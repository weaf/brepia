import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  preflight,
  requireUser,
} from '@/server/api';
import { discoverRuntimeIntegrations } from '@/server/runtimeIntegrations';

export const Route = createFileRoute('/api/settings/runtimeIntegrations')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        try {
          await requireUser(request);
          const integrations = await discoverRuntimeIntegrations();
          return json(integrations);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_discover_runtimes',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
    },
  },
});
