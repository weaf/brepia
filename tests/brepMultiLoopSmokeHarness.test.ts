import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const smoke = fs.readFileSync(
  new URL('../scripts/brep/multiloop-extrude-smoke.sh', import.meta.url),
  'utf8',
);

describe('bounded multi-loop native runtime smoke harness', () => {
  it('locks multi-hole, non-circular and expression-backed native fixtures', () => {
    assert.match(smoke, /multiLoopExtrudeNative/);
    assert.match(smoke, /"type":"circle"/);
    assert.match(smoke, /"type":"closedPolyline"/);
    assert.match(smoke, /"op":"sub"/);
    assert.match(smoke, /"op":"div"/);
    assert.match(smoke, /width/);
    assert.match(smoke, /margin/);
    assert.match(smoke, /holeRadius/);
    assert.match(smoke, /width:120,margin:40,holeRadius:9/);
    assert.match(smoke, /min:\[-60,-35,-4\],max:\[60,35,4\]/);
  });

  it('keeps exact STEP acceptance pinned, analytic and separate from repository tests', () => {
    assert.match(smoke, /build123d_version != "0\.11\.1"/);
    assert.match(smoke, /ocp_version != "7\.9\.3\.1\.1"/);
    assert.match(smoke, /import_step\(sys\.argv\[1\]\)/);
    assert.match(smoke, /expected exactly one imported solid/);
    assert.match(smoke, /expected positive imported volume/);
    assert.match(smoke, /expected_volume = \(120\.0 \* 70\.0 - math\.pi \* 9\.0 \* 9\.0 - 10\.0 \* 8\.0\) \* 8\.0/);
    assert.match(smoke, /unexpected exact STEP bounds/);
    assert.match(smoke, /unexpected exact STEP volume/);
    assert.match(smoke, /--network=none/);
    assert.match(smoke, /--read-only/);
    assert.match(smoke, /--cap-drop=all/);
  });
});
