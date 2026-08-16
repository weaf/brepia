/**
 * useParametricModelCatalog — React hook for fetching the effective
 * parametric model catalog.
 *
 * Under the hood this calls the `/api/models/catalog` endpoint which
 * merges built-in, opencode, and custom provider models per the
 * `modelCatalog` server module.
 *
 * Usage:
 *   const { models, isLoading, error } = useParametricModelCatalog();
 *   // models: CatalogEntry[] — enabled + available entries only
 */

import { useState, useEffect } from 'react';
import type { CatalogEntry } from '../../src/server/modelCatalog';

interface UseCatalogResult {
  /**
   * Enabled and available catalog entries, grouped by provider.
   * Each entry carries a `source` field ('builtin' | 'opencode' | 'custom').
   */
  models: CatalogEntry[];
  /** Whether data is currently being fetched. */
  isLoading: boolean;
  /** Error object if the fetch failed, null otherwise. */
  error: string | null;
}

/**
 * Fetch the effective parametric model catalog.
 *
 * Returns only entries where `enabled && available` is true.
 */
export function useParametricModelCatalog(): UseCatalogResult {
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/models/catalog');
        if (!res.ok) {
          setError(`Failed to load model catalog: ${res.status}`);
          setModels([]);
          return;
        }
        const entries: CatalogEntry[] = await res.json();
        if (!cancelled) {
          // Only enabled and available entries.
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

    fetchCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, isLoading, error };
}
