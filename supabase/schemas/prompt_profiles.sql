-- P01C: prompt_profiles table schema definition
-- Generated from migration: 20260816135311_prompt_profiles.sql
-- Updated: 20260816 P04G added mode column with overlay/fork values

CREATE TABLE IF NOT EXISTS "public"."prompt_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NULL,
    "prompt_template" "text" NOT NULL,
    "mode" text NOT NULL DEFAULT 'overlay' CHECK ("mode" IN ('overlay', 'fork')),
    "base_revision" "text" NULL,
    "archived" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "prompt_profiles_pkey" ON "public"."prompt_profiles" USING btree ("id");

ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_pkey" PRIMARY KEY USING INDEX "prompt_profiles_pkey";

ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "prompt_profiles_user_name_unique" ON "public"."prompt_profiles" USING btree ("user_id", "lower"(name)) WHERE archived = false;

CREATE INDEX IF NOT EXISTS "prompt_profiles_user_archived_idx" ON "public"."prompt_profiles" USING btree ("user_id", "archived");
