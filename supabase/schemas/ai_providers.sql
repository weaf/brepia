-- P01D: ai_providers table schema definition
-- Generated from migration: 20260816135454_ai_providers.sql

CREATE TABLE IF NOT EXISTS "public"."ai_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "driver" "text" NOT NULL,
    "base_url" "text" NOT NULL,
    "credential_ciphertext" "text" NULL,
    "credential_iv" "text" NULL,
    "credential_tag" "text" NULL,
    "enabled" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_providers_pkey" ON "public"."ai_providers" USING btree ("id");

ALTER TABLE "public"."ai_providers" ADD CONSTRAINT "ai_providers_pkey" PRIMARY KEY USING INDEX "ai_providers_pkey";

ALTER TABLE "public"."ai_providers" ADD CONSTRAINT "ai_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_providers_user_slug_unique" ON "public"."ai_providers" USING btree ("user_id", "slug");

CREATE INDEX IF NOT EXISTS "ai_providers_user_enabled_idx" ON "public"."ai_providers" USING btree ("user_id", "enabled");
