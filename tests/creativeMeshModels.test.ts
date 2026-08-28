import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  CREATIVE_MESH_MODEL_IDS,
  CREATIVE_MESH_MODELS,
  getCreativeMeshInputCapability,
  getCreativeMeshModelDefinition,
  isFalCreativeMeshModel,
  isLocalCreativeMeshModel,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';
import { getCreativeInputValidationIssue } from '../src/lib/creativeInputValidation';

describe('Creative mesh backend catalog', () => {
  it('contains all four local backends plus the three legacy fal.ai IDs', () => {
    assert.deepEqual([...CREATIVE_MESH_MODEL_IDS], [
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
      'local/stable-fast-3d',
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

  it('routes all requested open-source backends locally', () => {
    for (const id of [
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
      'local/stable-fast-3d',
    ]) {
      assert.equal(isLocalCreativeMeshModel(id), true, id);
    }
  });

  it('marks TRELLIS as text-capable and image-only models explicitly', () => {
    assert.equal(getCreativeMeshModelDefinition('local/trellis-v1')?.supportsText, true);
    assert.equal(getCreativeMeshInputCapability('local/trellis-v1'), 'Text + image');
    for (const id of [
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
      'local/stable-fast-3d',
    ]) {
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
    assert.match(issue?.description ?? '', /TRELLIS v1/);
  });

  it('allows TRELLIS text-only input and image-backed Hunyuan input', () => {
    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/trellis-v1',
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
