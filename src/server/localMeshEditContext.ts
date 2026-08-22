import { isRecord } from './api';
import { getServiceRoleSupabaseClient } from './supabaseClient';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DETERMINISTIC_EDIT_PATTERNS = [
  /\bwider\b/i,
  /\bbroader\b/i,
  /\bbredare\b/i,
  /\bnarrower\b/i,
  /\bsmalare\b/i,
  /\btaller\b/i,
  /\bhigher\b/i,
  /\bhögre\b/i,
  /\bshorter\b/i,
  /\blägre\b/i,
  /\bthicker\b/i,
  /\bdeeper\b/i,
  /\btjockare\b/i,
  /\bdjupare\b/i,
  /\bthinner\b/i,
  /\bshallower\b/i,
  /\btunnare\b/i,
  /\bbigger\b/i,
  /\blarger\b/i,
  /\bstörre\b/i,
  /\bsmaller\b/i,
  /\bmindre\b/i,
];

type BranchMessage = {
  id: string;
  parent_message_id: string | null;
  parts: unknown;
  role: string;
};

export function isDeterministicLocalMeshEditText(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    DETERMINISTIC_EDIT_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function requestHasImageReferences(body: Record<string, unknown>): boolean {
  return Array.isArray(body.images) && body.images.length > 0;
}

export function createMeshOutputId(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (
      !isRecord(part) ||
      part.type !== 'tool-create_mesh' ||
      part.state !== 'output-available' ||
      !isRecord(part.output) ||
      typeof part.output.id !== 'string' ||
      !UUID_RE.test(part.output.id)
    ) {
      continue;
    }
    return part.output.id;
  }
  return null;
}

async function latestActiveBranchMeshId({
  conversationId,
  userId,
  leafMessageId,
}: {
  conversationId: string;
  userId: string;
  leafMessageId: string;
}): Promise<string | null> {
  const supabase = getServiceRoleSupabaseClient();
  const visited = new Set<string>();
  let messageId: string | null = leafMessageId;

  for (let depth = 0; messageId && depth < 200; depth += 1) {
    if (visited.has(messageId)) break;
    visited.add(messageId);

    const queryResult = await supabase
      .from('messages')
      .select('id, parent_message_id, parts, role')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    const message = queryResult.data as BranchMessage | null;
    const error = queryResult.error;
    if (error) {
      throw new Error(`Failed to traverse Creative message branch: ${error.message}`);
    }
    if (!message) break;

    if (message.role === 'assistant') {
      const candidate = createMeshOutputId(message.parts);
      if (candidate) {
        const { data: mesh, error: meshError } = await supabase
          .from('meshes')
          .select('id')
          .eq('id', candidate)
          .eq('user_id', userId)
          .eq('conversation_id', conversationId)
          .eq('status', 'success')
          .maybeSingle();
        if (meshError) {
          throw new Error(`Failed to validate Creative source mesh: ${meshError.message}`);
        }
        if (mesh) return candidate;
      }
    }

    messageId = message.parent_message_id;
  }

  return null;
}

/**
 * The LLM may omit meshId for a simple follow-up geometry edit. Recover the
 * source mesh from the active persisted message lineage instead of falling
 * back to image-to-3D regeneration or choosing a mesh from a sibling branch.
 *
 * current_message_leaf_id is intentionally allowed to point at either the
 * previous assistant turn or the newly persisted user turn. Tool execution can
 * race the leaf update, so requiring a particular leaf role is incorrect.
 */
export async function resolveLocalMeshEditSource(
  request: Request,
  body: unknown,
): Promise<unknown> {
  if (!isRecord(body)) return body;
  if (typeof body.mesh === 'string' && UUID_RE.test(body.mesh)) return body;
  if (!isDeterministicLocalMeshEditText(body.text)) return body;
  if (typeof body.conversationId !== 'string') return body;

  // An explicit image reference means this is a new image-driven generation,
  // even if its text happens to contain a word such as "wider".
  if (requestHasImageReferences(body)) return body;

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return body;

  const supabase = getServiceRoleSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) return body;

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('current_message_leaf_id')
    .eq('id', body.conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (conversationError || !conversation?.current_message_leaf_id) return body;

  const meshId = await latestActiveBranchMeshId({
    conversationId: body.conversationId,
    userId,
    leafMessageId: conversation.current_message_leaf_id,
  });
  if (!meshId) {
    console.log('[local-mesh] no active-branch source mesh found for edit', {
      conversationId: body.conversationId,
      leafMessageId: conversation.current_message_leaf_id,
    });
    return body;
  }

  console.log('[local-mesh] inferred source mesh from active branch', {
    conversationId: body.conversationId,
    leafMessageId: conversation.current_message_leaf_id,
    meshId,
  });
  return { ...body, mesh: meshId };
}
