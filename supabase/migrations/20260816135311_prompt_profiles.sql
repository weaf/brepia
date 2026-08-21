-- P01C: Create prompt_profiles table
-- Purpose: Store local user prompt profiles (overlay/fork) for parametric
-- agent generation. Each user can have multiple profiles with names, prompt
-- templates, and revision tracking.
--
-- The built-in prompt (PARAMETRIC_AGENT_PROMPT) is immutable from Settings.
-- Editing Built-in must create a new profile (fork).
-- Overlay profiles inherit the current upstream prompt text.

BEGIN;

-- ============================================================================
-- 1. Create table
-- ============================================================================
CREATE TABLE public.prompt_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  prompt_template text NOT NULL,
  base_revision text NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================================
-- 2. Unique constraint: one active (non-archived) profile per user per name.
--    Uses a partial index for efficiency.
-- ============================================================================
CREATE UNIQUE INDEX prompt_profiles_user_name_unique
  ON public.prompt_profiles (user_id, lower(name))
  WHERE archived = false;

-- ============================================================================
-- 3. Index for efficient profile listing filtered by archive status.
-- ============================================================================
CREATE INDEX prompt_profiles_user_archived_idx
  ON public.prompt_profiles (user_id, archived);

-- ============================================================================
-- 4. RLS
-- ============================================================================
ALTER TABLE public.prompt_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_profiles_select"
  ON public.prompt_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "prompt_profiles_insert"
  ON public.prompt_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prompt_profiles_update"
  ON public.prompt_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prompt_profiles_delete"
  ON public.prompt_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Grants
-- ============================================================================
GRANT ALL ON TABLE public.prompt_profiles TO anon;
GRANT ALL ON TABLE public.prompt_profiles TO authenticated;
GRANT ALL ON TABLE public.prompt_profiles TO service_role;
GRANT ALL ON TABLE public.prompt_profiles TO postgres;

COMMIT;
