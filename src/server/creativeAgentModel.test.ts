import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CatalogEntry } from './modelCatalog';
import { selectCreativeAgentModel } from './creativeAgentModel';

function entry(
  id: string,
  overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    id,
    name: id,
    description: '',
    provider: 'test',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
    source: 'builtin',
    enabled: true,
    available: true,
    ...overrides,
  };
}

describe('Creative agent model selection', () => {
  it('keeps an explicit request separate from the mesh backend', () => {
    const result = selectCreativeAgentModel(
      { settings: { model: 'quality' } },
      'local/qwen3.6-35b',
      [entry('google/gemini-3.1-pro-preview')],
    );

    assert.deepEqual(result, {
      modelId: 'local/qwen3.6-35b',
      source: 'request',
    });
  });

  it('uses the conversation-pinned Creative agent before catalog fallback', () => {
    const result = selectCreativeAgentModel(
      {
        settings: {
          model: 'ultra',
          creativeAgentModel: 'agent/opencode/llama-swap/qwen3.6-35b',
        },
      },
      undefined,
      [entry('google/gemini-3.1-pro-preview')],
    );

    assert.deepEqual(result, {
      modelId: 'agent/opencode/llama-swap/qwen3.6-35b',
      source: 'conversation',
    });
  });

  it('falls back only to a selectable direct tool-capable catalog model', () => {
    const result = selectCreativeAgentModel(
      { settings: { model: 'fast' } },
      undefined,
      [
        entry('disabled/model', { enabled: false }),
        entry('no-tools/model', { supportsTools: false }),
        entry('agent/opencode/test/model', { source: 'opencode' }),
        entry('local/qwen3.6-35b', { source: 'local' }),
      ],
    );

    assert.deepEqual(result, {
      modelId: 'local/qwen3.6-35b',
      source: 'catalog',
    });
  });

  it('returns null when only parametric agent adapters are selectable', () => {
    const result = selectCreativeAgentModel(
      { settings: { model: 'quality' } },
      undefined,
      [entry('agent/opencode/test/model', { source: 'opencode' })],
    );

    assert.equal(result, null);
  });

  it('returns null when no enabled tool-capable agent exists', () => {
    const result = selectCreativeAgentModel(
      { settings: { model: 'quality' } },
      undefined,
      [entry('no-tools/model', { supportsTools: false })],
    );

    assert.equal(result, null);
  });
});
