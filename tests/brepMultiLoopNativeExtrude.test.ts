import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);

describe('bounded multi-loop native extrusion translation', () => {
  it('keeps the constrained Python driver syntactically valid', () => {
    const result = spawnSync(
      'python3',
      ['-c', 'import sys; compile(sys.stdin.read(), "brep_driver.py", "exec")'],
      { input: driver, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  });

  it('constructs one planar Face from the outer wire and translated hole wires', () => {
    assert.match(driver, /from build123d import .*Face/);
    assert.match(driver, /def profile_sketch\(profile, parameters, label\):/);
    assert.match(driver, /outer_wire = outer_sketch\.wire\(\)/);
    assert.match(driver, /hole\["offsetU"\]/);
    assert.match(driver, /hole\["offsetV"\]/);
    assert.match(
      driver,
      /hole_wire\.moved\(Location\(\(offset_u, offset_v, 0\.0\)\)\)/,
    );
    assert.match(driver, /region = Face\(outer_wire, hole_wires\)/);
  });

  it('extrudes the planar region symmetrically in the existing M4 frame', () => {
    assert.match(driver, /"x": Plane\.YZ/);
    assert.match(driver, /"y": Plane\.ZX/);
    assert.match(driver, /"z": Plane\.XY/);
    assert.match(
      driver,
      /extrude\(plane \* region, amount=depth \/ 2\.0, both=True\)/,
    );
    assert.match(
      driver,
      /if holes:\s+return require_single_positive_volume_solid\(part, "extrude", node_id\)/,
    );
  });

  it('preserves the legacy single-loop path and keeps revolve holes fail-closed', () => {
    assert.match(driver, /region = outer_sketch/);
    assert.match(
      driver,
      /return require_single_boolean_solid\(part, "extrude", node_id\)/,
    );
    assert.match(driver, /if profile\.get\("holes"\):/);
    assert.match(driver, /does not support profile holes/);
  });
});
