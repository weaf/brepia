-- ROBUST-1: durable server-owned generation lifecycle state.
--
-- Browser clients may read their own rows but do not receive INSERT/UPDATE/
-- DELETE policies. Authoritative writes are performed by trusted server code
-- after request authentication and conversation ownership checks.

CREATE TABLE IF NOT EXISTS "public"."generation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "request_message_id" "uuid" NOT NULL,
    "response_message_id" "uuid" NULL,
    "kind" "text" NOT NULL,
    "requested_model_id" "text" NOT NULL,
    "actual_model_id" "text" NULL,
    "transport_kind" "text" NULL,
    "execution_mode" "text" NULL,
    "status" "text" NOT NULL DEFAULT 'queued',
    "phase" "text" NOT NULL DEFAULT 'request_saved',
    "detail" "text" NULL,
    "sequence" bigint NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone NULL,
    "error_code" "text" NULL,
    "error_message" "text" NULL
);

COMMENT ON TABLE "public"."generation_runs" IS
    'Durable server-owned generation progress. sequence is a monotonic state version, never a percentage.';
COMMENT ON COLUMN "public"."generation_runs"."detail" IS
    'Bounded UI-safe progress detail. Raw provider/agent output and secrets must never be stored here.';
COMMENT ON COLUMN "public"."generation_runs"."status" IS
    'queued, running, waiting_for_preview, completed, failed, or cancelled.';
COMMENT ON COLUMN "public"."generation_runs"."phase" IS
    'Truthful current server phase from the shared GenerationRunPhase contract.';

CREATE UNIQUE INDEX IF NOT EXISTS "generation_runs_pkey"
    ON "public"."generation_runs" USING btree ("id");
CREATE INDEX IF NOT EXISTS "generation_runs_conversation_created_idx"
    ON "public"."generation_runs" USING btree ("conversation_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "generation_runs_user_updated_idx"
    ON "public"."generation_runs" USING btree ("user_id", "updated_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "generation_runs_request_message_id_key"
    ON "public"."generation_runs" USING btree ("request_message_id");

ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_pkey"
    PRIMARY KEY USING INDEX "generation_runs_pkey";
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_kind_check"
    CHECK ("kind" IN ('parametric', 'brep', 'creative'));
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_transport_kind_check"
    CHECK (
        "transport_kind" IS NULL OR
        "transport_kind" IN ('direct', 'opencode', 'codex', 'cli-agent')
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_execution_mode_check"
    CHECK (
        "execution_mode" IS NULL OR
        "execution_mode" IN ('cli', 'streaming')
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_opencode_execution_mode_check"
    CHECK (
        "execution_mode" IS NULL OR "transport_kind" = 'opencode'
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_status_check"
    CHECK (
        "status" IN (
            'queued',
            'running',
            'waiting_for_preview',
            'completed',
            'failed',
            'cancelled'
        )
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_phase_check"
    CHECK (
        "phase" IN (
            'request_saved',
            'model_dispatched',
            'generating',
            'response_received',
            'validating_artifact',
            'saving_revision',
            'revision_saved',
            'evaluation_requested',
            'evaluating_native',
            'preparing_viewer',
            'preview_ready'
        )
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_sequence_check"
    CHECK ("sequence" > 0);
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_detail_length_check"
    CHECK ("detail" IS NULL OR char_length("detail") <= 240);
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_error_code_length_check"
    CHECK ("error_code" IS NULL OR char_length("error_code") <= 80);
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_error_message_length_check"
    CHECK ("error_message" IS NULL OR char_length("error_message") <= 500);
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_terminal_timestamp_check"
    CHECK (
        ("status" IN ('completed', 'failed', 'cancelled') AND "completed_at" IS NOT NULL)
        OR
        ("status" NOT IN ('completed', 'failed', 'cancelled') AND "completed_at" IS NULL)
    );
ALTER TABLE "public"."generation_runs"
    ADD CONSTRAINT "generation_runs_failed_error_code_check"
    CHECK ("status" <> 'failed' OR "error_code" IS NOT NULL);

ALTER TABLE "public"."generation_runs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generation_runs_select_own"
    ON "public"."generation_runs"
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = "user_id"
        AND EXISTS (
            SELECT 1
            FROM "public"."conversations"
            WHERE "conversations"."id" = "generation_runs"."conversation_id"
              AND "conversations"."user_id" = auth.uid()
        )
    );

-- No authenticated INSERT/UPDATE/DELETE policies by design. The browser is an
-- observer. Trusted server code owns lifecycle writes through service_role.
GRANT SELECT ON TABLE "public"."generation_runs" TO authenticated;
GRANT ALL ON TABLE "public"."generation_runs" TO service_role;
GRANT ALL ON TABLE "public"."generation_runs" TO postgres;
