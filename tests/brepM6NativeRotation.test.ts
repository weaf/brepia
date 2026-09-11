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
const rotationSmoke = fs.readFileSync(
  new URL('../scripts/brep/m6-rotation-smoke.sh', import.meta.url),
  'utf8',
);

describe('M6 native rotation parity contract', () => {
  it('keeps build123d Location translation plus rotation as native authority', () => {
    assert.match(driver, /translation = vector\(node\.get\("translate", \[0, 0, 0\]\), parameters\)/);
    assert.match(driver, /rotation = vector\(node\.get\("rotateDeg", \[0, 0, 0\]\), parameters\)/);
    assert.match(driver, /shape = shape\.moved\(Location\(translation, rotation\)\)/);
  });

  it('covers asymmetric single-axis X/Y/Z rotations with exact bounds', () => {
    assert.match(
      rotationSmoke,
      /run_axis_rotation rotateX90 '\[90,0,0\]' -5 5 -15 15 -10 10/,
    );
    assert.match(
      rotationSmoke,
      /run_axis_rotation rotateY90 '\[0,90,0\]' -15 15 -10 10 -5 5/,
    );
    assert.match(
      rotationSmoke,
      /run_axis_rotation rotateZ90 '\[0,0,90\]' -10 10 -5 5 -15 15/,
    );
  });

  it('locks the dynamic Intrinsic XYZ plus translation parity fixture', () => {
    assert.match(rotationSmoke, /"translate":\[7,11,13\]/);
    assert.match(
      rotationSmoke,
      /"rotateDeg":\[\{"parameter":"rx"\},\{"op":"add","args":\[\{"parameter":"ryBase"\},5\]\},10\]/,
    );
    assert.match(rotationSmoke, /"parameterValues":\{"rx":30,"ryBase":15\}/);
    assert.match(
      rotationSmoke,
      /min:\[-4\.38914415,-5\.87340299,-5\.66971729\],max:\[18\.38914415,27\.87340299,31\.66971729\]/,
    );
    assert.match(rotationSmoke, /angles:\[30,20,10\],translation:\[7,11,13\]/);
    assert.match(rotationSmoke, /r\.exactExport\?\.available!==true/);
  });

  it('runs M6 as part of the full M0-M6 native smoke suite', () => {
    assert.match(smoke, /"\$SCRIPT_DIR\/m6-rotation-smoke\.sh"/);
  });
});
