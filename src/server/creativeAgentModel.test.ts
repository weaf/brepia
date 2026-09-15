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
    source: 'local',
    enabled: true,
    available: true,
    ...overrides,
  };
}

describe('Creative agent model selection', () => {
  it('keeps an explicit request only when that model exists in Settings', () => {
    const requested = entry('local/qwen3.6-35b');
    const result = selectCreativeAgentModel(
      { settings: { model: 'quality' } },
      requested.id,
      [requested],
    );

    assert.deepEqual(result, {
      modelId: requested.id,
      source: 'request',
    });
  });

  it('ignores a stale pinned Creative agent and uses Settings fallback', () => {
    const result = selectCreativeAgentModel(
      {
        settings: {
          model: 'ultra',
          creativeAgentModel: 'agent/opencode/deleted/model',
        },
      },
      undefined,
      [entry('local/qwen3.6-35b')],
    );

    assert.deepEqual(result, {
      modelId: 'local/qwen3.6-35b',
      source: 'catalog',
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
        entry('local/qwen3.6-35b'),
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
