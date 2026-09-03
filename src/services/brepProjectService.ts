import { supabase } from '@/lib/supabase';
import {
  buildBrepProjectBaselineMessages,
  createBrepProjectArtifact,
} from '@shared/brepProjectArtifact';
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
