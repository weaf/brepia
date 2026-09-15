import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const smoke = fs.readFileSync(
  new URL('../scripts/brep/revolve-smoke.sh', import.meta.url),
  'utf8',
);

describe('bounded revolve native runtime smoke harness', () => {
  it('locks the product-like, parameterized, axis-adjacent and invalid fixtures', () => {
    assert.match(smoke, /revolveStepped/);
    assert.match(smoke, /"u":-30,"v":8/);
    assert.match(smoke, /outerRadius/);
    assert.match(smoke, /length/);
    assert.match(smoke, /outerRadius:22,length:52/);
    assert.match(smoke, /revolveAxisAdjacent/);
    assert.match(smoke, /"u":-20,"v":0/);
    assert.match(smoke, /revolveInvalidCrossing/);
    assert.match(smoke, /"u":-20,"v":-2/);
  });

  it('keeps exact STEP acceptance pinned and separate from repository tests', () => {
    assert.match(smoke, /build123d_version != "0\.11\.1"/);
    assert.match(smoke, /ocp_version != "7\.9\.3\.1\.1"/);
    assert.match(smoke, /import_step\(sys\.argv\[1\]\)/);
    assert.match(smoke, /expected exactly one imported solid/);
    assert.match(smoke, /solid\.volume <= 0/);
    assert.match(smoke, /unexpected exact STEP bounds/);
    assert.match(smoke, /--network=none/);
    assert.match(smoke, /--read-only/);
    assert.match(smoke, /--cap-drop=all/);
  });
});
