import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { brepGrasshopperExactArtifactFileName } from '@shared/brepGrasshopperRuntime';

const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);

describe('BRep Phase 7 native exact role artifacts', () => {
  it('keeps native embedded STEP names aligned with the shared runtime manifest', () => {
    for (const role of [
      'result',
      'footprint',
      'clearanceEnvelope',
      'maintenanceEnvelope',
    ] as const) {
      assert.match(
        driver,
        new RegExp(
          brepGrasshopperExactArtifactFileName(role).replace('.', '\\.'),
        ),
      );
    }
  });

  it('exports optional role shapes as exact STEP instead of promoting viewer meshes', () => {
    assert.match(driver, /role_shapes = \{"result": result\}/);
    assert.match(driver, /role_shapes\[role\] = evaluate_node\(node_id\)/);
    assert.match(driver, /export_step\(role_shape, role_step_path\)/);
    assert.match(driver, /"representation": "exact-brep"/);
    assert.match(driver, /"brepia\.exactBrepArtifacts"/);
    assert.doesNotMatch(driver, /Brep\.CreateFromMesh/);
  });

  it('fails closed when any embedded exact STEP cannot be validated after 3DM round-trip', () => {
    assert.match(driver, /validate_exact_step_file\(step_path, role\)/);
    assert.match(driver, /expected_names = \{artifact\["fileName"\]/);
    assert.match(driver, /set\(embedded_by_name\) != expected_names/);
    assert.match(driver, /validate_exact_step_file\(extracted_step, role\)/);
    assert.match(driver, /ISO-10303-21/);
  });
});
