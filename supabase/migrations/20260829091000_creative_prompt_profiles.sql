BEGIN;

-- Keep existing prompt profiles as Parametric/Generative profiles while
-- allowing Creative to have an independent built-in/custom prompt lineage.
ALTER TABLE public.prompt_profiles
  ADD COLUMN scope text NOT NULL DEFAULT 'parametric';

ALTER TABLE public.prompt_profiles
  ADD CONSTRAINT prompt_profiles_scope_check
  CHECK (scope IN ('parametric', 'creative'));

DROP INDEX IF EXISTS public.prompt_profiles_user_name_unique;
CREATE UNIQUE INDEX prompt_profiles_user_scope_name_unique
  ON public.prompt_profiles (user_id, scope, lower(name))
  WHERE archived = false;

-- Creative has its own default prompt profile. NULL means the built-in
-- Creative prompt, just as NULL default_prompt_profile_id means CADAM Original.
ALTER TABLE public.user_ai_preferences
  ADD COLUMN default_creative_prompt_profile_id uuid NULL;

COMMIT;
