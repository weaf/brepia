-- P01D: ai_provider_models table schema definition
-- Generated from migration: 20260816135455_ai_provider_models.sql

CREATE TABLE IF NOT EXISTS "public"."ai_provider_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "model_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_visible" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_pkey" PRIMARY KEY USING INDEX IF NOT EXISTS "ai_provider_models_pkey";

ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_models_provider_model_unique" ON "public"."ai_provider_models" USING btree ("provider_id", "model_id");

CREATE INDEX IF NOT EXISTS "ai_provider_models_provider_id_idx" ON "public"."ai_provider_models" USING btree ("provider_id");
