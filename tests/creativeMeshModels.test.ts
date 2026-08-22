import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CREATIVE_MESH_MODEL_IDS,
  CREATIVE_MESH_MODELS,
  getCreativeMeshModelDefinition,
  isFalCreativeMeshModel,
  isLocalCreativeMeshModel,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';

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
    for (const id of [
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
      'local/stable-fast-3d',
    ]) {
      const definition = getCreativeMeshModelDefinition(id);
      assert.equal(definition?.supportsText, false, id);
      assert.equal(definition?.supportsImage, true, id);
      assert.equal(definition?.requiresReferenceImage, true, id);
    }
  });

  it('has UI mesh configuration for every selectable backend', () => {
    for (const definition of CREATIVE_MESH_MODELS) {
      assert.ok(MODEL_CONFIGS[definition.id], definition.id);
    }
  });
});
