import { rm } from 'node:fs/promises';
import { conversationRoot } from './conversationWorkspace';
import { deleteOwnedConversations } from './conversationTeardown';
import { getServiceRoleSupabaseClient } from './supabaseClient';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminWorkspaceDeleteResult = {
  success: true;
  orphaned: boolean;
};

export async function deleteAdminModelWorkspace(
  conversationId: string,
): Promise<AdminWorkspaceDeleteResult> {
  if (!UUID_PATTERN.test(conversationId)) {
    throw new Error('invalid_conversation_id');
  }

  const supabase = getServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id,user_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    await deleteOwnedConversations(supabase, data.user_id, [conversationId]);
    return { success: true, orphaned: false };
  }

  // An orphaned workspace has no authoritative conversation row and therefore
  // no trustworthy user/storage ownership to act on. Only remove its validated
  // local UUID workspace; never guess a Supabase storage prefix.
  await rm(conversationRoot(conversationId), { recursive: true, force: true });
  return { success: true, orphaned: true };
}
