import { supabase } from '@/lib/supabase';
import type { ParametricArtifact } from '@shared/types';
import type { ImportedArtifactOrigin } from '@shared/chatAi';
import {
  buildImportedArtifactMessages,
  type ImportedArtifactBaseline,
} from '@shared/importedArtifact';

export type PersistImportedArtifactResult = {
  userMessageId: string;
  assistantMessageId: string;
  toolCallId: string;
};

export async function persistImportedArtifact({
  conversationId,
  artifact,
  origin,
  baseline,
}: {
  conversationId: string;
  artifact: ParametricArtifact;
  origin: ImportedArtifactOrigin;
  baseline: ImportedArtifactBaseline;
}): Promise<PersistImportedArtifactResult> {
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const toolCallId = `tool_import_${crypto.randomUUID()}`;

  const rows = buildImportedArtifactMessages({
    conversationId,
    userMessageId,
    assistantMessageId,
    toolCallId,
    artifact,
    origin,
    baseline,
  });

  const { error } = await supabase.from('messages').insert(
    rows.map((row) => ({
      ...row,
      parts: JSON.parse(JSON.stringify(row.parts)),
      metadata: JSON.parse(JSON.stringify(row.metadata ?? {})),
    })),
  );
  if (error) throw error;

  return { userMessageId, assistantMessageId, toolCallId };
}
