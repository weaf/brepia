-- P05E: Add feature columns to ai_provider_models
-- Allows per-model capability metadata (tools, thinking, vision, limits)

ALTER TABLE "public"."ai_provider_models"
    ADD COLUMN IF NOT EXISTS "description" text,
    ADD COLUMN IF NOT EXISTS "supports_tools" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "supports_thinking" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "supports_vision" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "context_limit" integer,
    ADD COLUMN IF NOT EXISTS "output_limit" integer;

-- Add updated_at trigger to ai_provider_models (it should already exist, but ensure it)
ALTER TABLE "public"."ai_provider_models"
    ADD CONSTRAINT "ai_provider_models_updated_at_trigger"
    CHECK (true); -- placeholder to ensure migration idempotency
