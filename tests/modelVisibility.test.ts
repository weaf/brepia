import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  isDiscoveredOpenCodeModelId,
  isModelVisibleByPreference,
  UpdateModelVisibilitySchema,
} from '../shared/modelVisibility';
import {
  filterSelectableCatalog,
  type CatalogEntry,
} from '../src/server/modelCatalog';

function entry(
  id: string,
  source: CatalogEntry['source'] = 'opencode',
): CatalogEntry {
  return {
    id,
    name: id,
    description: '',
    provider: source === 'opencode' ? 'OpenCode Agent' : 'Test',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
    source,
    enabled: true,
    available: true,
  };
}

describe('dynamic OpenCode model visibility', () => {
  const first = entry('agent/opencode/llama-swap/model-a');
  const second = entry('agent/opencode/llama-swap/model-b');

  it('keeps newly discovered OpenCode models disabled by default', () => {
    assert.equal(filterSelectableCatalog([first], new Set()).length, 0);
    assert.equal(
      isModelVisibleByPreference(first, {
        hiddenModelIds: [],
        enabledOpenCodeModelIds: [],
      }),
      false,
    );
  });

  it('shows an OpenCode model only after that exact id is enabled', () => {
    const selectable = filterSelectableCatalog(
      [first, second],
      new Set(),
      new Set([first.id]),
    );

    assert.deepEqual(
      selectable.map((model) => model.id),
      [first.id],
    );
  });

  it('does not auto-enable a later OpenCode discovery', () => {
    const enabled = new Set([first.id]);
    const before = filterSelectableCatalog([first], new Set(), enabled);
    const after = filterSelectableCatalog([first, second], new Set(), enabled);

    assert.deepEqual(before.map((model) => model.id), [first.id]);
    assert.deepEqual(after.map((model) => model.id), [first.id]);
  });

  it('does not apply the OpenCode allowlist to configured Codex models', () => {
    const codex = entry('agent/codex/gpt-5.6-sol');
    const selectable = filterSelectableCatalog([codex], new Set(), new Set());

    assert.deepEqual(selectable.map((model) => model.id), [codex.id]);
  });

  it('preserves hidden-id behavior for non-OpenCode models', () => {
    const builtin = entry('google/gemini-test', 'builtin');

    assert.equal(
      filterSelectableCatalog([builtin], new Set([builtin.id]), new Set())
        .length,
      0,
    );
    assert.equal(
      filterSelectableCatalog([builtin], new Set(), new Set()).length,
      1,
    );
  });

  it('recognizes only dynamic agent/opencode ids as allowlist-controlled', () => {
    assert.equal(isDiscoveredOpenCodeModelId(first.id), true);
    assert.equal(isDiscoveredOpenCodeModelId('agent/codex/gpt-5.6-sol'), false);
    assert.equal(isDiscoveredOpenCodeModelId('local/model-a'), false);
  });

  it('rejects malformed visibility preference payloads', () => {
    assert.equal(
      UpdateModelVisibilitySchema.safeParse({
        enabledOpenCodeModelIds: ['agent/opencode/llama-swap/model-a'],
      }).success,
      true,
    );
    assert.equal(
      UpdateModelVisibilitySchema.safeParse({
        enabledOpenCodeModelIds: 'agent/opencode/llama-swap/model-a',
      }).success,
      false,
    );
  });
});
