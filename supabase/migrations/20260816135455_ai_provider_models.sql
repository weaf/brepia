-- P01D: Create ai_provider_models table
-- Purpose: Map custom providers to their available models. Each custom
-- provider can expose multiple models (e.g., openrouter/llama-3.1-70b,
-- google/gemini-2.0-flash).
--
-- Custom providers are additive — they do not replace built-in providers.

BEGIN;

-- ============================================================================
-- 1. Create table
-- ============================================================================
CREATE TABLE public.ai_provider_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  display_name text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================================
-- 2. Unique constraint: one model per provider per user.
-- ============================================================================
CREATE UNIQUE INDEX ai_provider_models_provider_model_unique
  ON public.ai_provider_models (provider_id, model_id);

-- ============================================================================
-- 3. Index for efficient model listing by provider.
-- ============================================================================
CREATE INDEX ai_provider_models_provider_id_idx
  ON public.ai_provider_models (provider_id);

-- ============================================================================
-- 4. RLS
-- ============================================================================
ALTER TABLE public.ai_provider_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_models_select"
  ON public.ai_provider_models
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_provider_models_insert"
  ON public.ai_provider_models
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_provider_models_update"
  ON public.ai_provider_models
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_provider_models_delete"
  ON public.ai_provider_models
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Grants
-- ============================================================================
GRANT ALL ON TABLE public.ai_provider_models TO anon;
GRANT ALL ON TABLE public.ai_provider_models TO authenticated;
GRANT ALL ON TABLE public.ai_provider_models TO service_role;
GRANT ALL ON TABLE public.ai_provider_models TO postgres;

COMMIT;
