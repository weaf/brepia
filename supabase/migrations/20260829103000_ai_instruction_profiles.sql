BEGIN;

-- Generalize prompt profile scopes so model-facing instructions can reuse the
-- existing profile lineage/overlay/fork machinery without adding one table or
-- default column per instruction type. The repository manifest is the source
-- of truth for registered instruction keys; the database only validates a safe
-- key format so adding a bundled instruction does not require another schema
-- migration.
ALTER TABLE public.prompt_profiles
  DROP CONSTRAINT IF EXISTS prompt_profiles_scope_check;

ALTER TABLE public.prompt_profiles
  ADD CONSTRAINT prompt_profiles_scope_check
  CHECK (scope ~ '^[a-z0-9][a-z0-9_.-]{0,127}$');

-- Auxiliary instruction defaults are intentionally stored as a map. The two
-- existing primary prompt columns remain in place for backward compatibility
-- and conversation pinning while the generalized settings surface is adopted.
ALTER TABLE public.user_ai_preferences
  ADD COLUMN instruction_profile_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_ai_preferences
  ADD CONSTRAINT user_ai_preferences_instruction_profile_defaults_object
  CHECK (jsonb_typeof(instruction_profile_defaults) = 'object');

-- Runtime settings are typed/validated against the repository configuration.
-- The sparse map stores only user choices; shipped values live in repo JSON,
-- not in database defaults or TypeScript constants.
ALTER TABLE public.user_ai_preferences
  ADD COLUMN runtime_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_ai_preferences
  ADD CONSTRAINT user_ai_preferences_runtime_overrides_object
  CHECK (jsonb_typeof(runtime_overrides) = 'object');

COMMIT;
