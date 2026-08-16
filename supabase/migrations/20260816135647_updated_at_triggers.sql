-- P01E: Add updated_at trigger to new tables
-- Purpose: Ensure all newly created tables have automatic updated_at
-- timestamp updates via BEFORE UPDATE trigger.
--
-- This migration:
-- 1. Creates the update_updated_at_column() function (idempotent)
-- 2. Adds triggers to: user_ai_preferences, prompt_profiles, ai_providers,
--    ai_provider_models
-- 3. Verifies existing trigger on previews (already exists)

BEGIN;

-- ============================================================================
-- 1. Create or replace the updated_at trigger function.
--    This is idempotent — safe to run multiple times.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 2. Add triggers to new tables.
-- ============================================================================

-- user_ai_preferences
CREATE OR REPLACE TRIGGER update_user_ai_preferences_updated_at
    BEFORE UPDATE ON public.user_ai_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- prompt_profiles
CREATE OR REPLACE TRIGGER update_prompt_profiles_updated_at
    BEFORE UPDATE ON public.prompt_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ai_providers
CREATE OR REPLACE TRIGGER update_ai_providers_updated_at
    BEFORE UPDATE ON public.ai_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ai_provider_models
CREATE OR REPLACE TRIGGER update_ai_provider_models_updated_at
    BEFORE UPDATE ON public.ai_provider_models
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
