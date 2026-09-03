import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { BrepProjectPreview } from '@/components/brep/BrepProjectPreview';
import { ActivityIndicator } from '@/components/brand';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getBrepProjectArtifact } from '@shared/brepProjectArtifact';
import type { Conversation } from '@shared/types';

export default function BrepProjectView() {
  const { id } = useParams({ from: '/_layout/_auth/brep/$id' });
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
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
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('parts')
        .eq('id', typedConversation.current_message_leaf_id)
        .eq('conversation_id', id)
        .single();
      if (messageError) throw messageError;
      const artifact = getBrepProjectArtifact(message.parts);
      if (!artifact)
        throw new Error(
          'The active project source is not a valid BRep snapshot.',
        );
      return artifact;
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
  return <BrepProjectPreview project={data.source.source} />;
}
