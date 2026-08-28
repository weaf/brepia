import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  CREATIVE_MESH_MODEL_IDS,
  CREATIVE_MESH_MODELS,
  getCreativeMeshInputCapability,
  getCreativeMeshModelDefinition,
  isFalCreativeMeshModel,
  isLocalCreativeMeshModel,
  isNativeTrellis2Model,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';
import { getCreativeInputValidationIssue } from '../src/lib/creativeInputValidation';

describe('Creative mesh backend catalog', () => {
  it('contains TRELLIS.2, the three transitional local backends and the three legacy fal.ai IDs', () => {
    assert.deepEqual([...CREATIVE_MESH_MODEL_IDS], [
      'local/trellis2',
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
      'quality',
      'fast',
      'ultra',
    ]);
  });

  it('keeps old fal.ai IDs backward compatible', () => {
    assert.equal(isFalCreativeMeshModel('quality'), true);
    assert.equal(isFalCreativeMeshModel('fast'), true);
    assert.equal(isFalCreativeMeshModel('ultra'), true);
    assert.equal(isLocalCreativeMeshModel('quality'), false);
  });

  it('routes all local Creative backends locally while identifying the new native path', () => {
    for (const id of [
      'local/trellis2',
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
    ]) {
      assert.equal(isLocalCreativeMeshModel(id), true, id);
    }
    assert.equal(isNativeTrellis2Model('local/trellis2'), true);
    assert.equal(isNativeTrellis2Model('local/trellis-v1'), false);
  });

  it('marks both TRELLIS paths as text/image-capable and Hunyuan as image-required', () => {
    for (const id of ['local/trellis2', 'local/trellis-v1']) {
      assert.equal(getCreativeMeshModelDefinition(id)?.supportsText, true, id);
      assert.equal(getCreativeMeshModelDefinition(id)?.supportsImage, true, id);
      assert.equal(getCreativeMeshInputCapability(id), 'Text + image', id);
    }
    for (const id of ['local/hunyuan3d-2', 'local/hunyuan3d-2.1']) {
      const definition = getCreativeMeshModelDefinition(id);
      assert.equal(definition?.supportsText, false, id);
      assert.equal(definition?.supportsImage, true, id);
      assert.equal(definition?.requiresReferenceImage, true, id);
      assert.equal(getCreativeMeshInputCapability(id), 'Image required', id);
    }
  });

  it('blocks text-only input for image-required Creative models', () => {
    const issue = getCreativeInputValidationIssue({
      conversationType: 'creative',
      model: 'local/hunyuan3d-2',
      parts: [{ type: 'text', text: 'Make a small dragon' }],
    });

    assert.equal(issue?.title, 'Reference image required');
    assert.match(issue?.description ?? '', /TRELLIS\.2/);
  });

  it('allows text-only TRELLIS.2 input and image-backed Hunyuan input', () => {
    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/trellis2',
        parts: [{ type: 'text', text: 'Make a small dragon' }],
      }),
      null,
    );

    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/hunyuan3d-2',
        parts: [
          { type: 'text', text: 'Turn this into a 3D model' },
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'https://example.test/reference.png',
          },
        ],
      }),
      null,
    );
  });

  it('has UI mesh configuration for every selectable backend', () => {
    for (const definition of CREATIVE_MESH_MODELS) {
      assert.ok(MODEL_CONFIGS[definition.id], definition.id);
    }
  });
});
