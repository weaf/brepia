/**
 * Model Catalog — unified model discovery layer.
 *
 * Merges model sources into a single effective catalog for the
 * parametric picker and settings UI:
 *
 *   1. Built-in hosted parametric models (PARAMETRIC_MODELS from src/lib/utils.ts)
 *   2. Dynamic Local OpenAI / llama-swap models from GET /v1/models
 *   3. Dynamic OpenCode agent models (fetched from opencode serve HTTP API/CLI)
 *   4. Configured Codex CLI agent models
 *   5. Custom provider models (from the ai_provider_models DB table)
 */

import {
  makeCustomProviderModelId,
  parseCustomProviderModelId,
} from '../../shared/customModelIds';
import { getUserProviders, getProviderModels } from './customProviders';
import type { User } from '@supabase/supabase-js';
import { opencodeModels } from './opencode';
import { configuredCodexModels } from './cliAgents';
import type { ModelConfig } from '../../src/types/misc';
import { getPreferences } from './aiSettings';
import {
  loadBuiltinProviderRuntimeOverrides,
  type BuiltinProviderDriver,
} from './builtinProviderOverrides';
import { discoverLocalModels } from './localModels';
import { PARAMETRIC_MODELS } from '../../src/lib/utils';

export type CatalogEntrySource = 'builtin' | 'local' | 'opencode' | 'custom';

export interface CatalogEntry extends ModelConfig {
  source: CatalogEntrySource;
  enabled: boolean;
  available: boolean;
  unavailableReason?: string;
}

export function isCustomCatalogEntry(entry: CatalogEntry): boolean {
  return entry.source === 'custom';
}

function toBuiltinCatalogEntry(m: ModelConfig): CatalogEntry {
  return {
    ...m,
    source: 'builtin' as const,
    enabled: true,
    available: true,
  };
}

export function getBuiltInModels(): CatalogEntry[] {
  return PARAMETRIC_MODELS.map(toBuiltinCatalogEntry);
}

function builtinDriverForModelId(modelId: string): BuiltinProviderDriver {
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('google/')) return 'google';
  return 'openrouter';
}

async function applyBuiltinProviderAvailability(
  models: CatalogEntry[],
  user: User | null,
): Promise<CatalogEntry[]> {
  if (!user) return models;

  try {
    const overrides = await loadBuiltinProviderRuntimeOverrides(user.id);
    return models.map((entry) => {
      const driver = builtinDriverForModelId(entry.id);
      if (overrides[driver]?.enabled !== false) return entry;
      return {
        ...entry,
        enabled: false,
        available: false,
        unavailableReason: `${entry.provider ?? driver} is disabled in AI Settings`,
      };
    });
  } catch {
    // Catalog discovery should remain usable if provider preference storage is
    // temporarily unavailable. The actual inference path still fails closed
    // when it cannot load provider overrides.
    return models;
  }
}

export async function getLocalModels(
  user: User | null,
): Promise<CatalogEntry[]> {
  if (!user) return [];

  try {
    const models = await discoverLocalModels(user.id);
    return models.map((model) => ({
      id: model.id,
      name: model.displayName,
      description: model.metadataConfigured
        ? 'Discovered from Local OpenAI / llama-swap with user capability metadata'
        : 'Discovered dynamically from Local OpenAI / llama-swap',
      provider: model.provider,
      supportsTools: model.supportsTools,
      supportsThinking: model.supportsThinking,
      supportsVision: model.supportsVision,
      source: 'local' as const,
      enabled: model.isVisible,
      available: true,
      ...(!model.isVisible
        ? { unavailableReason: 'Disabled in local model metadata' }
        : {}),
    }));
  } catch {
    return [];
  }
}

function toOpencodeCatalogEntry(m: {
  cliId: string;
  name: string;
  providerID: string;
}): CatalogEntry | undefined {
  if (!m.cliId || !m.name) return undefined;

  return {
    id: `agent/opencode/${m.cliId}`,
    name: `OpenCode · ${m.name}`,
    description: `OpenCode agent via ${m.providerID}`,
    provider: 'OpenCode Agent',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
    source: 'opencode' as const,
    enabled: true,
    available: true,
  };
}

function toCodexCatalogEntry(
  model: ReturnType<typeof configuredCodexModels>[number],
): CatalogEntry {
  return {
    ...model,
    source: 'opencode' as const,
    enabled: true,
    available: true,
  };
}

export async function getOpencodeModels(): Promise<CatalogEntry[]> {
  let openCodeEntries: CatalogEntry[] = [];
  try {
    const models = await opencodeModels();
    openCodeEntries = models
      .map(toOpencodeCatalogEntry)
      .filter((e): e is CatalogEntry => e !== undefined);
  } catch {
    // OpenCode server/CLI unreachable — Codex may still be available.
  }

  const codexEntries = configuredCodexModels().map(toCodexCatalogEntry);
  return [...openCodeEntries, ...codexEntries];
}

function toCustomCatalogEntry(
  model: {
    id: string;
    providerId: string;
    userId: string;
    modelId: string;
    displayName: string;
    description?: string | null;
    supportsTools?: boolean;
    supportsThinking?: boolean;
    supportsVision?: boolean;
    isVisible: boolean;
    createdAt: string;
    updatedAt: string;
  },
  providerName: string,
  enabled: boolean,
): CatalogEntry {
  return {
    id: makeCustomProviderModelId(model.providerId, model.modelId),
    name: model.displayName,
    description: model.description ?? '',
    provider: providerName,
    supportsTools: model.supportsTools ?? false,
    supportsThinking: model.supportsThinking ?? false,
    supportsVision: model.supportsVision ?? false,
    source: 'custom' as const,
    enabled: enabled && model.isVisible,
    available: true,
    ...(!enabled
      ? { unavailableReason: `${providerName} is disabled in AI Settings` }
      : {}),
  };
}

export async function getCustomProviderModels(
  user: User | null,
): Promise<CatalogEntry[]> {
  if (!user) return [];

  try {
    const providers = await getUserProviders(user);
    const results: CatalogEntry[] = [];

    for (const provider of providers) {
      // Reserved builtin-* rows are configuration overlays for the canonical
      // built-in catalog, not independent custom providers/models.
      if (provider.slug.startsWith('builtin-')) continue;
      const models = await getProviderModels(provider.id, user.id);
      for (const model of models) {
        results.push(
          toCustomCatalogEntry(model, provider.name, provider.enabled),
        );
      }
    }

    return results;
  } catch {
    return [];
  }
}

function mergeByProvider(
  opencode: CatalogEntry[],
  custom: CatalogEntry[],
): CatalogEntry[] {
  const customByProvider = new Map<string, Map<string, CatalogEntry>>();

  for (const entry of custom) {
    const provider = entry.provider ?? 'Unknown';
    const models = customByProvider.get(provider) ?? new Map();
    const parsed = parseCustomProviderModelId(entry.id);
    if (parsed) {
      models.set(parsed.modelId, entry);
    }
    customByProvider.set(provider, models);
  }

  const opencodeByProvider = new Map<string, Map<string, CatalogEntry>>();
  const ordering: { provider: string; nativeId: string }[] = [];

  for (const entry of opencode) {
    const cliId = entry.id.replace('agent/opencode/', '');
    const provider = entry.provider ?? 'Unknown';
    const models = opencodeByProvider.get(provider) ?? new Map();
    models.set(cliId, entry);
    opencodeByProvider.set(provider, models);
    ordering.push({ provider, nativeId: cliId });
  }

  const result: CatalogEntry[] = [];

  for (const { provider, nativeId } of ordering) {
    const opencodeModels = opencodeByProvider.get(provider);
    const customModels = customByProvider.get(provider);

    if (customModels?.has(nativeId)) {
      result.push(customModels.get(nativeId)!);
    } else {
      result.push(opencodeModels!.get(nativeId)!);
    }
  }

  for (const [provider, customModels] of customByProvider) {
    for (const [nativeId, entry] of customModels) {
      const opencodeModels = opencodeByProvider.get(provider);
      if (!opencodeModels?.has(nativeId)) {
        result.push(entry);
      }
    }
  }

  return result;
}

export async function buildCatalog(
  user: User | null = null,
): Promise<CatalogEntry[]> {
  const builtin = await applyBuiltinProviderAvailability(getBuiltInModels(), user);
  const local = await getLocalModels(user);
  const opencode = await getOpencodeModels();
  const custom = await getCustomProviderModels(user);

  const occupiedIds = new Set([
    ...builtin.map((m) => m.id),
    ...local.map((m) => m.id),
  ]);

  const dedupedOpencode = opencode.filter((m) => !occupiedIds.has(m.id));
  for (const entry of dedupedOpencode) occupiedIds.add(entry.id);
  const dedupedCustom = custom.filter((m) => !occupiedIds.has(m.id));

  const mergedOpencode = mergeByProvider(dedupedOpencode, dedupedCustom);
  const mergedCustom = mergedOpencode.filter((e) => e.source === 'custom');

  return [
    ...builtin,
    ...local,
    ...mergedOpencode.filter((e) => e.source === 'opencode'),
    ...mergedCustom,
  ];
}

async function getHiddenModelIds(user: User): Promise<Set<string>> {
  try {
    const prefs = await getPreferences(user);
    return new Set(prefs.hiddenModelIds ?? []);
  } catch {
    return new Set();
  }
}

export function filterSelectableCatalog(
  catalog: CatalogEntry[],
  hiddenIds: Set<string>,
): CatalogEntry[] {
  return catalog.filter((entry) => {
    if (hiddenIds.has(entry.id)) return false;
    if (!entry.enabled) return false;
    if (!entry.available) return false;
    return true;
  });
}

export async function buildFullCatalog(
  user: User | null = null,
): Promise<CatalogEntry[]> {
  return buildCatalog(user);
}

export async function buildSelectableCatalog(
  user: User | null = null,
): Promise<CatalogEntry[]> {
  const catalog = await buildCatalog(user);
  const hiddenIds = user
    ? await getHiddenModelIds(user)
    : (new Set<string>() as Set<string>);
  return filterSelectableCatalog(catalog, hiddenIds);
}

export function getDefaultModel(): string {
  return PARAMETRIC_MODELS[0].id;
}
