import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  preflight,
  requireUser,
} from '@/server/api';
import { getCreativeMeshCatalog } from '@/server/creativeMeshProviderRegistry';
import { buildSelectableCatalog } from '@/server/modelCatalog';

export const Route = createFileRoute('/api/models/catalog')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const scope = new URL(request.url).searchParams.get('scope');
          if (scope === 'creative') {
            return json(getCreativeMeshCatalog());
          }

          const catalog = await buildSelectableCatalog(user);
          return json(catalog);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'catalog_error',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
    },
  },
});
