// P03G: Model settings UI — AiModelsSettings section.
//
// Renders a searchable, groupable model visibility panel in SettingsView.
// Users can show/hide individual models, enable-all, hide-all, and restore
// defaults. Changes persist to user_ai_preferences.hidden_model_ids.

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { EyeOff, Loader2, RotateCcw, Search, SquareCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFullParametricModelCatalog } from '@/hooks/useParametricModelCatalog';
import { apiJson } from '@/services/api';
import type { CatalogEntry } from '@/server/modelCatalog';

type SourceGroup = {
  source: 'builtin' | 'opencode' | 'custom';
  label: string;
  models: CatalogEntry[];
};

const SOURCE_LABELS: Record<string, string> = {
  builtin: 'Built-in models',
  // Codex is temporarily carried by the existing agent source during the
  // repair pass. The later Runtime Integrations task will split the UI groups.
  opencode: 'Local agents',
  custom: 'Custom providers',
};

function groupBySource(models: CatalogEntry[]): SourceGroup[] {
  const groups: Record<string, CatalogEntry[]> = {};
  for (const m of models) {
    const src = m.source;
    if (!groups[src]) groups[src] = [];
    groups[src].push(m);
  }
  return [
    {
      source: 'builtin' as const,
      label: SOURCE_LABELS.builtin,
      models: groups.builtin ?? [],
    },
    {
      source: 'opencode' as const,
      label: SOURCE_LABELS.opencode,
      models: groups.opencode ?? [],
    },
    {
      source: 'custom' as const,
      label: SOURCE_LABELS.custom,
      models: groups.custom ?? [],
    },
  ].filter((g) => g.models.length > 0);
}

function filterBySearch(models: CatalogEntry[], query: string): CatalogEntry[] {
  if (!query.trim()) return models;
  const q = query.toLowerCase();
  return models.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.provider?.toLowerCase().includes(q),
  );
}

interface AiPreferences {
  hiddenModelIds: string[];
}

async function fetchPreferences(): Promise<AiPreferences> {
  const data = (await apiJson('ai-settings/preferences')) as AiPreferences;
  return { hiddenModelIds: data.hiddenModelIds ?? [] };
}

function useAiPreferences() {
  return useQuery({
    queryKey: ['ai-preferences'],
    queryFn: fetchPreferences,
    staleTime: 0,
  });
}

function useUpdateHiddenModels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (hiddenModelIds: string[]) =>
      apiJson('ai-settings/preferences', {
        method: 'PUT',
        body: JSON.stringify({ hiddenModelIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      toast({
        title: 'Model preferences saved',
        description: 'Your model visibility settings have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save model preferences.',
        variant: 'destructive',
      });
    },
  });
}

function ModelRow({
  entry,
  isHidden,
  onToggle,
  isUpdating,
}: {
  entry: CatalogEntry;
  isHidden: boolean;
  onToggle: () => void;
  isUpdating: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-lg px-3 py-3 transition-colors hover:bg-adam-neutral-800/40">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
          <span
            className={`min-w-0 break-words text-sm leading-snug sm:truncate ${
              isHidden
                ? 'text-adam-neutral-400 line-through'
                : 'text-adam-neutral-50'
            }`}
          >
            {entry.name}
          </span>
          <Badge
            variant={
              entry.source === 'builtin'
                ? 'default'
                : entry.source === 'opencode'
                  ? 'secondary'
                  : 'outline'
            }
            className={
              entry.source === 'builtin'
                ? 'shrink-0 bg-adam-blue/15 text-adam-blue hover:bg-adam-blue/20'
                : entry.source === 'opencode'
                  ? 'shrink-0 bg-adam-amber/15 text-adam-amber hover:bg-adam-amber/20'
                  : 'shrink-0'
            }
          >
            {entry.source === 'opencode' ? 'agent' : entry.source}
          </Badge>
        </div>

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {entry.provider && (
            <span className="min-w-0 break-words text-xs text-adam-neutral-400">
              {entry.provider}
            </span>
          )}
          {entry.supportsTools && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
              Tools
            </Badge>
          )}
          {entry.supportsThinking && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
              Thinking
            </Badge>
          )}
          {entry.supportsVision && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
              Vision
            </Badge>
          )}
        </div>

        {isHidden && entry.unavailableReason && (
          <div className="mt-1 break-words text-xs text-adam-neutral-500">
            {entry.unavailableReason}
          </div>
        )}
      </div>

      <Switch
        className="mt-0.5 shrink-0"
        checked={!isHidden}
        onCheckedChange={onToggle}
        disabled={isUpdating || !entry.enabled}
      />
    </div>
  );
}

export function AiModelsSettings() {
  const {
    models: allEntries = [],
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useFullParametricModelCatalog();

  const {
    data: prefs,
    isLoading: isPrefsLoading,
    error: prefsError,
  } = useAiPreferences();

  const hiddenIds = useMemo(
    () => prefs?.hiddenModelIds ?? [],
    [prefs?.hiddenModelIds],
  );
  const updateMutation = useUpdateHiddenModels();
  const [searchQuery, setSearchQuery] = useState('');

  const groups = useMemo<SourceGroup[]>(() => {
    const filtered = filterBySearch(allEntries, searchQuery);
    return groupBySource(filtered);
  }, [allEntries, searchQuery]);

  const totalModels = allEntries.length;
  const hiddenKnownModels = hiddenIds.filter((id) =>
    allEntries.some((entry) => entry.id === id),
  ).length;
  const visibleModels = Math.max(0, totalModels - hiddenKnownModels);
  const allHidden = totalModels > 0 && visibleModels === 0;

  const handleToggle = useCallback(
    (modelId: string) => {
      const isCurrentlyHidden = hiddenIds.includes(modelId);
      const newHidden = isCurrentlyHidden
        ? hiddenIds.filter((id) => id !== modelId)
        : [...hiddenIds, modelId];
      updateMutation.mutate(newHidden);
    },
    [hiddenIds, updateMutation],
  );

  const handleEnableAll = useCallback(() => {
    updateMutation.mutate([]);
  }, [updateMutation]);

  const handleHideAll = useCallback(() => {
    if (allHidden || allEntries.length === 0) return;
    updateMutation.mutate(allEntries.map((e: CatalogEntry) => e.id));
  }, [allEntries, allHidden, updateMutation]);

  const handleRestoreDefaults = useCallback(() => {
    updateMutation.mutate([]);
  }, [updateMutation]);

  const isLoading = isCatalogLoading || isPrefsLoading;
  const error =
    catalogError ?? (prefsError instanceof Error ? prefsError.message : null);

  if (error) {
    return (
      <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-4 sm:p-6">
        <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
          Models
        </h2>
        <div className="text-adam-red-400 text-sm">
          Failed to load model settings: {error}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-adam-neutral-50">Models</h2>
        <span className="text-xs text-adam-neutral-400">
          {visibleModels} of {totalModels} visible
        </span>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-adam-neutral-500" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="light"
          onClick={handleEnableAll}
          disabled={updateMutation.isPending || hiddenIds.length === 0}
          className="h-7 rounded-full px-2 text-xs"
        >
          <SquareCheck className="mr-1 h-3 w-3" />
          Enable all
        </Button>
        <Button
          size="sm"
          variant="dark"
          onClick={handleHideAll}
          disabled={
            updateMutation.isPending || allHidden || allEntries.length === 0
          }
          className="h-7 rounded-full px-2 text-xs"
        >
          <EyeOff className="mr-1 h-3 w-3" />
          Hide all
        </Button>
        <Button
          size="sm"
          variant="dark"
          onClick={handleRestoreDefaults}
          disabled={updateMutation.isPending || hiddenIds.length === 0}
          className="h-7 rounded-full px-2 text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Restore defaults
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-adam-neutral-500" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center text-sm text-adam-neutral-400">
          No models found.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.source}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-adam-neutral-400">
                {group.label}
              </div>
              <div className="flex flex-col gap-1">
                {group.models.map((entry) => (
                  <ModelRow
                    key={entry.id}
                    entry={entry}
                    isHidden={hiddenIds.includes(entry.id)}
                    onToggle={() => handleToggle(entry.id)}
                    isUpdating={updateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
