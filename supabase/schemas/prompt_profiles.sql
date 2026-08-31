-- P01C: prompt_profiles final declarative schema
-- Base: 20260816135311_prompt_profiles.sql
-- Mode: 20260816140000_add_prompt_profile_mode.sql

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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope" text NOT NULL DEFAULT 'parametric'
);

CREATE UNIQUE INDEX IF NOT EXISTS "prompt_profiles_pkey" ON "public"."prompt_profiles" USING btree ("id");
ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_pkey" PRIMARY KEY USING INDEX "prompt_profiles_pkey";
ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."prompt_profiles" ADD CONSTRAINT "prompt_profiles_scope_check"
    CHECK ("scope" ~ '^[a-z0-9][a-z0-9_.-]{0,127}$');

CREATE UNIQUE INDEX IF NOT EXISTS "prompt_profiles_user_scope_name_unique"
    ON "public"."prompt_profiles" USING btree ("user_id", "scope", lower("name"))
    WHERE archived = false;
CREATE INDEX IF NOT EXISTS "prompt_profiles_user_archived_idx" ON "public"."prompt_profiles" USING btree ("user_id", "archived");

ALTER TABLE "public"."prompt_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_profiles_select" ON "public"."prompt_profiles"
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "prompt_profiles_insert" ON "public"."prompt_profiles"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompt_profiles_update" ON "public"."prompt_profiles"
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompt_profiles_delete" ON "public"."prompt_profiles"
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON TABLE "public"."prompt_profiles" TO anon;
GRANT ALL ON TABLE "public"."prompt_profiles" TO authenticated;
GRANT ALL ON TABLE "public"."prompt_profiles" TO service_role;
GRANT ALL ON TABLE "public"."prompt_profiles" TO postgres;
