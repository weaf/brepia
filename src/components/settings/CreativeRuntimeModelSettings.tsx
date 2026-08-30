import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator } from '@/components/brand';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getAiPreferences,
  updateModelRoutingPreferences,
} from '@/services/aiPreferencesService';
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
      'Local llama-swap image model used before the native mesh runtime when no reference image is supplied.',
  },
  {
    key: 'nativeMeshModelId',
    label: 'Native mesh runtime',
    description:
      'Local llama-swap upstream model that produces the final native Creative GLB.',
  },
  {
    key: 'openAiOrchestratorModelId',
    label: 'OpenAI image orchestrator',
    description:
      'Responses API model used to orchestrate the OpenAI image-generation tool.',
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

export function CreativeRuntimeModelSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
    onSuccess: () => {
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
          such as Fast, Quality and Ultra stay stable, but no upstream provider
          model is silently selected in runtime code. Empty fields fail closed
          instead of falling back to a hidden model.
        </p>
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
                <label
                  htmlFor={`model-routing-${field.key}`}
                  className="text-sm font-medium text-adam-neutral-50"
                >
                  {field.label}
                </label>
                <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
                  {field.description}
                </p>
              </div>
              <Input
                key={`${field.key}-${value ?? ''}`}
                id={`model-routing-${field.key}`}
                defaultValue={value ?? ''}
                disabled={mutation.isPending}
                placeholder="Not configured"
                autoComplete="off"
                onBlur={(event) => {
                  const next = event.currentTarget.value.trim() || null;
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
