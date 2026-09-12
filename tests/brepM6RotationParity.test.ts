import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepProject, BrepVector3 } from '../shared/brepProject.ts';

const placement = {
  origin: [0, 0, 0] as BrepVector3,
  xAxis: [1, 0, 0] as BrepVector3,
  yAxis: [0, 1, 0] as BrepVector3,
};

function projectWithTransform(
  rotateDeg: BrepVector3,
  translate: BrepVector3 = [0, 0, 0],
): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm6RotationParity',
    name: 'M6 rotation parity',
    units: 'mm',
    placement,
    parameters: [],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 20, height: 30 },
      {
        id: 'placed',
        type: 'transform',
        input: 'body',
        translate,
        rotateDeg,
      },
    ],
    resultNodeId: 'placed',
  };
}

function contract(project: BrepProject) {
  return createBrepGrasshopperContract({
    project,
    sourceRevisionId: 'm6-rotation-parity-test',
  });
}

describe('M6 non-zero rotation parity', () => {
  it('compiles X/Y/Z rotations with canonical Intrinsic XYZ matrix order', async () => {
    const cases: BrepVector3[] = [
      [90, 0, 0],
      [0, 90, 0],
      [0, 0, 90],
    ];

    for (const angles of cases) {
      const script = await createBrepGrasshopperRhinoScriptPlan(
        contract(projectWithTransform(angles)),
      );
      assert.match(script.source, new RegExp(`brepiaNode1RotationXDeg = float\\(${angles[0]}\\)`));
      assert.match(script.source, new RegExp(`brepiaNode1RotationYDeg = float\\(${angles[1]}\\)`));
      assert.match(script.source, new RegExp(`brepiaNode1RotationZDeg = float\\(${angles[2]}\\)`));
      assert.match(
        script.source,
        /brepiaNode1Rotation = brepiaNode1RotationX \* brepiaNode1RotationY \* brepiaNode1RotationZ/,
      );
    }
  });

  it('locks asymmetric multi-axis rotation and translation composition order', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(
      contract(projectWithTransform([30, 20, 10], [7, 11, 13])),
    );

    const rx = script.source.indexOf('brepiaNode1RotationX =');
    const ry = script.source.indexOf('brepiaNode1RotationY =');
    const rz = script.source.indexOf('brepiaNode1RotationZ =');
    const combined = script.source.indexOf(
      'brepiaNode1Rotation = brepiaNode1RotationX * brepiaNode1RotationY * brepiaNode1RotationZ',
    );
    const translation = script.source.indexOf(
      'brepiaNode1Translation = rg.Transform.Translation(rg.Vector3d(7, 11, 13))',
    );
    const transform = script.source.indexOf(
      'brepiaNode1Transform = brepiaNode1Translation * brepiaNode1Rotation',
    );

    assert.ok(rx >= 0 && ry > rx && rz > ry);
    assert.ok(combined > rz);
    assert.ok(translation > combined);
    assert.ok(transform > translation);
    assert.match(script.source, /brepiaNode1\.Transform\(brepiaNode1Transform\)/);
  });

  it('keeps degree parameters and bounded M1 expressions dynamic in Rhino source', async () => {
    const project: BrepProject = {
      schemaVersion: 1,
      id: 'm6DynamicRotation',
      name: 'M6 dynamic rotation',
      units: 'mm',
      placement,
      parameters: [
        {
          id: 'rx',
          label: 'Rotate X',
          type: 'number',
          unit: 'deg',
          default: 15,
          min: -180,
          max: 180,
          step: 5,
        },
        {
          id: 'ryBase',
          label: 'Rotate Y base',
          type: 'number',
          unit: 'deg',
          default: 20,
          min: -180,
          max: 180,
          step: 5,
        },
      ],
      nodes: [
        { id: 'body', type: 'box', width: 10, depth: 20, height: 30 },
        {
          id: 'placed',
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
      resultNodeId: 'placed',
    };

    const sourceContract = contract(project);
    const script = await createBrepGrasshopperRhinoScriptPlan(sourceContract);
    assert.match(
      script.source,
      /brepiaNode1RotationXDeg = float\(brepia_scalar\(Rx\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1RotationYDeg = float\(brepia_add\(brepia_scalar\(RyBase\), 5\)\)/,
    );
    assert.match(script.source, /brepiaNode1RotationZDeg = float\(10\)/);

    const ghx = await compileBrepGrasshopperExecutableGhx(sourceContract);
    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      sourceContract,
      'generated',
    );
    assert.equal(validation.accepted, true, JSON.stringify(validation.diagnostics));
    assert.deepEqual(validation.parameters, { rx: 15, ryBase: 20 });
    assert.equal(sourceContract.interface.outputs[0]?.access, 'item');
  });

  it('keeps zero rotation on the same composed transform path', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(
      contract(projectWithTransform([0, 0, 0], [5, 0, 0])),
    );

    assert.match(script.source, /brepiaNode1RotationXDeg = float\(0\)/);
    assert.match(script.source, /brepiaNode1RotationYDeg = float\(0\)/);
    assert.match(script.source, /brepiaNode1RotationZDeg = float\(0\)/);
    assert.match(
      script.source,
      /brepiaNode1Transform = brepiaNode1Translation \* brepiaNode1Rotation/,
    );
  });
});
