import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { AccountAdminError, requireAdmin } from '@/server/accountAdmin';
import { listAdminModelInventory } from '@/server/adminModelInventory';

function adminModelsError(error: unknown) {
  if (error instanceof AccountAdminError) {
    return json({ error: error.code }, error.status);
  }
  if (isUnauthorizedError(error)) {
    return json({ error: 'Unauthorized' }, 401);
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
      POST: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
      HEAD: methodNotAllowed,
    },
  },
});
