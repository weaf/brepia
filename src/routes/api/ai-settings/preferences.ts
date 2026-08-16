import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { getPreferences } from '@/server/aiSettings';

export const Route = createFileRoute('/api/ai-settings/preferences')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const prefs = await getPreferences(user);
          return json(prefs);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_load_preferences',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      PUT: async ({ request }) => {
        try {
          const user = await requireUser(request);
          const body = await request.json().catch(() => ({}));
          const prefs = await getPreferences(user);

          // Update hidden model IDs if provided
          const updates: Record<string, unknown> = {};
          if (body.hiddenModelIds !== undefined) {
            updates.hidden_model_ids = body.hiddenModelIds;
          }

          // Update default prompt profile if provided
          if (body.defaultPromptProfileId !== undefined) {
            updates.default_prompt_profile_id = body.defaultPromptProfileId;
          }

          // If there are updates to apply, update them
          if (Object.keys(updates).length > 0) {
            // We use the AI settings helpers for the actual update logic
            // but for now we'll use a direct supabase call for combined updates
            const { getServiceRoleSupabaseClient } = await import(
              '@/server/supabaseClient'
            );
            const supabase = getServiceRoleSupabaseClient();
            const { data, error } = await supabase
              .from('user_ai_preferences')
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .select()
              .single();

            if (error) {
              return json({ error: 'failed_to_update_preferences' }, 500);
            }

            return json({
              userId: data.user_id,
              hiddenModelIds: data.hidden_model_ids,
              defaultPromptProfileId: data.default_prompt_profile_id,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            });
          }

          return json(prefs);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_update_preferences',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      POST: methodNotAllowed,
      DELETE: methodNotAllowed,
      HEAD: methodNotAllowed,
      PATCH: methodNotAllowed,
    },
  },
});
