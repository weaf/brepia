import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CREATIVE_MESH_MODELS } from '@shared/creativeMeshModels';
import { ActivityIndicator } from '@/components/brand';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useParametricModelCatalog } from '@/hooks/useParametricModelCatalog';
import {
  getAiPreferences,
  updateDefaultModelPreferences,
} from '@/services/aiPreferencesService';

const AUTOMATIC_VALUE = '__automatic__';

export function DefaultModelSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    models: parametricModels,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useParametricModelCatalog();
  const {
    data: preferences,
    isLoading: isPreferencesLoading,
    error: preferencesError,
  } = useQuery({
    queryKey: ['ai-preferences', 'defaults'],
    queryFn: getAiPreferences,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: updateDefaultModelPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      toast({
        title: 'Default model saved',
        description: 'New conversations will use your selected default model.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save the default model.',
        variant: 'destructive',
      });
    },
  });

  const selectableParametricIds = useMemo(
    () => new Set(parametricModels.map((model) => model.id)),
    [parametricModels],
  );

  const savedParametricId = preferences?.defaultParametricModelId ?? null;
  const parametricDefaultUnavailable = Boolean(
    savedParametricId && !selectableParametricIds.has(savedParametricId),
  );
  const parametricValue =
    savedParametricId && selectableParametricIds.has(savedParametricId)
      ? savedParametricId
      : AUTOMATIC_VALUE;

  const creativeIds = useMemo(
    () => new Set<string>(CREATIVE_MESH_MODELS.map((model) => model.id)),
    [],
  );
  const savedCreativeId = preferences?.defaultCreativeModelId ?? null;
  const creativeValue =
    savedCreativeId && creativeIds.has(savedCreativeId)
      ? savedCreativeId
      : AUTOMATIC_VALUE;

  const isLoading = isCatalogLoading || isPreferencesLoading;
  const error =
    catalogError ??
    (preferencesError instanceof Error ? preferencesError.message : null);

  return (
    <section className="mb-4 rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-sm font-medium text-adam-neutral-50">
          Default models
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
          Choose which model is preselected when you start a new Parametric or
          Creative conversation. Existing conversations keep their pinned
          model.
        </p>
      </div>

      {error ? (
        <div className="text-sm text-adam-red-400">
          Failed to load default model settings: {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6">
          <ActivityIndicator label="Loading default models" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div>
              <div className="text-sm text-adam-neutral-50">Parametric</div>
              <div className="mt-0.5 text-xs text-adam-neutral-400">
                OpenSCAD / CAD generation model
              </div>
            </div>
            <Select
              value={parametricValue}
              disabled={mutation.isPending || parametricModels.length === 0}
              onValueChange={(value) =>
                mutation.mutate({
                  defaultParametricModelId:
                    value === AUTOMATIC_VALUE ? null : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select default model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTOMATIC_VALUE}>
                  Automatic fallback
                </SelectItem>
                {parametricModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {parametricDefaultUnavailable ? (
              <p className="text-xs leading-relaxed text-adam-amber">
                The saved Parametric default is currently hidden or unavailable.
                Brepia will use a safe fallback until you select another model.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-sm text-adam-neutral-50">Creative</div>
              <div className="mt-0.5 text-xs text-adam-neutral-400">
                Mesh generation backend
              </div>
            </div>
            <Select
              value={creativeValue}
              disabled={mutation.isPending}
              onValueChange={(value) =>
                mutation.mutate({
                  defaultCreativeModelId:
                    value === AUTOMATIC_VALUE ? null : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select default model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTOMATIC_VALUE}>
                  Automatic fallback
                </SelectItem>
                {CREATIVE_MESH_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} · {model.providerLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </section>
  );
}
