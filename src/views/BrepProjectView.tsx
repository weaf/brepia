import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { BrepProjectPreview } from '@/components/brep/BrepProjectPreview';
import { ActivityIndicator } from '@/components/brand';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getBrepProjectArtifact,
} from '@shared/brepProjectArtifact';
import { resolveActiveBrepAiSourceForLeaf } from '@shared/brepAiContext';
import type { BrepParameterValues } from '@shared/brepProvider';
import type { Conversation } from '@shared/types';
import {
  persistBrepProjectParameterRevision,
  restoreBrepProjectRevision,
  selectBrepProjectRevision,
} from '@/services/brepProjectService';

export default function BrepProjectView() {
  const { id } = useParams({ from: '/_layout/_auth/brep/$id' });
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['brep-project', id],
    queryFn: async () => {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id ?? '')
        .single();
      if (conversationError) throw conversationError;
      const typedConversation = conversation as Conversation;
      if (
        typedConversation.type !== 'parametric' ||
        !typedConversation.current_message_leaf_id
      ) {
        throw new Error('This is not a persisted BRep project.');
      }
      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('id, parent_message_id, role, parts')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (messageError) throw messageError;

      const activeSource = resolveActiveBrepAiSourceForLeaf(
        messages ?? [],
        typedConversation.current_message_leaf_id,
      );
      if (!activeSource) {
        throw new Error(
          'The active project branch has no valid BRep source snapshot.',
        );
      }

      const revisions = (messages ?? []).flatMap((message) => {
        if (message.role !== 'assistant') return [];
        const artifact = getBrepProjectArtifact(message.parts);
        return artifact
          ? [
              {
                id: message.id,
                parentMessageId: message.parent_message_id,
                artifact,
              },
            ]
          : [];
      });

      return {
        artifact: activeSource.artifact,
        leafId: typedConversation.current_message_leaf_id,
        sourceRevisionId: activeSource.messageId,
        revisions,
      };
    },
  });
  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <ActivityIndicator label="Loading BRep project" />
      </div>
    );
  if (error || !data)
    return (
      <main className="p-6 text-destructive">
        {error instanceof Error ? error.message : 'BRep project not found.'}
      </main>
    );
  return (
    <BrepProjectPreview
      key={data.leafId}
      project={data.artifact.source.source}
      exportPackage
      packageTitle={data.artifact.title}
      onParameterValuesCommit={async (parameterValues: BrepParameterValues) => {
        await persistBrepProjectParameterRevision({
          conversationId: id,
          parentMessageId: data.leafId,
          artifact: data.artifact,
          parameterValues,
        });
        await refetch();
      }}
      activeRevisionId={data.sourceRevisionId}
      revisions={data.revisions.map((revision, index) => ({
        id: revision.id,
        label: `Revision ${index + 1}`,
      }))}
      onSelectRevision={async (messageId) => {
        await selectBrepProjectRevision({ conversationId: id, messageId });
        await refetch();
      }}
      onRestoreRevision={async (messageId) => {
        const revision = data.revisions.find((item) => item.id === messageId);
        if (!revision) throw new Error('BRep source revision not found.');
        await restoreBrepProjectRevision({
          conversationId: id,
          sourceMessageId: revision.id,
        });
        await refetch();
      }}
    />
  );
}
