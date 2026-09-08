
  create table "public"."generation_runs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "conversation_id" uuid not null,
    "request_message_id" uuid not null,
    "response_message_id" uuid,
    "kind" text not null,
    "requested_model_id" text not null,
    "actual_model_id" text,
    "transport_kind" text,
    "execution_mode" text,
    "status" text not null default 'queued'::text,
    "phase" text not null default 'request_saved'::text,
    "detail" text,
    "sequence" bigint not null default 1,
    "created_at" timestamp with time zone not null default now(),
    "started_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default now(),
    "completed_at" timestamp with time zone,
    "error_code" text,
    "error_message" text
      );


alter table "public"."generation_runs" enable row level security;

CREATE INDEX generation_runs_conversation_created_idx ON public.generation_runs USING btree (conversation_id, created_at DESC);

CREATE UNIQUE INDEX generation_runs_pkey ON public.generation_runs USING btree (id);

CREATE INDEX generation_runs_request_message_id_idx ON public.generation_runs USING btree (request_message_id);

CREATE INDEX generation_runs_user_updated_idx ON public.generation_runs USING btree (user_id, updated_at DESC);

alter table "public"."generation_runs" add constraint "generation_runs_pkey" PRIMARY KEY using index "generation_runs_pkey";

alter table "public"."generation_runs" add constraint "generation_runs_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_conversation_id_fkey";

alter table "public"."generation_runs" add constraint "generation_runs_detail_length_check" CHECK (((detail IS NULL) OR (char_length(detail) <= 240))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_detail_length_check";

alter table "public"."generation_runs" add constraint "generation_runs_error_code_length_check" CHECK (((error_code IS NULL) OR (char_length(error_code) <= 80))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_error_code_length_check";

alter table "public"."generation_runs" add constraint "generation_runs_error_message_length_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 500))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_error_message_length_check";

alter table "public"."generation_runs" add constraint "generation_runs_execution_mode_check" CHECK (((execution_mode IS NULL) OR (execution_mode = ANY (ARRAY['cli'::text, 'streaming'::text])))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_execution_mode_check";

alter table "public"."generation_runs" add constraint "generation_runs_failed_error_code_check" CHECK (((status <> 'failed'::text) OR ((error_code IS NOT NULL) AND (char_length(btrim(error_code)) > 0)))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_failed_error_code_check";

alter table "public"."generation_runs" add constraint "generation_runs_kind_check" CHECK ((kind = ANY (ARRAY['parametric'::text, 'brep'::text, 'creative'::text]))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_kind_check";

alter table "public"."generation_runs" add constraint "generation_runs_opencode_execution_mode_check" CHECK (((execution_mode IS NULL) OR (transport_kind = 'opencode'::text))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_opencode_execution_mode_check";

alter table "public"."generation_runs" add constraint "generation_runs_phase_check" CHECK ((phase = ANY (ARRAY['request_saved'::text, 'model_dispatched'::text, 'generating'::text, 'response_received'::text, 'validating_artifact'::text, 'saving_revision'::text, 'revision_saved'::text, 'evaluation_requested'::text, 'evaluating_native'::text, 'preparing_viewer'::text, 'preview_ready'::text]))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_phase_check";

alter table "public"."generation_runs" add constraint "generation_runs_sequence_check" CHECK (((sequence > 0) AND (sequence <= '9007199254740991'::bigint))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_sequence_check";

alter table "public"."generation_runs" add constraint "generation_runs_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'waiting_for_preview'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_status_check";

alter table "public"."generation_runs" add constraint "generation_runs_terminal_timestamp_check" CHECK ((((status = ANY (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text])) AND (completed_at IS NOT NULL)) OR ((status <> ALL (ARRAY['completed'::text, 'failed'::text, 'cancelled'::text])) AND (completed_at IS NULL)))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_terminal_timestamp_check";

alter table "public"."generation_runs" add constraint "generation_runs_transport_kind_check" CHECK (((transport_kind IS NULL) OR (transport_kind = ANY (ARRAY['direct'::text, 'opencode'::text, 'codex'::text, 'cli-agent'::text])))) not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_transport_kind_check";

alter table "public"."generation_runs" add constraint "generation_runs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."generation_runs" validate constraint "generation_runs_user_id_fkey";

grant select on table "public"."generation_runs" to "authenticated";

grant delete on table "public"."generation_runs" to "service_role";

grant insert on table "public"."generation_runs" to "service_role";

grant references on table "public"."generation_runs" to "service_role";

grant select on table "public"."generation_runs" to "service_role";

grant trigger on table "public"."generation_runs" to "service_role";

grant truncate on table "public"."generation_runs" to "service_role";

grant update on table "public"."generation_runs" to "service_role";


  create policy "generation_runs_select_own"
  on "public"."generation_runs"
  as permissive
  for select
  to authenticated
using (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = generation_runs.conversation_id) AND (conversations.user_id = auth.uid()))))));



