#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DB_URL:-}" ]]; then
  echo "DB_URL is required. Load it from: npx supabase status -o env" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for the local BRep AI race gate." >&2
  exit 1
fi

PSQL=(psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q)

owner_id="$(${PSQL[@]} -Atc "select id::text from auth.users order by created_at asc limit 1")"
if [[ -z "$owner_id" ]]; then
  echo "No local auth user exists. Sign in to the local Brepia instance once, then rerun this gate." >&2
  exit 1
fi

uuid() {
  cat /proc/sys/kernel/random/uuid
}

tmpdir="$(mktemp -d)"
conv_stale="$(uuid)"
base_stale="$(uuid)"
user_stale="$(uuid)"
ai_stale="$(uuid)"
conv_race="$(uuid)"
base_race="$(uuid)"
user_race="$(uuid)"
ai_race="$(uuid)"

cleanup() {
  ${PSQL[@]} -c "delete from public.conversations where id in ('$conv_stale'::uuid, '$conv_race'::uuid);" >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}
trap cleanup EXIT

create_fixture() {
  local conversation_id="$1"
  local base_message_id="$2"
  local title="$3"

  ${PSQL[@]} <<SQL
insert into public.conversations (id, user_id, title, type, privacy, settings)
values ('$conversation_id'::uuid, '$owner_id'::uuid, '$title', 'parametric', 'private', '{}'::jsonb);

insert into public.messages (
  id, conversation_id, role, parts, metadata, parent_message_id, rating
) values (
  '$base_message_id'::uuid,
  '$conversation_id'::uuid,
  'user',
  '[{"type":"text","text":"BRep AI atomic race base"}]'::jsonb,
  '{}'::jsonb,
  null,
  0
);
SQL
}

echo "[1/2] stale-first ordering"
create_fixture "$conv_stale" "$base_stale" "BRep AI stale-first race gate"

${PSQL[@]} <<SQL
insert into public.messages (
  id, conversation_id, role, parts, metadata, parent_message_id, rating
) values (
  '$user_stale'::uuid,
  '$conv_stale'::uuid,
  'user',
  '[{"type":"text","text":"newer user branch"}]'::jsonb,
  '{}'::jsonb,
  '$base_stale'::uuid,
  0
);
SQL

stale_reason="$(${PSQL[@]} -At <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$owner_id';
set local "request.jwt.claims" = '{"sub":"$owner_id","role":"authenticated"}';
select public.persist_brep_ai_revision(
  '$conv_stale'::uuid,
  '$base_stale'::uuid,
  '$ai_stale'::uuid,
  '[{"type":"text","text":"stale AI completion"}]'::jsonb,
  '{}'::jsonb
)->>'reason';
commit;
SQL
)"

if [[ "$stale_reason" != "stale" ]]; then
  echo "Expected stale rejection, got: ${stale_reason:-<empty>}" >&2
  exit 1
fi

stale_state="$(${PSQL[@]} -Atc "
select case
  when c.current_message_leaf_id = '$user_stale'::uuid
   and not exists (select 1 from public.messages where id = '$ai_stale'::uuid)
  then 'ok'
  else 'bad'
end
from public.conversations c
where c.id = '$conv_stale'::uuid;")"

if [[ "$stale_state" != "ok" ]]; then
  echo "Stale-first invariant failed: stale AI row or leaf mutation detected." >&2
  exit 1
fi

echo "PASS: newer leaf rejects the AI completion without inserting it"

echo "[2/2] AI-lock-first ordering"
create_fixture "$conv_race" "$base_race" "BRep AI lock-first race gate"

ready_file="$tmpdir/ai-lock-ready"
ai_sql="$tmpdir/ai.sql"
ai_out="$tmpdir/ai.out"

cat >"$ai_sql" <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$owner_id';
set local "request.jwt.claims" = '{"sub":"$owner_id","role":"authenticated"}';
select current_message_leaf_id::text
from public.conversations
where id = '$conv_race'::uuid
for update;
\! touch "$ready_file"
select public.persist_brep_ai_revision(
  '$conv_race'::uuid,
  '$base_race'::uuid,
  '$ai_race'::uuid,
  '[{"type":"text","text":"accepted AI completion"}]'::jsonb,
  '{}'::jsonb
)->>'accepted';
select pg_sleep(2);
commit;
SQL

${PSQL[@]} -Atf "$ai_sql" >"$ai_out" 2>&1 &
ai_pid=$!

for _ in $(seq 1 100); do
  if [[ -f "$ready_file" ]]; then
    break
  fi
  if ! kill -0 "$ai_pid" >/dev/null 2>&1; then
    cat "$ai_out" >&2 || true
    echo "AI transaction exited before acquiring the conversation row lock." >&2
    exit 1
  fi
  sleep 0.05
done

if [[ ! -f "$ready_file" ]]; then
  cat "$ai_out" >&2 || true
  echo "Timed out waiting for the AI transaction to acquire the conversation row lock." >&2
  exit 1
fi

# This insert begins while the AI transaction owns the conversation row lock.
# Its AFTER INSERT update_leaf_trigger must wait; once the AI transaction commits,
# this genuinely later user message must become the current leaf.
${PSQL[@]} <<SQL
insert into public.messages (
  id, conversation_id, role, parts, metadata, parent_message_id, rating
) values (
  '$user_race'::uuid,
  '$conv_race'::uuid,
  'user',
  '[{"type":"text","text":"concurrent newer user branch"}]'::jsonb,
  '{}'::jsonb,
  '$base_race'::uuid,
  0
);
SQL

wait "$ai_pid"

if ! grep -qx 'true' "$ai_out"; then
  cat "$ai_out" >&2 || true
  echo "AI-lock-first transaction did not report an accepted atomic revision." >&2
  exit 1
fi

race_state="$(${PSQL[@]} -Atc "
select case
  when c.current_message_leaf_id = '$user_race'::uuid
   and exists (
     select 1 from public.messages
     where id = '$ai_race'::uuid
       and parent_message_id = '$base_race'::uuid
   )
   and exists (
     select 1 from public.messages
     where id = '$user_race'::uuid
       and parent_message_id = '$base_race'::uuid
   )
  then 'ok'
  else 'bad'
end
from public.conversations c
where c.id = '$conv_race'::uuid;")"

if [[ "$race_state" != "ok" ]]; then
  echo "AI-lock-first invariant failed: the later user message did not win the leaf." >&2
  exit 1
fi

echo "PASS: AI revision commits atomically and the genuinely later user message wins the leaf"
echo "BRep AI atomic persistence race gate PASS"
