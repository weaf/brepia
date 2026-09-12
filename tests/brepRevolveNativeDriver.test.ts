import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);

describe('bounded revolve native build123d translation', () => {
  it('uses the locked explicit right-handed U-axial/V-radial frame for X/Y/Z', () => {
    assert.match(
      driver,
      /"x": \(\(1\.0, 0\.0, 0\.0\), \(0\.0, 0\.0, 1\.0\)\)/,
    );
    assert.match(
      driver,
      /"y": \(\(0\.0, 1\.0, 0\.0\), \(1\.0, 0\.0, 0\.0\)\)/,
    );
    assert.match(
      driver,
      /"z": \(\(0\.0, 0\.0, 1\.0\), \(0\.0, 1\.0, 0\.0\)\)/,
    );
    assert.match(
      driver,
      /profile_plane = Plane\(origin=\(0\.0, 0\.0, 0\.0\), x_dir=x_dir, z_dir=z_dir\)/,
    );
    assert.match(
      driver,
      /rotation_axis = Axis\(\(0\.0, 0\.0, 0\.0\), directions\[node\["axis"\]\]\)/,
    );
  });

  it('uses build123d full revolve and requires exactly one positive-volume solid', () => {
    assert.match(driver, /from build123d import .*revolve/);
    assert.match(driver, /part = revolve\(/);
    assert.match(driver, /revolution_arc=360\.0/);
    assert.match(
      driver,
      /require_single_positive_volume_solid\(part, "revolve", node_id\)/,
    );
    assert.match(driver, /volume = float\(solid\.volume\)/);
    assert.match(driver, /volume <= 0\.0/);
  });

  it('mirrors the bounded radial fail-closed checks before accepting native geometry', () => {
    assert.match(driver, /if profile\["type"\] != "closedPolyline":/);
    assert.match(driver, /if any\(v < 0\.0 for _, v in points\):/);
    assert.match(driver, /has_axis_segment = any\(/);
    assert.match(driver, /boundary segment on v = 0/);
    assert.match(driver, /elif kind == "revolve": shape = revolve_profile_shape/);
  });
});
