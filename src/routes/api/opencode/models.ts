import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  preflight,
  requireUser,
} from '@/server/api';
import { opencodeModels } from '@/server/opencode';

export const Route = createFileRoute('/api/opencode/models')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        try {
          await requireUser(request);
          const models = await opencodeModels();
          return json(
            models.map((m) => ({
              id: `opencode/${m.bareID}`,
              name: m.name,
              description: `OpenCode · ${m.providerID}`,
              provider: 'OpenCode',
              supportsTools: false,
              supportsThinking: false,
            })),
          );
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'opencode_unavailable',
            },
            isUnauthorizedError(err) ? 401 : 502,
          );
        }
      },
    },
  },
});
