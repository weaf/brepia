import { supabase } from '@/lib/supabase';
import {
  buildBrepProjectBaselineMessages,
  createBrepProjectArtifact,
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
