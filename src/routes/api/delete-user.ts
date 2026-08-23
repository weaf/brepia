import { createFileRoute } from '@tanstack/react-router';
import { json, methodNotAllowed, preflight } from '@/server/api';
import { getServiceRoleSupabaseClient } from '@/server/supabaseClient';
import { teardownUser } from '@/server/deleteUserTeardown';

export const Route = createFileRoute('/api/delete-user')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const supabase = getServiceRoleSupabaseClient();
        const token = request.headers
          .get('Authorization')
          ?.replace('Bearer ', '');
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) return json({ error: 'Unauthorized' }, 401);

        try {
          await teardownUser(supabase, { id: data.user.id });
        } catch {
          return json({ error: 'Failed to delete user' }, 500);
        }
        return json({ success: true });
      },
    },
  },
});
