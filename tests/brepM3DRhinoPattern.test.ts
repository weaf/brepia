import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepProject } from '../shared/brepProject.ts';

function circularProject(resultNodeId = 'pattern'): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3dRhinoPattern',
    name: 'M3D Rhino circular pattern',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      {
        id: 'radius',
        label: 'Pattern radius',
        type: 'number',
        unit: 'mm',
        default: 30,
        min: 10,
        max: 80,
      },
      {
        id: 'angleStep',
        label: 'Angle step',
        type: 'number',
        unit: 'deg',
        default: 60,
        min: 15,
        max: 60,
      },
    ],
    nodes: [
      { id: 'seed', type: 'box', width: 10, depth: 6, height: 4 },
      {
        id: 'seedAt',
        type: 'transform',
        input: 'seed',
        translate: [
          { op: 'add', args: [5, { parameter: 'radius' }] },
          -3,
          0,
        ],
      },
      {
        id: 'pattern',
        type: 'circularPattern',
        input: 'seedAt',
        axis: 'z',
        center: [5, -10, 0],
        count: 6,
        angleStepDeg: { parameter: 'angleStep' },
      },
      { id: 'base', type: 'box', width: 240, depth: 240, height: 20 },
      { id: 'cutter', type: 'cylinder', radius: 4, height: 40 },
      {
        id: 'cutterAt',
        type: 'transform',
        input: 'cutter',
        translate: [
          { op: 'add', args: [20, { parameter: 'radius' }] },
          -15,
          0,
        ],
      },
      {
        id: 'cutters',
        type: 'circularPattern',
        input: 'cutterAt',
        axis: 'z',
        center: [20, -15, 0],
        count: 6,
        angleStepDeg: { parameter: 'angleStep' },
      },
      { id: 'cut', type: 'subtract', base: 'base', tools: ['cutters'] },
    ],
    resultNodeId,
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  return ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  )?.[1];
}

describe('M3D Rhino/GHX circular-pattern host contract', () => {
  it('emits rigid right-hand rotations about the non-origin canonical center', async () => {
    const contract = createBrepGrasshopperContract({
      project: circularProject(),
      sourceRevisionId: 'm3d-rhino-pattern',
    });
    assert.equal(contract.interface.outputs[0]?.access, 'list');
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);
    assert.match(plan.source, /AngleStepDeg = float\(brepia_scalar\(AngleStep\)\)/);
    assert.match(plan.source, /Center = rg\.Point3d\(5, -10, 0\)/);
    assert.match(plan.source, /Axis = rg\.Vector3d\(0, 0, 1\)/);
    assert.match(plan.source, /for brepiaNode\d+Index in range\(6\):/);
    assert.match(plan.source, /DuplicateBrep\(\)/);
    assert.match(
      plan.source,
      /rg\.Transform\.Rotation\(math\.radians\(brepiaNode\d+Index \* brepiaNode\d+AngleStepDeg\), brepiaNode\d+Axis, brepiaNode\d+Center\)/,
    );
    assert.match(
      plan.source,
      /Result = \[brepia_place_brep\(brepiaResultItem, brepiaTransform\) for brepiaResultItem in brepiaNode\d+\]/,
    );
    assert.doesNotMatch(plan.source, /CreateBooleanUnion/);
  });

  it('expands circular pattern subtract tools in canonical list order', async () => {
    const contract = createBrepGrasshopperContract({
      project: circularProject('cut'),
      sourceRevisionId: 'm3d-rhino-cutters',
    });
    assert.equal(contract.interface.outputs[0]?.access, 'item');
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);
    assert.match(plan.source, /for brepiaNode\d+Tool0 in brepiaNode\d+:/);
    assert.match(
      plan.source,
      /CreateBooleanDifference\(brepiaNode\d+, brepiaNode\d+Tool0, brepiaTolerance\)/,
    );
  });

  it('persists circular Result as List access and validates generated GHX', async () => {
    const contract = createBrepGrasshopperContract({
      project: circularProject(),
      sourceRevisionId: 'm3d-rhino-ghx',
    });
    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    assert.equal(resultOutputAccess(ghx), '1');
    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      contract,
      'generated',
    );
    assert.equal(validation.accepted, true);
    assert.deepEqual(validation.diagnostics, []);
  });

  it('rejects circular Result access tampering from List to Item', async () => {
    const contract = createBrepGrasshopperContract({
      project: circularProject(),
      sourceRevisionId: 'm3d-rhino-tamper',
    });
    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    const changed = ghx.replace(
      /(<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">)1(<\/item>)/,
      (_match, prefix: string, suffix: string) => `${prefix}0${suffix}`,
    );
    assert.notEqual(changed, ghx);
    const validation = await validateBrepGrasshopperExecutableGhx(
      changed,
      contract,
      'returned',
    );
    assert.equal(validation.accepted, false);
    assert.ok(
      validation.diagnostics.some(
        (entry) => entry.code === 'script_output_access_changed',
      ),
    );
  });
});
