import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);

describe('bounded planar elbow sweep native build123d translation', () => {
  it('uses the verified tangent-arc path rather than RadiusArc approximation', () => {
    assert.match(driver, /from build123d import .*JernArc.*Line.*Wire.*sweep/);
    assert.match(driver, /first = Line\(\(0\.0, 0\.0\), \(first_leg, 0\.0\)\)/);
    assert.match(driver, /bend = JernArc\(/);
    assert.match(driver, /\(1\.0, 0\.0\),\s+bend_radius,\s+90\.0,/);
    assert.match(driver, /second = Line\(/);
    assert.match(
      driver,
      /local_path = Wire\(\[first\.edges\(\)\[0\], bend\.edges\(\)\[0\], second\.edges\(\)\[0\]\]\)/,
    );
    assert.doesNotMatch(driver, /RadiusArc/);
  });

  it('maps the locked U/V path plane and V/N section plane for X/Y/Z', () => {
    assert.match(
      driver,
      /path_plane = \{\s+"x": Plane\.YZ,\s+"y": Plane\.ZX,\s+"z": Plane\.XY,/,
    );
    assert.match(
      driver,
      /section_plane = \{\s+"x": Plane\.ZX,\s+"y": Plane\.XY,\s+"z": Plane\.YZ,/,
    );
    assert.match(driver, /rail = path_plane \* local_path/);
    assert.match(driver, /section = section_plane \* Circle\(profile_radius\)/);
  });

  it('fails closed on invalid radii and requires one positive-volume solid', () => {
    assert.match(driver, /if profile_radius >= bend_radius:/);
    assert.match(driver, /profile radius must resolve smaller than bendRadius/);
    assert.match(driver, /part = sweep\(section, path=rail\)/);
    assert.match(
      driver,
      /return require_single_positive_volume_solid\(part, "sweep", node_id\)/,
    );
    assert.match(driver, /elif kind == "sweep": shape = sweep_shape/);
  });
});
