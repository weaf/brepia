import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  CORE_CREATIVE_MESH_MODELS,
  CREATIVE_MESH_MODEL_IDS,
  FAL_CREATIVE_MESH_MODEL_IDS,
  getCreativeMeshInputCapability,
  getCreativeMeshModelDefinition,
  isCreativeMeshModelId,
  isFalCreativeMeshModel,
  isLegacyLocalCreativeMeshModelId,
  isLocalCreativeMeshModel,
  isNativeCreativeMeshModel,
  normalizeCreativeMeshModelId,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';
import { getCreativeInputValidationIssue } from '../src/lib/creativeInputValidation';

describe('Creative mesh backend catalog', () => {
  it('keeps a model-neutral local backend as the only built-in Creative mode', () => {
    assert.deepEqual(
      CORE_CREATIVE_MESH_MODELS.map((model) => model.id),
      ['local/native'],
    );
    assert.equal(isLocalCreativeMeshModel('local/native'), true);
    assert.equal(isNativeCreativeMeshModel('local/native'), true);
  });

  it('keeps hosted product modes behind the optional provider', () => {
    assert.deepEqual(
      [...FAL_CREATIVE_MESH_MODEL_IDS],
      ['ultra', 'quality', 'fast'],
    );
    for (const id of FAL_CREATIVE_MESH_MODEL_IDS) {
      assert.equal(isFalCreativeMeshModel(id), true, id);
      assert.equal(getCreativeMeshModelDefinition(id)?.provider, 'fal', id);
    }
  });

  it('normalizes model-specific legacy local IDs to the neutral native mode', () => {
    assert.deepEqual(
      [...CREATIVE_MESH_MODEL_IDS],
      ['local/native', 'ultra', 'quality', 'fast'],
    );

    for (const id of [
      'local/trellis2',
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
    ]) {
      assert.equal(isCreativeMeshModelId(id), false, id);
      assert.equal(isLegacyLocalCreativeMeshModelId(id), true, id);
      assert.equal(normalizeCreativeMeshModelId(id), 'local/native', id);
    }
  });

  it('marks the native backend as text/image-capable with one reference image', () => {
    const definition = getCreativeMeshModelDefinition('local/native');
    assert.equal(definition?.supportsText, true);
    assert.equal(definition?.supportsImage, true);
    assert.equal(definition?.maxReferenceImages, 1);
    assert.equal(
      getCreativeMeshInputCapability('local/native'),
      'Text + image',
    );
  });

  it('allows text-only native Creative input', () => {
    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/native',
        parts: [{ type: 'text', text: 'Make a small dragon' }],
      }),
      null,
    );
  });

  it('rejects multiple native Creative reference images before generation', () => {
    const issue = getCreativeInputValidationIssue({
      conversationType: 'creative',
      model: 'local/native',
      parts: [
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'one.png',
          url: 'storage://one',
        },
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'two.png',
          url: 'storage://two',
        },
      ],
    });
    assert.equal(issue?.title, 'Too many reference images');
  });

  it('has UI mesh configuration for every active product mode', () => {
    for (const id of CREATIVE_MESH_MODEL_IDS) {
      assert.ok(MODEL_CONFIGS[id], id);
    }
    assert.equal(
      Object.prototype.hasOwnProperty.call(MODEL_CONFIGS, 'local/trellis2'),
      false,
    );
  });
});
