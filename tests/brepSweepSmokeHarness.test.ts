import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const smoke = fs.readFileSync(
  new URL('../scripts/brep/sweep-smoke.sh', import.meta.url),
  'utf8',
);

describe('bounded planar elbow sweep native runtime smoke harness', () => {
  it('locks nominal target-E geometry, axis parity and parameter perturbations', () => {
    assert.match(smoke, /boundedSweep/);
    assert.match(smoke, /"type":"sweep"/);
    assert.match(smoke, /"type":"planarElbow90"/);
    assert.match(smoke, /"tubeDiameter".*"default":40/);
    assert.match(smoke, /"firstLeg".*"default":1000/);
    assert.match(smoke, /"secondLeg".*"default":700/);
    assert.match(smoke, /"bendRadius".*"default":150/);
    assert.match(smoke, /for \(const axis of \['x', 'y', 'z'\]\)/);
    assert.match(smoke, /bendRadius = 180/);
    assert.match(smoke, /tubeDiameter = 50/);
    assert.match(
      smoke,
      /expectedBend = \{ min: \[0, -20, -20\], max: \[1200, 880, 20\] \}/,
    );
    assert.match(
      smoke,
      /expectedDiameter = \{ min: \[0, -25, -25\], max: \[1175, 850, 25\] \}/,
    );
  });

  it('keeps invalid-radius and zero-leg cases fail closed', () => {
    assert.match(smoke, /tubeDiameter = 300/);
    assert.match(smoke, /firstLeg = 0/);
    assert.match(smoke, /profile radius must resolve smaller than bendRadius/);
    assert.match(
      smoke,
      /firstLegLength must resolve to a positive millimetre value/,
    );
  });

  it('keeps exact STEP acceptance pinned and independently re-imported', () => {
    assert.match(smoke, /build123d_version != "0\.11\.1"/);
    assert.match(smoke, /ocp_version != "7\.9\.3\.1\.1"/);
    assert.match(smoke, /import_step\(sys\.argv\[1\]\)/);
    assert.match(smoke, /expected exactly one imported solid/);
    assert.match(
      smoke,
      /centerline_length = 1000\.0 \+ math\.pi \* 150\.0 \/ 2\.0 \+ 700\.0/,
    );
    assert.match(
      smoke,
      /expected_volume = math\.pi \* 20\.0 \* 20\.0 \* centerline_length/,
    );
    assert.match(smoke, /--network=none/);
    assert.match(smoke, /--read-only/);
    assert.match(smoke, /--cap-drop=all/);
  });
});
