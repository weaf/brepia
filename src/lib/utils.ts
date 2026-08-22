export * from './utilsCore';

import { CREATIVE_MESH_MODELS } from '@shared/creativeMeshModels';
import type { ModelConfig } from '../types/misc.ts';

/**
 * Creative mesh picker entries. The shared catalog is the single source of
 * truth for local/fal backend identity and capabilities; this adapter keeps
 * the existing ModelSelector contract unchanged.
 */
export const CREATIVE_MODELS: ModelConfig[] = CREATIVE_MESH_MODELS.map(
  (definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    provider: definition.providerLabel,
    timeEstimate: definition.timeEstimate,
  }),
);
