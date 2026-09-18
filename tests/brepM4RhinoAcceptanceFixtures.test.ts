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

const WRITE_FIXTURES = process.env.BREPIA_WRITE_M4_RHINO_FIXTURES === '1';
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.BREPIA_M4_RHINO_FIXTURE_DIR ?? 'test-results/m4-rhino-acceptance',
);

const placement = {
  origin: [0, 0, 0] as [number, number, number],
  xAxis: [1, 0, 0] as [number, number, number],
  yAxis: [0, 1, 0] as [number, number, number],
};

function rectangleProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm4HostRectangleZ',
    name: 'M4 host rectangle Z',
    units: 'mm',
    placement,
    parameters: [
      {
        id: 'profileWidth',
        label: 'Profile width',
        type: 'number',
        unit: 'mm',
        default: 60,
        min: 20,
        max: 100,
        step: 10,
      },
      {
        id: 'extrudeDepth',
        label: 'Extrusion depth',
        type: 'number',
        unit: 'mm',
        default: 30,
        min: 10,
        max: 60,
        step: 5,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: {
          type: 'rectangle',
          width: { parameter: 'profileWidth' },
          height: 20,
        },
        axis: 'z',
        depth: { parameter: 'extrudeDepth' },
      },
    ],
    resultNodeId: 'body',
  };
}

function circleProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm4HostCircleX',
    name: 'M4 host circle X',
    units: 'mm',
    placement,
    parameters: [
      {
        id: 'radius',
        label: 'Radius',
        type: 'number',
        unit: 'mm',
        default: 12,
        min: 5,
        max: 30,
        step: 1,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: { type: 'circle', radius: { parameter: 'radius' } },
        axis: 'x',
        depth: 24,
      },
    ],
    resultNodeId: 'body',
  };
}

function polylineProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm4HostPolylineY',
    name: 'M4 host polyline Y',
    units: 'mm',
    placement,
    parameters: [
      {
        id: 'reach',
        label: 'Profile reach',
        type: 'number',
        unit: 'mm',
        default: 30,
        min: 20,
        max: 50,
        step: 5,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: {
          type: 'closedPolyline',
          points: [
            { u: -20, v: -10 },
            { u: 20, v: -10 },
            { u: 20, v: 10 },
            { u: 0, v: 10 },
            { u: 0, v: { parameter: 'reach' } },
            { u: -20, v: { parameter: 'reach' } },
          ],
        },
        axis: 'y',
        depth: 30,
      },
    ],
    resultNodeId: 'body',
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
};

const fixtures: AcceptanceFixture[] = [
  {
    fileStem: 'm4-rectangle-z',
    project: rectangleProject(),
    expectedBounds: { min: [-30, -10, -15], max: [30, 10, 15] },
    acceptanceEdit:
      'Change Profile width 60 -> 80 and Extrusion depth 30 -> 40; geometry must recompute and remain one Brep.',
    expectedSavedParameters: { profileWidth: 80, extrudeDepth: 40 },
  },
  {
    fileStem: 'm4-circle-x',
    project: circleProject(),
    expectedBounds: { min: [-12, -12, -12], max: [12, 12, 12] },
    acceptanceEdit:
      'Change Radius 12 -> 16; circular profile must recompute while extrusion remains centered on X.',
    expectedSavedParameters: { radius: 16 },
  },
  {
    fileStem: 'm4-polyline-y',
    project: polylineProject(),
    expectedBounds: { min: [-10, -15, -20], max: [30, 15, 20] },
    acceptanceEdit:
      'Change Profile reach 30 -> 40; the asymmetric profile must extend in +X while extrusion remains centered on Y.',
    expectedSavedParameters: { reach: 40 },
  },
];

function sourceRevisionId(fixture: AcceptanceFixture): string {
  return `m4-host-acceptance-${fixture.fileStem}-2026-09-11`;
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('M4 installed Rhino 8 acceptance fixtures', () => {
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

      const node = fixture.project.nodes[0];
      assert.ok(node && node.type === 'extrude');
      manifest.push({
        file: `${fixture.fileStem}.ghx`,
        savedFile: `${fixture.fileStem}-host-saved.ghx`,
        projectId: fixture.project.id,
        sourceRevisionId: revisionId,
        profileType: node.profile.type,
        axis: node.axis,
        resultAccess: 'item',
        expectedBoundsAtDefaults: fixture.expectedBounds,
        acceptanceEdit: fixture.acceptanceEdit,
        expectedSavedParameters: fixture.expectedSavedParameters,
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
      console.log(`M4 Rhino acceptance fixtures written to ${OUTPUT_DIR}`);
    }

    assert.deepEqual(
      manifest.map((entry) => [entry.profileType, entry.axis, entry.resultAccess]),
      [
        ['rectangle', 'z', 'item'],
        ['circle', 'x', 'item'],
        ['closedPolyline', 'y', 'item'],
      ],
    );
  });

  it('strictly validates Rhino-saved parameter-only acceptance files when requested', async () => {
    const savedDir = process.env.BREPIA_M4_RHINO_SAVED_DIR;
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
