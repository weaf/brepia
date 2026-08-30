import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
import { ActivityIndicator } from '@/components/brand';
import { ProviderLogo } from '@/components/ProviderLogo';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFullParametricModelCatalog } from '@/hooks/useParametricModelCatalog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getAiPreferences,
  updateModelRoutingPreferences,
} from '@/services/aiPreferencesService';
import type { CatalogEntry } from '@/server/modelCatalog';
import type {
  CreativeImageProvider,
  CreativeRuntimeModelKey,
  CreativeRuntimeModelRouting,
} from '@shared/modelRouting';

const NONE_VALUE = '__none__';

const MODEL_FIELDS: Array<{
  key: CreativeRuntimeModelKey;
  label: string;
  description: string;
}> = [
  {
    key: 'nativeImageModelId',
    label: 'Native conditioning image',
    description:
      'Local image model used before the native mesh runtime when no reference image is supplied.',
  },
  {
    key: 'nativeMeshModelId',
    label: 'Native mesh runtime',
    description:
      'Local upstream model that produces the final native Creative GLB.',
  },
  {
    key: 'openAiOrchestratorModelId',
    label: 'OpenAI image orchestrator',
    description:
      'Responses API model used to orchestrate the configured OpenAI image-generation tool.',
  },
  {
    key: 'openAiImageModelId',
    label: 'OpenAI image generator',
    description: 'Image-generation tool model used by the OpenAI image route.',
  },
  {
    key: 'falImageTextModelId',
    label: 'fal.ai text image model',
    description:
      'fal.ai model used when image generation has no reference image.',
  },
  {
    key: 'falImageReferenceModelId',
    label: 'fal.ai reference image model',
    description:
      'fal.ai model used for image generation/editing when reference images are present.',
  },
  {
    key: 'falUltraMeshModelId',
    label: 'Ultra mesh model',
    description: 'Hosted 3D model used by the Ultra Creative product mode.',
  },
  {
    key: 'falCaptionModelId',
    label: 'Quality caption model',
    description: 'Captioning model used by the Quality segmentation pipeline.',
  },
  {
    key: 'falSegmentationModelId',
    label: 'Quality segmentation model',
    description:
      'Segmentation model used to create masks for Quality mesh generation.',
  },
  {
    key: 'falQualityMeshModelId',
    label: 'Quality mesh model',
    description:
      '3D reconstruction model used by the Quality Creative product mode.',
  },
  {
    key: 'falFastMeshModelId',
    label: 'Fast mesh model',
    description: 'Textureless 3D model used by the Fast Creative product mode.',
  },
  {
    key: 'falPreviewMeshModelId',
    label: 'Preview mesh model',
    description: 'Hosted model used for Creative GLB previews.',
  },
];

function ProviderSelect({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: CreativeImageProvider | null;
  onChange: (value: CreativeImageProvider | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4">
      <div>
        <div className="text-sm font-medium text-adam-neutral-50">{label}</div>
        <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
          {description}
        </p>
      </div>
      <Select
        value={value ?? NONE_VALUE}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(next === NONE_VALUE ? null : (next as CreativeImageProvider))
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Not configured</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="fal">fal.ai</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RuntimeModelPicker({
  value,
  models,
  disabled,
  onChange,
}: {
  value: string | null;
  models: CatalogEntry[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = models.find((model) => model.id === value);
  const customCandidate = query.trim();
  const customMatchesCatalog = models.some(
    (model) => model.id === customCandidate,
  );

  const choose = (next: string | null) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="min-w-0 truncate">
            {selected?.name ?? value ?? 'Not configured'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search catalog or enter model ID…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              Type a model ID to use a provider-specific model.
            </CommandEmpty>
            <CommandGroup heading="Selection">
              <CommandItem value="not configured none" onSelect={() => choose(null)}>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === null ? 'opacity-100' : 'opacity-0',
                  )}
                />
                Not configured
              </CommandItem>
              {value && !selected && (
                <CommandItem value={value} onSelect={() => choose(value)}>
                  <Check className="mr-2 h-4 w-4 opacity-100" />
                  <span className="truncate">{value}</span>
                </CommandItem>
              )}
            </CommandGroup>
            {models.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Model catalog">
                  {models.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`${model.id} ${model.name} ${model.provider ?? ''}`}
                      disabled={!model.enabled || !model.available}
                      onSelect={() => choose(model.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === model.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <ProviderLogo provider={model.provider} className="mr-2" />
                      <span className="min-w-0 flex-1 truncate">{model.name}</span>
                      <span className="ml-2 max-w-[45%] truncate text-xs text-adam-neutral-400">
                        {model.id}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {customCandidate && !customMatchesCatalog && customCandidate !== value && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Custom model ID">
                  <CommandItem
                    value={`${customCandidate} custom model id`}
                    onSelect={() => choose(customCandidate)}
                  >
                    Use <span className="ml-1 font-mono">{customCandidate}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CreativeRuntimeModelSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    models: catalogModels,
    isLoading: catalogLoading,
    error: catalogError,
  } = useFullParametricModelCatalog();
  const {
    data: preferences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-preferences', 'model-routing'],
    queryFn: getAiPreferences,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: updateModelRoutingPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(['ai-preferences', 'model-routing'], updated);
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      toast({
        title: 'Model routing saved',
        description:
          'Creative runtime routing now uses the updated configuration.',
      });
    },
    onError: (saveError: Error) => {
      toast({
        title: 'Could not save model routing',
        description: saveError.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="py-6">
        <ActivityIndicator label="Loading model routing…" showLabel size="sm" />
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load model routing settings.
      </div>
    );
  }

  const routing: CreativeRuntimeModelRouting = preferences.modelRouting;
  const save = (update: Partial<CreativeRuntimeModelRouting>) =>
    mutation.mutate(update);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-adam-neutral-50">
          Model routing
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-adam-neutral-400">
          Low-level Creative model IDs are explicit user settings. Product modes
          such as Fast, Quality and Ultra stay stable, but no upstream model is
          silently selected in runtime code. Pick a discovered catalog model or
          enter a provider-specific model ID. Empty roles fail closed instead of
          falling back to a hidden model.
        </p>
        {catalogError && (
          <p className="mt-2 text-xs text-amber-400">
            Model catalog suggestions are unavailable: {catalogError}. Custom
            model IDs can still be configured.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProviderSelect
          label="Primary image provider"
          description="Provider tried first when a hosted Creative mode needs a generated conditioning image."
          value={routing.creativeImagePrimaryProvider}
          disabled={mutation.isPending}
          onChange={(value) => save({ creativeImagePrimaryProvider: value })}
        />
        <ProviderSelect
          label="Fallback image provider"
          description="Optional second provider. Choose Not configured to disable provider fallback entirely."
          value={routing.creativeImageFallbackProvider}
          disabled={mutation.isPending}
          onChange={(value) => save({ creativeImageFallbackProvider: value })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {MODEL_FIELDS.map((field) => {
          const value = routing[field.key];
          return (
            <div
              key={field.key}
              className="space-y-2 rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4"
            >
              <div>
                <div className="text-sm font-medium text-adam-neutral-50">
                  {field.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
                  {field.description}
                </p>
              </div>
              <RuntimeModelPicker
                value={value}
                models={catalogModels}
                disabled={mutation.isPending || catalogLoading}
                onChange={(next) => {
                  if (next !== value) save({ [field.key]: next });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
