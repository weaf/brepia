import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID } from '../shared/brepGrasshopperRhinoScript.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

function emulateRhinoSavedPythonLibraryNormalization(ghx: string): string {
  const scriptLib = `<item name="Lib" type_name="gh_guid" type_code="9">${BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID}</item>`;
  assert.ok(ghx.includes(scriptLib));

  const rhinoCodeLibrary = new RegExp(
    `<chunk name="Library" index="1"><items count="6">[\\s\\S]*?<item name="Id" type_name="gh_guid" type_code="9">${BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID}</item>[\\s\\S]*?</items></chunk>`,
  );
  assert.match(ghx, rhinoCodeLibrary);

  const grasshopperLibrary =
    `<chunk name="Library" index="1"><items count="4">` +
    `<item name="Author" type_name="gh_string" type_code="10">Robert McNeel &amp; Associates</item>` +
    `<item name="Id" type_name="gh_guid" type_code="9">${ZERO_GUID}</item>` +
    `<item name="Name" type_name="gh_string" type_code="10">Grasshopper</item>` +
    `<item name="Version" type_name="gh_string" type_code="10">8.32.26160.13002</item>` +
    `</items></chunk>`;

  return ghx.replace(rhinoCodeLibrary, grasshopperLibrary).replace(scriptLib, '');
}

describe('Rhino-saved Python 3 GHX library normalization', () => {
  it('accepts the host-owned library metadata normalization only in returned mode', async () => {
    const generated = await compileBrepGrasshopperExecutableGhx(fixture);
    const hostSaved = emulateRhinoSavedPythonLibraryNormalization(generated);
    assert.notEqual(hostSaved, generated);

    const returned = await validateBrepGrasshopperExecutableGhx(
      hostSaved,
      fixture,
      'returned',
    );
    assert.equal(returned.accepted, true, JSON.stringify(returned.diagnostics));
    assert.deepEqual(returned.diagnostics, []);

    const generatedValidation = await validateBrepGrasshopperExecutableGhx(
      hostSaved,
      fixture,
      'generated',
    );
    assert.equal(generatedValidation.accepted, false);
    assert.ok(
      generatedValidation.diagnostics.some(
        (entry) => entry.code === 'missing_rhinocode_library',
      ),
    );
    assert.ok(
      generatedValidation.diagnostics.some(
        (entry) => entry.code === 'script_library_changed',
      ),
    );
  });

  it('still rejects a present foreign script Lib identity in returned mode', async () => {
    const generated = await compileBrepGrasshopperExecutableGhx(fixture);
    const changed = generated.replace(
      `<item name="Lib" type_name="gh_guid" type_code="9">${BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID}</item>`,
      '<item name="Lib" type_name="gh_guid" type_code="9">11111111-1111-4111-8111-111111111111</item>',
    );
    assert.notEqual(changed, generated);

    const result = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(
      result.diagnostics.some((entry) => entry.code === 'script_library_changed'),
    );
  });

  it('still requires a GHALibraries envelope in returned mode', async () => {
    const generated = await compileBrepGrasshopperExecutableGhx(fixture);
    const changed = generated.replace(
      '<chunk name="GHALibraries">',
      '<chunk name="GHALibrariesRemoved">',
    );
    assert.notEqual(changed, generated);

    const result = await validateBrepGrasshopperExecutableGhx(
      changed,
      fixture,
      'returned',
    );
    assert.equal(result.accepted, false);
    assert.ok(
      result.diagnostics.some((entry) => entry.code === 'missing_gha_libraries'),
    );
  });
});
