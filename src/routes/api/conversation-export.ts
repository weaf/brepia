import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { initializeConversationWorkspace } from '@/server/conversationWorkspace';
import { persistConversationExportArtifact } from '@/server/conversationWorkspaceExports';
import {
  conversationModelCodeSha256,
  findConversationModelRevisionByCodeSha,
  syncConversationModelSources,
} from '@/server/conversationWorkspaceModels';
import { getAnonSupabaseClient } from '@/server/supabaseClient';
import type { ConversationExportFormat } from '@/server/conversationWorkspace';

const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const MAX_SOURCE_CHARS = 5_000_000;

function exportFormat(value: FormDataEntryValue | null): ConversationExportFormat | null {
  return value === 'stl' || value === '3mf' || value === 'dxf' ? value : null;
}

function isBlobLike(value: FormDataEntryValue | null): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.size === 'number'
  );
}

export const Route = createFileRoute('/api/conversation-export')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch (error) {
          if (isUnauthorizedError(error)) {
            return json({ error: 'Unauthorized' }, 401);
          }
          throw error;
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: 'Invalid multipart form data' }, 400);
        }

        const conversationId = form.get('conversationId');
        const format = exportFormat(form.get('format'));
        const sourceCode = form.get('sourceCode');
        const file = form.get('file');
        if (
          typeof conversationId !== 'string' ||
          !conversationId ||
          !format ||
          typeof sourceCode !== 'string' ||
          !sourceCode ||
          !isBlobLike(file)
        ) {
          return json({ error: 'Missing or invalid export fields' }, 400);
        }
        if (sourceCode.length > MAX_SOURCE_CHARS) {
          return json({ error: 'OpenSCAD source is too large' }, 413);
        }
        if (file.size <= 0 || file.size > MAX_EXPORT_BYTES) {
          return json({ error: 'Export file size is invalid' }, 413);
        }

        const supabase = getAnonSupabaseClient({
          global: {
            headers: {
              Authorization: request.headers.get('Authorization') ?? '',
            },
          },
        });
        const { data: conversation, error } = await supabase
          .from('conversations')
          .select(
            'id, title, type, created_at, updated_at, current_message_leaf_id',
          )
          .eq('id', conversationId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (!conversation) return json({ error: 'Conversation not found' }, 404);
        if (conversation.type !== 'parametric') {
          return json({ error: 'Revision exports require a parametric conversation' }, 409);
        }

        await initializeConversationWorkspace({
          conversationId: conversation.id,
          title: conversation.title,
          type: conversation.type,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
        });
        await syncConversationModelSources(
          request,
          conversation.id,
          conversation.current_message_leaf_id,
        );

        const codeSha256 = conversationModelCodeSha256(sourceCode);
        const revision = await findConversationModelRevisionByCodeSha(
          conversation.id,
          codeSha256,
        );
        if (!revision) {
          // Parameter writes are intentionally asynchronous on the client. A
          // click can therefore beat the DB write by a few milliseconds. The
          // client retries this response once; never attach bytes to a guessed
          // revision because that would corrupt the session history.
          return json({ error: 'source_revision_not_found' }, 409);
        }

        const result = await persistConversationExportArtifact({
          conversationId: conversation.id,
          format,
          revision: revision.revision,
          codeSha256,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        return json(result);
      },
    },
  },
});