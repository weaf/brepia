import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { getPreferences } from '@/server/aiSettings';
import {
  getPromptProfile,
  updatePromptProfile,
  deletePromptProfile,
} from '@/server/promptProfiles';

export const Route = createFileRoute('/api/ai-settings/profiles/$profileId')({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request, params }) => {
        try {
          const user = await requireUser(request);
          const profile = await getPromptProfile(user.id, params.profileId);

          if (!profile) {
            return json({ error: 'Prompt profile not found' }, 404);
          }

          return json(profile);
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_load_profile',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      PATCH: async ({ request, params }) => {
        try {
          const user = await requireUser(request);
          const body = await request.json().catch(() => ({}));

          const profile = await updatePromptProfile(user.id, params.profileId, {
            name: body.name,
            description: body.description,
            promptTemplate: body.promptTemplate,
            mode: body.mode as 'overlay' | 'fork' | undefined,
            baseRevision: body.baseRevision,
          });

          return json(profile);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          if (message.includes('not found')) {
            return json({ error: 'Prompt profile not found' }, 404);
          }
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_update_profile',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const user = await requireUser(request);
          const profile = await getPromptProfile(user.id, params.profileId);
          if (!profile) {
            return json({ error: 'Prompt profile not found' }, 404);
          }

          if (profile.editable) {
            const preferences = await getPreferences(user);
            const activeProfileId =
              profile.scope === 'parametric'
                ? preferences.defaultPromptProfileId
                : profile.scope === 'creative'
                  ? preferences.defaultCreativePromptProfileId
                  : (preferences.instructionProfileDefaults[profile.scope] ??
                    null);

            if (activeProfileId === profile.id) {
              return json(
                {
                  error: 'active_prompt_profile',
                  message:
                    'Choose another active profile before deleting this profile.',
                },
                409,
              );
            }
          }

          await deletePromptProfile(user.id, params.profileId);
          return json({ success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          if (message.includes('not found')) {
            return json({ error: 'Prompt profile not found' }, 404);
          }
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'failed_to_delete_profile',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
      PUT: methodNotAllowed,
      POST: methodNotAllowed,
      HEAD: methodNotAllowed,
    },
  },
});
