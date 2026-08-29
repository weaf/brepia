import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isInternalCreativeRuntimeModelId } from '../shared/creativeRuntimeModels';
import { selectCreativeAgentModel } from '../src/server/creativeAgentModel';
import { applyLocalModelMetadata } from '../src/server/localModels';
import type { CatalogEntry } from '../src/server/modelCatalog';

const validCreativeAgent: CatalogEntry = {
  id: 'local/qwen-tool-model',
  name: 'Qwen tool model',
  description: 'Test tool-capable local chat model',
  provider: 'Local OpenAI / llama-swap',
  supportsTools: true,
  supportsThinking: false,
  supportsVision: false,
  source: 'local',
  enabled: true,
  available: true,
};

describe('native Creative runtime model isolation', () => {
  it('recognizes raw and local-prefixed runtime IDs', () => {
    for (const id of [
      'creative/z-image-turbo',
      'creative/trellis2',
      'local/creative/z-image-turbo',
      'local/creative/trellis2',
    ]) {
      assert.equal(isInternalCreativeRuntimeModelId(id), true, id);
    }
    assert.equal(isInternalCreativeRuntimeModelId('local/qwen-tool-model'), false);
  });

  it('removes Creative generation runtimes from discovered local chat models', () => {
    const discovered = applyLocalModelMetadata(
      ['creative/z-image-turbo', 'creative/trellis2', 'qwen-tool-model'],
      new Map(),
    );

    assert.deepEqual(
      discovered.map((model) => model.modelId),
      ['qwen-tool-model'],
    );
  });

  it('self-heals an accidentally pinned TRELLIS runtime by choosing a real chat model', () => {
    const result = selectCreativeAgentModel(
      { settings: { creativeAgentModel: 'local/creative/trellis2' } },
      undefined,
      [validCreativeAgent],
    );

    assert.deepEqual(result, {
      modelId: 'local/qwen-tool-model',
      source: 'catalog',
    });
  });

  it('never chooses a Creative runtime from catalog fallback', () => {
    const runtimeEntry: CatalogEntry = {
      ...validCreativeAgent,
      id: 'local/creative/trellis2',
      name: 'TRELLIS.2 runtime',
    };

    const result = selectCreativeAgentModel(
      { settings: null },
      undefined,
      [runtimeEntry, validCreativeAgent],
    );

    assert.equal(result?.modelId, 'local/qwen-tool-model');
  });
});
