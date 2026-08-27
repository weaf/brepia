-- P01B: user_ai_preferences final declarative schema
-- Base: 20260816135107_user_ai_preferences.sql
-- Vision preferences: 20260820210000_vision_model_preferences.sql
-- Default model preferences: 20260827095000_default_model_preferences.sql

CREATE TABLE IF NOT EXISTS "public"."user_ai_preferences" (
    "user_id" "uuid" NOT NULL,
    "hidden_model_ids" "text"[] NOT NULL DEFAULT '{}',
    "default_prompt_profile_id" "uuid" NULL,
    "default_parametric_model_id" "text" NULL,
    "default_creative_model_id" "text" NULL,
    "vision_fast_model_id" "text" NULL,
    "vision_deep_model_id" "text" NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON COLUMN "public"."user_ai_preferences"."default_parametric_model_id" IS
    'Model catalog id preselected for new Parametric conversations.';
COMMENT ON COLUMN "public"."user_ai_preferences"."default_creative_model_id" IS
    'Creative mesh backend id preselected for new Creative conversations.';
COMMENT ON COLUMN "public"."user_ai_preferences"."vision_fast_model_id" IS
    'Model catalog id used for normal pCAD vision fallback analysis.';
COMMENT ON COLUMN "public"."user_ai_preferences"."vision_deep_model_id" IS
    'Model catalog id used for difficult/render inspection pCAD vision fallback analysis.';

CREATE UNIQUE INDEX IF NOT EXISTS "user_ai_preferences_pkey" ON "public"."user_ai_preferences" USING btree ("user_id");
ALTER TABLE "public"."user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_pkey" PRIMARY KEY USING INDEX "user_ai_preferences_pkey";
ALTER TABLE "public"."user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_ai_preferences" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ai_preferences_select" ON "public"."user_ai_preferences"
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_ai_preferences_insert" ON "public"."user_ai_preferences"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_ai_preferences_update" ON "public"."user_ai_preferences"
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_ai_preferences_delete" ON "public"."user_ai_preferences"
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON TABLE "public"."user_ai_preferences" TO anon;
GRANT ALL ON TABLE "public"."user_ai_preferences" TO authenticated;
GRANT ALL ON TABLE "public"."user_ai_preferences" TO service_role;
GRANT ALL ON TABLE "public"."user_ai_preferences" TO postgres;
