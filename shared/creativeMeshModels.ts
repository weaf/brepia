export const CREATIVE_MESH_MODEL_IDS = [
  'local/trellis-v1',
  'local/hunyuan3d-2',
  'local/hunyuan3d-2.1',
  'local/stable-fast-3d',
  'quality',
  'fast',
  'ultra',
] as const;

export type CreativeMeshModelId = (typeof CREATIVE_MESH_MODEL_IDS)[number];
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
};

/**
 * Creative mesh backends exposed by pCAD.
 *
 * The three historical IDs (`quality`, `fast`, `ultra`) intentionally remain
 * unchanged because they are persisted in existing conversation/message data.
 * They are now explicitly labelled as fal.ai backends instead of being treated
 * as generic quality presets.
 */
export const CREATIVE_MESH_MODELS: readonly CreativeMeshModelDefinition[] = [
  {
    id: 'local/trellis-v1',
    name: 'TRELLIS v1',
    description: 'Local text/image-to-3D generation (RTX 3090 friendly)',
    provider: 'local',
    providerLabel: 'Local',
    supportsText: true,
    supportsImage: true,
    supportsMeshEdit: false,
    outputFormats: ['glb'],
  },
  {
    id: 'local/hunyuan3d-2',
    name: 'Hunyuan3D-2',
    description: 'Local image-to-3D shape generation with optional texture',
    provider: 'local',
    providerLabel: 'Local',
    supportsText: false,
    supportsImage: true,
    supportsMeshEdit: false,
    outputFormats: ['glb'],
    requiresReferenceImage: true,
  },
  {
    id: 'local/hunyuan3d-2.1',
    name: 'Hunyuan3D-2.1',
    description: 'Local high-quality image-to-3D; sequential low-VRAM mode',
    provider: 'local',
    providerLabel: 'Local',
    supportsText: false,
    supportsImage: true,
    supportsMeshEdit: false,
    outputFormats: ['glb'],
    requiresReferenceImage: true,
  },
  {
    id: 'local/stable-fast-3d',
    name: 'Stable Fast 3D',
    description: 'Fast local single-image reconstruction',
    provider: 'local',
    providerLabel: 'Local',
    supportsText: false,
    supportsImage: true,
    supportsMeshEdit: false,
    outputFormats: ['glb'],
    requiresReferenceImage: true,
  },
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

const CREATIVE_MESH_MODEL_BY_ID = new Map(
  CREATIVE_MESH_MODELS.map((definition) => [definition.id, definition]),
);

export function isCreativeMeshModelId(value: unknown): value is CreativeMeshModelId {
  return typeof value === 'string' && CREATIVE_MESH_MODEL_BY_ID.has(value as CreativeMeshModelId);
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

export function isLocalCreativeMeshModel(id: string): id is CreativeMeshModelId {
  return getCreativeMeshModelDefinition(id)?.provider === 'local';
}

export function isFalCreativeMeshModel(id: string): id is CreativeMeshModelId {
  return getCreativeMeshModelDefinition(id)?.provider === 'fal';
}
