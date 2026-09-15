import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID,
  BREP_GRASSHOPPER_GHX_NUMBER_SLIDER_GUID,
  compileBrepGrasshopperParameterShellGhx,
  validateBrepGrasshopperParameterShellGhx,
} from '../shared/brepGrasshopperGhx.ts';
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

describe('BRep Phase 8E-A portable GHX codec foundation', () => {
  it('emits deterministic standard Grasshopper numeric controls without Rhino or a Brepia GHA', async () => {
    const first = await compileBrepGrasshopperParameterShellGhx(fixture);
    const second = await compileBrepGrasshopperParameterShellGhx(fixture);
    const plan = await createBrepGrasshopperPackagePlan(fixture);

    assert.equal(first, second);
    assert.match(first, /^<\?xml version="1\.0" encoding="utf-8" standalone="yes"\?>/);
    assert.match(first, /<Archive name="Root">/);
    assert.match(first, /<chunk name="DefinitionObjects">/);
    assert.match(first, new RegExp(BREP_GRASSHOPPER_GHX_NUMBER_SLIDER_GUID));
    assert.match(first, new RegExp(BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID));
    assert.ok(
      plan.controls.every((control) => first.includes(control.instanceGuid)),
    );
    assert.doesNotMatch(first, /Brepia\.Grasshopper\.gha/i);
    assert.doesNotMatch(first, /BrepiaProjectComponent/);
    assert.match(first, /parameter-shell portability proof/);
  });

  it('round-trips its generated parameter shell through the deterministic validator', async () => {
    const ghx = await compileBrepGrasshopperParameterShellGhx(fixture);
    const result = await validateBrepGrasshopperParameterShellGhx(ghx, {
      expected: fixture,
      mode: 'generated',
    });

    assert.equal(result.accepted, true);
    assert.equal(result.valid, true);
    assert.equal(result.compatibility, 'supported-subset');
    assert.equal(result.summary.objectCount, 2);
    assert.equal(result.summary.sliderCount, 1);
    assert.equal(result.summary.numberCount, 1);
    assert.deepEqual(
      result.summary.parameters.map((parameter) => [parameter.inputId, parameter.value]),
      [
        ['height', 2100],
        ['width', 1200],
      ],
    );
    assert.deepEqual(result.diagnostics, []);
  });

  it('allows supported returned parameter changes while keeping canonical bounds authoritative', async () => {
    const ghx = await compileBrepGrasshopperParameterShellGhx(fixture);
    const changed = ghx.replace(
      '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
      '<item name="Value" type_name="gh_double" type_code="6">1500</item>',
    );

    const result = await validateBrepGrasshopperParameterShellGhx(changed, {
      expected: fixture,
      mode: 'returned',
    });

    assert.equal(result.accepted, true);
    assert.equal(
      result.summary.parameters.find((parameter) => parameter.inputId === 'width')?.value,
      1500,
    );
    assert.deepEqual(result.diagnostics, []);

    const outOfBounds = ghx.replace(
      '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
      '<item name="Value" type_name="gh_double" type_code="6">2600</item>',
    );
    const rejected = await validateBrepGrasshopperParameterShellGhx(outOfBounds, {
      expected: fixture,
      mode: 'returned',
    });
    assert.equal(rejected.accepted, false);
    assert.ok(
      rejected.diagnostics.some(
        (entry) =>
          entry.code === 'invalid_slider_state' || entry.code === 'parameter_out_of_bounds',
      ),
    );
  });

  it('rejects unknown object types and identity mutations instead of guessing', async () => {
    const ghx = await compileBrepGrasshopperParameterShellGhx(fixture);
    const unknownObject = ghx.replace(
      BREP_GRASSHOPPER_GHX_NUMBER_PARAMETER_GUID,
      '11111111-1111-4111-8111-111111111111',
    );
    const unknownResult = await validateBrepGrasshopperParameterShellGhx(
      unknownObject,
      { expected: fixture, mode: 'returned' },
    );
    assert.equal(unknownResult.accepted, false);
    assert.ok(
      unknownResult.diagnostics.some((entry) => entry.code === 'unsupported_object'),
    );

    const plan = await createBrepGrasshopperPackagePlan(fixture);
    const width = plan.controls.find((control) => control.inputId === 'width');
    assert.ok(width);
    const changedIdentity = ghx.replace(
      width.instanceGuid,
      '22222222-2222-4222-8222-222222222222',
    );
    const identityResult = await validateBrepGrasshopperParameterShellGhx(
      changedIdentity,
      { expected: fixture, mode: 'returned' },
    );
    assert.equal(identityResult.accepted, false);
    assert.ok(
      identityResult.diagnostics.some(
        (entry) => entry.code === 'missing_parameter_control',
      ),
    );
  });

  it('fails closed on unsafe or malformed XML before semantic inspection', async () => {
    const ghx = await compileBrepGrasshopperParameterShellGhx(fixture);
    const unsafe = ghx.replace(
      '<Archive name="Root">',
      '<!DOCTYPE Archive [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Archive name="Root">',
    );
    const unsafeResult = await validateBrepGrasshopperParameterShellGhx(unsafe);
    assert.equal(unsafeResult.accepted, false);
    assert.ok(unsafeResult.diagnostics.some((entry) => entry.code === 'unsafe_xml'));

    const malformedResult = await validateBrepGrasshopperParameterShellGhx(
      '<Archive name="Root"><chunks></Archive>',
    );
    assert.equal(malformedResult.accepted, false);
    assert.ok(
      malformedResult.diagnostics.some((entry) => entry.code === 'malformed_xml'),
    );
  });

  it('checks archive object counts and generated defaults for deterministic export acceptance', async () => {
    const ghx = await compileBrepGrasshopperParameterShellGhx(fixture);
    const wrongCount = ghx.replace(
      '<item name="ObjectCount" type_name="gh_int32" type_code="3">2</item>',
      '<item name="ObjectCount" type_name="gh_int32" type_code="3">3</item>',
    );
    const countResult = await validateBrepGrasshopperParameterShellGhx(wrongCount);
    assert.equal(countResult.accepted, false);
    assert.ok(
      countResult.diagnostics.some((entry) => entry.code === 'object_count_mismatch'),
    );

    const changedDefault = ghx.replace(
      '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
      '<item name="Value" type_name="gh_double" type_code="6">1500</item>',
    );
    await expect(
      validateBrepGrasshopperParameterShellGhx(changedDefault, {
        expected: fixture,
        mode: 'generated',
      }),
    ).resolves.toMatchObject({ accepted: false });
    const defaultResult = await validateBrepGrasshopperParameterShellGhx(
      changedDefault,
      { expected: fixture, mode: 'generated' },
    );
    assert.ok(
      defaultResult.diagnostics.some(
        (entry) => entry.code === 'generated_default_mismatch',
      ),
    );
  });
});
