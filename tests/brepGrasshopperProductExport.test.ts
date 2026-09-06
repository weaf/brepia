import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { exportBrepGrasshopperGhx } from '../src/services/brepGrasshopperExport.ts';
import { BrepGrasshopperRhinoScriptError } from '../shared/brepGrasshopperRhinoScript.ts';
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

function cloneProject(): BrepProject {
  return JSON.parse(JSON.stringify(fixture.source)) as BrepProject;
}

describe('BRep Phase 8F product GHX export', () => {
  it('compiles the saved canonical revision into executable GHX without a Rhino host', async () => {
    const result = await exportBrepGrasshopperGhx(
      fixture.source,
      fixture.model.sourceRevisionId,
    );

    assert.equal(result.contract.model.projectId, fixture.source.id);
    assert.equal(
      result.contract.model.sourceRevisionId,
      fixture.model.sourceRevisionId,
    );
    assert.match(result.ghx, /^<\?xml version="1\.0" encoding="utf-8" standalone="yes"\?>/);
    assert.match(
      result.ghx,
      /<item name="Name" type_name="gh_string" type_code="10">C# Script<\/item>/,
    );
    assert.match(result.ghx, /<item name="Title" type_name="gh_string" type_code="10">Brepia<\/item>/);
    assert.doesNotMatch(result.ghx, /BREPIA_GRASSHOPPER_TOKEN|HttpClient/);
  });

  it('fails closed instead of approximating canonical geometry outside the proven GHX subset', async () => {
    const unsupported = cloneProject();
    unsupported.nodes.push({
      id: 'movedBody',
      type: 'transform',
      input: unsupported.resultNodeId,
      translate: [10, 0, 0],
    });
    unsupported.resultNodeId = 'movedBody';

    await assert.rejects(
      () => exportBrepGrasshopperGhx(unsupported, 'revision-unsupported'),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model',
    );
  });
});
