import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';

vi.mock('../src/server/opencode', () => ({
  opencodeModels: vi.fn().mockRejectedValue(new Error('OpenCode unavailable')),
}));

describe('Settings-owned model catalog', () => {
  it('has no built-in models or compile-time default', async () => {
    const { getBuiltInModels, getDefaultModel } =
      await import('../src/server/modelCatalog');

    assert.deepStrictEqual(getBuiltInModels(), []);
    assert.equal(getDefaultModel(), undefined);
  });

  it('buildCatalog never manufactures builtin entries', async () => {
    const { buildCatalog } = await import('../src/server/modelCatalog');
    const catalog = await buildCatalog(null);

    assert.equal(catalog.some((entry) => entry.source === 'builtin'), false);
  });

  it('filters hidden, disabled and unavailable Settings entries', async () => {
    const { filterSelectableCatalog } =
      await import('../src/server/modelCatalog');
    const catalog = [
      {
        id: 'local/visible',
        name: 'Visible',
        source: 'local' as const,
        enabled: true,
        available: true,
      },
      {
        id: 'local/hidden',
        name: 'Hidden',
        source: 'local' as const,
        enabled: true,
        available: true,
      },
      {
        id: 'custom/provider/model-disabled',
        name: 'Disabled',
        source: 'custom' as const,
        enabled: false,
        available: true,
      },
      {
        id: 'custom/provider/model-unavailable',
        name: 'Unavailable',
        source: 'custom' as const,
        enabled: true,
        available: false,
      },
    ];

    const result = filterSelectableCatalog(catalog, new Set(['local/hidden']));
    assert.deepStrictEqual(result.map((entry) => entry.id), ['local/visible']);
  });

  it('requires discovered OpenCode models to be explicitly enabled', async () => {
    const { filterSelectableCatalog } =
      await import('../src/server/modelCatalog');
    const catalog = [
      {
        id: 'agent/opencode/llama-swap/model-a',
        name: 'OpenCode A',
        source: 'opencode' as const,
        enabled: true,
        available: true,
      },
      {
        id: 'local/model-b',
        name: 'Local B',
        source: 'local' as const,
        enabled: true,
        available: true,
      },
    ];

    const disabled = filterSelectableCatalog(catalog, new Set(), new Set());
    assert.deepStrictEqual(disabled.map((entry) => entry.id), ['local/model-b']);

    const enabled = filterSelectableCatalog(
      catalog,
      new Set(),
      new Set(['agent/opencode/llama-swap/model-a']),
    );
    assert.deepStrictEqual(enabled.map((entry) => entry.id), [
      'agent/opencode/llama-swap/model-a',
      'local/model-b',
    ]);
  });

  it('keeps custom provider model IDs explicit and stable', async () => {
    const { makeCustomProviderModelId, parseCustomProviderModelId } =
      await import('../shared/customModelIds');

    const id = makeCustomProviderModelId('provider-123', 'vendor/model-a');
    assert.equal(id, 'custom/provider-123/vendor/model-a');
    assert.deepStrictEqual(parseCustomProviderModelId(id), {
      providerId: 'provider-123',
      modelId: 'vendor/model-a',
    });
  });
});
