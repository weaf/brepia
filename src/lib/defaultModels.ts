import { normalizeCreativeMeshModelId } from '@shared/creativeMeshModels';
import type { Model } from '@shared/types';

export const FALLBACK_PARAMETRIC_MODEL_ID: Model = 'openai/gpt-5.6-sol';
export const FALLBACK_CREATIVE_MODEL_ID: Model = 'local/trellis2';

type ModelLike = { id: string };

export function resolveParametricDefaultModel(
  preferredModelId: string | null | undefined,
  selectableModels: ModelLike[],
): Model {
  const selectableIds = new Set(selectableModels.map((model) => model.id));

  if (preferredModelId && selectableIds.has(preferredModelId)) {
    return preferredModelId;
  }

  if (selectableIds.has(FALLBACK_PARAMETRIC_MODEL_ID)) {
    return FALLBACK_PARAMETRIC_MODEL_ID;
  }

  return selectableModels[0]?.id ?? FALLBACK_PARAMETRIC_MODEL_ID;
}

export function resolveCreativeDefaultModel(
  preferredModelId: string | null | undefined,
  selectableModels?: ModelLike[],
): Model {
  const normalized = normalizeCreativeMeshModelId(preferredModelId);
  if (!normalized) return FALLBACK_CREATIVE_MODEL_ID;

  if (selectableModels) {
    const selectableIds = new Set(selectableModels.map((model) => model.id));
    return selectableIds.has(normalized)
      ? normalized
      : FALLBACK_CREATIVE_MODEL_ID;
  }

  return normalized;
}
