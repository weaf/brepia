export const INTERNAL_CREATIVE_RUNTIME_MODEL_IDS = [
  'creative/z-image-turbo',
  'creative/trellis2',
] as const;

export type InternalCreativeRuntimeModelId =
  (typeof INTERNAL_CREATIVE_RUNTIME_MODEL_IDS)[number];

export function isInternalCreativeRuntimeModelId(modelId: string): boolean {
  const normalized = modelId.startsWith('local/')
    ? modelId.slice('local/'.length)
    : modelId;
  return INTERNAL_CREATIVE_RUNTIME_MODEL_IDS.includes(
    normalized as InternalCreativeRuntimeModelId,
  );
}
