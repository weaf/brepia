-- P01D: ai_provider_models final declarative schema
-- Base: 20260816135455_ai_provider_models.sql
-- Features: 20260816141000_add_provider_model_features.sql

CREATE TABLE IF NOT EXISTS "public"."ai_provider_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "model_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text" NULL,
    "supports_tools" boolean NOT NULL DEFAULT false,
    "supports_thinking" boolean NOT NULL DEFAULT false,
    "supports_vision" boolean NOT NULL DEFAULT false,
    "context_limit" integer NULL,
    "output_limit" integer NULL,
    "is_visible" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_provider_models_updated_at_trigger" CHECK (true)
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_models_pkey" ON "public"."ai_provider_models" USING btree ("id");
ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_pkey" PRIMARY KEY USING INDEX "ai_provider_models_pkey";

ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "public"."ai_provider_models" ADD CONSTRAINT "ai_provider_models_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_models_provider_model_unique" ON "public"."ai_provider_models" USING btree ("provider_id", "model_id");
CREATE INDEX IF NOT EXISTS "ai_provider_models_provider_id_idx" ON "public"."ai_provider_models" USING btree ("provider_id");

ALTER TABLE "public"."ai_provider_models" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_models_select" ON "public"."ai_provider_models"
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_provider_models_insert" ON "public"."ai_provider_models"
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_provider_models_update" ON "public"."ai_provider_models"
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_provider_models_delete" ON "public"."ai_provider_models"
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON TABLE "public"."ai_provider_models" TO anon;
GRANT ALL ON TABLE "public"."ai_provider_models" TO authenticated;
GRANT ALL ON TABLE "public"."ai_provider_models" TO service_role;
GRANT ALL ON TABLE "public"."ai_provider_models" TO postgres;
