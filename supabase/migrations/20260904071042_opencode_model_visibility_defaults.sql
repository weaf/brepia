alter table "public"."user_ai_preferences"
  add column "enabled_opencode_model_ids" text[] not null default '{}'::text[];

comment on column "public"."user_ai_preferences"."enabled_opencode_model_ids" is
  'Explicit allowlist for dynamically discovered agent/opencode models. Newly discovered OpenCode models remain disabled until the user enables them.';
