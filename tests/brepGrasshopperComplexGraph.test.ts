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

    const firstBoolean = /^\s+(brepiaNode\d+)Parts0 = rg\.Brep\.CreateBooleanDifference\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );
    const secondBoolean = /^\s+(brepiaNode\d+)Parts1 = rg\.Brep\.CreateBooleanDifference\((brepiaNode\d+), (brepiaNode\d+), brepiaTolerance\)$/m.exec(
      script.source,
    );
    const positiveTranslation = /^if not (brepiaNode\d+)\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(250, 0, 0\)\)\):$/m.exec(
      script.source,
    );
    const negativeTranslation = /^if not (brepiaNode\d+)\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(-250, 0, 0\)\)\):$/m.exec(
      script.source,
    );

    assert.ok(firstBoolean);
    assert.ok(secondBoolean);
    assert.ok(positiveTranslation);
    assert.ok(negativeTranslation);

    assert.equal(firstBoolean[1], firstBoolean[2]);
    assert.equal(secondBoolean[1], secondBoolean[2]);
    assert.equal(secondBoolean[1], firstBoolean[1]);
    assert.equal(firstBoolean[3], positiveTranslation[1]);
    assert.equal(secondBoolean[3], negativeTranslation[1]);
    assert.notEqual(firstBoolean[3], secondBoolean[3]);

    const positiveOffset = script.source.indexOf(positiveTranslation[0]);
    const firstBooleanOffset = script.source.indexOf(firstBoolean[0]);
    const negativeOffset = script.source.indexOf(negativeTranslation[0]);
    const secondBooleanOffset = script.source.indexOf(secondBoolean[0]);

    assert.ok(positiveOffset >= 0);
    assert.ok(firstBooleanOffset > positiveOffset);
    assert.ok(negativeOffset > firstBooleanOffset);
    assert.ok(secondBooleanOffset > negativeOffset);
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
      /rg\.Transform\.Translation\(rg\.Vector3d\(brepia_scalar\(Width\), 0, 0\)\)/,
    );
  });

  it('compiles bounded scalar expressions without adding Grasshopper controls for derived values', async () => {
    const candidate = throughHoleFixture();
    const positionedHole = candidate.source.nodes.find(
      (node) => node.id === 'positionedHole',
    );
    assert.ok(positionedHole);
    positionedHole.translate = [
      {
        op: 'sub',
        args: [
          { op: 'div', args: [{ parameter: 'width' }, 2] },
          25,
        ],
      },
      0,
      0,
    ];

    const script = await createBrepGrasshopperRhinoScriptPlan(candidate);
    const ghx = await compileBrepGrasshopperExecutableGhx(candidate);

    assert.match(
      script.source,
      /rg\.Vector3d\(brepia_sub\(brepia_div\(brepia_scalar\(Width\), 2\), 25\), 0, 0\)/,
    );
    assert.match(script.source, /def brepia_div\(left, right\):/);
    assert.match(script.source, /if right == 0\.0:/);
    assert.equal((ghx.match(/>Width<\/item>/g) ?? []).length > 0, true);
    assert.doesNotMatch(ghx, />Derived<\/item>/);
  });
});