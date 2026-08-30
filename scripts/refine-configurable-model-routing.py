from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


# Model routing UI: keep a real combobox/selector, but do not suggest the chat
# model catalog for provider-specific APIs whose model-id namespaces differ.
text = read('src/components/settings/CreativeRuntimeModelSettings.tsx')
text = text.replace("import { ProviderLogo } from '@/components/ProviderLogo';\n", '')
text = text.replace("import { useFullParametricModelCatalog } from '@/hooks/useParametricModelCatalog';\n", '')
text = text.replace("import type { CatalogEntry } from '@/server/modelCatalog';\n", '')
text = text.replace("  models,\n", '')
text = text.replace("  models: CatalogEntry[];\n", '')
text = text.replace("  const [open, setOpen] = React.useState(false);\n  const [query, setQuery] = React.useState('');\n  const selected = models.find((model) => model.id === value);\n  const customCandidate = query.trim();\n  const customMatchesCatalog = models.some(\n    (model) => model.id === customCandidate,\n  );\n", "  const [open, setOpen] = useState(false);\n  const [query, setQuery] = useState('');\n  const customCandidate = query.trim();\n")
text = text.replace("            {models.length > 0 && (\n              <>\n                <CommandSeparator />\n                <CommandGroup heading=\"Model catalog\">\n                  {models.map((model) => (\n                    <CommandItem\n                      key={model.id}\n                      value={`${model.id} ${model.name} ${model.provider ?? ''}`}\n                      disabled={!model.enabled || !model.available}\n                      onSelect={() => choose(model.id)}\n                    >\n                      <Check\n                        className={cn(\n                          'mr-2 h-4 w-4',\n                          value === model.id ? 'opacity-100' : 'opacity-0',\n                        )}\n                      />\n                      <ProviderLogo provider={model.provider} className=\"mr-2\" />\n                      <span className=\"min-w-0 flex-1 truncate\">{model.name}</span>\n                      <span className=\"ml-2 max-w-[45%] truncate text-xs text-adam-neutral-400\">\n                        {model.id}\n                      </span>\n                    </CommandItem>\n                  ))}\n                </CommandGroup>\n              </>\n            )}\n            {customCandidate && !customMatchesCatalog && customCandidate !== value && (\n", "            {customCandidate && customCandidate !== value && (\n")
text = text.replace("            {selected?.name ?? value ?? 'Not configured'}\n", "            {value ?? 'Not configured'}\n")
text = text.replace("  const {\n    models: catalogModels,\n    isLoading: catalogLoading,\n    error: catalogError,\n  } = useFullParametricModelCatalog();\n", '')
text = text.replace("        {catalogError && (\n          <p className=\"mt-2 text-xs text-amber-400\">\n            Model catalog suggestions are unavailable: {catalogError}. Custom\n            model IDs can still be configured.\n          </p>\n        )}\n", '')
text = text.replace("                models={catalogModels}\n                disabled={mutation.isPending || catalogLoading}\n", "                disabled={mutation.isPending}\n")
text = text.replace("          model is silently selected in runtime code. Pick a discovered catalog model or\n          enter a provider-specific model ID. Empty roles fail closed instead of\n", "          model is silently selected in runtime code. Select or enter the exact\n          provider-specific model ID for each role. Empty roles fail closed instead of\n")
text = text.replace("            placeholder=\"Search catalog or enter model ID…\"\n", "            placeholder=\"Enter model ID…\"\n")
text = text.replace("              Type a model ID to use a provider-specific model.\n", "              Type a model ID and choose it below.\n")
if "useState" not in text.split('\n', 4)[0:4].__str__():
    text = "import { useState } from 'react';\n" + text
write('src/components/settings/CreativeRuntimeModelSettings.tsx', text)

# Public/native Creative backend identity is a product contract, not a model ID.
text = read('src/server/nativeCreativeMesh.ts')
text = text.replace('NATIVE_TRELLIS2_MODEL_ID', 'NATIVE_CREATIVE_MESH_MODEL_ID')
text = text.replace("'z-image-generate'", "'conditioning-image-generate'")
text = text.replace("'trellis-generate'", "'mesh-generate'")
text = text.replace('generateTrellisGlb', 'generateNativeMeshGlb')
text = text.replace('Invalid TRELLIS.2 request body', 'Invalid native Creative request body')
text = text.replace('Text or a reference image is required for TRELLIS.2', 'Text or a reference image is required for native Creative generation')
text = text.replace('TRELLIS.2 currently accepts one reference image per generation.', 'The native Creative backend currently accepts one reference image per generation.')
text = text.replace('Failed to create TRELLIS.2 mesh job', 'Failed to create native Creative mesh job')
text = text.replace('Failed to finalize TRELLIS.2 mesh', 'Failed to finalize native Creative mesh')
text = text.replace('generating TRELLIS conditioning image', 'generating native conditioning image')
write('src/server/nativeCreativeMesh.ts', text)

# Remove the final silent provider fallback. Unknown models stay unresolved.
replace_once(
    'src/server/mesh.ts',
    "  getCreativeMeshProviderAdapter,\n  resolveCreativeMeshProvider,\n",
    "  resolveCreativeMeshProvider,\n",
)
text = read('src/server/mesh.ts')
text = text.replace('starting a second expensive TRELLIS.2 generation.', 'starting a second expensive native Creative generation.')
text = text.replace(
    " * TRELLIS.2 is the built-in backend. Hosted services are optional provider\n * adapters selected by configuration. Retired local model IDs are normalized\n * forward to TRELLIS.2 so old conversations stay usable without reviving the\n * removed Python gateway.\n",
    " * The built-in local backend is a model-neutral product mode. Hosted services\n * are optional provider adapters selected by configuration. Retired model-specific\n * local backend IDs are normalized forward to the neutral native mode so old\n * conversations stay usable without selecting a concrete runtime model in code.\n",
)
old_tail = "\nexport function creativeMeshProviderForModel(model: string) {\n  const resolved = resolveCreativeMeshProvider(model);\n  return resolved?.provider ?? getCreativeMeshProviderAdapter('local');\n}\n"
if old_tail not in text:
    raise SystemExit('Expected creativeMeshProviderForModel fallback not found')
text = text.replace(old_tail, '\n')
write('src/server/mesh.ts', text)

# Product-mode UI configuration follows the neutral backend ID.
text = read('src/constants/meshConstants.ts')
text = text.replace("'local/trellis2':", "'local/native':")
write('src/constants/meshConstants.ts', text)

text = read('src/hooks/useLoadingProgress.tsx')
text = text.replace('TRELLIS.2 includes first-run model loading', 'The native Creative backend can include first-run model loading')
text = text.replace("'local/trellis2'", "'local/native'")
write('src/hooks/useLoadingProgress.tsx', text)

# Existing preference rows move to the neutral backend identity. Historical
# concrete IDs remain only in this migration/compatibility layer.
path = 'supabase/migrations/20260830194000_configurable_model_routing.sql'
text = read(path)
text = text.replace("SET default_creative_model_id = 'local/trellis2'\nWHERE default_creative_model_id IS NULL;", "SET default_creative_model_id = 'local/native'\nWHERE default_creative_model_id IS NULL;\n\nUPDATE public.user_ai_preferences\nSET default_creative_model_id = 'local/native'\nWHERE default_creative_model_id IN (\n  'local/trellis2',\n  'local/trellis-v1',\n  'local/hunyuan3d-2',\n  'local/hunyuan3d-2.1'\n);")
write(path, text)

# Focused tests for neutral backend compatibility and no hidden provider fallback.
write(
    'tests/creativeMeshModels.test.ts',
    r'''import assert from 'node:assert/strict';
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
  isNativeCreativeMeshModel,
  normalizeCreativeMeshModelId,
} from '../shared/creativeMeshModels';
import { MODEL_CONFIGS } from '../src/constants/meshConstants';
import { getCreativeInputValidationIssue } from '../src/lib/creativeInputValidation';

describe('Creative mesh backend catalog', () => {
  it('keeps a model-neutral local backend as the only built-in Creative mode', () => {
    assert.deepEqual(
      CORE_CREATIVE_MESH_MODELS.map((model) => model.id),
      ['local/native'],
    );
    assert.equal(isLocalCreativeMeshModel('local/native'), true);
    assert.equal(isNativeCreativeMeshModel('local/native'), true);
  });

  it('keeps hosted product modes behind the optional provider', () => {
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

  it('normalizes model-specific legacy local IDs to the neutral native mode', () => {
    assert.deepEqual([...CREATIVE_MESH_MODEL_IDS], [
      'local/native',
      'ultra',
      'quality',
      'fast',
    ]);

    for (const id of [
      'local/trellis2',
      'local/trellis-v1',
      'local/hunyuan3d-2',
      'local/hunyuan3d-2.1',
    ]) {
      assert.equal(isCreativeMeshModelId(id), false, id);
      assert.equal(isLegacyLocalCreativeMeshModelId(id), true, id);
      assert.equal(normalizeCreativeMeshModelId(id), 'local/native', id);
    }
  });

  it('marks the native backend as text/image-capable with one reference image', () => {
    const definition = getCreativeMeshModelDefinition('local/native');
    assert.equal(definition?.supportsText, true);
    assert.equal(definition?.supportsImage, true);
    assert.equal(definition?.maxReferenceImages, 1);
    assert.equal(getCreativeMeshInputCapability('local/native'), 'Text + image');
  });

  it('allows text-only native Creative input', () => {
    assert.equal(
      getCreativeInputValidationIssue({
        conversationType: 'creative',
        model: 'local/native',
        parts: [{ type: 'text', text: 'Make a small dragon' }],
      }),
      null,
    );
  });

  it('rejects multiple native Creative reference images before generation', () => {
    const issue = getCreativeInputValidationIssue({
      conversationType: 'creative',
      model: 'local/native',
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

  it('has UI mesh configuration for every active product mode', () => {
    for (const id of CREATIVE_MESH_MODEL_IDS) {
      assert.ok(MODEL_CONFIGS[id], id);
    }
    assert.equal(
      Object.prototype.hasOwnProperty.call(MODEL_CONFIGS, 'local/trellis2'),
      false,
    );
  });
});
''',
)

write(
    'tests/creativeMeshProviderRegistry.test.ts',
    r'''import { afterEach, describe, expect, it } from 'vitest';
import { resolveCreativeMeshProvider } from '../src/server/creativeMeshProviderRegistry';

const originalProviderList = process.env.PCAD_CREATIVE_MESH_PROVIDERS;
const originalFalKey = process.env.FAL_KEY;

afterEach(() => {
  if (originalProviderList === undefined) {
    delete process.env.PCAD_CREATIVE_MESH_PROVIDERS;
  } else {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = originalProviderList;
  }
  if (originalFalKey === undefined) {
    delete process.env.FAL_KEY;
  } else {
    process.env.FAL_KEY = originalFalKey;
  }
});

describe('Creative mesh provider registry', () => {
  it('keeps the neutral native backend enabled as the core provider', () => {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    const resolved = resolveCreativeMeshProvider('local/native');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/native');
    expect(resolved?.enabled).toBe(true);
  });

  it('normalizes legacy model-specific local IDs to the native backend', () => {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    const resolved = resolveCreativeMeshProvider('local/trellis2');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/native');
    expect(resolved?.enabled).toBe(true);
  });

  it('does not resolve an unknown model to a hidden provider fallback', () => {
    expect(resolveCreativeMeshProvider('not-configured')).toBeNull();
  });

  it('requires both provider opt-in and credentials for fal.ai', () => {
    process.env.FAL_KEY = 'test-key';
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(false);

    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'fal';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(true);
  });

  it('keeps an opted-in provider disabled when credentials are absent', () => {
    delete process.env.FAL_KEY;
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'fal';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(false);
  });
});
''',
)

text = read('tests/defaultModels.test.ts')
text = text.replace("{ id: 'local/trellis2' }", "{ id: 'local/native' }")
text = text.replace(".toBe('local/trellis2');", ".toBe('local/native');")
write('tests/defaultModels.test.ts', text)

# Documentation: make the product-mode/runtime-model split explicit.
path = 'docs/model_routing_plan.md'
text = read(path)
text += "\n## Native backend identity\n\nThe selectable built-in Creative backend is `local/native`. Historical model-specific backend IDs such as `local/trellis2` are compatibility aliases only. The actual local conditioning-image and mesh runtime model IDs come from `modelRouting` settings, so changing the upstream model does not require changing conversation/backend identity.\n\nThe low-level Settings control is a model-ID combobox. Provider-specific APIs use different namespaces, so values are entered/selected explicitly rather than borrowing incompatible IDs from the chat/Parametric model catalog. Provider discovery can supply candidates to the same control later without adding runtime defaults.\n"
write(path, text)

print('Applied final configurable model routing refinements')
