import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);
const smoke = fs.readFileSync(
  new URL('../scripts/brep/m3d-circular-pattern-smoke.sh', import.meta.url),
  'utf8',
);
const containerfile = fs.readFileSync(
  new URL('../scripts/brep/Containerfile', import.meta.url),
  'utf8',
);

describe('M3D native circular-pattern execution contract', () => {
  it('rotates complete source instances around the canonical axis through center', () => {
    assert.match(driver, /center = vector\(node\["center"\], parameters\)/);
    assert.match(driver, /rotation_axis = Axis\(center, directions\[node\["axis"\]\]\)/);
    assert.match(
      driver,
      /input_shape\.rotate\(rotation_axis, index \* angle_step_deg\)/,
    );
  });

  it('fails closed for zero and over-one-turn effective angle steps in the native driver', () => {
    assert.match(driver, /angle_step_deg == 0\.0/);
    assert.match(driver, /abs\(angle_step_deg\) \* node\["count"\] > 360\.0/);
    assert.match(smoke, /invalid-zero-output/);
    assert.match(smoke, /invalid-overturn-output/);
  });

  it('locks pinned-runtime final-result and subtract fixtures with exact STEP checks', () => {
    assert.match(containerfile, /BUILD123D_VERSION=0\.11\.1/);
    assert.match(containerfile, /CADQUERY_OCP_NOVTK_VERSION=7\.9\.3\.1\.1/);
    assert.match(smoke, /m3dCircularResult/);
    assert.match(smoke, /m3dCircularSubtract/);
    assert.match(smoke, /resultKind!=='instanceSet'/);
    assert.match(smoke, /resultKind!=='single'/);
    assert.match(smoke, /pattern::'\+i/);
    assert.match(smoke, /rightHandStepDeg:60/);
    assert.match(smoke, /radius:40,angleStepDeg:45/);
    assert.match(smoke, /GeomType\.CYLINDER/);
    assert.match(smoke, /len\(cylinders\) != 6/);
    assert.match(smoke, /ISO-10303-21/);
  });
});
