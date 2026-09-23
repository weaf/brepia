#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${ROOT}/scripts/supabase-local.sh"

if [[ -z "${DB_URL:-}" ]]; then
  status_env="$(brepia_supabase_status_env 2>/dev/null || true)"
  if [[ -n "$status_env" ]]; then
    eval "$status_env"
  fi
fi

PSQL=()
if [[ -n "${DB_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  if psql "$DB_URL" -X -Atc "select 1" >/dev/null 2>&1; then
    PSQL=(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q)
  fi
fi

if [[ "${#PSQL[@]}" -eq 0 ]] &&
  command -v podman >/dev/null 2>&1 &&
  podman inspect supabase_db_brepia --format '{{.State.Running}}' 2>/dev/null |
    grep -qx true; then
  PSQL=(
    podman exec -i supabase_db_brepia
    psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -q
  )
fi

if [[ "${#PSQL[@]}" -eq 0 ]]; then
  echo "No reachable local Brepia PostgreSQL connection is available." >&2
  exit 1
fi
owner_id="$("${PSQL[@]}" -Atc "select id::text from auth.users order by created_at asc limit 1")"
if [[ -z "$owner_id" ]]; then
  echo "No local auth user exists. Sign in to the local Brepia instance once, then rerun." >&2
  exit 1
fi

uuid() {
  cat /proc/sys/kernel/random/uuid
}

conversation_id="$(uuid)"
base_message_id="$(uuid)"
new_message_id="$(uuid)"

cleanup() {
  "${PSQL[@]}" -c "delete from public.conversations where id = '$conversation_id'::uuid;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${PSQL[@]}" <<SQL
insert into public.conversations (id, user_id, title, type, privacy, settings)
values (
  '$conversation_id'::uuid,
  '$owner_id'::uuid,
  'stale cached title',
  'parametric',
  'private',
  '{"model":"old-model","openCodeExecutionMode":"cli"}'::jsonb
);

insert into public.messages (
  id, conversation_id, role, parts, metadata, parent_message_id, rating
) values (
  '$base_message_id'::uuid,
  '$conversation_id'::uuid,
  'user',
  '[{"type":"text","text":"base"}]'::jsonb,
  '{}'::jsonb,
  null,
  0
);
SQL

stale_leaf="$("${PSQL[@]}" -Atc "select current_message_leaf_id::text from public.conversations where id = '$conversation_id'::uuid")"
if [[ "$stale_leaf" != "$base_message_id" ]]; then
  echo "Fixture trigger did not establish expected stale leaf." >&2
  exit 1
fi

# A different tab/generation advances the authoritative leaf after the metadata
# client has already cached the conversation row.
"${PSQL[@]}" <<SQL
insert into public.messages (
  id, conversation_id, role, parts, metadata, parent_message_id, rating
) values (
  '$new_message_id'::uuid,
  '$conversation_id'::uuid,
  'user',
  '[{"type":"text","text":"newer branch"}]'::jsonb,
  '{}'::jsonb,
  '$base_message_id'::uuid,
  0
);
SQL

# Exercise the exact B1.1 database contract. The RPC never accepts the leaf,
# and settings are merged atomically into the current row.
"${PSQL[@]}" <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$owner_id';
set local "request.jwt.claims" = '{"sub":"$owner_id","role":"authenticated"}';

select public.patch_conversation_metadata(
  '$conversation_id'::uuid,
  'fresh title',
  'public'::public.privacy_type,
  '{"model":"fresh-model"}'::jsonb
);

select public.patch_conversation_metadata(
  '$conversation_id'::uuid,
  null,
  null,
  '{"openCodeExecutionMode":"streaming"}'::jsonb
);
commit;
SQL

result="$("${PSQL[@]}" -At -F '|' -c "
select
  current_message_leaf_id::text,
  title,
  privacy::text,
  settings->>'model',
  settings->>'openCodeExecutionMode'
from public.conversations
where id = '$conversation_id'::uuid
")"

expected="$new_message_id|fresh title|public|fresh-model|streaming"
if [[ "$result" != "$expected" ]]; then
  echo "Conversation metadata race failed." >&2
  echo "expected: $expected" >&2
  echo "actual:   $result" >&2
  exit 1
fi

echo "conversation metadata race: PASS"
echo "stale_leaf=$stale_leaf"
echo "authoritative_leaf=$new_message_id"
