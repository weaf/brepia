-- Phase F1: bounded durable generation-run telemetry.
--
-- `generation_runs` remains the lifecycle snapshot authority. This table is a
-- narrow append-only event ledger for diagnostics that must survive reload and
-- reconnect. Raw prompts, provider output, hidden reasoning and canonical
-- project payloads have no storage field here.

CREATE TABLE IF NOT EXISTS "public"."generation_run_events" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "generation_run_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "sequence" bigint NOT NULL,
    "kind" text NOT NULL,
    "invocation_number" bigint NULL,
    "candidate_number" bigint NULL,
    "build_attempt_number" bigint NULL,
    "model_step_number" bigint NULL,
    "repair_count" bigint NULL,
    "error_code" text NULL,
    "error_message" text NULL,
    "context_used_tokens" bigint NULL,
    "context_limit_tokens" bigint NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE "public"."generation_run_events" IS
    'Bounded server-owned telemetry for one durable generation run. Retains only the newest 128 events per run.';
COMMENT ON COLUMN "public"."generation_run_events"."sequence" IS
    'Monotonic per-run event order. It may exceed 128 because retention trims old rows without renumbering.';
COMMENT ON COLUMN "public"."generation_run_events"."error_message" IS
    'Bounded UI-safe diagnostic only; never raw provider output, prompts, hidden reasoning or canonical project payloads.';

CREATE UNIQUE INDEX IF NOT EXISTS "generation_run_events_pkey"
    ON "public"."generation_run_events" USING btree ("id");
CREATE UNIQUE INDEX IF NOT EXISTS "generation_run_events_run_sequence_key"
    ON "public"."generation_run_events" USING btree ("generation_run_id", "sequence");
CREATE INDEX IF NOT EXISTS "generation_run_events_user_run_sequence_idx"
    ON "public"."generation_run_events" USING btree ("user_id", "generation_run_id", "sequence");

ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_pkey"
    PRIMARY KEY USING INDEX "generation_run_events_pkey";
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_generation_run_id_fkey"
    FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE CASCADE;
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_sequence_check"
    CHECK ("sequence" > 0 AND "sequence" <= 9007199254740991);
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_kind_check"
    CHECK (
        "kind" IN (
            'external_agent_invoked',
            'canonical_candidate_received',
            'canonical_candidate_rejected',
            'canonical_candidate_accepted',
            'build_attempt_started',
            'build_rejected',
            'build_accepted',
            'model_step',
            'transport_repair',
            'context_usage'
        )
    );
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_counter_range_check"
    CHECK (
        ("invocation_number" IS NULL OR ("invocation_number" > 0 AND "invocation_number" <= 9007199254740991))
        AND ("candidate_number" IS NULL OR ("candidate_number" > 0 AND "candidate_number" <= 9007199254740991))
        AND ("build_attempt_number" IS NULL OR ("build_attempt_number" > 0 AND "build_attempt_number" <= 9007199254740991))
        AND ("model_step_number" IS NULL OR ("model_step_number" > 0 AND "model_step_number" <= 9007199254740991))
        AND ("repair_count" IS NULL OR ("repair_count" > 0 AND "repair_count" <= 9007199254740991))
        AND ("context_used_tokens" IS NULL OR ("context_used_tokens" >= 0 AND "context_used_tokens" <= 9007199254740991))
        AND ("context_limit_tokens" IS NULL OR ("context_limit_tokens" > 0 AND "context_limit_tokens" <= 9007199254740991))
    );
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_required_counter_check"
    CHECK (
        ("kind" <> 'external_agent_invoked' OR "invocation_number" IS NOT NULL)
        AND ("kind" NOT IN ('canonical_candidate_received', 'canonical_candidate_rejected', 'canonical_candidate_accepted') OR "candidate_number" IS NOT NULL)
        AND ("kind" NOT IN ('build_attempt_started', 'build_rejected', 'build_accepted') OR "build_attempt_number" IS NOT NULL)
        AND ("kind" <> 'model_step' OR "model_step_number" IS NOT NULL)
        AND ("kind" <> 'transport_repair' OR "repair_count" IS NOT NULL)
        AND ("kind" <> 'context_usage' OR "context_used_tokens" IS NOT NULL)
    );
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_error_code_length_check"
    CHECK (
        "error_code" IS NULL
        OR (char_length(btrim("error_code")) > 0 AND char_length("error_code") <= 80)
    );
ALTER TABLE "public"."generation_run_events"
    ADD CONSTRAINT "generation_run_events_error_message_length_check"
    CHECK (
        "error_message" IS NULL
        OR (char_length(btrim("error_message")) > 0 AND char_length("error_message") <= 500)
    );

ALTER TABLE "public"."generation_run_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generation_run_events_select_own"
    ON "public"."generation_run_events"
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = "user_id"
        AND EXISTS (
            SELECT 1
            FROM "public"."generation_runs"
            WHERE "generation_runs"."id" = "generation_run_events"."generation_run_id"
              AND "generation_runs"."user_id" = auth.uid()
        )
    );

REVOKE ALL ON TABLE "public"."generation_run_events" FROM anon;
REVOKE ALL ON TABLE "public"."generation_run_events" FROM authenticated;
GRANT SELECT ON TABLE "public"."generation_run_events" TO authenticated;
GRANT ALL ON TABLE "public"."generation_run_events" TO service_role;
GRANT ALL ON TABLE "public"."generation_run_events" TO postgres;

CREATE OR REPLACE FUNCTION "public"."append_generation_run_event"(
    "p_generation_run_id" uuid,
    "p_user_id" uuid,
    "p_kind" text,
    "p_invocation_number" bigint DEFAULT NULL,
    "p_candidate_number" bigint DEFAULT NULL,
    "p_build_attempt_number" bigint DEFAULT NULL,
    "p_model_step_number" bigint DEFAULT NULL,
    "p_repair_count" bigint DEFAULT NULL,
    "p_error_code" text DEFAULT NULL,
    "p_error_message" text DEFAULT NULL,
    "p_context_used_tokens" bigint DEFAULT NULL,
    "p_context_limit_tokens" bigint DEFAULT NULL
)
RETURNS SETOF "public"."generation_run_events"
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_sequence bigint;
    v_event "public"."generation_run_events"%ROWTYPE;
BEGIN
    -- Serializing on the durable parent makes per-run sequence assignment safe
    -- even when multiple trusted runtime paths emit telemetry concurrently.
    PERFORM 1
    FROM "public"."generation_runs"
    WHERE "id" = p_generation_run_id
      AND "user_id" = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'generation run % is not owned by user %', p_generation_run_id, p_user_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(MAX("sequence"), 0) + 1
    INTO v_sequence
    FROM "public"."generation_run_events"
    WHERE "generation_run_id" = p_generation_run_id;

    INSERT INTO "public"."generation_run_events" (
        "generation_run_id",
        "user_id",
        "sequence",
        "kind",
        "invocation_number",
        "candidate_number",
        "build_attempt_number",
        "model_step_number",
        "repair_count",
        "error_code",
        "error_message",
        "context_used_tokens",
        "context_limit_tokens"
    ) VALUES (
        p_generation_run_id,
        p_user_id,
        v_sequence,
        p_kind,
        p_invocation_number,
        p_candidate_number,
        p_build_attempt_number,
        p_model_step_number,
        p_repair_count,
        p_error_code,
        p_error_message,
        p_context_used_tokens,
        p_context_limit_tokens
    )
    RETURNING * INTO v_event;

    -- Keep only the newest bounded window without renumbering durable events.
    DELETE FROM "public"."generation_run_events"
    WHERE "id" IN (
        SELECT "id"
        FROM "public"."generation_run_events"
        WHERE "generation_run_id" = p_generation_run_id
        ORDER BY "sequence" DESC
        OFFSET 128
    );

    RETURN NEXT v_event;
    RETURN;
END;
$$;

COMMENT ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) IS
    'Service-role telemetry append boundary. Assigns monotonic per-run sequence and retains the newest 128 events.';

REVOKE ALL ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) FROM anon;
REVOKE ALL ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) FROM authenticated;
GRANT EXECUTE ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) TO service_role;
GRANT EXECUTE ON FUNCTION "public"."append_generation_run_event"(
    uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text, text, bigint, bigint
) TO postgres;
