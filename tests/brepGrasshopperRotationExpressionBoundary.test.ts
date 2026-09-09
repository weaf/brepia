import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BrepGrasshopperRhinoScriptError,
  createBrepGrasshopperRhinoScriptPlan,
} from '../shared/brepGrasshopperRhinoScript.ts';

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

describe('BRep M1 Rhino rotation boundary', () => {
  it('rejects an expression-backed rotation even when the expression resolves to zero', async () => {
    const unsupported = cloneFixture();
    unsupported.source.nodes.push({
      id: 'expressionRotatedBody',
      type: 'transform',
      input: 'body',
      rotateDeg: [{ op: 'sub', args: [0, 0] }, 0, 0],
    });
    unsupported.source.resultNodeId = 'expressionRotatedBody';

    await assert.rejects(
      () => createBrepGrasshopperRhinoScriptPlan(unsupported),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model' &&
        /rotation/.test(error.message),
    );
  });
});
