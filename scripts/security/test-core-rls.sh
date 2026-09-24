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

other_id="$(uuid)"
private_conversation_id="$(uuid)"
public_conversation_id="$(uuid)"
private_message_id="$(uuid)"
public_message_id="$(uuid)"
private_image_id="$(uuid)"
public_image_id="$(uuid)"
private_mesh_id="$(uuid)"
public_mesh_id="$(uuid)"
private_preview_id="$(uuid)"
public_preview_id="$(uuid)"

cleanup() {
  "${PSQL[@]}" -c "
    delete from public.conversations
    where id in (
      '$private_conversation_id'::uuid,
      '$public_conversation_id'::uuid
    );
  " >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${PSQL[@]}" <<SQL
insert into public.conversations (id, user_id, title, type, privacy, settings)
values
  ('$private_conversation_id'::uuid, '$owner_id'::uuid, 'rls private', 'parametric', 'private', '{}'::jsonb),
  ('$public_conversation_id'::uuid, '$owner_id'::uuid, 'rls public', 'parametric', 'public', '{}'::jsonb);

insert into public.messages (id, conversation_id, role, parts, metadata, rating)
values
  ('$private_message_id'::uuid, '$private_conversation_id'::uuid, 'user', '[{"type":"text","text":"private"}]'::jsonb, '{}'::jsonb, 0),
  ('$public_message_id'::uuid, '$public_conversation_id'::uuid, 'user', '[{"type":"text","text":"public"}]'::jsonb, '{}'::jsonb, 0);

insert into public.images (id, user_id, conversation_id, prompt)
values
  ('$private_image_id'::uuid, '$owner_id'::uuid, '$private_conversation_id'::uuid, '{}'::jsonb),
  ('$public_image_id'::uuid, '$owner_id'::uuid, '$public_conversation_id'::uuid, '{}'::jsonb);

insert into public.meshes (id, user_id, conversation_id, prompt)
values
  ('$private_mesh_id'::uuid, '$owner_id'::uuid, '$private_conversation_id'::uuid, '{}'::jsonb),
  ('$public_mesh_id'::uuid, '$owner_id'::uuid, '$public_conversation_id'::uuid, '{}'::jsonb);

insert into public.previews (id, user_id, conversation_id, mesh_id)
values
  ('$private_preview_id'::uuid, '$owner_id'::uuid, '$private_conversation_id'::uuid, '$private_mesh_id'::uuid),
  ('$public_preview_id'::uuid, '$owner_id'::uuid, '$public_conversation_id'::uuid, '$public_mesh_id'::uuid);
SQL

query_auth() {
  local sub="$1"
  local statement="$2"
  "${PSQL[@]}" -At -F '|' <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$sub';
set local "request.jwt.claims" = '{"sub":"$sub","role":"authenticated"}';
$statement
rollback;
SQL
}

query_anon() {
  local statement="$1"
  "${PSQL[@]}" -At -F '|' <<SQL
begin;
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role":"anon"}';
$statement
rollback;
SQL
}

expect_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "RLS regression failed: $label" >&2
    echo "expected: $expected" >&2
    echo "actual:   $actual" >&2
    exit 1
  fi
  echo "PASS: $label"
}

expect_eq "owner reads private conversation"   "$(query_auth "$owner_id" "select count(*) from public.conversations where id = '$private_conversation_id'::uuid;")" "1"
expect_eq "owner reads private message"   "$(query_auth "$owner_id" "select count(*) from public.messages where id = '$private_message_id'::uuid;")" "1"
expect_eq "owner reads private image"   "$(query_auth "$owner_id" "select count(*) from public.images where id = '$private_image_id'::uuid;")" "1"
expect_eq "owner reads private mesh"   "$(query_auth "$owner_id" "select count(*) from public.meshes where id = '$private_mesh_id'::uuid;")" "1"
expect_eq "owner reads private preview"   "$(query_auth "$owner_id" "select count(*) from public.previews where id = '$private_preview_id'::uuid;")" "1"

expect_eq "other user cannot read private conversation"   "$(query_auth "$other_id" "select count(*) from public.conversations where id = '$private_conversation_id'::uuid;")" "0"
expect_eq "other user cannot read private message"   "$(query_auth "$other_id" "select count(*) from public.messages where id = '$private_message_id'::uuid;")" "0"
expect_eq "other user cannot read private image"   "$(query_auth "$other_id" "select count(*) from public.images where id = '$private_image_id'::uuid;")" "0"
expect_eq "other user cannot read private mesh"   "$(query_auth "$other_id" "select count(*) from public.meshes where id = '$private_mesh_id'::uuid;")" "0"
expect_eq "other user cannot read private preview"   "$(query_auth "$other_id" "select count(*) from public.previews where id = '$private_preview_id'::uuid;")" "0"

expect_eq "anon cannot read private conversation"   "$(query_anon "select count(*) from public.conversations where id = '$private_conversation_id'::uuid;")" "0"
expect_eq "anon cannot read private message"   "$(query_anon "select count(*) from public.messages where id = '$private_message_id'::uuid;")" "0"
expect_eq "anon cannot read private image"   "$(query_anon "select count(*) from public.images where id = '$private_image_id'::uuid;")" "0"
expect_eq "anon cannot read private mesh"   "$(query_anon "select count(*) from public.meshes where id = '$private_mesh_id'::uuid;")" "0"

expect_eq "anon reads public conversation"   "$(query_anon "select count(*) from public.conversations where id = '$public_conversation_id'::uuid;")" "1"
expect_eq "anon reads public message"   "$(query_anon "select count(*) from public.messages where id = '$public_message_id'::uuid;")" "1"
expect_eq "anon reads public image"   "$(query_anon "select count(*) from public.images where id = '$public_image_id'::uuid;")" "1"
expect_eq "anon reads public mesh"   "$(query_anon "select count(*) from public.meshes where id = '$public_mesh_id'::uuid;")" "1"
expect_eq "anon still cannot read previews"   "$(query_anon "select count(*) from public.previews where id = '$public_preview_id'::uuid;")" "0"

expect_eq "other user cannot update owner conversation"   "$(query_auth "$other_id" "with changed as (update public.conversations set title = 'forbidden' where id = '$private_conversation_id'::uuid returning 1) select count(*) from changed;")" "0"
expect_eq "other user cannot delete owner message"   "$(query_auth "$other_id" "with changed as (delete from public.messages where id = '$private_message_id'::uuid returning 1) select count(*) from changed;")" "0"
expect_eq "anon cannot update public conversation"   "$(query_anon "with changed as (update public.conversations set title = 'forbidden' where id = '$public_conversation_id'::uuid returning 1) select count(*) from changed;")" "0"

expect_eq "owner metadata RPC can update own conversation"   "$(query_auth "$owner_id" "select count(*) from public.patch_conversation_metadata('$private_conversation_id'::uuid, 'owner patch', null, '{}'::jsonb);")" "1"
expect_eq "other metadata RPC cannot update owner conversation"   "$(query_auth "$other_id" "select count(*) from public.patch_conversation_metadata('$private_conversation_id'::uuid, 'forbidden patch', null, '{}'::jsonb);")" "0"

echo "core RLS regression: PASS"
