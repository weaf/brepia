alter table "public"."user_ai_preferences"
  add column "default_parametric_model_id" text,
  add column "default_creative_model_id" text;

comment on column "public"."user_ai_preferences"."default_parametric_model_id" is
  'Model catalog id preselected for new Parametric conversations.';
comment on column "public"."user_ai_preferences"."default_creative_model_id" is
  'Creative mesh backend id preselected for new Creative conversations.';
