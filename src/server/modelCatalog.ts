/**
 * Model Catalog — unified model discovery layer.
 *
 * Merges three model sources into a single effective catalog for the
 * parametric picker and settings UI:
 *
 *   1. Built-in parametric models (PARAMETRIC_MODELS from src/lib/utils.ts)
 *   2. Dynamic OpenCode agent models (fetched from opencode serve HTTP API)
 *   3. Custom provider models (from the ai_provider_models DB table)
 *
 * Deduplication strategy:
 *   - Built-in models always win (first source).
 *   - Opencode models with IDs matching built-in entries are skipped.
 *   - Custom provider models with IDs matching either built-in or opencode
 *     entries are skipped (by stable ID format, collisions should be rare).
 *
 * Provider-aware merge:
 *   - When a custom provider shares the same provider name as an opencode
 *     provider, custom models overlay the same provider bucket.
 *   - Custom models override opencode models for matching provider-native
 *     model IDs.
 */

import {
  makeCustomProviderModelId,
  parseCustomProviderModelId,
} from '../../shared/customModelIds';
import { getUserProviders, getProviderModels } from './customProviders';
import type { User } from '@supabase/supabase-js';
import { opencodeModels } from './opencode';
import type { ModelConfig } from '../../src/types/misc';

// ---------------------------------------------------------------------------
// Catalog entry type — the canonical shape returned by every catalog consumer.
// ---------------------------------------------------------------------------

export type CatalogEntrySource = 'builtin' | 'opencode' | 'custom';

export interface CatalogEntry extends ModelConfig {
  /**
   * Which source this entry came from.
   * - 'builtin' — from PARAMETRIC_MODELS
   * - 'opencode' — from opencode serve HTTP API
   * - 'custom' — from ai_provider_models table
   */
  source: CatalogEntrySource;

  /** Whether the model is enabled for user selection. */
  enabled: boolean;

  /**
   * Whether the model is available at runtime (the backend service is
   * reachable).
   */
  available: boolean;

  /**
   * If available is false, a human-readable reason.
   */
  unavailableReason?: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Returns true if the given entry is a custom provider model.
 */
export function isCustomCatalogEntry(entry: CatalogEntry): boolean {
  return entry.source === 'custom';
}

// ---------------------------------------------------------------------------
// Built-in models — always available, always enabled.
// ---------------------------------------------------------------------------

// Import PARAMETRIC_MODELS — the canonical built-in list.
import { PARAMETRIC_MODELS } from '../../src/lib/utils';

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

// ---------------------------------------------------------------------------
// Opencode models — fetched at runtime, always enabled.
// ---------------------------------------------------------------------------

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

export async function getOpencodeModels(): Promise<CatalogEntry[]> {
  try {
    const models = await opencodeModels();
    return models
      .map(toOpencodeCatalogEntry)
      .filter((e): e is CatalogEntry => e !== undefined);
  } catch {
    // Opencode server unreachable — return empty list.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Custom provider models.
// ---------------------------------------------------------------------------

function toCustomCatalogEntry(
  model: {
    id: string;
    providerId: string;
    userId: string;
    modelId: string;
    displayName: string;
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
    description: '',
    provider: providerName,
    supportsTools: false,
    supportsThinking: false,
    supportsVision: false,
    source: 'custom' as const,
    enabled: enabled && model.isVisible,
    available: true,
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
      const models = await getProviderModels(provider.id);
      for (const model of models) {
        results.push(
          toCustomCatalogEntry(model, provider.name, provider.enabled),
        );
      }
    }

    return results;
  } catch {
    // Provider DB unreachable — return empty list.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Provider-aware merge.
// ---------------------------------------------------------------------------

/**
 * Merge opencode and custom models by provider name.
 *
 * For providers with matching names, custom models override opencode
 * models on provider-native model ID match. Custom models that don't
 * match any opencode model ID are appended.
 *
 * Returns a flat list preserving opencode-first ordering, with overrides
 * applied in-place.
 */
function mergeByProvider(
  opencode: CatalogEntry[],
  custom: CatalogEntry[],
): CatalogEntry[] {
  // Build a lookup of custom models by provider name → native model ID.
  const customByProvider = new Map<string, Map<string, CatalogEntry>>();

  for (const entry of custom) {
    const provider = entry.provider ?? 'Unknown';
    const models = customByProvider.get(provider) ?? new Map();
    // Derive provider-native model ID from the stable custom ID.
    const parsed = parseCustomProviderModelId(entry.id);
    if (parsed) {
      models.set(parsed.modelId, entry);
    }
    customByProvider.set(provider, models);
  }

  // Opencode models keyed by their provider-native model ID.
  const opencodeByProvider = new Map<string, Map<string, CatalogEntry>>();
  const ordering: { provider: string; nativeId: string }[] = [];

  for (const entry of opencode) {
    // Opencode native model ID is the cliId (after "agent/opencode/" prefix).
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
      // Custom model overrides the opencode one.
      result.push(customModels.get(nativeId)!);
    } else {
      result.push(opencodeModels!.get(nativeId)!);
    }
  }

  // Append custom-only models (providers or model IDs not in opencode).
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

// ---------------------------------------------------------------------------
// Full catalog builder.
// ---------------------------------------------------------------------------

/**
 * Build the effective parametric model catalog by merging all sources.
 *
 * Deduplication strategy:
 *   - Built-in models always win (first source).
 *   - Opencode models with IDs matching built-in entries are skipped.
 *   - Custom provider models with IDs matching either built-in or opencode
 *     entries are skipped (by stable ID format, collisions should be rare).
 */
export async function buildCatalog(
  user: User | null = null,
): Promise<CatalogEntry[]> {
  const builtin = getBuiltInModels();
  const opencode = await getOpencodeModels();
  const custom = await getCustomProviderModels(user);

  // Build a set of all builtin IDs for dedup.
  const builtinIds = new Set(builtin.map((m: CatalogEntry) => m.id));

  const dedupedOpencode = opencode.filter(
    (m: CatalogEntry) => !builtinIds.has(m.id),
  );
  const dedupedIds = new Set([
    ...builtinIds,
    ...dedupedOpencode.map((m: CatalogEntry) => m.id),
  ]);
  const dedupedCustom = custom.filter(
    (m: CatalogEntry) => !dedupedIds.has(m.id),
  );

  // Provider-aware merge: opencode + custom models sharing a provider name
  // are merged into the same provider bucket, with custom overriding on
  // native model ID match.
  const mergedOpencode = mergeByProvider(dedupedOpencode, dedupedCustom);

  const mergedCustom = mergedOpencode.filter((e) => e.source === 'custom');

  return [
    ...builtin,
    ...mergedOpencode.filter((e) => e.source === 'opencode'),
    ...mergedCustom,
  ];
}
