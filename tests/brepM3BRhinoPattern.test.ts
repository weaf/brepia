import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepProject } from '../shared/brepProject.ts';

function patternProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'patternProject',
    name: 'Linear pattern',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'spacing',
        label: 'Spacing',
        type: 'number',
        unit: 'mm',
        default: 25,
        min: 1,
        max: 100,
      },
    ],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'linearPattern',
        input: 'body',
        axis: 'x',
        count: 3,
        spacing: { parameter: 'spacing' },
      },
    ],
    resultNodeId: 'pattern',
  };
}

function subtractPatternProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'patternCutProject',
    name: 'Pattern cutters',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [],
    nodes: [
      { id: 'base', type: 'box', width: 100, depth: 30, height: 20 },
      { id: 'cutter', type: 'cylinder', radius: 3, height: 40 },
      {
        id: 'cutters',
        type: 'linearPattern',
        input: 'cutter',
        axis: 'x',
        count: 4,
        spacing: 15,
      },
      { id: 'cut', type: 'subtract', base: 'base', tools: ['cutters'] },
    ],
    resultNodeId: 'cut',
  };
}

function boxProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'singleProject',
    name: 'Single result',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [],
    nodes: [{ id: 'body', type: 'box', width: 10, depth: 10, height: 10 }],
    resultNodeId: 'body',
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('M3B Rhino linear-pattern host contract', () => {
  it('compiles an ordered single-axis instance list without fusing it', async () => {
    const contract = createBrepGrasshopperContract({
      project: patternProject(),
      sourceRevisionId: 'm3b-pattern',
    });
    assert.equal(contract.interface.outputs[0]?.id, 'result');
    assert.equal(contract.interface.outputs[0]?.access, 'list');

    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);
    assert.match(plan.source, /Spacing = float\(brepia_scalar\(Spacing\)\)/);
    assert.match(plan.source, /if brepiaNode\d+Spacing == 0\.0:/);
    assert.match(plan.source, /for brepiaNode\d+Index in range\(3\):/);
    assert.match(
      plan.source,
      /rg\.Vector3d\(brepiaNode\d+Index \* brepiaNode\d+Spacing, 0, 0\)/,
    );
    assert.match(
      plan.source,
      /Result = \[brepia_place_brep\(brepiaResultItem, brepiaTransform\) for brepiaResultItem in brepiaNode\d+\]/,
    );
    assert.doesNotMatch(plan.source, /CreateBooleanUnion/);
  });

  it('expands a pattern tool into ordered Rhino BooleanDifference cutters', async () => {
    const contract = createBrepGrasshopperContract({
      project: subtractPatternProject(),
      sourceRevisionId: 'm3b-pattern-cutters',
    });
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

    assert.match(plan.source, /for brepiaNode\d+Tool0 in brepiaNode\d+:/);
    assert.match(
      plan.source,
      /CreateBooleanDifference\(brepiaNode\d+, brepiaNode\d+Tool0, brepiaTolerance\)/,
    );
    assert.match(plan.source, /Result = brepia_place_brep\(brepiaNode\d+, brepiaTransform\)/);
  });

  it('persists Result as List access and validates the generated GHX', async () => {
    const contract = createBrepGrasshopperContract({
      project: patternProject(),
      sourceRevisionId: 'm3b-pattern-ghx',
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

  it('rejects a returned pattern GHX whose Result access was changed to Item', async () => {
    const contract = createBrepGrasshopperContract({
      project: patternProject(),
      sourceRevisionId: 'm3b-pattern-ghx-tamper',
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

  it('preserves Item access for ordinary single-result GHX', async () => {
    const contract = createBrepGrasshopperContract({
      project: boxProject(),
      sourceRevisionId: 'm3b-single-regression',
    });
    assert.equal(contract.interface.outputs[0]?.access, 'item');

    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    assert.equal(resultOutputAccess(ghx), '0');
    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      contract,
      'generated',
    );
    assert.equal(validation.accepted, true);
  });
});
