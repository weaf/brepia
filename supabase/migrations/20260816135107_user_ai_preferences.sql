-- P01B: Create user_ai_preferences table
-- Purpose: Persist local user AI customization preferences (hidden models,
-- default prompt profile) without copying upstream model catalogs or provider
-- secrets.
--
-- The service layer treats a missing row as defaults:
--   { hiddenModelIds: [], defaultPromptProfileId: null }
-- This avoids requiring an insert for every existing account.

BEGIN;

-- ============================================================================
-- 1. Create table. user_id is the PK because each user has exactly one
--    preferences row.
-- ============================================================================
CREATE TABLE public.user_ai_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_model_ids text[] NOT NULL DEFAULT '{}',
  default_prompt_profile_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. RLS — user can manage their own row only.
-- ============================================================================
ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ai_preferences_select"
  ON public.user_ai_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_ai_preferences_insert"
  ON public.user_ai_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_ai_preferences_update"
  ON public.user_ai_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_ai_preferences_delete"
  ON public.user_ai_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Grants — mirror the project's grant pattern for all tables.
-- ============================================================================
GRANT ALL ON TABLE public.user_ai_preferences TO anon;
GRANT ALL ON TABLE public.user_ai_preferences TO authenticated;
GRANT ALL ON TABLE public.user_ai_preferences TO service_role;
GRANT ALL ON TABLE public.user_ai_preferences TO postgres;

COMMIT;
