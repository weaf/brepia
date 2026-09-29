alter table public.user_ai_preferences
  add column if not exists default_instruction_profile_id text not null default 'standard';

comment on column public.user_ai_preferences.default_instruction_profile_id is
  'Repository-backed Brepia AI instruction profile package ID, such as standard or cadam.';

-- Freeze existing conversations onto the package that was active for their
-- owner at migration time. Conversations created before package profiles did
-- not have this key, so using the current user preference is the least
-- surprising compatibility snapshot; users without a preference row use the
-- Brepia Standard package.
update public.conversations as c
set settings = coalesce(c.settings, '{}'::jsonb) ||
  jsonb_build_object(
    'instructionProfileId',
    coalesce(p.default_instruction_profile_id, 'standard')
  )
from public.user_ai_preferences as p
where c.user_id = p.user_id
  and not coalesce(c.settings, '{}'::jsonb) ? 'instructionProfileId';

update public.conversations as c
set settings = coalesce(c.settings, '{}'::jsonb) ||
  jsonb_build_object('instructionProfileId', 'standard')
where not coalesce(c.settings, '{}'::jsonb) ? 'instructionProfileId';

-- Pin the selected package for every future conversation. Clients may provide
-- instructionProfileId explicitly later (for a per-conversation selector); if
-- they do, the trigger preserves it. Otherwise the user's current default is
-- copied into the conversation settings at INSERT time.
create or replace function public.pin_conversation_instruction_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_profile text;
begin
  if coalesce(new.settings, '{}'::jsonb) ? 'instructionProfileId' then
    return new;
  end if;

  select default_instruction_profile_id
  into selected_profile
  from public.user_ai_preferences
  where user_id = new.user_id;

  new.settings := coalesce(new.settings, '{}'::jsonb) ||
    jsonb_build_object(
      'instructionProfileId',
      coalesce(selected_profile, 'standard')
    );
  return new;
end;
$$;

drop trigger if exists conversations_pin_instruction_profile
  on public.conversations;

create trigger conversations_pin_instruction_profile
before insert on public.conversations
for each row
execute function public.pin_conversation_instruction_profile();
