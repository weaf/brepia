import { createFileRoute } from '@tanstack/react-router';
import {
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { AccountAdminError, requireAdmin } from '@/server/accountAdmin';
import { listAdminModelInventory } from '@/server/adminModelInventory';
import { deleteAdminModelWorkspace } from '@/server/adminModelManagement';

function adminModelsError(error: unknown) {
  if (error instanceof AccountAdminError) {
    return json({ error: error.code }, error.status);
  }
  if (isUnauthorizedError(error)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (error instanceof Error && error.message === 'invalid_conversation_id') {
    return json({ error: 'invalid_conversation_id' }, 400);
  }
  console.error('[admin-model-inventory]', error);
  return json({ error: 'internal_error' }, 500);
}

export const Route = createFileRoute('/api/settings/adminModels')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          await requireAdmin(user);
          return json(await listAdminModelInventory());
        } catch (error) {
          return adminModelsError(error);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await requireUser(request);
          await requireAdmin(user);
          const body: unknown = await request.json().catch(() => null);
          if (
            !isRecord(body) ||
            typeof body.conversationId !== 'string' ||
            !body.conversationId
          ) {
            return json({ error: 'conversation_id_required' }, 400);
          }
          return json(await deleteAdminModelWorkspace(body.conversationId));
        } catch (error) {
          return adminModelsError(error);
        }
      },
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
      HEAD: methodNotAllowed,
    },
  },
});
