import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

import {
  createBrepGrasshopperContract,
  serializeBrepGrasshopperContract,
} from '../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject } from '../shared/brepProject.ts';

const WRITE_FIXTURES = process.env.BREPIA_WRITE_M6_RHINO_FIXTURES === '1';
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.BREPIA_M6_RHINO_FIXTURE_DIR ?? 'test-results/m6-rhino-acceptance',
);

const placement = {
  origin: [0, 0, 0] as [number, number, number],
  xAxis: [1, 0, 0] as [number, number, number],
  yAxis: [0, 1, 0] as [number, number, number],
};

function singleAxisProject(
  id: string,
  name: string,
  rotateDeg: [number, number, number],
): BrepProject {
  return {
    schemaVersion: 1,
    id,
    name,
    units: 'mm',
    placement,
    parameters: [],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 20, height: 30 },
      {
        id: 'rotated',
        type: 'transform',
        input: 'body',
        rotateDeg,
      },
    ],
    resultNodeId: 'rotated',
  };
}

function intrinsicXyzProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm6HostIntrinsicXyz',
    name: 'M6 host intrinsic XYZ',
    units: 'mm',
    placement,
    parameters: [
      {
        id: 'rx',
        label: 'Rotate X',
        type: 'number',
        unit: 'deg',
        default: 30,
        min: -180,
        max: 180,
        step: 5,
      },
      {
        id: 'ryBase',
        label: 'Rotate Y base',
        type: 'number',
        unit: 'deg',
        default: 15,
        min: -180,
        max: 180,
        step: 5,
      },
    ],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 20, height: 30 },
      {
        id: 'rotated',
        type: 'transform',
        input: 'body',
        translate: [7, 11, 13],
        rotateDeg: [
          { parameter: 'rx' },
          { op: 'add', args: [{ parameter: 'ryBase' }, 5] },
          10,
        ],
      },
    ],
    resultNodeId: 'rotated',
  };
}

type AcceptanceFixture = {
  fileStem: string;
  project: BrepProject;
  expectedBounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  acceptanceEdit: string;
  expectedSavedParameters: Record<string, number>;
  expectedBoundsAfterEdit?: {
    min: [number, number, number];
    max: [number, number, number];
  };
};

const fixtures: AcceptanceFixture[] = [
  {
    fileStem: 'm6-rotate-x90',
    project: singleAxisProject('m6HostRotateX90', 'M6 host rotate X 90', [90, 0, 0]),
    expectedBounds: { min: [-5, -15, -10], max: [5, 15, 10] },
    acceptanceEdit: 'No parameter edit required; verify the 10x20x30 source box is rotated +90 degrees about local X and Result is one Brep.',
    expectedSavedParameters: {},
  },
  {
    fileStem: 'm6-rotate-y90',
    project: singleAxisProject('m6HostRotateY90', 'M6 host rotate Y 90', [0, 90, 0]),
    expectedBounds: { min: [-15, -10, -5], max: [15, 10, 5] },
    acceptanceEdit: 'No parameter edit required; verify the 10x20x30 source box is rotated +90 degrees about local Y and Result is one Brep.',
    expectedSavedParameters: {},
  },
  {
    fileStem: 'm6-rotate-z90',
    project: singleAxisProject('m6HostRotateZ90', 'M6 host rotate Z 90', [0, 0, 90]),
    expectedBounds: { min: [-10, -5, -15], max: [10, 5, 15] },
    acceptanceEdit: 'No parameter edit required; verify the 10x20x30 source box is rotated +90 degrees about local Z and Result is one Brep.',
    expectedSavedParameters: {},
  },
  {
    fileStem: 'm6-intrinsic-xyz',
    project: intrinsicXyzProject(),
    expectedBounds: {
      min: [-4.38914415, -5.87340299, -5.66971729],
      max: [18.38914415, 27.87340299, 31.66971729],
    },
    acceptanceEdit:
      'Change Rotate X 30 -> 60 while Rotate Y base remains 15. The effective rotation becomes [60,20,10], geometry must recompute around the local origin before translation [7,11,13], and Result must remain one Brep.',
    expectedSavedParameters: { rx: 60, ryBase: 15 },
    expectedBoundsAfterEdit: {
      min: [-4.38914415, -7.50927286, -2.9634774],
      max: [18.38914415, 29.50927286, 28.9634774],
    },
  },
];

function sourceRevisionId(fixture: AcceptanceFixture): string {
  return `m6-host-acceptance-${fixture.fileStem}-2026-09-11`;
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('M6 installed Rhino 8 acceptance fixtures', () => {
  it('compiles and strictly validates fresh Item-access GHX fixtures', async () => {
    if (WRITE_FIXTURES) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const manifest: Array<Record<string, unknown>> = [];

    for (const fixture of fixtures) {
      const revisionId = sourceRevisionId(fixture);
      const contract = createBrepGrasshopperContract({
        project: fixture.project,
        sourceRevisionId: revisionId,
      });
      const ghx = await compileBrepGrasshopperExecutableGhx(contract);
      const validation = await validateBrepGrasshopperExecutableGhx(
        ghx,
        contract,
        'generated',
      );

      assert.equal(validation.accepted, true, JSON.stringify(validation.diagnostics));
      assert.deepEqual(validation.diagnostics, []);
      assert.equal(contract.interface.outputs[0]?.id, 'result');
      assert.equal(contract.interface.outputs[0]?.access, 'item');
      assert.equal(resultOutputAccess(ghx), '0');
      assert.match(ghx, /719467e6-7cf5-4848-99b0-c5dd57e5442c/i);

      manifest.push({
        file: `${fixture.fileStem}.ghx`,
        savedFile: `${fixture.fileStem}-host-saved.ghx`,
        projectId: fixture.project.id,
        sourceRevisionId: revisionId,
        resultAccess: 'item',
        expectedBoundsAtDefaults: fixture.expectedBounds,
        acceptanceEdit: fixture.acceptanceEdit,
        expectedSavedParameters: fixture.expectedSavedParameters,
        expectedBoundsAfterEdit: fixture.expectedBoundsAfterEdit ?? null,
      });

      if (WRITE_FIXTURES) {
        fs.writeFileSync(path.join(OUTPUT_DIR, `${fixture.fileStem}.ghx`), ghx);
        fs.writeFileSync(
          path.join(OUTPUT_DIR, `${fixture.fileStem}.brepia-grasshopper.json`),
          serializeBrepGrasshopperContract(contract),
        );
      }
    }

    if (WRITE_FIXTURES) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      console.log(`M6 Rhino acceptance fixtures written to ${OUTPUT_DIR}`);
    }

    assert.deepEqual(
      manifest.map((entry) => entry.resultAccess),
      ['item', 'item', 'item', 'item'],
    );
  });

  it('strictly validates Rhino-saved parameter-only acceptance files when requested', async () => {
    const savedDir = process.env.BREPIA_M6_RHINO_SAVED_DIR;
    if (!savedDir) return;

    for (const fixture of fixtures) {
      const contract = createBrepGrasshopperContract({
        project: fixture.project,
        sourceRevisionId: sourceRevisionId(fixture),
      });
      const savedPath = path.resolve(
        process.cwd(),
        savedDir,
        `${fixture.fileStem}-host-saved.ghx`,
      );
      const savedGhx = fs.readFileSync(savedPath, 'utf8');
      const validation = await validateBrepGrasshopperExecutableGhx(
        savedGhx,
        contract,
        'returned',
      );

      assert.equal(
        validation.accepted,
        true,
        `${path.basename(savedPath)}: ${JSON.stringify(validation.diagnostics)}`,
      );
      assert.deepEqual(validation.diagnostics, []);
      assert.deepEqual(validation.parameters, fixture.expectedSavedParameters);
      assert.equal(resultOutputAccess(savedGhx), '0');
    }
  });
});
