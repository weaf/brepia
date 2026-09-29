-- P01D: Create ai_providers table
-- Purpose: Store user's custom AI provider configurations (OpenRouter, Google,
-- etc.) with encrypted credentials.
--
-- Security:
-- - credential_ciphertext, credential_iv, credential_tag are encrypted.
--   The encryption key is server-side only (environment variable).
-- - These columns are NULL when no credential is stored (e.g., API key
--   auth mode).
-- - Secrets are NEVER returned to the client after storage.
-- - Secrets are NEVER logged (not in error logs, access logs, or console).
-- - No silent fallback: if a custom provider fails, the error is surfaced
--   to the user.

BEGIN;

-- ============================================================================
-- 1. Create table
-- ============================================================================
CREATE TABLE public.ai_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  driver text NOT NULL,
  base_url text NOT NULL,
  credential_ciphertext text NULL,
  credential_iv text NULL,
  credential_tag text NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================================
-- 2. Unique constraint: one provider per user per slug.
-- ============================================================================
CREATE UNIQUE INDEX ai_providers_user_slug_unique
  ON public.ai_providers (user_id, slug);

-- ============================================================================
-- 3. Index for efficient provider listing filtered by enabled status.
-- ============================================================================
CREATE INDEX ai_providers_user_enabled_idx
  ON public.ai_providers (user_id, enabled);

-- ============================================================================
-- 4. RLS
-- ============================================================================
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_providers_select"
  ON public.ai_providers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_providers_insert"
  ON public.ai_providers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_providers_update"
  ON public.ai_providers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_providers_delete"
  ON public.ai_providers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Grants
-- ============================================================================
GRANT ALL ON TABLE public.ai_providers TO anon;
GRANT ALL ON TABLE public.ai_providers TO authenticated;
GRANT ALL ON TABLE public.ai_providers TO service_role;
GRANT ALL ON TABLE public.ai_providers TO postgres;

COMMIT;
