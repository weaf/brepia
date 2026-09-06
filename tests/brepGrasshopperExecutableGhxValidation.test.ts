import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperPackagePlan } from '../shared/brepGrasshopperPackagePlan.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

describe('BRep Phase 8E strict executable GHX gate', () => {
  it('accepts the deterministic generated box GHX and recovers canonical parameter values', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const result = await validateBrepGrasshopperExecutableGhx(
      ghx,
      fixture,
      'generated',
    );

    assert.equal(result.accepted, true);
    assert.equal(result.compatibility, 'supported');
    assert.deepEqual(result.parameters, { height: 2100, width: 1200 });
    assert.deepEqual(result.diagnostics, []);
  });

  it('accepts parameter-only edits in returned mode but not as generated canonical output', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const changed = ghx.replace(
      '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
      '<item name="Value" type_name="gh_double" type_code="6">1500</item>',
    );

    const returned = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(returned.accepted, true);
    assert.equal(returned.parameters.width, 1500);

    const generated = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'generated',
    );
    assert.equal(generated.accepted, false);
    assert.ok(
      generated.diagnostics.some(
        (entry) => entry.code === 'generated_default_mismatch',
      ),
    );
  });

  it('rejects any embedded Brepia script-source mutation', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const scriptTextPattern =
      /(<chunk name="Script"><items count="5">[\s\S]*?<item name="Text" type_name="gh_string" type_code="10">)([^<])/;
    const changed = ghx.replace(
      scriptTextPattern,
      (_match, prefix: string, first: string) => `${prefix}${first === 'A' ? 'B' : 'A'}`,
    );
    assert.notEqual(changed, ghx);

    const result = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(
      result.diagnostics.some((entry) => entry.code === 'script_source_changed'),
    );
  });

  it('rejects rewiring of a Brepia-owned script input', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const packagePlan = await createBrepGrasshopperPackagePlan(fixture);
    const width = packagePlan.controls.find((control) => control.inputId === 'width');
    assert.ok(width);
    const sourceItem = `<item name="Source" index="0" type_name="gh_guid" type_code="9">${width.instanceGuid}</item>`;
    assert.ok(ghx.includes(sourceItem));
    const changed = ghx.replace(
      sourceItem,
      '<item name="Source" index="0" type_name="gh_guid" type_code="9">11111111-1111-4111-8111-111111111111</item>',
    );

    const result = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(result.diagnostics.some((entry) => entry.code === 'script_rewired'));
  });

  it('rejects unknown graph objects instead of trying to interpret them into canonical Brepia state', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const changed = ghx.replace(
      'b6ba1144-02d6-4a2d-b53c-ec62e290eeb7',
      '22222222-2222-4222-8222-222222222222',
    );

    const result = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(
      result.diagnostics.some(
        (entry) => entry.code === 'unsupported_object' || entry.code === 'missing_script',
      ),
    );
  });

  it('rejects unsafe XML before any Grasshopper/Brepia semantic recovery', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const unsafe = ghx.replace(
      '<Archive name="Root">',
      '<!DOCTYPE Archive [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Archive name="Root">',
    );
    const result = await validateBrepGrasshopperExecutableGhx(
      unsafe,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(result.diagnostics.some((entry) => entry.code === 'unsafe_xml'));
  });
});
