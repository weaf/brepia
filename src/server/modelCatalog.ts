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
 * The built-in array is NOT copied into the database; it stays in
 * src/lib/utils.ts and is imported by this module.
 */

import { PARAMETRIC_MODELS } from '@/lib/utils';
import type { ModelConfig } from '@/types/misc';
import { opencodeModels, OpenCodeModelInfo } from './opencode';
import { getUserProviders, getProviderModels } from './customProviders';
import type { User } from '@supabase/supabase-js';

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
   * Whether the model is available at runtime (the backend service is reachable).
   * For built-in models this is always true; for opencode/custom it reflects
   * a health check.
   */
  available: boolean;

  /**
   * Reason the model is unavailable (when available === false).
   * e.g. 'opencode_unavailable', 'provider_down', 'key_missing'.
   */
  unavailableReason?: string;
}

// ---------------------------------------------------------------------------
// Built-in models — always available, always enabled.
// ---------------------------------------------------------------------------

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
// OpenCode agent models.
// ---------------------------------------------------------------------------

function toOpencodeCatalogEntry(
  m: OpenCodeModelInfo,
): CatalogEntry | undefined {
  // Skip models that duplicate built-in IDs.
  const exists = PARAMETRIC_MODELS.some(
    (b: ModelConfig) => b.id === `agent/opencode/${m.cliId}`,
  );
  if (exists) return undefined;

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
    // Stable custom ID format: custom/<provider-uuid>/<model-id>
    id: `custom/${model.providerId}/${model.modelId}`,
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

  return [...builtin, ...dedupedOpencode, ...dedupedCustom];
}
