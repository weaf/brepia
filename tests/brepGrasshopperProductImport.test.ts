import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BrepGrasshopperGhxImportError,
  importBrepGrasshopperGhx,
  importBrepGrasshopperGhxFile,
} from '../src/services/brepGrasshopperImport.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { BREP_GRASSHOPPER_GHX_ARCHIVE_MAX_BYTES } from '../shared/brepGrasshopperGhxArchive.ts';
import type { BrepProject } from '../shared/brepProject.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  model: { sourceRevisionId: string };
  source: BrepProject;
};

describe('BRep Phase 8G strict product GHX import', () => {
  it('recovers only supported returned parameter edits against the active revision', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const changed = ghx
      .replace(
        '<item name="number" type_name="gh_double" type_code="6">2100</item>',
        '<item name="number" type_name="gh_double" type_code="6">2200</item>',
      )
      .replace(
        '<item name="Value" type_name="gh_double" type_code="6">1200</item>',
        '<item name="Value" type_name="gh_double" type_code="6">1500</item>',
      );

    const result = await importBrepGrasshopperGhx(
      fixture.source,
      fixture.model.sourceRevisionId,
      changed,
    );

    assert.deepEqual(result.parameterValues, { height: 2200, width: 1500 });
    assert.deepEqual(result.changedParameterIds, ['height', 'width']);
  });

  it('reports an unchanged supported GHX without manufacturing a revision-worthy change', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const result = await importBrepGrasshopperGhx(
      fixture.source,
      fixture.model.sourceRevisionId,
      ghx,
    );

    assert.deepEqual(result.parameterValues, { height: 2100, width: 1200 });
    assert.deepEqual(result.changedParameterIds, []);
  });

  it('rejects oversized browser files before reading their complete text', async () => {
    let read = false;
    await assert.rejects(
      () =>
        importBrepGrasshopperGhxFile(
          fixture.source,
          fixture.model.sourceRevisionId,
          {
            size: BREP_GRASSHOPPER_GHX_ARCHIVE_MAX_BYTES + 1,
            text: async () => {
              read = true;
              return '';
            },
          },
        ),
      (error: unknown) =>
        error instanceof BrepGrasshopperGhxImportError &&
        error.diagnostics.some((entry) => entry.code === 'too_large'),
    );
    assert.equal(read, false);
  });

  it('rejects a GHX exported from another Brepia revision even when project identity is stable', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);

    await assert.rejects(
      () => importBrepGrasshopperGhx(fixture.source, 'revision-43', ghx),
      (error: unknown) =>
        error instanceof BrepGrasshopperGhxImportError &&
        error.diagnostics.some((entry) => entry.code === 'script_source_changed'),
    );
  });

  it('preserves machine-readable diagnostics for unsupported returned script mutations', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);
    const scriptTextPattern =
      /(<chunk name="Script"><items count="5">[\s\S]*?<item name="Text" type_name="gh_string" type_code="10">)([^<])/;
    const changed = ghx.replace(
      scriptTextPattern,
      (_match, prefix: string, first: string) => `${prefix}${first === 'A' ? 'B' : 'A'}`,
    );
    assert.notEqual(changed, ghx);

    await assert.rejects(
      () =>
        importBrepGrasshopperGhx(
          fixture.source,
          fixture.model.sourceRevisionId,
          changed,
        ),
      (error: unknown) =>
        error instanceof BrepGrasshopperGhxImportError &&
        error.diagnostics.some((entry) => entry.code === 'script_source_changed'),
    );
  });
});
