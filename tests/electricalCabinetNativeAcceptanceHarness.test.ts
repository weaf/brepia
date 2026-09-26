import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const acceptance = fs.readFileSync(
  new URL(
    '../scripts/brep/d1-electrical-cabinet-acceptance.sh',
    import.meta.url,
  ),
  'utf8',
);

describe('D1 Electrical Cabinet native acceptance harness', () => {
  it('uses the exact shipped source and proves the 0 to 90 degree door perturbation', () => {
    assert.match(acceptance, /electricalCabinetV1\.json/);
    assert.match(acceptance, /doorOpenAngleDeg: angle/);
    assert.match(acceptance, /for \(const angle of \[0, 90\]\)/);
    assert.match(acceptance, /result\.resultKind !== 'single'/);
    assert.match(acceptance, /result\.bodies\?\.length !== 1/);
    assert.match(acceptance, /result\.resultNodeId !== 'cabinet'/);
    assert.match(acceptance, /result\.warnings\.length !== 0/);
    assert.match(acceptance, /result\.exactExport\?\.available !== true/);
    assert.match(acceptance, /90 degree door must materially extend outward/);
    assert.match(acceptance, /STEP digests must differ/);
  });

  it('re-imports both exact STEP artifacts through the pinned isolated CAD runtime', () => {
    assert.match(acceptance, /build123d_version != "0\.11\.1"/);
    assert.match(acceptance, /ocp_version != "7\.9\.3\.1\.1"/);
    assert.match(acceptance, /for angle in \(0, 90\)/);
    assert.match(acceptance, /import_step/);
    assert.match(acceptance, /expected exactly one imported solid/);
    assert.match(acceptance, /expected positive imported volume/);
    assert.match(acceptance, /STEP\/native bounds mismatch/);
    assert.match(acceptance, /--network=none/);
    assert.match(acceptance, /--read-only/);
    assert.match(acceptance, /--cap-drop=all/);
    assert.match(acceptance, /D1_ELECTRICAL_CABINET_ACCEPTANCE_PASS/);
  });
});
