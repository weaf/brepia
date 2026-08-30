from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


MODEL_ROUTING = r'''import { z } from 'zod';

const runtimeModelIdSchema = z.string().trim().min(1).max(512);
const nullableRuntimeModelIdSchema = z.union([runtimeModelIdSchema, z.null()]);

export const CreativeImageProviderSchema = z.enum(['openai', 'fal']);
export type CreativeImageProvider = z.infer<typeof CreativeImageProviderSchema>;
const nullableCreativeImageProviderSchema = z.union([
  CreativeImageProviderSchema,
  z.null(),
]);

export const CreativeRuntimeModelRoutingSchema = z.object({
  creativeImagePrimaryProvider: nullableCreativeImageProviderSchema.default(null),
  creativeImageFallbackProvider: nullableCreativeImageProviderSchema.default(null),
  openAiOrchestratorModelId: nullableRuntimeModelIdSchema.default(null),
  openAiImageModelId: nullableRuntimeModelIdSchema.default(null),
  falImageTextModelId: nullableRuntimeModelIdSchema.default(null),
  falImageReferenceModelId: nullableRuntimeModelIdSchema.default(null),
  nativeImageModelId: nullableRuntimeModelIdSchema.default(null),
  nativeMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falUltraMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falCaptionModelId: nullableRuntimeModelIdSchema.default(null),
  falSegmentationModelId: nullableRuntimeModelIdSchema.default(null),
  falQualityMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falFastMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falPreviewMeshModelId: nullableRuntimeModelIdSchema.default(null),
});

export type CreativeRuntimeModelRouting = z.infer<
  typeof CreativeRuntimeModelRoutingSchema
>;

export const UpdateCreativeRuntimeModelRoutingSchema =
  CreativeRuntimeModelRoutingSchema.partial();

export const EMPTY_CREATIVE_RUNTIME_MODEL_ROUTING: CreativeRuntimeModelRouting =
  CreativeRuntimeModelRoutingSchema.parse({});

export type CreativeRuntimeModelKey = Exclude<
  keyof CreativeRuntimeModelRouting,
  'creativeImagePrimaryProvider' | 'creativeImageFallbackProvider'
>;

export function requireCreativeRuntimeModel(
  routing: CreativeRuntimeModelRouting,
  key: CreativeRuntimeModelKey,
): string {
  const value = routing[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Creative runtime model ${key} is not configured. Select it in AI Settings > Model routing.`,
    );
  }
  return value.trim();
}
'''
write('shared/modelRouting.ts', MODEL_ROUTING)

write(
    'shared/creativeRuntimeModels.ts',
    r'''const INTERNAL_CREATIVE_RUNTIME_MODEL_PREFIX = 'creative/';

/**
 * Internal Creative generation runtimes are identified by namespace rather
 * than concrete model IDs. The actual runtime model IDs are user-configurable
 * under AI Settings > Model routing.
 */
export function isInternalCreativeRuntimeModelId(modelId: string): boolean {
  const normalized = modelId.startsWith('local/')
    ? modelId.slice('local/'.length)
    : modelId;
  return normalized.startsWith(INTERNAL_CREATIVE_RUNTIME_MODEL_PREFIX);
}
''',
)

replace_once(
    'shared/aiSettings.ts',
    "import { z } from 'zod';\n",
    "import { z } from 'zod';\nimport {\n  CreativeRuntimeModelRoutingSchema,\n  UpdateCreativeRuntimeModelRoutingSchema,\n} from './modelRouting.ts';\n",
)
replace_once(
    'shared/aiSettings.ts',
    "  visionDeepModelId: nullableModelIdSchema.default(null),\n  createdAt:",
    "  visionDeepModelId: nullableModelIdSchema.default(null),\n  modelRouting: CreativeRuntimeModelRoutingSchema.default({}),\n  createdAt:",
)
replace_once(
    'shared/aiSettings.ts',
    "export const UpdateVisionModelsSchema = z.object({\n  visionFastModelId: nullableModelIdSchema,\n  visionDeepModelId: nullableModelIdSchema,\n});\n",
    "export const UpdateVisionModelsSchema = z.object({\n  visionFastModelId: nullableModelIdSchema,\n  visionDeepModelId: nullableModelIdSchema,\n});\n\nexport const UpdateModelRoutingSchema = UpdateCreativeRuntimeModelRoutingSchema;\n",
)
replace_once(
    'shared/aiSettings.ts',
    "export type UpdateVisionModelsInput = z.infer<typeof UpdateVisionModelsSchema>;\n",
    "export type UpdateVisionModelsInput = z.infer<typeof UpdateVisionModelsSchema>;\nexport type UpdateModelRoutingInput = z.infer<typeof UpdateModelRoutingSchema>;\n",
)

replace_once(
    'src/server/aiSettings.ts',
    "import type { AiPreferencesDto } from '@shared/aiSettings';\n",
    "import type { AiPreferencesDto } from '@shared/aiSettings';\nimport { CreativeRuntimeModelRoutingSchema } from '@shared/modelRouting';\n",
)
replace_once(
    'src/server/aiSettings.ts',
    "  visionDeepModelId: null,\n};",
    "  visionDeepModelId: null,\n  modelRouting: CreativeRuntimeModelRoutingSchema.parse({}),\n};",
)
replace_once(
    'src/server/aiSettings.ts',
    "  vision_deep_model_id?: string | null;\n  created_at:",
    "  vision_deep_model_id?: string | null;\n  model_routing?: unknown;\n  created_at:",
)
replace_once(
    'src/server/aiSettings.ts',
    "function parseRuntimeOverrides(value: unknown) {\n  const parsed = RuntimeOverridesSchema.safeParse(value ?? {});\n  return parsed.success ? parsed.data : {};\n}\n",
    "function parseRuntimeOverrides(value: unknown) {\n  const parsed = RuntimeOverridesSchema.safeParse(value ?? {});\n  return parsed.success ? parsed.data : {};\n}\n\nfunction parseModelRouting(value: unknown) {\n  const parsed = CreativeRuntimeModelRoutingSchema.safeParse(value ?? {});\n  return parsed.success\n    ? parsed.data\n    : CreativeRuntimeModelRoutingSchema.parse({});\n}\n",
)
replace_once(
    'src/server/aiSettings.ts',
    "    visionDeepModelId: row.vision_deep_model_id ?? null,\n    createdAt:",
    "    visionDeepModelId: row.vision_deep_model_id ?? null,\n    modelRouting: parseModelRouting(row.model_routing),\n    createdAt:",
)

replace_once(
    'src/routes/api/ai-settings/preferences.ts',
    "  UpdateDefaultModelsSchema,\n  UpdateVisionModelsSchema,\n} from '@shared/aiSettings';\n",
    "  UpdateDefaultModelsSchema,\n  UpdateModelRoutingSchema,\n  UpdateVisionModelsSchema,\n} from '@shared/aiSettings';\nimport { CreativeRuntimeModelRoutingSchema } from '@shared/modelRouting';\n",
)
replace_once(
    'src/routes/api/ai-settings/preferences.ts',
    "    visionDeepModelId: data.vision_deep_model_id ?? null,\n    createdAt:",
    "    visionDeepModelId: data.vision_deep_model_id ?? null,\n    modelRouting: CreativeRuntimeModelRoutingSchema.parse(\n      data.model_routing ?? {},\n    ),\n    createdAt:",
)
replace_once(
    'src/routes/api/ai-settings/preferences.ts',
    "          if (\n            body.visionFastModelId !== undefined ||\n            body.visionDeepModelId !== undefined\n          ) {",
    "          if (body.modelRouting !== undefined) {\n            const parsed = UpdateModelRoutingSchema.safeParse(body.modelRouting);\n            if (!parsed.success) {\n              return json({ error: 'invalid_model_routing_settings' }, 400);\n            }\n            updates.model_routing = CreativeRuntimeModelRoutingSchema.parse({\n              ...prefs.modelRouting,\n              ...parsed.data,\n            });\n          }\n\n          if (\n            body.visionFastModelId !== undefined ||\n            body.visionDeepModelId !== undefined\n          ) {",
)

replace_once(
    'src/services/aiPreferencesService.ts',
    "import type { AiPreferencesDto } from '@shared/aiSettings';\n",
    "import type { AiPreferencesDto } from '@shared/aiSettings';\nimport type { CreativeRuntimeModelRouting } from '@shared/modelRouting';\n",
)
replace_once(
    'src/services/aiPreferencesService.ts',
    "export async function updateDefaultModelPreferences(\n  update: DefaultModelPreferencesUpdate,\n): Promise<AiPreferencesDto> {\n  return (await apiJson('ai-settings/preferences', {\n    method: 'PUT',\n    body: JSON.stringify(update),\n  })) as AiPreferencesDto;\n}\n",
    "export async function updateDefaultModelPreferences(\n  update: DefaultModelPreferencesUpdate,\n): Promise<AiPreferencesDto> {\n  return (await apiJson('ai-settings/preferences', {\n    method: 'PUT',\n    body: JSON.stringify(update),\n  })) as AiPreferencesDto;\n}\n\nexport async function updateModelRoutingPreferences(\n  update: Partial<CreativeRuntimeModelRouting>,\n): Promise<AiPreferencesDto> {\n  return (await apiJson('ai-settings/preferences', {\n    method: 'PUT',\n    body: JSON.stringify({ modelRouting: update }),\n  })) as AiPreferencesDto;\n}\n",
)

write(
    'src/components/settings/CreativeRuntimeModelSettings.tsx',
    r'''import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    description: 'Local llama-swap image model used before the native mesh runtime when no reference image is supplied.',
  },
  {
    key: 'nativeMeshModelId',
    label: 'Native mesh runtime',
    description: 'Local llama-swap upstream model that produces the final native Creative GLB.',
  },
  {
    key: 'openAiOrchestratorModelId',
    label: 'OpenAI image orchestrator',
    description: 'Responses API model used to orchestrate the OpenAI image-generation tool.',
  },
  {
    key: 'openAiImageModelId',
    label: 'OpenAI image generator',
    description: 'Image-generation tool model used by the OpenAI image route.',
  },
  {
    key: 'falImageTextModelId',
    label: 'fal.ai text image model',
    description: 'fal.ai model used when image generation has no reference image.',
  },
  {
    key: 'falImageReferenceModelId',
    label: 'fal.ai reference image model',
    description: 'fal.ai model used for image generation/editing when reference images are present.',
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
    description: 'Segmentation model used to create masks for Quality mesh generation.',
  },
  {
    key: 'falQualityMeshModelId',
    label: 'Quality mesh model',
    description: '3D reconstruction model used by the Quality Creative product mode.',
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
        <p className="mt-1 text-xs leading-relaxed text-adam-neutral-400">{description}</p>
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
  const { data: preferences, isLoading, error } = useQuery({
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
        description: 'Creative runtime routing now uses the updated configuration.',
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
  const save = (update: Partial<CreativeRuntimeModelRouting>) => mutation.mutate(update);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-adam-neutral-50">Model routing</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-adam-neutral-400">
          Low-level Creative model IDs are explicit user settings. Product modes such as Fast, Quality and Ultra stay stable, but no upstream provider model is silently selected in runtime code. Empty fields fail closed instead of falling back to a hidden model.
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
''',
)

replace_once(
    'src/components/settings/AiSettingsSection.tsx',
    "import { DefaultModelSettings } from './DefaultModelSettings';\n",
    "import { DefaultModelSettings } from './DefaultModelSettings';\nimport { CreativeRuntimeModelSettings } from './CreativeRuntimeModelSettings';\n",
)
replace_once(
    'src/components/settings/AiSettingsSection.tsx',
    "  { value: 'model-catalog', label: 'Model catalog' },\n",
    "  { value: 'model-catalog', label: 'Model catalog' },\n  { value: 'model-routing', label: 'Model routing' },\n",
)
replace_once(
    'src/components/settings/AiSettingsSection.tsx',
    "            <TabsContent value=\"model-catalog\" className=\"mt-0 min-w-0\">\n              <AiModelsSettings />\n            </TabsContent>\n",
    "            <TabsContent value=\"model-catalog\" className=\"mt-0 min-w-0\">\n              <AiModelsSettings />\n            </TabsContent>\n            <TabsContent value=\"model-routing\" className=\"mt-0 min-w-0\">\n              <CreativeRuntimeModelSettings />\n            </TabsContent>\n",
)

write(
    'src/lib/defaultModels.ts',
    r'''import {
  CREATIVE_MESH_MODELS,
  getCreativeMeshModelDefinition,
  normalizeCreativeMeshModelId,
} from '@shared/creativeMeshModels';
import type { Model } from '@shared/types';

export const UNCONFIGURED_MODEL_ID: Model = '__unconfigured__';

type ModelLike = { id: string };

const OPTIONAL_CREATIVE_PROVIDER_IDS = new Set(
  (import.meta.env.VITE_PCAD_CREATIVE_MESH_PROVIDERS ?? '')
    .split(',')
    .map((value: string) => value.trim().toLowerCase())
    .filter(Boolean),
);

function creativeModelEnabled(modelId: string): boolean {
  const definition = getCreativeMeshModelDefinition(modelId);
  if (!definition || definition.provider === 'local') return Boolean(definition);
  return (
    OPTIONAL_CREATIVE_PROVIDER_IDS.has('*') ||
    OPTIONAL_CREATIVE_PROVIDER_IDS.has('all') ||
    OPTIONAL_CREATIVE_PROVIDER_IDS.has(definition.provider.toLowerCase())
  );
}

export function resolveParametricDefaultModel(
  preferredModelId: string | null | undefined,
  selectableModels: ModelLike[],
): Model {
  const selectableIds = new Set(selectableModels.map((model) => model.id));
  if (preferredModelId && selectableIds.has(preferredModelId)) {
    return preferredModelId;
  }
  return selectableModels[0]?.id ?? UNCONFIGURED_MODEL_ID;
}

export function resolveCreativeDefaultModel(
  preferredModelId: string | null | undefined,
  selectableModels?: ModelLike[],
): Model {
  const normalized = normalizeCreativeMeshModelId(preferredModelId);

  if (normalized && selectableModels) {
    const selectableIds = new Set(selectableModels.map((model) => model.id));
    if (selectableIds.has(normalized)) return normalized;
    return selectableModels[0]?.id ?? UNCONFIGURED_MODEL_ID;
  }

  if (normalized && creativeModelEnabled(normalized)) return normalized;

  return (
    CREATIVE_MESH_MODELS.find((definition) =>
      creativeModelEnabled(definition.id),
    )?.id ?? UNCONFIGURED_MODEL_ID
  );
}
''',
)
replace_once(
    'src/views/PromptView.tsx',
    "  FALLBACK_PARAMETRIC_MODEL_ID,\n  resolveCreativeDefaultModel,\n",
    "  UNCONFIGURED_MODEL_ID,\n  resolveCreativeDefaultModel,\n",
)
replace_once(
    'src/views/PromptView.tsx',
    "  const [model, setModel] = useState<Model>(FALLBACK_PARAMETRIC_MODEL_ID);\n",
    "  const [model, setModel] = useState<Model>(UNCONFIGURED_MODEL_ID);\n",
)
replace_once(
    'src/components/settings/DefaultModelSettings.tsx',
    "                  Automatic fallback\n",
    "                  Automatic first available\n",
)
replace_once(
    'src/components/settings/DefaultModelSettings.tsx',
    "                The saved Parametric default is currently hidden or unavailable.\n                Brepia will use a safe fallback until you select another model.\n",
    "                The saved Parametric default is currently hidden or unavailable.\n                Brepia will use the first available model until you select another one.\n",
)
replace_once(
    'src/components/settings/DefaultModelSettings.tsx',
    "                  Automatic fallback\n",
    "                  Automatic first available\n",
)
replace_once(
    'src/components/settings/DefaultModelSettings.tsx',
    "                The saved Creative default is currently unavailable. Brepia will\n                use TRELLIS.2 until you select another model.\n",
    "                The saved Creative default is currently unavailable. Brepia will\n                use the first available Creative backend until you select another one.\n",
)

write(
    'tests/defaultModels.test.ts',
    r'''import { describe, expect, it } from 'vitest';
import {
  UNCONFIGURED_MODEL_ID,
  resolveCreativeDefaultModel,
  resolveParametricDefaultModel,
} from '../src/lib/defaultModels';

describe('default model resolution', () => {
  it('uses a saved selectable Parametric model', () => {
    expect(
      resolveParametricDefaultModel('local/qwen', [
        { id: 'openrouter/example' },
        { id: 'local/qwen' },
      ]),
    ).toBe('local/qwen');
  });

  it('uses the first selectable Parametric model when the saved model is unavailable', () => {
    expect(
      resolveParametricDefaultModel('local/missing', [
        { id: 'openrouter/example' },
        { id: 'local/qwen' },
      ]),
    ).toBe('openrouter/example');
  });

  it('returns an explicit unconfigured sentinel when no Parametric model exists', () => {
    expect(resolveParametricDefaultModel(null, [])).toBe(UNCONFIGURED_MODEL_ID);
  });

  it('uses the first enabled Creative backend instead of a hard-coded fallback', () => {
    const resolved = resolveCreativeDefaultModel('not-a-creative-model', [
      { id: 'quality' },
      { id: 'local/trellis2' },
    ]);
    expect(resolved).toBe('quality');
  });

  it('normalizes retired local Creative IDs then respects the selectable catalog', () => {
    expect(
      resolveCreativeDefaultModel('local/trellis-v1', [
        { id: 'local/trellis2' },
      ]),
    ).toBe('local/trellis2');
  });

  it('returns an explicit unconfigured sentinel when no Creative backend exists', () => {
    expect(resolveCreativeDefaultModel(null, [])).toBe(UNCONFIGURED_MODEL_ID);
  });
});
''',
)
write(
    'shared/creativeRuntimeModels.ts',
    r'''const INTERNAL_CREATIVE_RUNTIME_MODEL_PREFIX = 'creative/';

/**
 * Internal Creative generation runtimes are identified by namespace rather
 * than concrete model IDs. The actual runtime model IDs are user-configurable
 * under AI Settings > Model routing.
 */
export function isInternalCreativeRuntimeModelId(modelId: string): boolean {
  const normalized = modelId.startsWith('local/')
    ? modelId.slice('local/'.length)
    : modelId;
  return normalized.startsWith(INTERNAL_CREATIVE_RUNTIME_MODEL_PREFIX);
}
''',
)
replace_once(
    'tests/creativeRuntimeModels.test.ts',
    "      'creative/z-image-turbo',\n      'creative/trellis2',\n      'local/creative/z-image-turbo',\n      'local/creative/trellis2',\n",
    "      'creative/image-runtime-a',\n      'creative/mesh-runtime-b',\n      'local/creative/image-runtime-a',\n      'local/creative/mesh-runtime-b',\n",
)
replace_once(
    'tests/creativeRuntimeModels.test.ts',
    "      ['creative/z-image-turbo', 'creative/trellis2', 'qwen-tool-model'],\n",
    "      ['creative/image-runtime-a', 'creative/mesh-runtime-b', 'qwen-tool-model'],\n",
)
replace_once(
    'tests/creativeRuntimeModels.test.ts',
    "      { settings: { creativeAgentModel: 'local/creative/trellis2' } },\n",
    "      { settings: { creativeAgentModel: 'local/creative/mesh-runtime-b' } },\n",
)
replace_once(
    'tests/creativeRuntimeModels.test.ts',
    "      id: 'local/creative/trellis2',\n",
    "      id: 'local/creative/mesh-runtime-b',\n",
)

replace_once(
    'supabase/schemas/user_ai_preferences.sql',
    '    "vision_deep_model_id" "text" NULL,\n',
    '    "vision_deep_model_id" "text" NULL,\n    "model_routing" "jsonb" NOT NULL DEFAULT \'{}\'::"jsonb",\n',
)
replace_once(
    'supabase/schemas/user_ai_preferences.sql',
    "COMMENT ON COLUMN \"public\".\"user_ai_preferences\".\"vision_deep_model_id\" IS\n    'Model catalog id used for difficult/render inspection pCAD vision fallback analysis.';\n",
    "COMMENT ON COLUMN \"public\".\"user_ai_preferences\".\"vision_deep_model_id\" IS\n    'Model catalog id used for difficult/render inspection pCAD vision fallback analysis.';\nCOMMENT ON COLUMN \"public\".\"user_ai_preferences\".\"model_routing\" IS\n    'User-configurable low-level runtime model IDs and provider routing. Runtime code must not inject hidden model defaults.';\n",
)

write(
    'supabase/migrations/20260830194000_configurable_model_routing.sql',
    r'''ALTER TABLE public.user_ai_preferences
  ADD COLUMN IF NOT EXISTS model_routing jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_ai_preferences.model_routing IS
  'User-configurable low-level runtime model IDs and provider routing. Runtime code must not inject hidden model defaults.';

-- Preserve the behavior existing users had before runtime model IDs became
-- explicit settings. These values are migration history only; new users get an
-- empty routing object and must configure the runtime models they intend to use.
UPDATE public.user_ai_preferences
SET model_routing = jsonb_build_object(
  'creativeImagePrimaryProvider', 'openai',
  'creativeImageFallbackProvider', 'fal',
  'openAiOrchestratorModelId', 'gpt-5.4',
  'openAiImageModelId', 'gpt-image-2',
  'falImageTextModelId', 'fal-ai/flux-pro/v1.1',
  'falImageReferenceModelId', 'fal-ai/flux-pro/kontext/max/multi',
  'nativeImageModelId', 'creative/z-image-turbo',
  'nativeMeshModelId', 'creative/trellis2',
  'falUltraMeshModelId', 'fal-ai/meshy/v6-preview/image-to-3d',
  'falCaptionModelId', 'fal-ai/moondream3-preview/caption',
  'falSegmentationModelId', 'fal-ai/sam-3/image',
  'falQualityMeshModelId', 'fal-ai/sam-3/3d-objects',
  'falFastMeshModelId', 'tripo3d/tripo/v2.5/image-to-3d',
  'falPreviewMeshModelId', 'fal-ai/hunyuan3d/v2/mini/turbo'
)
WHERE model_routing = '{}'::jsonb;

-- The old code used these two model IDs as hidden defaults. Persist them for
-- existing preference rows so behavior survives the migration without keeping
-- those IDs in runtime source code. New preference rows remain unconfigured.
UPDATE public.user_ai_preferences
SET default_parametric_model_id = 'openai/gpt-5.6-sol'
WHERE default_parametric_model_id IS NULL;

UPDATE public.user_ai_preferences
SET default_creative_model_id = 'local/trellis2'
WHERE default_creative_model_id IS NULL;
''',
)

# imageGen: model IDs become arguments instead of literals.
replace_once(
    'src/server/imageGen.ts',
    "  priorImageCallId: string | null,\n  // 'low'",
    "  priorImageCallId: string | null,\n  orchestratorModelId: string,\n  imageModelId: string,\n  // 'low'",
)
replace_once(
    'src/server/imageGen.ts',
    "    model: 'gpt-5.4',\n",
    "    model: orchestratorModelId,\n",
)
replace_once(
    'src/server/imageGen.ts',
    "        model: 'gpt-image-2',\n",
    "        model: imageModelId,\n",
)
replace_once(
    'src/server/imageGen.ts',
    "  promptText: string,\n  images: string[],\n) => {",
    "  promptText: string,\n  images: string[],\n  textModelId: string,\n  referenceModelId: string,\n) => {",
)
replace_once(
    'src/server/imageGen.ts',
    "    const result = await fal.run('fal-ai/flux-pro/kontext/max/multi', {\n",
    "    const result = await fal.run(referenceModelId, {\n",
)
replace_once(
    'src/server/imageGen.ts',
    "  const result = await fal.run('fal-ai/flux-pro/v1.1', {\n",
    "  const result = await fal.run(textModelId, {\n",
)

# Native Creative: resolve local runtime model IDs from user settings.
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "import type { AiPreferencesDto } from '@shared/aiSettings';\n",
    "import type { AiPreferencesDto } from '@shared/aiSettings';\nimport {\n  requireCreativeRuntimeModel,\n  type CreativeRuntimeModelRouting,\n} from '@shared/modelRouting';\n",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "const DEFAULT_Z_IMAGE_MODEL_ID = 'creative/z-image-turbo';\nconst DEFAULT_TRELLIS2_MODEL_ID = 'creative/trellis2';\n",
    "",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "function zImageModelId(): string {\n  return env('PCAD_Z_IMAGE_MODEL_ID') || DEFAULT_Z_IMAGE_MODEL_ID;\n}\n\nfunction trellis2ModelId(): string {\n  return env('PCAD_TRELLIS2_MODEL_ID') || DEFAULT_TRELLIS2_MODEL_ID;\n}\n\n",
    "",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "async function generateConditioningImage(\n  prompt: string,\n  timeoutMs: number,\n): Promise<ImageInput> {\n  const model = zImageModelId();\n",
    "async function generateConditioningImage(\n  prompt: string,\n  timeoutMs: number,\n  model: string,\n): Promise<ImageInput> {\n",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "async function generateTrellisGlb(\n  image: ImageInput,\n  runtime: NativeCreativeRuntime,\n): Promise<ArrayBuffer> {\n  const model = trellis2ModelId();\n",
    "async function generateTrellisGlb(\n  image: ImageInput,\n  runtime: NativeCreativeRuntime,\n  model: string,\n): Promise<ArrayBuffer> {\n",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "  let runtime: NativeCreativeRuntime;\n  try {\n    runtime = resolveNativeCreativeRuntime(\n      await loadUserAiPreferences(userData.user.id),\n    );\n  } catch (error) {",
    "  let runtime: NativeCreativeRuntime;\n  let modelRouting: CreativeRuntimeModelRouting;\n  try {\n    const preferences = await loadUserAiPreferences(userData.user.id);\n    runtime = resolveNativeCreativeRuntime(preferences);\n    modelRouting = preferences.modelRouting;\n  } catch (error) {",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "  const requiredRuntimeModels = [trellis2ModelId()];\n  if (imageIds.length === 0) requiredRuntimeModels.unshift(zImageModelId());\n",
    "  let nativeImageModel: string | null = null;\n  let nativeMeshModel: string;\n  try {\n    nativeMeshModel = requireCreativeRuntimeModel(modelRouting, 'nativeMeshModelId');\n    if (imageIds.length === 0) {\n      nativeImageModel = requireCreativeRuntimeModel(modelRouting, 'nativeImageModelId');\n    }\n  } catch (error) {\n    return localError(errorMessage(error), 422);\n  }\n\n  const requiredRuntimeModels = [nativeMeshModel];\n  if (nativeImageModel) requiredRuntimeModels.unshift(nativeImageModel);\n",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "        text as string,\n        runtime.imageGenerationTimeoutMs,\n      );",
    "        text as string,\n        runtime.imageGenerationTimeoutMs,\n        nativeImageModel as string,\n      );",
)
replace_once(
    'src/server/nativeCreativeMesh.ts',
    "    const glb = await generateTrellisGlb(conditioningImage, runtime);\n",
    "    const glb = await generateTrellisGlb(\n      conditioningImage,\n      runtime,\n      nativeMeshModel,\n    );\n",
)

# falMesh: central user routing controls provider order and every fal/OpenAI model ID.
replace_once(
    'src/server/falMesh.ts',
    "import { env, requiredEnv, webhookBaseUrl } from './env';\n",
    "import { env, requiredEnv, webhookBaseUrl } from './env';\nimport { getPreferencesByUserId } from './aiSettings';\nimport {\n  requireCreativeRuntimeModel,\n  type CreativeImageProvider,\n  type CreativeRuntimeModelKey,\n} from '@shared/modelRouting';\n",
)
replace_once(
    'src/server/falMesh.ts',
    "  let provider: 'gpt-image-2' | 'flux';\n  let result: {\n    imageBytes: Buffer;\n    imageCallId: string | null;\n    contentType: 'image/jpeg' | 'image/png';\n  };\n\n  try {\n    result = await generateImageWithGptImage2(\n      supabaseClient,\n      getOpenAI(),\n      userId,\n      conversationId,\n      prompt,\n      gptImageReferenceImages,\n      priorImageCallId,\n      QUALITY_BY_MESH_MODEL[sentryStage.meshModel],\n    );\n    provider = 'gpt-image-2';\n  } catch (gptImageError) {\n    logError(gptImageError, {\n      ...sentryContext,\n      additionalContext: {\n        stage: 'gpt_image_2_fallback',\n        hasFreshUserImages,\n        priorImageCallIdStatus,\n        ...sentryStage,\n      },\n    });\n    try {\n      const imageBytes = await generateImageWithFalFlux(\n        supabaseClient,\n        userId,\n        conversationId,\n        prompt,\n        gptImageReferenceImages,\n      );\n      // Flux returns png per its output_format config.\n      result = { imageBytes, imageCallId: null, contentType: 'image/png' };\n      provider = 'flux';\n    } catch (fluxError) {\n      logError(fluxError, {\n        ...sentryContext,\n        additionalContext: {\n          stage: 'flux_fallback',\n          hasFreshUserImages,\n          priorImageCallIdStatus,\n          ...sentryStage,\n        },\n      });\n      throw fluxError;\n    }\n  }\n\n  // Diagnostic log — gated on DEBUG_LOGS. In prod, ground truth comes from:\n  //   - images.image_generation_call_id (null = fallback ran, non-null = gpt-image-2)\n  //   - Sentry events tagged stage=gpt_image_2_fallback / flux_fallback\n  //     with full meshModel + subStage context\n  // This line stays opt-in for live debugging without polluting prod logs.\n  debugLog(\n    `[mesh] image_gen provider=${provider} meshModel=${sentryStage.meshModel}` +\n      (sentryStage.subStage ? ` subStage=${sentryStage.subStage}` : '') +\n      (provider === 'gpt-image-2'\n        ? ` quality=${QUALITY_BY_MESH_MODEL[sentryStage.meshModel]}`\n        : '') +\n      ` contentType=${result.contentType}` +\n      ` callId=${result.imageCallId ?? 'none'}`,\n  );\n\n  return result;\n",
    "  const routing = (await getPreferencesByUserId(userId)).modelRouting;\n  const configuredProviders = [\n    routing.creativeImagePrimaryProvider,\n    routing.creativeImageFallbackProvider,\n  ].filter((value): value is CreativeImageProvider => value !== null);\n  const providers = [...new Set(configuredProviders)];\n  if (providers.length === 0) {\n    throw new Error(\n      'No Creative image provider is configured. Select one in AI Settings > Model routing.',\n    );\n  }\n\n  const runProvider = async (provider: CreativeImageProvider) => {\n    if (provider === 'openai') {\n      return generateImageWithGptImage2(\n        supabaseClient,\n        getOpenAI(),\n        userId,\n        conversationId,\n        prompt,\n        gptImageReferenceImages,\n        priorImageCallId,\n        requireCreativeRuntimeModel(routing, 'openAiOrchestratorModelId'),\n        requireCreativeRuntimeModel(routing, 'openAiImageModelId'),\n        QUALITY_BY_MESH_MODEL[sentryStage.meshModel],\n      );\n    }\n\n    const imageBytes = await generateImageWithFalFlux(\n      supabaseClient,\n      userId,\n      conversationId,\n      prompt,\n      gptImageReferenceImages,\n      requireCreativeRuntimeModel(routing, 'falImageTextModelId'),\n      requireCreativeRuntimeModel(routing, 'falImageReferenceModelId'),\n    );\n    return {\n      imageBytes,\n      imageCallId: null,\n      contentType: 'image/png' as const,\n    };\n  };\n\n  let lastError: unknown;\n  for (const provider of providers) {\n    try {\n      const result = await runProvider(provider);\n      debugLog(\n        `[mesh] image_gen provider=${provider} meshModel=${sentryStage.meshModel}` +\n          (sentryStage.subStage ? ` subStage=${sentryStage.subStage}` : '') +\n          (provider === 'openai'\n            ? ` quality=${QUALITY_BY_MESH_MODEL[sentryStage.meshModel]}`\n            : '') +\n          ` contentType=${result.contentType}` +\n          ` callId=${result.imageCallId ?? 'none'}`,\n      );\n      return result;\n    } catch (providerError) {\n      lastError = providerError;\n      logError(providerError, {\n        ...sentryContext,\n        additionalContext: {\n          stage: 'configured_image_provider_failed',\n          provider,\n          hasFreshUserImages,\n          priorImageCallIdStatus,\n          ...sentryStage,\n        },\n      });\n    }\n  }\n\n  throw lastError ?? new Error('Configured Creative image providers failed');\n",
)
replace_once(
    'src/server/falMesh.ts',
    "function getSupabaseClient() {\n  return getServiceRoleSupabaseClient();\n}\n",
    "function getSupabaseClient() {\n  return getServiceRoleSupabaseClient();\n}\n\nasync function configuredRuntimeModel(\n  userId: string,\n  key: CreativeRuntimeModelKey,\n): Promise<string> {\n  const routing = (await getPreferencesByUserId(userId)).modelRouting;\n  return requireCreativeRuntimeModel(routing, key);\n}\n",
)
for old, key in [
    ("'fal-ai/meshy/v6-preview/image-to-3d'", 'falUltraMeshModelId'),
    ("'fal-ai/moondream3-preview/caption'", 'falCaptionModelId'),
    ("'fal-ai/sam-3/image'", 'falSegmentationModelId'),
    ("'fal-ai/sam-3/3d-objects'", 'falQualityMeshModelId'),
    ("'tripo3d/tripo/v2.5/image-to-3d'", 'falFastMeshModelId'),
    ("'fal-ai/hunyuan3d/v2/mini/turbo'", 'falPreviewMeshModelId'),
]:
    text = read('src/server/falMesh.ts')
    count = text.count(old)
    if count == 0:
        raise SystemExit(f'Expected runtime model literal not found: {old}')
    text = text.replace(old, f"await configuredRuntimeModel(userId, '{key}')")
    write('src/server/falMesh.ts', text)

# The preview-only Flux call also receives explicit text/reference model IDs.
replace_once(
    'src/server/falMesh.ts',
    "        newPrompt,\n        allImages,\n      );",
    "        newPrompt,\n        allImages,\n        await configuredRuntimeModel(userId, 'falImageTextModelId'),\n        await configuredRuntimeModel(userId, 'falImageReferenceModelId'),\n      );",
)

# Remove stale comments that describe fixed model choices as defaults.
for path in ['src/server/imageGen.ts', 'src/server/falMesh.ts', 'src/server/nativeCreativeMesh.ts']:
    text = read(path)
    text = text.replace('gpt-5.4 is the canonical orchestrator for the Responses API\n  // image_generation tool per OpenAI\'s docs; gpt-image-2 is the actual\n  // image model invoked via the tool.\n  ', '')
    write(path, text)

write(
    'tests/modelRoutingHardcoding.test.ts',
    r'''import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeFiles = [
  'src/lib/defaultModels.ts',
  'src/server/imageGen.ts',
  'src/server/falMesh.ts',
  'src/server/nativeCreativeMesh.ts',
];

const historicalModelIds = [
  'openai/gpt-5.6-sol',
  'gpt-5.4',
  'gpt-image-2',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro/kontext/max/multi',
  'creative/z-image-turbo',
  'creative/trellis2',
  'fal-ai/meshy/v6-preview/image-to-3d',
  'fal-ai/moondream3-preview/caption',
  'fal-ai/sam-3/image',
  'fal-ai/sam-3/3d-objects',
  'tripo3d/tripo/v2.5/image-to-3d',
  'fal-ai/hunyuan3d/v2/mini/turbo',
];

describe('runtime model routing', () => {
  it('keeps historical provider model IDs out of runtime source files', () => {
    for (const relativePath of runtimeFiles) {
      const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
      for (const modelId of historicalModelIds) {
        expect(source, `${relativePath} contains ${modelId}`).not.toContain(modelId);
      }
    }
  });
});
''',
)

write(
    'docs/model_routing_plan.md',
    r'''# Configurable model routing

## Goal

No concrete upstream model ID may be selected implicitly by runtime source code. User-facing product modes can remain stable abstractions, but the provider/model used by every low-level generation stage must be visible and editable in AI Settings.

## Architecture

- Existing Parametric and Creative default selectors remain the high-level conversation defaults.
- Existing Vision Fast/Deep selectors remain catalog-backed helper-model routing.
- `user_ai_preferences.model_routing` stores low-level Creative routing as JSONB.
- AI Settings > Model routing exposes primary/fallback image providers and every current Creative runtime model ID.
- Missing low-level model configuration fails closed with an actionable Settings error; runtime code does not inject a hidden model.
- Existing users are migrated with their previous effective defaults so the architecture change does not silently alter behavior. New users start unconfigured for low-level runtime roles.
- Product mode IDs (`fast`, `quality`, `ultra`, native Creative backend identity) are contracts, not upstream model IDs, and remain stable.

## Current routed roles

- Native conditioning image runtime
- Native mesh runtime
- OpenAI Responses image orchestrator
- OpenAI image-generation model
- fal.ai text image model
- fal.ai reference/edit image model
- Ultra mesh model
- Quality caption model
- Quality segmentation model
- Quality mesh model
- Fast mesh model
- Preview mesh model

## Guardrail

`tests/modelRoutingHardcoding.test.ts` prevents the historical concrete model IDs from being reintroduced into runtime source files.
''',
)

print('Applied configurable model routing changes')
