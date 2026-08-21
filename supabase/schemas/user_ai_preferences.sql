-- P01B: user_ai_preferences table schema definition
-- Generated from migration: 20260816135107_user_ai_preferences.sql

CREATE TABLE IF NOT EXISTS "public"."user_ai_preferences" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hidden_model_ids" "text"[] NOT NULL DEFAULT '{}',
    "default_prompt_profile_id" "uuid" NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_pkey" PRIMARY KEY USING INDEX IF NOT EXISTS "user_ai_preferences_pkey";

ALTER TABLE "public"."user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "user_ai_preferences_pkey" ON "public"."user_ai_preferences" USING btree ("user_id");
