import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const smoke = fs.readFileSync(
  new URL('../scripts/brep/c5-template-validation-smoke.sh', import.meta.url),
  'utf8',
);

describe('C5 template validation native smoke harness', () => {
  it('locks native result-kind, exact STEP and effective-control evidence', () => {
    assert.match(smoke, /c5TemplateValidation/);
    assert.match(smoke, /"parameter":"width"/);
    assert.match(smoke, /"width":60/);
    assert.match(smoke, /r\.resultKind!=='single'/);
    assert.match(smoke, /r\.exactExport\?\.available!==true/);
    assert.match(smoke, /ISO-10303-21/);
  });

  it('re-imports exact STEP through the pinned isolated CAD runtime', () => {
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
