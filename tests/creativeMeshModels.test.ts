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
  isNativeTrellis2Model,
  normalizeCreativeMeshModelId,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';
import { getCreativeInputValidationIssue } from '../src/lib/creativeInputValidation';

describe('Creative mesh backend catalog', () => {
  it('keeps TRELLIS.2 as the only built-in Creative model', () => {
    assert.deepEqual(
      CORE_CREATIVE_MESH_MODELS.map((model) => model.id),
      ['local/trellis2'],
    );
    assert.equal(isLocalCreativeMeshModel('local/trellis2'), true);
    assert.equal(isNativeTrellis2Model('local/trellis2'), true);
  });

  it('keeps fal.ai models as optional provider models', () => {
    assert.deepEqual([...FAL_CREATIVE_MESH_MODEL_IDS], [
      'ultra',
      'quality',
      'fast',
    ]);
    for (const id of FAL_CREATIVE_MESH_MODEL_IDS) {
      assert.equal(isFalCreativeMeshModel(id), true, id);
      assert.equal(getCreativeMeshModelDefinition(id)?.provider, 'fal', id);
    }
  });

  it('does not expose retired local backends as selectable model IDs', () => {
    assert.deepEqual([...CREATIVE_MESH_MODEL_IDS], [
      'local/trellis2',
      'ultra',
      'quality',
      'fast',
    ]);

    for (const id of [
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
    ]) {
      assert.equal(isCreativeMeshModelId(id), false, id);
      assert.equal(isLegacyLocalCreativeMeshModelId(id), true, id);
      assert.equal(normalizeCreativeMeshModelId(id), 'local/trellis2', id);
    }
  });

  it('marks TRELLIS.2 as text/image-capable with one reference image', () => {
    const definition = getCreativeMeshModelDefinition('local/trellis2');
    assert.equal(definition?.supportsText, true);
    assert.equal(definition?.supportsImage, true);
    assert.equal(definition?.maxReferenceImages, 1);
    assert.equal(getCreativeMeshInputCapability('local/trellis2'), 'Text + image');
  });

  it('allows text-only TRELLIS.2 input', () => {
    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/trellis2',
        parts: [{ type: 'text', text: 'Make a small dragon' }],
      }),
      null,
    );
  });

  it('rejects multiple TRELLIS.2 reference images before generation', () => {
    const issue = getCreativeInputValidationIssue({
      conversationType: 'creative',
      model: 'local/trellis2',
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

  it('has UI mesh configuration for every active model definition', () => {
    for (const id of CREATIVE_MESH_MODEL_IDS) {
      assert.ok(MODEL_CONFIGS[id], id);
    }
    assert.equal(
      Object.prototype.hasOwnProperty.call(MODEL_CONFIGS, 'local/trellis-v1'),
      false,
    );
  });
});
