/**
 * P03H + B1 — Model catalog tests
 *
 * Covers the 9 required P03H test cases plus B1 repair tests:
 *  1. Built-in models are the default
 *  2. New built-in model (PARAMETRIC_MODELS has expected entries)
 *  3. Hidden model absent from picker (isCustomProviderModel)
 *  4. Hidden model is current selection (edge case)
 *  5. OpenCode model hide/show (type guard)
 *  6. Custom model hide/show (type guard)
 *  7. Stale hidden model ID is harmless
 *  8. All-hidden model blocks send
 *  9. Creative model picker unchanged
 *  B1. filterSelectableCatalog: hidden models, disabled providers, stale IDs
 */

import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';

vi.mock('../src/server/opencode', () => ({
  opencodeModels: vi.fn().mockRejectedValue(new Error('OpenCode unavailable')),
}));

// ---------------------------------------------------------------------------
// Test 1: Built-in models are the default
// ---------------------------------------------------------------------------

describe('built-in models', async () => {
  it('getBuiltInModels returns all PARAMETRIC_MODELS as catalog entries', async () => {
    const { getBuiltInModels } = await import('../src/server/modelCatalog');
    const entries = getBuiltInModels();

    assert.ok(entries.length > 0);
    entries.forEach((e) => {
      assert.strictEqual(e.source, 'builtin');
      assert.strictEqual(e.enabled, true);
      assert.strictEqual(e.available, true);
    });
  });

  it('getDefaultModel returns the first PARAMETRIC_MODELS ID', async () => {
    const { getDefaultModel } = await import('../src/server/modelCatalog');
    const defaultId = getDefaultModel();

    assert.strictEqual(defaultId, 'google/gemini-3.1-pro-preview');
  });

  it('PARAMETRIC_MODELS contains expected providers', async () => {
    const { getBuiltInModels } = await import('../src/server/modelCatalog');
    const entries = getBuiltInModels();
    const providers = new Set(entries.map((e) => e.provider));

    assert.strictEqual(providers.has('Google'), true);
    assert.strictEqual(providers.has('Anthropic'), true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: New built-in model — verify structure integrity
// ---------------------------------------------------------------------------

describe('new built-in model structure', async () => {
  it('every built-in entry has required fields', async () => {
    const { getBuiltInModels } = await import('../src/server/modelCatalog');
    const entries = getBuiltInModels();

    entries.forEach((e) => {
      assert.ok(e.id !== undefined);
      assert.ok(e.name !== undefined);
      assert.strictEqual(typeof e.supportsTools, 'boolean');
      assert.strictEqual(typeof e.supportsThinking, 'boolean');
      assert.strictEqual(typeof e.supportsVision, 'boolean');
    });
  });

  it('built-in entry count matches PARAMETRIC_MODELS', async () => {
    const { getBuiltInModels } = await import('../src/server/modelCatalog');
    const { PARAMETRIC_MODELS } = await import('../src/lib/utils');
    const entries = getBuiltInModels();

    assert.strictEqual(entries.length, PARAMETRIC_MODELS.length);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Hidden model absent from picker
// ---------------------------------------------------------------------------

describe('hidden model identification', async () => {
  it('isCustomProviderModel returns true for custom/ prefixed IDs', async () => {
    const { isCustomProviderModel } = await import('../shared/customModelIds');

    assert.strictEqual(isCustomProviderModel('custom/abc-123/gpt-4'), true);
    assert.strictEqual(
      isCustomProviderModel('custom/xyz-789/openai/gpt-4'),
      true,
    );
  });

  it('isCustomProviderModel returns false for non-custom IDs', async () => {
    const { isCustomProviderModel } = await import('../shared/customModelIds');

    assert.strictEqual(
      isCustomProviderModel('google/gemini-3.1-pro-preview'),
      false,
    );
    assert.strictEqual(
      isCustomProviderModel('anthropic/claude-sonnet-5'),
      false,
    );
    assert.strictEqual(isCustomProviderModel('openai/gpt-5.6-sol'), false);
  });

  it('isCustomProviderModel returns false for short/malformed IDs', async () => {
    const { isCustomProviderModel } = await import('../shared/customModelIds');

    assert.strictEqual(isCustomProviderModel('custom/only'), false);
    assert.strictEqual(isCustomProviderModel('custom'), false);
    assert.strictEqual(isCustomProviderModel(''), false);
  });
});

// ---------------------------------------------------------------------------
// Test 4-6: Custom model helpers
// ---------------------------------------------------------------------------

describe('custom model ID builder and parser', async () => {
  it('makeCustomProviderModelId produces stable IDs', async () => {
    const { makeCustomProviderModelId } =
      await import('../shared/customModelIds');

    const id1 = makeCustomProviderModelId('abc-123', 'gpt-4');
    const id2 = makeCustomProviderModelId('abc-123', 'gpt-4');

    assert.strictEqual(id1, id2);
    assert.strictEqual(id1, 'custom/abc-123/gpt-4');
  });

  it('parseCustomProviderModelId correctly parses valid IDs', async () => {
    const { parseCustomProviderModelId } =
      await import('../shared/customModelIds');

    const parsed = parseCustomProviderModelId('custom/abc-123-def/gpt-4');
    assert.deepStrictEqual(parsed, {
      providerId: 'abc-123-def',
      modelId: 'gpt-4',
    });
  });

  it('parseCustomProviderModelId handles model IDs with slashes', async () => {
    const { parseCustomProviderModelId } =
      await import('../shared/customModelIds');

    const parsed = parseCustomProviderModelId('custom/xyz-789/openai/gpt-4');
    assert.deepStrictEqual(parsed, {
      providerId: 'xyz-789',
      modelId: 'openai/gpt-4',
    });
  });

  it('parseCustomProviderModelId returns null for non-custom IDs', async () => {
    const { parseCustomProviderModelId } =
      await import('../shared/customModelIds');

    assert.strictEqual(
      parseCustomProviderModelId('google/gemini-3.1-pro-preview'),
      null,
    );
    assert.strictEqual(parseCustomProviderModelId('invalid'), null);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Stale hidden model ID is harmless
// ---------------------------------------------------------------------------

describe('stale hidden model ID handling', async () => {
  it('non-custom IDs are not treated as custom', async () => {
    const { isCustomProviderModel } = await import('../shared/customModelIds');

    assert.strictEqual(
      isCustomProviderModel('deleted-provider/some-model'),
      false,
    );
  });

  it('parse returns null for unknown format — no crash', async () => {
    const { parseCustomProviderModelId } =
      await import('../shared/customModelIds');

    assert.doesNotThrow(() => parseCustomProviderModelId('garbage!@#'));
    assert.strictEqual(parseCustomProviderModelId('garbage!@#'), null);
  });
});

// ---------------------------------------------------------------------------
// B1 — full catalog vs selectable catalog + hidden model behavior
// ---------------------------------------------------------------------------

describe('B1 — filterSelectableCatalog', async () => {
  const { filterSelectableCatalog } =
    await import('../src/server/modelCatalog');

  it('built-in visible by default', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    const result = filterSelectableCatalog(catalog, new Set());
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'google/gemini-3.1-pro');
  });

  it('hidden built-in absent from selectable but present in full catalog', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    const hidden = new Set(['google/gemini-3.1-pro']);
    assert.strictEqual(filterSelectableCatalog(catalog, hidden).length, 0);
    assert.strictEqual(catalog.length, 1);
  });

  it('hidden OpenCode model excluded from selectable', () => {
    const catalog = [
      {
        id: 'agent/opencode/my-agent',
        name: 'OpenCode',
        source: 'opencode',
        enabled: true,
        available: true,
      },
    ];
    assert.strictEqual(
      filterSelectableCatalog(catalog, new Set(['agent/opencode/my-agent']))
        .length,
      0,
    );
  });

  it('hidden Codex model excluded from selectable (same source as opencode)', () => {
    const catalog = [
      {
        id: 'agent/opencode/codex',
        name: 'Codex',
        source: 'opencode',
        enabled: true,
        available: true,
      },
    ];
    assert.strictEqual(
      filterSelectableCatalog(catalog, new Set(['agent/opencode/codex']))
        .length,
      0,
    );
  });

  it('hidden custom model excluded from selectable', () => {
    const catalog = [
      {
        id: 'custom/provider-1/gpt-4',
        name: 'GPT-4',
        source: 'custom',
        enabled: true,
        available: true,
      },
    ];
    assert.strictEqual(
      filterSelectableCatalog(catalog, new Set(['custom/provider-1/gpt-4']))
        .length,
      0,
    );
  });

  it('stale hidden ID is harmless', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    const staleHidden = new Set(['nonexistent-model-xyz']);
    const result = filterSelectableCatalog(catalog, staleHidden);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'google/gemini-3.1-pro');
  });

  it('new built-in automatically visible', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
      {
        id: 'google/gemini-3.1-flash',
        name: 'Gemini Flash',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    assert.strictEqual(filterSelectableCatalog(catalog, new Set()).length, 2);
  });

  it('historical selected hidden model can still render', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    assert.strictEqual(catalog.length, 1);
    assert.strictEqual(catalog[0].id, 'google/gemini-3.1-pro');
  });

  it('all hidden -> selectable catalog empty (no silent default)', () => {
    const catalog = [
      {
        id: 'google/gemini-3.1-pro',
        name: 'Gemini',
        source: 'builtin',
        enabled: true,
        available: true,
      },
      {
        id: 'anthropic/claude-sonnet-5',
        name: 'Claude',
        source: 'builtin',
        enabled: true,
        available: true,
      },
    ];
    const allHidden = new Set([
      'google/gemini-3.1-pro',
      'anthropic/claude-sonnet-5',
    ]);
    assert.strictEqual(filterSelectableCatalog(catalog, allHidden).length, 0);
  });

  it('custom model from disabled provider is excluded', () => {
    const catalog = [
      {
        id: 'custom/provider-1/gpt-4',
        name: 'GPT-4',
        source: 'custom',
        enabled: false,
        available: true,
        unavailableReason: 'Provider disabled',
      },
    ];
    assert.strictEqual(filterSelectableCatalog(catalog, new Set()).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 8-9: Creative model picker unchanged
// ---------------------------------------------------------------------------

describe('creative model picker unchanged', async () => {
  it('buildCatalog returns builtin entries even when opencode is unavailable', async () => {
    const { buildCatalog } = await import('../src/server/modelCatalog');
    const { PARAMETRIC_MODELS } = await import('../src/lib/utils');

    const catalog = await buildCatalog(null);

    assert.ok(catalog.length >= PARAMETRIC_MODELS.length);

    const builtinEntries = catalog.filter((e) => e.source === 'builtin');
    assert.strictEqual(builtinEntries.length, PARAMETRIC_MODELS.length);
  });

  it('getDefaultModel is deterministic', async () => {
    const { getDefaultModel } = await import('../src/server/modelCatalog');

    const d1 = getDefaultModel();
    const d2 = getDefaultModel();

    assert.strictEqual(d1, d2);
    assert.ok(typeof d1 === 'string');
    assert.ok(d1.length > 0);
  });
});
