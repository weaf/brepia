import { createFileRoute } from '@tanstack/react-router';
import {
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { getPreferences } from '@/server/aiSettings';
import { buildFullCatalog } from '@/server/modelCatalog';
import { getServiceRoleSupabaseClient } from '@/server/supabaseClient';
import { UpdateVisionModelsSchema } from '@shared/aiSettings';

function preferenceResponse(data: Record<string, unknown>) {
  return {
    userId: data.user_id,
    hiddenModelIds: data.hidden_model_ids ?? [],
    defaultPromptProfileId: data.default_prompt_profile_id ?? null,
    visionFastModelId: data.vision_fast_model_id ?? null,
    visionDeepModelId: data.vision_deep_model_id ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

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
          const updates: Record<string, unknown> = {};

          if (body.hiddenModelIds !== undefined) {
            updates.hidden_model_ids = body.hiddenModelIds;
          }

          if (body.defaultPromptProfileId !== undefined) {
            updates.default_prompt_profile_id = body.defaultPromptProfileId;
          }

          if (
            body.visionFastModelId !== undefined ||
            body.visionDeepModelId !== undefined
          ) {
            const parsed = UpdateVisionModelsSchema.safeParse({
              visionFastModelId:
                body.visionFastModelId !== undefined
                  ? body.visionFastModelId
                  : prefs.visionFastModelId,
              visionDeepModelId:
                body.visionDeepModelId !== undefined
                  ? body.visionDeepModelId
                  : prefs.visionDeepModelId,
            });
            if (!parsed.success) {
              return json({ error: 'invalid_vision_model_settings' }, 400);
            }

            const catalog = await buildFullCatalog(user);
            const byId = new Map(catalog.map((entry) => [entry.id, entry]));
            for (const modelId of [
              parsed.data.visionFastModelId,
              parsed.data.visionDeepModelId,
            ]) {
              if (!modelId) continue;
              const entry = byId.get(modelId);
              if (
                !entry ||
                !entry.supportsVision ||
                !entry.enabled ||
                !entry.available
              ) {
                return json(
                  {
                    error: 'invalid_vision_model',
                    modelId,
                  },
                  400,
                );
              }
            }

            updates.vision_fast_model_id = parsed.data.visionFastModelId;
            updates.vision_deep_model_id = parsed.data.visionDeepModelId;
          }

          if (Object.keys(updates).length === 0) return json(prefs);

          const supabase = getServiceRoleSupabaseClient();
          const { data, error } = await supabase
            .from('user_ai_preferences')
            // The generated DB type may lag this migration until Supabase types
            // are regenerated; the API schema above is the authoritative guard.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ ...updates, updated_at: new Date().toISOString() } as any)
            .eq('user_id', user.id)
            .select()
            .single();

          if (error) {
            return json({ error: 'failed_to_update_preferences' }, 500);
          }

          return json(
            preferenceResponse(data as unknown as Record<string, unknown>),
          );
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
