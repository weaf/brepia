import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

type MutableFixture = Record<string, unknown> & {
  source: Record<string, unknown> & {
    nodes: Array<Record<string, unknown>>;
    resultNodeId: string;
  };
};

function cloneFixture(): MutableFixture {
  return JSON.parse(JSON.stringify(fixture)) as MutableFixture;
}

describe('C2.5-D Rhino/native disjoint subtraction parity', () => {
  it('guards Rhino boolean difference with an accurate tolerance-aware bounding-box disjoint proof', async () => {
    const project = cloneFixture();
    const body = project.source.nodes[0];
    assert.ok(body);

    project.source.nodes = [
      body,
      { id: 'cutter', type: 'box', width: 100, depth: 100, height: 100 },
      {
        id: 'farCutter',
        type: 'transform',
        input: 'cutter',
        translate: [100000, 0, 0],
      },
      {
        id: 'bodyMinusFarCutter',
        type: 'subtract',
        base: 'body',
        tools: ['farCutter'],
      },
    ];
    project.source.resultNodeId = 'bodyMinusFarCutter';

    const script = await createBrepGrasshopperRhinoScriptPlan(project);

    assert.match(
      script.source,
      /def brepia_bounds_disjoint\(first, second, tolerance\):/,
    );
    assert.match(script.source, /first_box = first\.GetBoundingBox\(True\)/);
    assert.match(script.source, /second_box = second\.GetBoundingBox\(True\)/);
    assert.match(
      script.source,
      /if not first_box\.IsValid or not second_box\.IsValid:\n        return False/,
    );
    assert.match(script.source, /tolerance = max\(0\.0, float\(tolerance\)\)/);
    assert.match(
      script.source,
      /first_box\.Max\.X < second_box\.Min\.X - tolerance/,
    );
    assert.match(
      script.source,
      /second_box\.Max\.Z < first_box\.Min\.Z - tolerance/,
    );

    const guard =
      'brepiaNode3Disjoint0 = brepia_bounds_disjoint(brepiaNode3, brepiaNode2, brepiaTolerance)';
    const conditional = 'if not brepiaNode3Disjoint0:';
    const boolean =
      '    brepiaNode3Parts0 = rg.Brep.CreateBooleanDifference(brepiaNode3, brepiaNode2, brepiaTolerance)';
    const failure =
      '        raise RuntimeError("Rhino boolean difference for Brepia node bodyMinusFarCutter did not produce exactly one Brep.")';

    assert.ok(script.source.includes(guard));
    assert.ok(script.source.includes(conditional));
    assert.ok(script.source.includes(boolean));
    assert.ok(script.source.includes(failure));
    assert.ok(script.source.indexOf(guard) < script.source.indexOf(conditional));
    assert.ok(script.source.indexOf(conditional) < script.source.indexOf(boolean));
    assert.ok(script.source.indexOf(boolean) < script.source.indexOf(failure));
  });

  it('keeps subtract tools ordered and rechecks disjointness against the current accumulated result', async () => {
    const project = cloneFixture();
    const body = project.source.nodes[0];
    assert.ok(body);

    project.source.nodes = [
      body,
      { id: 'firstCutter', type: 'box', width: 100, depth: 100, height: 100 },
      { id: 'secondCutter', type: 'box', width: 80, depth: 80, height: 80 },
      {
        id: 'bodyMinusTwoCutters',
        type: 'subtract',
        base: 'body',
        tools: ['firstCutter', 'secondCutter'],
      },
    ];
    project.source.resultNodeId = 'bodyMinusTwoCutters';

    const script = await createBrepGrasshopperRhinoScriptPlan(project);
    const firstGuard =
      'brepiaNode3Disjoint0 = brepia_bounds_disjoint(brepiaNode3, brepiaNode1, brepiaTolerance)';
    const firstUpdate = '    brepiaNode3 = brepiaNode3Parts0[0]';
    const secondGuard =
      'brepiaNode3Disjoint1 = brepia_bounds_disjoint(brepiaNode3, brepiaNode2, brepiaTolerance)';
    const secondUpdate = '    brepiaNode3 = brepiaNode3Parts1[0]';

    assert.ok(script.source.includes(firstGuard));
    assert.ok(script.source.includes(firstUpdate));
    assert.ok(script.source.includes(secondGuard));
    assert.ok(script.source.includes(secondUpdate));
    assert.ok(script.source.indexOf(firstGuard) < script.source.indexOf(firstUpdate));
    assert.ok(script.source.indexOf(firstUpdate) < script.source.indexOf(secondGuard));
    assert.ok(script.source.indexOf(secondGuard) < script.source.indexOf(secondUpdate));
  });
});
