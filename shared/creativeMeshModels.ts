export const NATIVE_TRELLIS2_MODEL_ID = 'local/trellis2' as const;

/**
 * Old local backend IDs are intentionally no longer selectable. They are kept
 * only as read-compatibility aliases for conversations created before the
 * TRELLIS.2 migration.
 */
export const LEGACY_LOCAL_CREATIVE_MESH_MODEL_IDS = [
  'local/trellis-v1',
  'local/hunyuan3d-2',
  'local/hunyuan3d-2.1',
] as const;

export const FAL_CREATIVE_MESH_MODEL_IDS = [
  'ultra',
  'quality',
  'fast',
] as const;

/**
 * Compile-time known Creative models. TRELLIS.2 is always available; models
 * owned by optional providers are exposed to the UI only when that provider is
 * enabled by the server-side Creative provider registry.
 */
export const CREATIVE_MESH_MODEL_IDS = [
  NATIVE_TRELLIS2_MODEL_ID,
  ...FAL_CREATIVE_MESH_MODEL_IDS,
] as const;

export type CreativeMeshModelId = (typeof CREATIVE_MESH_MODEL_IDS)[number];
export type LegacyLocalCreativeMeshModelId =
  (typeof LEGACY_LOCAL_CREATIVE_MESH_MODEL_IDS)[number];
export type CreativeMeshProvider = 'local' | 'fal';
export type CreativeMeshInputCapability =
  | 'Text + image'
  | 'Image required'
  | 'Text only'
  | 'Image only'
  | 'Unsupported';

export type CreativeMeshModelDefinition = {
  id: CreativeMeshModelId;
  name: string;
  description: string;
  provider: CreativeMeshProvider;
  providerLabel: string;
  supportsText: boolean;
  supportsImage: boolean;
  supportsMeshEdit: boolean;
  outputFormats: readonly ('glb' | 'fbx')[];
  timeEstimate?: string;
  requiresReferenceImage?: boolean;
  maxReferenceImages?: number;
};

export type CreativeMeshProviderDefinition = {
  id: CreativeMeshProvider;
  label: string;
  optional: boolean;
  modelIds: readonly CreativeMeshModelId[];
};

/** TRELLIS.2 is the only built-in Creative mesh backend. */
export const CORE_CREATIVE_MESH_MODELS: readonly CreativeMeshModelDefinition[] = [
  {
    id: NATIVE_TRELLIS2_MODEL_ID,
    name: 'TRELLIS.2',
    description:
      'Local text-to-3D via Z-Image-Turbo or direct image-to-3D; textured PBR GLB',
    provider: 'local',
    providerLabel: 'Local',
    supportsText: true,
    supportsImage: true,
    supportsMeshEdit: false,
    outputFormats: ['glb'],
    maxReferenceImages: 1,
  },
] as const;

/**
 * Models supplied by optional external services. Keeping these definitions
 * separate from the core model makes the provider removable without changing
 * TRELLIS.2 and gives future services an explicit extension point.
 */
export const OPTIONAL_CREATIVE_MESH_MODELS: readonly CreativeMeshModelDefinition[] = [
  {
    id: 'ultra',
    name: 'Max Quality',
    description: 'fal.ai Meshy high-quality textured generation',
    provider: 'fal',
    providerLabel: 'fal.ai',
    supportsText: true,
    supportsImage: true,
    supportsMeshEdit: true,
    outputFormats: ['glb', 'fbx'],
    timeEstimate: '5-6 minutes',
  },
  {
    id: 'quality',
    name: 'Draft',
    description: 'fal.ai SAM 3D draft generation',
    provider: 'fal',
    providerLabel: 'fal.ai',
    supportsText: true,
    supportsImage: true,
    supportsMeshEdit: true,
    outputFormats: ['glb'],
    timeEstimate: '~45 seconds',
  },
  {
    id: 'fast',
    name: 'Textureless',
    description: 'fal.ai fast textureless generation',
    provider: 'fal',
    providerLabel: 'fal.ai',
    supportsText: true,
    supportsImage: true,
    supportsMeshEdit: true,
    outputFormats: ['glb'],
    timeEstimate: '60-90 seconds',
  },
] as const;

/** All known model definitions, including optional provider models. */
export const CREATIVE_MESH_MODELS: readonly CreativeMeshModelDefinition[] = [
  ...CORE_CREATIVE_MESH_MODELS,
  ...OPTIONAL_CREATIVE_MESH_MODELS,
] as const;

export const CREATIVE_MESH_PROVIDERS: readonly CreativeMeshProviderDefinition[] = [
  {
    id: 'local',
    label: 'Local',
    optional: false,
    modelIds: [NATIVE_TRELLIS2_MODEL_ID],
  },
  {
    id: 'fal',
    label: 'fal.ai',
    optional: true,
    modelIds: FAL_CREATIVE_MESH_MODEL_IDS,
  },
] as const;

const CREATIVE_MESH_MODEL_BY_ID = new Map(
  CREATIVE_MESH_MODELS.map((definition) => [definition.id, definition]),
);

const LEGACY_LOCAL_MODEL_IDS = new Set<string>(
  LEGACY_LOCAL_CREATIVE_MESH_MODEL_IDS,
);

export function isCreativeMeshModelId(
  value: unknown,
): value is CreativeMeshModelId {
  return (
    typeof value === 'string' &&
    CREATIVE_MESH_MODEL_BY_ID.has(value as CreativeMeshModelId)
  );
}

export function isLegacyLocalCreativeMeshModelId(
  value: unknown,
): value is LegacyLocalCreativeMeshModelId {
  return typeof value === 'string' && LEGACY_LOCAL_MODEL_IDS.has(value);
}

/**
 * Resolve persisted Creative model IDs into the current product catalog.
 * Retired local backends migrate forward to TRELLIS.2 instead of reviving the
 * removed Python gateway.
 */
export function normalizeCreativeMeshModelId(
  value: unknown,
): CreativeMeshModelId | undefined {
  if (isCreativeMeshModelId(value)) return value;
  if (isLegacyLocalCreativeMeshModelId(value)) return NATIVE_TRELLIS2_MODEL_ID;
  return undefined;
}

export function getCreativeMeshModelDefinition(
  id: string,
): CreativeMeshModelDefinition | undefined {
  return CREATIVE_MESH_MODEL_BY_ID.get(id as CreativeMeshModelId);
}

export function getCreativeMeshInputCapability(
  id: string,
): CreativeMeshInputCapability | undefined {
  const definition = getCreativeMeshModelDefinition(id);
  if (!definition) return undefined;
  if (definition.requiresReferenceImage) return 'Image required';
  if (definition.supportsText && definition.supportsImage) return 'Text + image';
  if (definition.supportsText) return 'Text only';
  if (definition.supportsImage) return 'Image only';
  return 'Unsupported';
}

export function isLocalCreativeMeshModel(
  id: string,
): id is typeof NATIVE_TRELLIS2_MODEL_ID {
  return id === NATIVE_TRELLIS2_MODEL_ID;
}

export function isNativeTrellis2Model(
  id: string,
): id is typeof NATIVE_TRELLIS2_MODEL_ID {
  return id === NATIVE_TRELLIS2_MODEL_ID;
}

export function isFalCreativeMeshModel(
  id: string,
): id is (typeof FAL_CREATIVE_MESH_MODEL_IDS)[number] {
  return FAL_CREATIVE_MESH_MODEL_IDS.includes(
    id as (typeof FAL_CREATIVE_MESH_MODEL_IDS)[number],
  );
}
