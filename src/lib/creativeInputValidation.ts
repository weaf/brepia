import type { AppUIMessage } from '@shared/chatAi';
import { getCreativeMeshModelDefinition } from '@shared/creativeMeshModels';
import type { Model } from '@shared/types';

export type CreativeInputValidationIssue = {
  title: string;
  description: string;
};

export function getCreativeInputValidationIssue({
  conversationType,
  model,
  parts,
}: {
  conversationType: 'parametric' | 'creative';
  model: Model;
  parts: AppUIMessage['parts'];
}): CreativeInputValidationIssue | null {
  if (conversationType !== 'creative') return null;

  const definition = getCreativeMeshModelDefinition(model);
  if (!definition?.requiresReferenceImage) return null;

  const hasReferenceImage = parts.some(
    (part) => part.type === 'file' && part.mediaType.startsWith('image/'),
  );
  if (hasReferenceImage) return null;

  return {
    title: 'Reference image required',
    description: `${definition.name} requires a reference image. Add an image or choose TRELLIS.2 for text-only generation.`,
  };
}
