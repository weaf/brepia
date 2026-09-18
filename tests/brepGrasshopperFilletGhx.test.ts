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

function filletFixture(): MutableFixture {
  const candidate = JSON.parse(JSON.stringify(fixture)) as MutableFixture;
  candidate.source.nodes.push({
    id: 'filletedBody',
    type: 'fillet',
    input: 'body',
    radius: 25,
    selector: { kind: 'parallelToAxis', axis: 'z' },
  });
  candidate.source.resultNodeId = 'filletedBody';
  return candidate;
}

describe('canonical fillet executable GHX export', () => {
  it('packages the RhinoCommon fillet script in the zero-install Python 3 carrier', async () => {
    const candidate = filletFixture();
    const [ghx, script] = await Promise.all([
      compileBrepGrasshopperExecutableGhx(candidate),
      createBrepGrasshopperRhinoScriptPlan(candidate),
    ]);

    assert.match(script.source, /rg\.Brep\.CreateFilletEdges\(/);
    assert.match(script.source, /rg\.BlendType\.Fillet/);
    assert.match(script.source, /rg\.RailType\.RollingBall/);
    assert.match(ghx, /<item name="Name" type_name="gh_string" type_code="10">Python 3 Script<\/item>/);
    assert.doesNotMatch(
      ghx,
      /<item name="NickName" type_name="gh_string" type_code="10">Plane<\/item>/,
    );
  });
});