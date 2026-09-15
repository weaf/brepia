import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { exportBrepGrasshopperGhx } from '../src/services/brepGrasshopperExport.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
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
      /<item name="Name" type_name="gh_string" type_code="10">Python 3 Script<\/item>/,
    );
    assert.match(
      result.ghx,
      /<item name="Taxon" type_name="gh_string" type_code="10">\*\.\*\.python<\/item>/,
    );
    assert.match(result.ghx, /<item name="Title" type_name="gh_string" type_code="10">Brepia<\/item>/);
    assert.match(result.ghx, /<chunk name="Thumbnail">/);
    assert.doesNotMatch(result.ghx, /BREPIA_GRASSHOPPER_TOKEN|HttpClient/);
  });

  it('exports canonical M6 non-zero rotation through the supported executable GHX subset', async () => {
    const rotated = cloneProject();
    rotated.nodes.push({
      id: 'rotatedBody',
      type: 'transform',
      input: rotated.resultNodeId,
      translate: [7, 11, 13],
      rotateDeg: [30, 20, 10],
    });
    rotated.resultNodeId = 'rotatedBody';

    const result = await exportBrepGrasshopperGhx(
      rotated,
      'revision-m6-rotation-export',
    );
    const validation = await validateBrepGrasshopperExecutableGhx(
      result.ghx,
      result.contract,
      'generated',
    );

    assert.equal(validation.accepted, true, JSON.stringify(validation.diagnostics));
    assert.deepEqual(validation.diagnostics, []);
    assert.equal(result.contract.interface.outputs[0]?.id, 'result');
    assert.equal(result.contract.interface.outputs[0]?.access, 'item');
    assert.equal(result.contract.source.resultNodeId, 'rotatedBody');
    assert.match(result.ghx, /<item name="Name" type_name="gh_string" type_code="10">Python 3 Script<\/item>/);
  });
});
