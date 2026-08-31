import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronsUpDown,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ActivityIndicator } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { CREATIVE_MODELS } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { apiJson } from '@/services/api';
import {
  getAiPreferences,
  updateModelRoutingPreferences,
} from '@/services/aiPreferencesService';
import type {
  CreativeImageProvider,
  CreativeRuntimeModelKey,
  CreativeRuntimeModelRouting,
  LocalCreativeProfile,
} from '@shared/modelRouting';

const NONE_VALUE = '__none__';

const HOSTED_MODEL_FIELDS: Array<{
  key: CreativeRuntimeModelKey;
  label: string;
  description: string;
}> = [
  {
    key: 'openAiOrchestratorModelId',
    label: 'OpenAI image orchestrator',
    description:
      'Responses API model used by the optional OpenAI Creative image adapter.',
  },
  {
    key: 'openAiImageModelId',
    label: 'OpenAI image generator',
    description:
      'Image-generation tool model used by the optional OpenAI Creative image adapter.',
  },
  {
    key: 'falImageTextModelId',
    label: 'fal.ai text image model',
    description:
      'fal.ai model used when the optional hosted Creative adapter generates an image from text.',
  },
  {
    key: 'falImageReferenceModelId',
    label: 'fal.ai reference image model',
    description:
      'fal.ai image model used when reference images are present.',
  },
  {
    key: 'falUltraMeshModelId',
    label: 'Ultra mesh model',
    description: 'Hosted 3D model used by the Ultra Creative product mode.',
  },
  {
    key: 'falCaptionModelId',
    label: 'Quality caption model',
    description: 'Captioning model used by the hosted Quality pipeline.',
  },
  {
    key: 'falSegmentationModelId',
    label: 'Quality segmentation model',
    description: 'Segmentation model used by the hosted Quality pipeline.',
  },
  {
    key: 'falQualityMeshModelId',
    label: 'Quality mesh model',
    description: '3D reconstruction model used by the hosted Quality mode.',
  },
  {
    key: 'falFastMeshModelId',
    label: 'Fast mesh model',
    description: 'Textureless 3D model used by the hosted Fast mode.',
  },
  {
    key: 'falPreviewMeshModelId',
    label: 'Preview mesh model',
    description: 'Hosted model used for Creative GLB previews.',
  },
];

type CreativeRuntimeDiscoveryPayload = {
  creativeRuntimeModels?: Array<{ modelId: string }>;
};

async function fetchCreativeRuntimeModels(): Promise<string[]> {
  const payload = (await apiJson(
    'settings/runtimeIntegrations?includeCreativeModels=1',
  )) as CreativeRuntimeDiscoveryPayload;
  return [...new Set((payload.creativeRuntimeModels ?? []).map((item) => item.modelId))].sort();
}

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
  candidates,
  disabled,
  onChange,
}: {
  value: string | null;
  candidates: string[];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const customCandidate = query.trim();

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
          <span className="min-w-0 truncate">{value ?? 'Not configured'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or enter model ID…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Type a model ID and choose it below.</CommandEmpty>
            <CommandGroup heading="Selection">
              <CommandItem
                value="not configured none"
                onSelect={() => choose(null)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === null ? 'opacity-100' : 'opacity-0',
                  )}
                />
                Not configured
              </CommandItem>
            </CommandGroup>
            {candidates.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Discovered in llama-swap">
                  {candidates.map((candidate) => (
                    <CommandItem
                      key={candidate}
                      value={`${candidate} discovered creative runtime`}
                      onSelect={() => choose(candidate)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === candidate ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate font-mono text-xs">
                        {candidate}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
            {customCandidate && !candidates.includes(customCandidate) ? (
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
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ModelAvailability({
  modelId,
  discovered,
}: {
  modelId: string | null;
  discovered: Set<string>;
}) {
  if (!modelId) return <Badge variant="outline">Not configured</Badge>;
  if (discovered.has(modelId)) {
    return <Badge variant="outline">Available</Badge>;
  }
  return <Badge variant="outline">Not currently discovered</Badge>;
}

export function CreativeRuntimeModelSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const preferencesQuery = useQuery({
    queryKey: ['ai-preferences', 'model-routing'],
    queryFn: getAiPreferences,
    staleTime: 0,
  });
  const discoveryQuery = useQuery({
    queryKey: ['creative-runtime-models'],
    queryFn: fetchCreativeRuntimeModels,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: updateModelRoutingPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(['ai-preferences', 'model-routing'], updated);
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      toast({
        title: 'Creative models saved',
        description: 'Local Creative profile configuration was updated.',
      });
    },
    onError: (saveError: Error) => {
      toast({
        title: 'Could not save Creative models',
        description: saveError.message,
        variant: 'destructive',
      });
    },
  });

  if (preferencesQuery.isLoading) {
    return (
      <div className="py-6">
        <ActivityIndicator label="Loading Creative models…" showLabel size="sm" />
      </div>
    );
  }

  if (preferencesQuery.error || !preferencesQuery.data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load Creative model settings.
      </div>
    );
  }

  const preferences = preferencesQuery.data;
  const routing: CreativeRuntimeModelRouting = preferences.modelRouting;
  const profiles = routing.localCreativeProfiles;
  const discoveredIds = discoveryQuery.data ?? [];
  const discovered = new Set(discoveredIds);
  const hostedCreativeEnabled = CREATIVE_MODELS.some(
    (model) => model.provider !== 'Local',
  );

  const save = (update: Partial<CreativeRuntimeModelRouting>) =>
    mutation.mutate(update);

  const saveProfiles = (
    nextProfiles: LocalCreativeProfile[],
    requestedDefaultId: string | null = routing.defaultLocalCreativeProfileId,
  ) => {
    let defaultId = requestedDefaultId;
    const active = defaultId
      ? nextProfiles.find((profile) => profile.id === defaultId)
      : undefined;
    const activeUsable = Boolean(active?.enabled && active.meshModelId);
    if (defaultId && !activeUsable) defaultId = null;

    save({
      localCreativeProfiles: nextProfiles,
      defaultLocalCreativeProfileId: defaultId,
      ...(activeUsable && active
        ? {
            nativeImageModelId: active.imageModelId,
            nativeMeshModelId: active.meshModelId,
          }
        : requestedDefaultId && defaultId === null
          ? { nativeImageModelId: null, nativeMeshModelId: null }
          : {}),
    });
  };

  const updateProfile = (
    profileId: string,
    patch: Partial<LocalCreativeProfile>,
  ) => {
    saveProfiles(
      profiles.map((profile) =>
        profile.id === profileId ? { ...profile, ...patch } : profile,
      ),
    );
  };

  const addProfile = () => {
    const profile: LocalCreativeProfile = {
      id: crypto.randomUUID(),
      name: `Local Creative ${profiles.length + 1}`,
      adapter: 'native-image-mesh-v1',
      imageModelId: null,
      meshModelId: null,
      enabled: false,
    };
    saveProfiles([...profiles, profile]);
  };

  const convertLegacyRouting = () => {
    const profile: LocalCreativeProfile = {
      id: crypto.randomUUID(),
      name: 'Local Creative',
      adapter: 'native-image-mesh-v1',
      imageModelId: routing.nativeImageModelId,
      meshModelId: routing.nativeMeshModelId,
      enabled: Boolean(routing.nativeMeshModelId),
    };
    saveProfiles([profile], profile.enabled ? profile.id : null);
  };

  const makeDefault = (profile: LocalCreativeProfile) => {
    if (!profile.enabled || !profile.meshModelId) return;
    save({
      defaultLocalCreativeProfileId: profile.id,
      nativeImageModelId: profile.imageModelId,
      nativeMeshModelId: profile.meshModelId,
    });
  };

  const hasLegacyRouting =
    profiles.length === 0 &&
    Boolean(routing.nativeImageModelId || routing.nativeMeshModelId);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-adam-neutral-50">
          Creative models
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-adam-neutral-400">
          Local Creative profiles are the primary configuration. Each profile
          names the compatible runtime adapter and the exact conditioning-image
          and mesh model IDs it should use. Models advertised by llama-swap are
          discovered live, so removing a selection never removes the model from
          the picker.
        </p>
      </div>

      <div className="rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-adam-neutral-50">
              Local Creative runtime discovery
            </div>
            <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
              Reads the native Creative llama-swap /v1/models catalog and keeps
              only the Creative runtime namespace.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="dark"
            disabled={discoveryQuery.isFetching}
            onClick={() => discoveryQuery.refetch()}
          >
            {discoveryQuery.isFetching ? (
              <ActivityIndicator label="Refreshing Creative models" size="sm" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
        {discoveryQuery.isError ? (
          <p className="mt-3 text-xs text-adam-red-300">
            Discovery failed. Existing saved IDs remain editable; verify that
            llama-swap is running and refresh again.
          </p>
        ) : discoveredIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {discoveredIds.map((modelId) => (
              <Badge key={modelId} variant="outline" className="font-mono">
                {modelId}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-adam-neutral-400">
            No Creative runtime models are currently advertised.
          </p>
        )}
      </div>

      {hasLegacyRouting ? (
        <div className="rounded-lg border border-adam-amber/40 bg-adam-amber/5 p-4">
          <div className="text-sm font-medium text-adam-neutral-50">
            Existing local routing detected
          </div>
          <p className="mt-1 text-xs leading-relaxed text-adam-neutral-300">
            Convert the current explicit runtime selection into a named profile.
            The effective model IDs do not change.
          </p>
          <div className="mt-3 space-y-1 font-mono text-xs text-adam-neutral-300">
            <div>Image: {routing.nativeImageModelId ?? 'Not configured'}</div>
            <div>Mesh: {routing.nativeMeshModelId ?? 'Not configured'}</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={mutation.isPending}
            onClick={convertLegacyRouting}
          >
            Convert to profile
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-adam-neutral-50">
              Local Creative profiles
            </h4>
            <p className="mt-1 text-xs text-adam-neutral-400">
              A profile can be saved before it is enabled. The default profile
              must have a mesh runtime configured.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={mutation.isPending}
            onClick={addProfile}
          >
            <Plus className="mr-1 h-4 w-4" /> Add profile
          </Button>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-adam-neutral-700 px-4 py-7 text-center text-xs text-adam-neutral-300">
            No local Creative profiles are configured yet. Add one and select
            runtime models discovered above.
          </div>
        ) : (
          profiles.map((profile) => {
            const isDefault =
              routing.defaultLocalCreativeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                className="rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label="Creative profile name"
                        defaultValue={profile.name}
                        disabled={mutation.isPending}
                        className="h-9 max-w-sm text-sm"
                        onBlur={(event) => {
                          const name = event.currentTarget.value.trim();
                          if (name && name !== profile.name) {
                            updateProfile(profile.id, { name });
                          }
                        }}
                      />
                      {isDefault ? <Badge variant="outline">Default</Badge> : null}
                      <Badge variant="outline">Native image → mesh</Badge>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-adam-neutral-500">
                      {profile.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-adam-neutral-200">
                      Enabled
                      <Switch
                        checked={profile.enabled}
                        disabled={mutation.isPending}
                        onCheckedChange={(enabled) =>
                          updateProfile(profile.id, { enabled })
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${profile.name}`}
                      disabled={mutation.isPending}
                      onClick={() =>
                        saveProfiles(
                          profiles.filter((item) => item.id !== profile.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-adam-neutral-50">
                        Conditioning image model
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
                        Optional when the user supplies a reference image;
                        required for text → 3D with this adapter.
                      </p>
                    </div>
                    <RuntimeModelPicker
                      value={profile.imageModelId}
                      candidates={discoveredIds}
                      disabled={mutation.isPending}
                      onChange={(imageModelId) =>
                        updateProfile(profile.id, { imageModelId })
                      }
                    />
                    <ModelAvailability
                      modelId={profile.imageModelId}
                      discovered={discovered}
                    />
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-adam-neutral-50">
                        Mesh runtime model
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">
                        Required. The selected model must implement the native
                        image → GLB adapter contract.
                      </p>
                    </div>
                    <RuntimeModelPicker
                      value={profile.meshModelId}
                      candidates={discoveredIds}
                      disabled={mutation.isPending}
                      onChange={(meshModelId) =>
                        updateProfile(profile.id, { meshModelId })
                      }
                    />
                    <ModelAvailability
                      modelId={profile.meshModelId}
                      discovered={discovered}
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant={isDefault ? 'dark' : 'outline'}
                    disabled={
                      mutation.isPending ||
                      isDefault ||
                      !profile.enabled ||
                      !profile.meshModelId
                    }
                    onClick={() => makeDefault(profile)}
                  >
                    {isDefault ? 'Default profile' : 'Set as default'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-adam-neutral-700 bg-adam-background-2 p-4">
        <div className="text-sm font-medium text-adam-neutral-50">
          External Creative providers
        </div>
        {!hostedCreativeEnabled ? (
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-adam-neutral-400">
            No external Creative adapter is enabled in this deployment. Local
            Creative profiles do not depend on an external provider. A supported
            provider adapter can be enabled later without changing the local
            profile configuration.
          </p>
        ) : (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-adam-neutral-200">
              Advanced external provider routing
            </summary>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-adam-neutral-400">
              These controls are shown only because a hosted Creative adapter is
              explicitly enabled for this deployment.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ProviderSelect
                label="Primary image provider"
                description="Provider tried first when the hosted Creative adapter needs a conditioning image."
                value={routing.creativeImagePrimaryProvider}
                disabled={mutation.isPending}
                onChange={(value) =>
                  save({ creativeImagePrimaryProvider: value })
                }
              />
              <ProviderSelect
                label="Fallback image provider"
                description="Optional second image provider. Not configured disables fallback."
                value={routing.creativeImageFallbackProvider}
                disabled={mutation.isPending}
                onChange={(value) =>
                  save({ creativeImageFallbackProvider: value })
                }
              />
              {HOSTED_MODEL_FIELDS.map((field) => {
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
                      value={typeof value === 'string' ? value : null}
                      candidates={[]}
                      disabled={mutation.isPending}
                      onChange={(next) => {
                        if (next !== value) save({ [field.key]: next });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
