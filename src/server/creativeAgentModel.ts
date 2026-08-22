import type { User } from '@supabase/supabase-js';
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

/**
 * Choose a Creative-mode LLM independently from the Creative mesh backend.
 *
 * Explicit request and conversation-pinned choices are authoritative. They
 * are deliberately not silently replaced when a provider later becomes
 * disabled/hidden; the normal model initialization path will surface that
 * configuration error. Only legacy Creative conversations with no agent
 * choice at all fall back to the first selectable direct tool-capable model.
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
  const requested = nonEmptyModel(requestedAgentModel);
  if (requested) {
    return { modelId: normalizeModelId(requested), source: 'request' };
  }

  const pinned = nonEmptyModel(conversation.settings?.creativeAgentModel);
  if (pinned) {
    return { modelId: normalizeModelId(pinned), source: 'conversation' };
  }

  const fallback = selectableCatalog.find(
    (entry) =>
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
  const requested = nonEmptyModel(requestedAgentModel);
  const pinned = nonEmptyModel(conversation.settings?.creativeAgentModel);

  // Avoid catalog discovery on the hot path when the conversation already has
  // an explicit agent identity. Availability is enforced by the existing
  // provider/model initialization path.
  if (requested || pinned) {
    return selectCreativeAgentModel(conversation, requestedAgentModel, []);
  }

  const catalog = await buildSelectableCatalog(user);
  return selectCreativeAgentModel(conversation, requestedAgentModel, catalog);
}
