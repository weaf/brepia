import { supabase } from '@/lib/supabase';
import {
  buildBrepProjectBaselineMessages,
  createBrepProjectArtifact,
  getBrepProjectArtifact,
  withBrepProjectParameterValues,
} from '@shared/brepProjectArtifact';
import type { BrepProjectArtifactData } from '@shared/chatAi';
import type { BrepProject } from '@shared/brepProject';

export async function createBrepProjectConversation({
  userId,
  title,
  project,
}: {
  userId: string;
  title: string;
  project: BrepProject;
}): Promise<string> {
  const conversationId = crypto.randomUUID();
  const artifact = createBrepProjectArtifact({
    title,
    version: 'v1',
    source: { kind: 'brep', source: project },
  });
  const { error: conversationError } = await supabase
    .from('conversations')
    .insert({
      id: conversationId,
      user_id: userId,
      title: artifact.title,
      type: 'parametric',
      settings: { model: 'openai/gpt-5.6-sol' },
    });
  if (conversationError) throw conversationError;

  const assistantMessageId = crypto.randomUUID();
  const rows = buildBrepProjectBaselineMessages({
    conversationId,
    userMessageId: crypto.randomUUID(),
    assistantMessageId,
    artifact,
  });
  const { error: messagesError } = await supabase.from('messages').insert(
    rows.map((row) => ({
      ...row,
      parts: JSON.parse(JSON.stringify(row.parts)),
      metadata: JSON.parse(JSON.stringify(row.metadata)),
    })),
  );
  if (messagesError) {
    await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);
    throw messagesError;
  }

  const { error: leafError } = await supabase
    .from('conversations')
    .update({ current_message_leaf_id: assistantMessageId })
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (leafError) throw leafError;
  return conversationId;
}

export async function persistBrepProjectParameterRevision({
  conversationId,
  parentMessageId,
  artifact,
  parameterValues,
}: {
  conversationId: string;
  parentMessageId: string;
  artifact: BrepProjectArtifactData;
  parameterValues: Record<string, number>;
}): Promise<{ messageId: string; artifact: BrepProjectArtifactData }> {
  const nextArtifact = createBrepProjectArtifact({
    ...artifact,
    source: {
      kind: 'brep',
      source: withBrepProjectParameterValues(
        artifact.source.source,
        parameterValues,
      ),
    },
  });
  const messageId = crypto.randomUUID();
  const { error: messageError } = await supabase.from('messages').insert({
    id: messageId,
    conversation_id: conversationId,
    role: 'assistant',
    parent_message_id: parentMessageId,
    parts: JSON.parse(
      JSON.stringify([{ type: 'data-brep-project', data: nextArtifact }]),
    ),
    metadata: {},
  });
  if (messageError) throw messageError;

  // Do not let an older tab/async commit replace a newer active source. The
  // orphaned immutable message is valid branch evidence and can be selected.
  const { data, error: leafError } = await supabase
    .from('conversations')
    .update({ current_message_leaf_id: messageId })
    .eq('id', conversationId)
    .eq('current_message_leaf_id', parentMessageId)
    .select('id');
  if (leafError) throw leafError;
  if (!data?.length) {
    throw new Error(
      'BRep project changed before this parameter revision could be activated.',
    );
  }
  return { messageId, artifact: nextArtifact };
}

export async function selectBrepProjectRevision({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const revision = await requireBrepProjectRevision(conversationId, messageId);
  if (!revision) {
    throw new Error('BRep source revision was not found in this conversation.');
  }
  const { error } = await supabase
    .from('conversations')
    .update({ current_message_leaf_id: messageId })
    .eq('id', conversationId);
  if (error) throw error;
}

async function requireBrepProjectRevision(
  conversationId: string,
  messageId: string,
) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, parent_message_id, role, parts')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const artifact = getBrepProjectArtifact(data.parts);
  return artifact
    ? { id: data.id, parentMessageId: data.parent_message_id, artifact }
    : null;
}

export async function restoreBrepProjectRevision({
  conversationId,
  sourceMessageId,
}: {
  conversationId: string;
  sourceMessageId: string;
}): Promise<string> {
  const source = await requireBrepProjectRevision(
    conversationId,
    sourceMessageId,
  );
  if (!source) {
    throw new Error('BRep source revision was not found in this conversation.');
  }
  const restoredArtifact = createBrepProjectArtifact(source.artifact);
  const restoredMessageId = crypto.randomUUID();
  const { error: messageError } = await supabase.from('messages').insert({
    id: restoredMessageId,
    conversation_id: conversationId,
    role: 'assistant',
    parent_message_id: source.parentMessageId,
    parts: JSON.parse(
      JSON.stringify([{ type: 'data-brep-project', data: restoredArtifact }]),
    ),
    metadata: {},
  });
  if (messageError) throw messageError;
  await selectBrepProjectRevision({
    conversationId,
    messageId: restoredMessageId,
  });
  return restoredMessageId;
}
