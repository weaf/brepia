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

const WRITE_FIXTURES =
  process.env.BREPIA_WRITE_MULTILOOP_RHINO_FIXTURES === '1';
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  process.env.BREPIA_MULTILOOP_RHINO_FIXTURE_DIR ??
    'test-results/multiloop-rhino-acceptance',
);
const FILE_STEM = 'multiloop-extrude-plate';
const SOURCE_REVISION_ID =
  'multiloop-extrude-host-acceptance-2026-09-12';

function multiLoopProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'multiLoopHostPlate',
    name: 'Multi-loop host plate',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'width',
        label: 'Plate width',
        type: 'number',
        unit: 'mm',
        default: 100,
        min: 80,
        max: 140,
        step: 10,
      },
      {
        id: 'margin',
        label: 'Right-hole margin',
        type: 'number',
        unit: 'mm',
        default: 35,
        min: 30,
        max: 50,
        step: 5,
      },
      {
        id: 'holeRadius',
        label: 'Right-hole radius',
        type: 'number',
        unit: 'mm',
        default: 7,
        min: 5,
        max: 12,
        step: 1,
      },
    ],
    nodes: [
      {
        id: 'plate',
        type: 'extrude',
        axis: 'z',
        depth: 8,
        profile: {
          type: 'rectangle',
          width: { parameter: 'width' },
          height: 70,
          holes: [
            {
              loop: { type: 'circle', radius: { parameter: 'holeRadius' } },
              offsetU: {
                op: 'sub',
                args: [
                  { op: 'div', args: [{ parameter: 'width' }, 2] },
                  { parameter: 'margin' },
                ],
              },
              offsetV: 0,
            },
            {
              loop: {
                type: 'closedPolyline',
                points: [
                  { u: -5, v: -4 },
                  { u: 5, v: -4 },
                  { u: 5, v: 4 },
                  { u: -5, v: 4 },
                ],
              },
              offsetU: -20,
              offsetV: 0,
            },
          ],
        },
      },
    ],
    resultNodeId: 'plate',
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('bounded multi-loop installed Rhino 8 acceptance fixture', () => {
  it('compiles and strictly validates a fresh multi-hole Item-access GHX fixture', async () => {
    const project = multiLoopProject();
    const contract = createBrepGrasshopperContract({
      project,
      sourceRevisionId: SOURCE_REVISION_ID,
    });
    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      contract,
      'generated',
    );

    assert.equal(validation.accepted, true, JSON.stringify(validation.diagnostics));
    assert.deepEqual(validation.diagnostics, []);
    assert.deepEqual(validation.parameters, {
      width: 100,
      margin: 35,
      holeRadius: 7,
    });
    assert.equal(contract.interface.outputs[0]?.id, 'result');
    assert.equal(contract.interface.outputs[0]?.access, 'item');
    assert.equal(resultOutputAccess(ghx), '0');
    assert.match(ghx, /719467e6-7cf5-4848-99b0-c5dd57e5442c/i);

    const node = project.nodes[0];
    assert.ok(node && node.type === 'extrude');
    assert.equal(node.profile.holes?.length, 2);
    assert.equal(node.profile.holes?.[0]?.loop.type, 'circle');
    assert.equal(node.profile.holes?.[1]?.loop.type, 'closedPolyline');

    const manifest = {
      file: `${FILE_STEM}.ghx`,
      savedFile: `${FILE_STEM}-host-saved.ghx`,
      projectId: project.id,
      sourceRevisionId: SOURCE_REVISION_ID,
      resultAccess: 'item',
      expectedBoundsAtDefaults: {
        min: [-50, -35, -4],
        max: [50, 35, 4],
      },
      acceptanceEdit:
        'Fresh-open and solve. Change Plate width 100 -> 120, Right-hole margin 35 -> 40, and Right-hole radius 7 -> 9. Confirm the outer plate widens and the expression-backed circular hole moves while the closed-polyline hole remains. Save, close Grasshopper/Rhino, reopen the saved GHX, solve again, and return the saved GHX for strict validation.',
      expectedBoundsAfterEdit: {
        min: [-60, -35, -4],
        max: [60, 35, 4],
      },
      expectedSavedParameters: {
        width: 120,
        margin: 40,
        holeRadius: 9,
      },
      requiredHostChecks: [
        'fresh GHX opens without repair prompts',
        'solution produces exactly one solid Brep Result item',
        'both inner holes are visibly present',
        'parameter perturbation visibly changes geometry',
        'save -> close -> reopen -> solve preserves the result',
        'returned GHX passes strict parameter-only validation',
      ],
    };

    if (WRITE_FIXTURES) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUTPUT_DIR, `${FILE_STEM}.ghx`), ghx);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${FILE_STEM}.brepia-grasshopper.json`),
        serializeBrepGrasshopperContract(contract),
      );
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      console.log(`Multi-loop Rhino acceptance fixture written to ${OUTPUT_DIR}`);
    }

    assert.equal(manifest.resultAccess, 'item');
    assert.deepEqual(manifest.expectedSavedParameters, {
      width: 120,
      margin: 40,
      holeRadius: 9,
    });
  });

  it('strictly validates a Rhino-saved parameter-only GHX when requested', async () => {
    const savedDir = process.env.BREPIA_MULTILOOP_RHINO_SAVED_DIR;
    if (!savedDir) return;

    const project = multiLoopProject();
    const contract = createBrepGrasshopperContract({
      project,
      sourceRevisionId: SOURCE_REVISION_ID,
    });
    const savedPath = path.resolve(
      process.cwd(),
      savedDir,
      `${FILE_STEM}-host-saved.ghx`,
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
    assert.deepEqual(validation.parameters, {
      width: 120,
      margin: 40,
      holeRadius: 9,
    });
    assert.equal(resultOutputAccess(savedGhx), '0');
  });
});
