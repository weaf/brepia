import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLocalModelMetadata,
  normalizeLocalOpenAiUrls,
  parseLocalOpenAiModelIds,
} from './localModels.ts';

describe('local model discovery', () => {
  it('normalizes a versioned llama-swap endpoint without duplicating /v1', () => {
    assert.deepEqual(normalizeLocalOpenAiUrls('http://127.0.0.1:9292/v1/'), {
      baseUrl: 'http://127.0.0.1:9292/v1',
      modelsUrl: 'http://127.0.0.1:9292/v1/models',
      rootUrl: 'http://127.0.0.1:9292',
    });
  });

  it('extracts unique model IDs from OpenAI-compatible /v1/models payloads', () => {
    assert.deepEqual(
      parseLocalOpenAiModelIds({
        data: [
          { id: 'qwen-coder' },
          { id: 'qwen-vision' },
          { id: 'qwen-coder' },
          { id: '' },
          { nope: true },
        ],
      }),
      ['qwen-coder', 'qwen-vision'],
    );
  });

  it('uses safe capability defaults when no user metadata exists', () => {
    const [model] = applyLocalModelMetadata(['qwen-coder'], new Map());
    assert.deepEqual(model, {
      id: 'local/qwen-coder',
      modelId: 'qwen-coder',
      displayName: 'qwen-coder',
      provider: 'Local OpenAI / llama-swap',
      supportsTools: true,
      supportsThinking: false,
      supportsVision: false,
      contextLimit: null,
      outputLimit: null,
      isVisible: true,
      metadataConfigured: false,
    });
  });

  it('applies saved capability metadata to discovered models', () => {
    const metadata = new Map([
      [
        'qwen-vision',
        {
          model_id: 'qwen-vision',
          display_name: 'Qwen Vision',
          supports_tools: false,
          supports_thinking: true,
          supports_vision: true,
          context_limit: 65536,
          output_limit: 8192,
          is_visible: true,
        },
      ],
    ]);
    const [model] = applyLocalModelMetadata(['qwen-vision'], metadata);
    assert.equal(model.displayName, 'Qwen Vision');
    assert.equal(model.supportsTools, false);
    assert.equal(model.supportsThinking, true);
    assert.equal(model.supportsVision, true);
    assert.equal(model.contextLimit, 65536);
    assert.equal(model.outputLimit, 8192);
    assert.equal(model.metadataConfigured, true);
  });
});
