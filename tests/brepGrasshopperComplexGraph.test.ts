import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
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

function throughHoleFixture(): MutableFixture {
  const candidate = cloneFixture();
  const body = candidate.source.nodes.find((node) => node.id === 'body');
  assert.ok(body);

  candidate.source.nodes = [
    body,
    {
      id: 'hole',
      type: 'cylinder',
      radius: 60,
      height: 2600,
    },
    {
      id: 'positionedHole',
      type: 'transform',
      input: 'hole',
      translate: [200, 0, 0],
    },
    {
      id: 'bodyWithHole',
      type: 'subtract',
      base: 'body',
      tools: ['positionedHole'],
    },
  ];
  candidate.source.resultNodeId = 'bodyWithHole';
  return candidate;
}

describe('complex canonical BRep -> Rhino Python/GHX parity', () => {
  it('emits the current box -> cylinder -> translate -> subtract host candidate with centered primitives', async () => {
    const candidate = throughHoleFixture();
    const script = await createBrepGrasshopperRhinoScriptPlan(candidate);
    const ghx = await compileBrepGrasshopperExecutableGhx(candidate);

    assert.match(
      script.source,
      /rg\.Interval\(-brepiaNode\d+Width \/ 2\.0, brepiaNode\d+Width \/ 2\.0\)/,
    );
    assert.match(
      script.source,
      /rg\.Cylinder\(rg\.Circle\(rg\.Plane\.WorldXY, brepiaNode\d+Radius\), brepiaNode\d+Height\)/,
    );
    assert.match(
      script.source,
      /\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(0, 0, -brepiaNode\d+Height \/ 2\.0\)\)\)/,
    );
    assert.match(
      script.source,
      /\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(200, 0, 0\)\)\)/,
    );
    assert.match(
      script.source,
      /rg\.Brep\.CreateBooleanDifference\(brepiaNode\d+, brepiaNode\d+, brepiaTolerance\)/,
    );
    assert.match(
      script.source,
      /Result = brepia_place_brep\(brepiaNode\d+, brepiaTransform\)/,
    );

    assert.doesNotMatch(
      ghx,
      /<item name="NickName" type_name="gh_string" type_code="10">Plane<\/item>/,
    );
    assert.match(
      ghx,
      /<item name="NickName" type_name="gh_string" type_code="10">Height<\/item>/,
    );
    assert.match(
      ghx,
      /<item name="NickName" type_name="gh_string" type_code="10">Width<\/item>/,
    );
  });

  it('preserves canonical subtract tool order for multiple cutters', async () => {
    const candidate = cloneFixture();
    const body = candidate.source.nodes.find((node) => node.id === 'body');
    assert.ok(body);

    candidate.source.nodes = [
      body,
      { id: 'holeA', type: 'cylinder', radius: 45, height: 2600 },
      {
        id: 'positionedHoleA',
        type: 'transform',
        input: 'holeA',
        translate: [250, 0, 0],
      },
      { id: 'holeB', type: 'cylinder', radius: 35, height: 2600 },
      {
        id: 'positionedHoleB',
        type: 'transform',
        input: 'holeB',
        translate: [-250, 0, 0],
      },
      {
        id: 'bodyWithTwoHoles',
        type: 'subtract',
        base: 'body',
        tools: ['positionedHoleA', 'positionedHoleB'],
      },
    ];
    candidate.source.resultNodeId = 'bodyWithTwoHoles';

    const script = await createBrepGrasshopperRhinoScriptPlan(candidate);
    const booleanMatches = script.source.match(/rg\.Brep\.CreateBooleanDifference\(/g) ?? [];
    assert.equal(booleanMatches.length, 2);

    const positiveTranslation = script.source.indexOf(
      'rg.Transform.Translation(rg.Vector3d(250, 0, 0))',
    );
    const negativeTranslation = script.source.indexOf(
      'rg.Transform.Translation(rg.Vector3d(-250, 0, 0))',
    );
    const firstBoolean = script.source.indexOf('rg.Brep.CreateBooleanDifference(');
    const secondBoolean = script.source.indexOf(
      'rg.Brep.CreateBooleanDifference(',
      firstBoolean + 1,
    );

    assert.ok(positiveTranslation >= 0);
    assert.ok(negativeTranslation >= 0);
    assert.ok(firstBoolean > positiveTranslation);
    assert.ok(negativeTranslation > firstBoolean);
    assert.ok(secondBoolean > negativeTranslation);
  });

  it('keeps general translation parameterized instead of baking current values into Rhino source', async () => {
    const candidate = throughHoleFixture();
    const positionedHole = candidate.source.nodes.find(
      (node) => node.id === 'positionedHole',
    );
    assert.ok(positionedHole);
    positionedHole.translate = [{ parameter: 'width' }, 0, 0];

    const script = await createBrepGrasshopperRhinoScriptPlan(candidate);

    assert.match(
      script.source,
      /rg\.Transform\.Translation\(rg\.Vector3d\(Width, 0, 0\)\)/,
    );
  });
});
