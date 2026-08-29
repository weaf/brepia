import type { User } from '@supabase/supabase-js';
import { isInternalCreativeRuntimeModelId } from '@shared/creativeRuntimeModels';
import { normalizeModelId } from '@shared/models';
import type { Conversation, Model } from '@shared/types';
import {
  buildSelectableCatalog,
  type CatalogEntry,
} from './modelCatalog';

export type CreativeAgentModelSource = 'request' | 'conversation' | 'catalog';

export type CreativeAgentModelResolution = {
  modelId: string;
  source: CreativeAgentModelSource;
};

type CreativeConversation = Pick<Conversation, 'settings'>;

function nonEmptyModel(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function creativeAgentModel(value: unknown): string | null {
  const modelId = nonEmptyModel(value);
  return modelId && !isInternalCreativeRuntimeModelId(modelId) ? modelId : null;
}

/**
 * Choose a Creative-mode LLM independently from the Creative mesh backend.
 *
 * Explicit request and conversation-pinned choices are authoritative unless
 * they point at an internal Creative runtime endpoint. Runtime IDs such as
 * Z-Image-Turbo and TRELLIS.2 are generation services, not chat language
 * models, and must never be selected as the Creative agent.
 *
 * OpenCode/Codex catalog entries are excluded from automatic Creative fallback
 * because pCAD's current agent adapters are intentionally parametric/OpenSCAD
 * specific. They can be enabled for Creative later when those adapters gain a
 * create_mesh result contract instead of being selected accidentally here.
 */
export function selectCreativeAgentModel(
  conversation: CreativeConversation,
  requestedAgentModel: Model | undefined,
  selectableCatalog: CatalogEntry[],
): CreativeAgentModelResolution | null {
  const requested = creativeAgentModel(requestedAgentModel);
  if (requested) {
    return { modelId: normalizeModelId(requested), source: 'request' };
  }

  const pinned = creativeAgentModel(conversation.settings?.creativeAgentModel);
  if (pinned) {
    return { modelId: normalizeModelId(pinned), source: 'conversation' };
  }

  const fallback = selectableCatalog.find(
    (entry) =>
      !isInternalCreativeRuntimeModelId(entry.id) &&
      entry.source !== 'opencode' &&
      entry.enabled &&
      entry.available &&
      entry.supportsTools === true,
  );
  return fallback
    ? { modelId: normalizeModelId(fallback.id), source: 'catalog' }
    : null;
}

export async function resolveCreativeAgentModel({
  conversation,
  requestedAgentModel,
  user,
}: {
  conversation: CreativeConversation;
  requestedAgentModel?: Model;
  user: User;
}): Promise<CreativeAgentModelResolution | null> {
  const requested = creativeAgentModel(requestedAgentModel);
  const pinned = creativeAgentModel(conversation.settings?.creativeAgentModel);

  // Avoid catalog discovery on the hot path when the conversation already has
  // a valid explicit agent identity. Internal Creative runtime IDs are ignored
  // so an accidentally pinned runtime can self-heal through catalog fallback.
  if (requested || pinned) {
    return selectCreativeAgentModel(conversation, requestedAgentModel, []);
  }

  const catalog = await buildSelectableCatalog(user);
  return selectCreativeAgentModel(conversation, requestedAgentModel, catalog);
}
