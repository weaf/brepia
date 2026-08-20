alter table public.user_ai_preferences
  add column if not exists vision_fast_model_id text null,
  add column if not exists vision_deep_model_id text null;

comment on column public.user_ai_preferences.vision_fast_model_id is
  'Model catalog id used for normal pCAD vision fallback analysis.';

comment on column public.user_ai_preferences.vision_deep_model_id is
  'Model catalog id used for difficult/render inspection pCAD vision fallback analysis.';
