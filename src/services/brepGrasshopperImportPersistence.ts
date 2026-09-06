import { supabase } from '@/lib/supabase';
import {
  createBrepProjectArtifact,
  withBrepProjectParameterValues,
} from '@shared/brepProjectArtifact';
import type { BrepProjectArtifactData } from '@shared/chatAi';
import type { BrepParameterValues } from '@shared/brepProvider';

export function buildBrepGrasshopperImportedArtifact(
  artifact: BrepProjectArtifactData,
  parameterValues: BrepParameterValues,
): BrepProjectArtifactData {
  return createBrepProjectArtifact({
    ...artifact,
    source: {
      kind: 'brep',
      source: withBrepProjectParameterValues(
        artifact.source.source,
        parameterValues,
      ),
    },
  });
}

/**
 * Persist a deterministically validated GHX parameter edit as an immutable
 * BRep revision without changing the active conversation leaf. This keeps an
 * unsaved browser preview intact; the operator can explicitly activate the
 * imported revision from Revision history when ready.
 */
export async function persistBrepGrasshopperImportedRevision({
  conversationId,
  parentMessageId,
  artifact,
  parameterValues,
}: {
  conversationId: string;
  parentMessageId: string;
  artifact: BrepProjectArtifactData;
  parameterValues: BrepParameterValues;
}): Promise<{ messageId: string; artifact: BrepProjectArtifactData }> {
  const nextArtifact = buildBrepGrasshopperImportedArtifact(
    artifact,
    parameterValues,
  );
  const messageId = crypto.randomUUID();
  const { error } = await supabase.from('messages').insert({
    id: messageId,
    conversation_id: conversationId,
    role: 'assistant',
    parent_message_id: parentMessageId,
    parts: JSON.parse(
      JSON.stringify([{ type: 'data-brep-project', data: nextArtifact }]),
    ),
    metadata: {},
  });
  if (error) throw error;

  return { messageId, artifact: nextArtifact };
}
