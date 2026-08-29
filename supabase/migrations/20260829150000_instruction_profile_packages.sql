alter table public.user_ai_preferences
  add column if not exists default_instruction_profile_id text not null default 'standard';

comment on column public.user_ai_preferences.default_instruction_profile_id is
  'Repository-backed Brepia AI instruction profile package ID, such as standard or cadam.';
