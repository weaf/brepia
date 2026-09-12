import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);
const smoke = fs.readFileSync(
  new URL('../scripts/brep/smoke-test.sh', import.meta.url),
  'utf8',
);

describe('M4 native profile extrusion translation', () => {
  it('maps the three canonical profile frames to build123d planes', () => {
    assert.match(driver, /"x": Plane\.YZ/);
    assert.match(driver, /"y": Plane\.ZX/);
    assert.match(driver, /"z": Plane\.XY/);
    assert.match(
      driver,
      /extrude\(plane \* region, amount=depth \/ 2\.0, both=True\)/,
    );
  });

  it('uses bounded rectangle, circle and closed-polyline sketch primitives', () => {
    assert.match(driver, /def profile_sketch\(profile, parameters, label\):/);
    assert.match(driver, /profile_kind == "rectangle"/);
    assert.match(driver, /return Rectangle\(/);
    assert.match(driver, /profile_kind == "circle"/);
    assert.match(driver, /return Circle\(/);
    assert.match(driver, /profile_kind == "closedPolyline"/);
    assert.match(driver, /return Polygon\(\*points\)/);
    assert.match(driver, /positive_scalar\(node\["depth"\]/);
    assert.match(driver, /require_single_boolean_solid\(part, "extrude", node_id\)/);
  });

  it('preserves the established single-loop region path', () => {
    assert.match(driver, /outer_sketch = profile_sketch\(/);
    assert.match(driver, /region = outer_sketch/);
    assert.match(
      driver,
      /return require_single_boolean_solid\(part, "extrude", node_id\)/,
    );
  });

  it('keeps native smoke coverage explicit for all axes and profile variants', () => {
    assert.match(smoke, /run_extrude_rectangle x -15 15 -30 30 -10 10/);
    assert.match(smoke, /run_extrude_rectangle y -10 10 -15 15 -30 30/);
    assert.match(smoke, /run_extrude_rectangle z -30 30 -10 10 -15 15/);
    assert.match(smoke, /"type":"circle","radius":12/);
    assert.match(smoke, /"type":"closedPolyline"/);
    assert.match(smoke, /r\.resultKind!=='single'/);
    assert.match(smoke, /r\.exactExport\?\.available!==true/);
  });
});
