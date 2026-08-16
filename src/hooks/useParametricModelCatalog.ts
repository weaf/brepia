/**
 * useParametricModelCatalog — React hook for fetching the effective
 * parametric model catalog.
 *
 * Under the hood this calls the `/api/models/catalog` endpoint which
 * merges built-in, opencode, Codex and custom provider models per the
 * `modelCatalog` server module.
 */

import { useState, useEffect } from 'react';
import type { CatalogEntry } from '../../src/server/modelCatalog';
import { apiJson } from '@/services/api';

interface UseCatalogResult {
  /** Enabled and available catalog entries. */
  models: CatalogEntry[];
  /** Whether data is currently being fetched. */
  isLoading: boolean;
  /** Error object if the fetch failed, null otherwise. */
  error: string | null;
}

/**
 * Fetch the effective parametric model catalog.
 *
 * The catalog endpoint requires the current Supabase access token.  Always use
 * the project's authenticated API helper rather than a raw `fetch()` here;
 * otherwise a signed-in Settings/PromptView request is seen as anonymous by
 * `requireUser()` and returns HTTP 401.
 */
export function useParametricModelCatalog(): UseCatalogResult {
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCatalog = async () => {
      try {
        const entries = (await apiJson('models/catalog')) as CatalogEntry[];
        if (!cancelled) {
          // Picker consumers only receive selectable entries. Settings keeps
          // visibility preferences separately and will get a dedicated full
          // catalog view in the follow-up hardening pass.
          const filtered = entries.filter((e) => e.enabled && e.available);
          setModels(filtered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setModels([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, isLoading, error };
}
