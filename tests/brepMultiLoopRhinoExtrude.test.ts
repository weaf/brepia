import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepProject } from '../shared/brepProject.ts';

function multiLoopProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'multiLoopRhino',
    name: 'Multi-loop Rhino',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 100,
      },
      {
        id: 'margin',
        label: 'Margin',
        type: 'number',
        unit: 'mm',
        default: 30,
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
              loop: { type: 'circle', radius: 7 },
              offsetU: {
                op: 'sub',
                args: [
                  {
                    op: 'div',
                    args: [{ parameter: 'width' }, 2],
                  },
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

function contract(project: BrepProject) {
  return createBrepGrasshopperContract({
    project,
    sourceRevisionId: 'multi-loop-rhino-test',
  });
}

describe('bounded multi-loop Rhino extrusion compiler', () => {
  it('creates one planar region with explicit inner loops and no hidden cutter booleans', async () => {
    const plan = await createBrepGrasshopperRhinoScriptPlan(
      contract(multiLoopProject()),
    );

    assert.match(plan.source, /brepiaNode0ProfileHole0OffsetU/);
    assert.match(
      plan.source,
      /brepia_sub\(brepia_div\(brepia_scalar\(Width\), 2\), brepia_scalar\(Margin\)\)/,
    );
    assert.match(plan.source, /brepiaNode0ProfileHole1Points/);
    assert.match(
      plan.source,
      /rg\.Brep\.CreatePlanarBreps\(\[brepiaNode0Profile, brepiaNode0ProfileHole0, brepiaNode0ProfileHole1\], brepiaTolerance\)/,
    );
    assert.match(plan.source, /Faces\.Count != 1 or brepiaNode0Region\.Loops\.Count != 3/);
    assert.match(
      plan.source,
      /brepiaNode0Region\.Faces\[0\]\.CreateExtrusion\(brepiaNode0Path, True\)/,
    );
    assert.match(plan.source, /not brepiaNode0\.IsSolid/);
    assert.doesNotMatch(plan.source, /CreateBooleanDifference/);
  });

  it('keeps legacy single-loop extrusion generation unchanged', async () => {
    const project = multiLoopProject();
    const node = project.nodes[0];
    assert.ok(node && node.type === 'extrude');
    node.profile = { type: 'rectangle', width: { parameter: 'width' }, height: 70 };
    project.parameters = project.parameters.filter(
      (parameter) => parameter.id !== 'margin',
    );

    const plan = await createBrepGrasshopperRhinoScriptPlan(contract(project));
    assert.match(plan.source, /rg\.Extrusion\.Create\(/);
    assert.doesNotMatch(plan.source, /CreatePlanarBreps/);
  });

  it('embeds the multi-loop source into a strict executable GHX without changing the returned-GHX boundary', async () => {
    const sourceContract = contract(multiLoopProject());
    const plan = await createBrepGrasshopperRhinoScriptPlan(sourceContract);
    const ghx = await compileBrepGrasshopperExecutableGhx(sourceContract);
    const validation = await validateBrepGrasshopperExecutableGhx(ghx.ghx);

    assert.equal(validation.sourceSha256, plan.sourceSha256);
    assert.equal(validation.projectId, 'multiLoopRhino');
    assert.match(ghx.ghx, /CreatePlanarBreps/);
  });
});
