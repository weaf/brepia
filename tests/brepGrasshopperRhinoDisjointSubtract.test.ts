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

    const guard = /^(brepiaNode\d+)Disjoint0 = brepia_bounds_disjoint\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );
    const boolean = /^    (brepiaNode\d+)Parts0 = rg\.Brep\.CreateBooleanDifference\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );
    const failure =
      '        raise RuntimeError("Rhino boolean difference for Brepia node bodyMinusFarCutter did not produce exactly one Brep.")';

    assert.ok(guard);
    assert.ok(boolean);
    assert.equal(guard[1], guard[2]);
    assert.equal(boolean[1], boolean[2]);
    assert.equal(boolean[1], guard[1]);
    assert.equal(boolean[3], guard[3]);

    const conditional = `if not ${guard[1]}Disjoint0:`;
    assert.ok(script.source.includes(conditional));
    assert.ok(script.source.includes(failure));

    const guardOffset = script.source.indexOf(guard[0]);
    const conditionalOffset = script.source.indexOf(conditional);
    const booleanOffset = script.source.indexOf(boolean[0]);
    const failureOffset = script.source.indexOf(failure);
    assert.ok(guardOffset >= 0);
    assert.ok(conditionalOffset > guardOffset);
    assert.ok(booleanOffset > conditionalOffset);
    assert.ok(failureOffset > booleanOffset);
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
    const firstGuard = /^(brepiaNode\d+)Disjoint0 = brepia_bounds_disjoint\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );
    const secondGuard = /^(brepiaNode\d+)Disjoint1 = brepia_bounds_disjoint\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );

    assert.ok(firstGuard);
    assert.ok(secondGuard);
    assert.equal(firstGuard[1], firstGuard[2]);
    assert.equal(secondGuard[1], secondGuard[2]);
    assert.equal(firstGuard[1], secondGuard[1]);
    assert.notEqual(firstGuard[3], secondGuard[3]);

    const resultVariable = firstGuard[1];
    const firstUpdate = `    ${resultVariable} = ${resultVariable}Parts0[0]`;
    const secondUpdate = `    ${resultVariable} = ${resultVariable}Parts1[0]`;
    const firstBoolean = `    ${resultVariable}Parts0 = rg.Brep.CreateBooleanDifference(${resultVariable}, ${firstGuard[3]}, brepiaTolerance)`;
    const secondBoolean = `    ${resultVariable}Parts1 = rg.Brep.CreateBooleanDifference(${resultVariable}, ${secondGuard[3]}, brepiaTolerance)`;

    assert.ok(script.source.includes(firstBoolean));
    assert.ok(script.source.includes(firstUpdate));
    assert.ok(script.source.includes(secondBoolean));
    assert.ok(script.source.includes(secondUpdate));

    const firstGuardOffset = script.source.indexOf(firstGuard[0]);
    const firstBooleanOffset = script.source.indexOf(firstBoolean);
    const firstUpdateOffset = script.source.indexOf(firstUpdate);
    const secondGuardOffset = script.source.indexOf(secondGuard[0]);
    const secondBooleanOffset = script.source.indexOf(secondBoolean);
    const secondUpdateOffset = script.source.indexOf(secondUpdate);

    assert.ok(firstGuardOffset >= 0);
    assert.ok(firstBooleanOffset > firstGuardOffset);
    assert.ok(firstUpdateOffset > firstBooleanOffset);
    assert.ok(secondGuardOffset > firstUpdateOffset);
    assert.ok(secondBooleanOffset > secondGuardOffset);
    assert.ok(secondUpdateOffset > secondBooleanOffset);
  });
});