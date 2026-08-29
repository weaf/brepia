BEGIN;

-- Generalize prompt profile scopes so model-facing instructions can reuse the
-- existing profile lineage/overlay/fork machinery without adding one table or
-- default column per instruction type.
ALTER TABLE public.prompt_profiles
  DROP CONSTRAINT IF EXISTS prompt_profiles_scope_check;

ALTER TABLE public.prompt_profiles
  ADD CONSTRAINT prompt_profiles_scope_check
  CHECK (
    scope IN (
      'parametric',
      'creative',
      'tool.build_parametric_model',
      'tool.answer_user',
      'tool.create_mesh',
      'vision.reference',
      'vision.inspection',
      'conversation.title',
      'suggestions.parametric',
      'suggestions.creative',
      'context.parametric_attachment',
      'context.mesh_preferences',
      'context.parametric_inspection_output'
    )
  );

-- Auxiliary instruction defaults are intentionally stored as a map. The two
-- existing primary prompt columns remain in place for backward compatibility
-- and conversation pinning.
ALTER TABLE public.user_ai_preferences
  ADD COLUMN instruction_profile_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_ai_preferences
  ADD CONSTRAINT user_ai_preferences_instruction_profile_defaults_object
  CHECK (jsonb_typeof(instruction_profile_defaults) = 'object');

-- Runtime limits are typed/validated by the application registry. Storing the
-- sparse overrides as JSON keeps built-in defaults authoritative and makes
-- Reset-to-Original equivalent to removing a key.
ALTER TABLE public.user_ai_preferences
  ADD COLUMN runtime_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_ai_preferences
  ADD CONSTRAINT user_ai_preferences_runtime_overrides_object
  CHECK (jsonb_typeof(runtime_overrides) = 'object');

COMMIT;
