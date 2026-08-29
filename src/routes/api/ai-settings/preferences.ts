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
  buildFullCatalog,
  buildSelectableCatalog,
} from '@/server/modelCatalog';
import { resolveCreativeMeshProvider } from '@/server/creativeMeshProviderRegistry';
import { getPromptProfile } from '@/server/promptProfiles';
import { getServiceRoleSupabaseClient } from '@/server/supabaseClient';
import {
  InstructionProfileDefaultsSchema,
  RuntimeOverridesSchema,
} from '@shared/aiInstructionSettings';
import {
  UpdateDefaultModelsSchema,
  UpdateVisionModelsSchema,
} from '@shared/aiSettings';

function preferenceResponse(data: Record<string, unknown>) {
  return {
    userId: data.user_id,
    hiddenModelIds: data.hidden_model_ids ?? [],
    defaultPromptProfileId: data.default_prompt_profile_id ?? null,
    defaultCreativePromptProfileId:
      data.default_creative_prompt_profile_id ?? null,
    instructionProfileDefaults: data.instruction_profile_defaults ?? {},
    runtimeOverrides: data.runtime_overrides ?? {},
    defaultParametricModelId: data.default_parametric_model_id ?? null,
    defaultCreativeModelId: data.default_creative_model_id ?? null,
    visionFastModelId: data.vision_fast_model_id ?? null,
    visionDeepModelId: data.vision_deep_model_id ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function isSelectablePromptProfile(
  profile: Awaited<ReturnType<typeof getPromptProfile>>,
  scope: string,
): boolean {
  return Boolean(
    profile &&
      profile.scope === scope &&
      profile.editable &&
      !profile.archived,
  );
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
            if (body.defaultPromptProfileId !== null) {
              const profile = await getPromptProfile(
                user.id,
                body.defaultPromptProfileId,
              );
              if (!isSelectablePromptProfile(profile, 'parametric')) {
                return json({ error: 'invalid_default_prompt_profile' }, 400);
              }
            }
            updates.default_prompt_profile_id = body.defaultPromptProfileId;
          }

          if (body.defaultCreativePromptProfileId !== undefined) {
            if (body.defaultCreativePromptProfileId !== null) {
              const profile = await getPromptProfile(
                user.id,
                body.defaultCreativePromptProfileId,
              );
              if (!isSelectablePromptProfile(profile, 'creative')) {
                return json(
                  { error: 'invalid_default_creative_prompt_profile' },
                  400,
                );
              }
            }
            updates.default_creative_prompt_profile_id =
              body.defaultCreativePromptProfileId;
          }

          if (body.instructionProfileDefaults !== undefined) {
            const parsed = InstructionProfileDefaultsSchema.safeParse(
              body.instructionProfileDefaults,
            );
            if (!parsed.success) {
              return json({ error: 'invalid_instruction_profile_defaults' }, 400);
            }

            for (const [scope, profileId] of Object.entries(parsed.data)) {
              if (profileId == null) continue;
              const profile = await getPromptProfile(user.id, profileId);
              if (!isSelectablePromptProfile(profile, scope)) {
                return json(
                  {
                    error: 'invalid_instruction_profile_default',
                    scope,
                    profileId,
                  },
                  400,
                );
              }
            }

            updates.instruction_profile_defaults = parsed.data;
          }

          if (body.runtimeOverrides !== undefined) {
            const parsed = RuntimeOverridesSchema.safeParse(body.runtimeOverrides);
            if (!parsed.success) {
              return json({ error: 'invalid_runtime_overrides' }, 400);
            }
            updates.runtime_overrides = parsed.data;
          }

          if (
            body.defaultParametricModelId !== undefined ||
            body.defaultCreativeModelId !== undefined
          ) {
            const parsed = UpdateDefaultModelsSchema.safeParse({
              ...(body.defaultParametricModelId !== undefined
                ? {
                    defaultParametricModelId: body.defaultParametricModelId,
                  }
                : {}),
              ...(body.defaultCreativeModelId !== undefined
                ? { defaultCreativeModelId: body.defaultCreativeModelId }
                : {}),
            });
            if (!parsed.success) {
              return json({ error: 'invalid_default_model_settings' }, 400);
            }

            if (parsed.data.defaultParametricModelId) {
              const selectableCatalog = await buildSelectableCatalog(user);
              if (
                !selectableCatalog.some(
                  (entry) =>
                    entry.id === parsed.data.defaultParametricModelId,
                )
              ) {
                return json(
                  {
                    error: 'invalid_default_parametric_model',
                    modelId: parsed.data.defaultParametricModelId,
                  },
                  400,
                );
              }
            }

            if (parsed.data.defaultCreativeModelId) {
              const creativeProvider = resolveCreativeMeshProvider(
                parsed.data.defaultCreativeModelId,
              );
              if (!creativeProvider?.enabled) {
                return json(
                  {
                    error: 'invalid_default_creative_model',
                    modelId: parsed.data.defaultCreativeModelId,
                  },
                  400,
                );
              }
            }

            if (parsed.data.defaultParametricModelId !== undefined) {
              updates.default_parametric_model_id =
                parsed.data.defaultParametricModelId;
            }
            if (parsed.data.defaultCreativeModelId !== undefined) {
              updates.default_creative_model_id =
                parsed.data.defaultCreativeModelId;
            }
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
            // New preference columns can briefly lead generated DB types after
            // a migration; request validation above remains authoritative.
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