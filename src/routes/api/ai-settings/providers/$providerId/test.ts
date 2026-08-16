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
          const body = await request.json().catch(() => ({}));

          // Test with existing provider config (uses stored credentials)
          if (body.useStored) {
            const result = await testProvider(user.id, params.providerId);
            return json(result);
          }

          // Test with draft config (for new providers without stored credentials)
          const result = await testProvider(user.id, undefined, {
            slug: body.slug,
            name: body.name,
            driver: body.driver,
            baseUrl: body.baseUrl,
            credential: body.credential,
          });

          return json(result);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
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
      HEAD: methodNotAllowed,
    },
  },
});
