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

describe('BRep M6 Rhino rotation expression parity', () => {
  it('compiles bounded expression-backed degree rotations instead of rejecting them', async () => {
    const candidate = cloneFixture();
    candidate.source.nodes.push({
      id: 'expressionRotatedBody',
      type: 'transform',
      input: 'body',
      translate: [7, 11, 13],
      rotateDeg: [
        { op: 'add', args: [10, 5] },
        { op: 'sub', args: [20, 20] },
        { op: 'neg', args: [-10] },
      ],
    });
    candidate.source.resultNodeId = 'expressionRotatedBody';

    const script = await createBrepGrasshopperRhinoScriptPlan(candidate);

    assert.match(
      script.source,
      /RotationXDeg = float\(brepia_add\(10, 5\)\)/,
    );
    assert.match(
      script.source,
      /RotationYDeg = float\(brepia_sub\(20, 20\)\)/,
    );
    assert.match(
      script.source,
      /RotationZDeg = float\(brepia_neg\(-10\)\)/,
    );
    assert.match(
      script.source,
      /Rotation = brepiaNode\d+RotationX \* brepiaNode\d+RotationY \* brepiaNode\d+RotationZ/,
    );
    assert.match(
      script.source,
      /Transform = brepiaNode\d+Translation \* brepiaNode\d+Rotation/,
    );
  });
});
