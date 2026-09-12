import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepProject } from '../shared/brepProject.ts';

function rectangularProject(resultNodeId = 'pattern'): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3cRhinoPattern',
    name: 'M3C Rhino rectangular pattern',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'rectangularPattern',
        input: 'body',
        axisA: 'x',
        axisB: 'y',
        countA: 2,
        countB: 3,
        spacingA: 20,
        spacingB: 30,
      },
      { id: 'base', type: 'box', width: 120, depth: 120, height: 20 },
      { id: 'cut', type: 'subtract', base: 'base', tools: ['pattern'] },
    ],
    resultNodeId,
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  return ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  )?.[1];
}

describe('M3C Rhino/GHX rectangular-pattern host contract', () => {
  it('emits row-major A-outer/B-inner loops and separate translated Breps', async () => {
    const contract = createBrepGrasshopperContract({
      project: rectangularProject(),
      sourceRevisionId: 'm3c-rhino-pattern',
    });
    assert.equal(contract.interface.outputs[0]?.access, 'list');
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);
    assert.match(plan.source, /for brepiaNode\d+A in range\(2\):\s+for brepiaNode\d+B in range\(3\):/s);
    assert.match(plan.source, /DuplicateBrep\(\)/);
    assert.match(plan.source, /rg\.Transform\.Translation\(/);
    assert.match(
      plan.source,
      /Result = \[brepia_place_brep\(brepiaResultItem, brepiaTransform\) for brepiaResultItem in brepiaNode\d+\]/,
    );
    assert.doesNotMatch(plan.source, /CreateBooleanUnion/);
  });

  it('expands a rectangular pattern subtract tool in list order', async () => {
    const contract = createBrepGrasshopperContract({
      project: rectangularProject('cut'),
      sourceRevisionId: 'm3c-rhino-cutters',
    });
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);
    assert.match(plan.source, /for brepiaNode\d+Tool0 in brepiaNode\d+:/);
    assert.match(plan.source, /CreateBooleanDifference\(brepiaNode\d+, brepiaNode\d+Tool0, brepiaTolerance\)/);
  });

  it('persists rectangular Result as List access and validates generated GHX', async () => {
    const contract = createBrepGrasshopperContract({
      project: rectangularProject(),
      sourceRevisionId: 'm3c-rhino-ghx',
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

  it('rejects rectangular Result access tampering from List to Item', async () => {
    const contract = createBrepGrasshopperContract({
      project: rectangularProject(),
      sourceRevisionId: 'm3c-rhino-tamper',
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
