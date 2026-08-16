import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { testProvider } from '@/server/customProviders';

export const Route = createFileRoute(
  '/api/ai-settings/providers/$providerId/test',
)({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request, params }) => {
        try {
          const user = await requireUser(request);

          const result = await testProvider(
            user.id,
            params.providerId,
            undefined,
          );

          return json(result);
        } catch (err) {
          return json(
            {
              ok: false,
              message: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_test_provider',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
});
