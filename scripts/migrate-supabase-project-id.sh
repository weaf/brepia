#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

OLD_ID="cadam"
NEW_ID="brepia"
CONFIG_FILE="${REPO_ROOT}/supabase/config.toml"
SUPABASE_BIN="${REPO_ROOT}/node_modules/.bin/supabase"
OLD_DB_VOLUME="supabase_db_${OLD_ID}"
NEW_DB_VOLUME="supabase_db_${NEW_ID}"
OLD_STORAGE_VOLUME="supabase_storage_${OLD_ID}"
NEW_STORAGE_VOLUME="supabase_storage_${NEW_ID}"
BACKUP_ROOT="${REPO_ROOT}/supabase/.temp/project-id-migration-backups"
MODE="${1:-}"

export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
export PATH="${REPO_ROOT}/scripts/podman:${PATH}"

section() {
  printf '\n=== %s ===\n' "$1"
}

project_id() {
  sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([^"]+)"[[:space:]]*$/\1/p' "${CONFIG_FILE}" | head -n 1
}

set_project_id() {
  local wanted="$1"
  node --input-type=module - "${CONFIG_FILE}" "${wanted}" <<'NODE'
import fs from 'node:fs';
const [file, wanted] = process.argv.slice(2);
const source = fs.readFileSync(file, 'utf8');
const pattern = /^project_id\s*=\s*"[^"]+"\s*$/m;
if (!pattern.test(source)) {
  console.error(`Could not find project_id in ${file}`);
  process.exit(1);
}
fs.writeFileSync(file, source.replace(pattern, `project_id = "${wanted}"`));
NODE
}

volume_exists() {
  podman volume exists "$1" >/dev/null 2>&1
}

volume_mountpoint() {
  podman volume inspect --format '{{.Mountpoint}}' "$1" 2>/dev/null || true
}

volume_size() {
  local mountpoint size
  mountpoint="$(volume_mountpoint "$1")"
  if [ -z "${mountpoint}" ] || [ ! -e "${mountpoint}" ]; then
    echo unknown
    return
  fi

  # Rootless Podman volumes can contain UID-mapped files that the host user
  # cannot traverse directly. `podman unshare` enters the matching user
  # namespace so du can inspect the complete volume without modifying it.
  size="$(podman unshare du -sh "${mountpoint}" 2>/dev/null | awk 'NR == 1 {print $1}' || true)"
  if [ -n "${size}" ]; then
    printf '%s\n' "${size}"
  else
    echo unknown
  fi
}

project_containers() {
  local project="$1"
  podman ps -a --format '{{.Names}}' 2>/dev/null \
    | grep -E "^supabase_.*_${project}$" || true
}

running_project_containers() {
  local project="$1"
  podman ps --format '{{.Names}}' 2>/dev/null \
    | grep -E "^supabase_.*_${project}$" || true
}

print_project_container_states() {
  local project="$1"
  podman ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null \
    | grep -E "^supabase_.*_${project}[[:space:]]" || true
}

remove_stopped_project_containers() {
  local project="$1"
  local running containers
  running="$(running_project_containers "${project}")"
  if [ -n "${running}" ]; then
    echo "Refusing to remove '${project}' containers because some are still running:" >&2
    printf '%s\n' "${running}" >&2
    return 1
  fi

  containers="$(project_containers "${project}")"
  if [ -z "${containers}" ]; then
    return 0
  fi

  echo "Removing stopped '${project}' containers while preserving named volumes..."
  while IFS= read -r container; do
    [ -n "${container}" ] || continue
    podman rm "${container}"
  done <<< "${containers}"
}

stop_project_for_migration() {
  local project="$1"
  local stop_rc=0 running

  set +e
  "${SUPABASE_BIN}" stop --project-id "${project}"
  stop_rc=$?
  set -e

  running="$(running_project_containers "${project}")"
  if [ -n "${running}" ]; then
    echo "Supabase stop left '${project}' containers running; aborting before touching volumes." >&2
    print_project_container_states "${project}" >&2
    return 1
  fi

  if [ "${stop_rc}" -ne 0 ]; then
    echo "Supabase CLI stop returned ${stop_rc}, but all '${project}' containers are stopped; continuing with verified stopped state."
  fi

  remove_stopped_project_containers "${project}"

  if [ -n "$(project_containers "${project}")" ]; then
    echo "Old project containers still exist after cleanup; refusing to copy volumes." >&2
    print_project_container_states "${project}" >&2
    return 1
  fi
}

db_fingerprint() {
  local project="$1"
  local container="supabase_db_${project}"

  if ! podman container exists "${container}" >/dev/null 2>&1; then
    echo "Database container not found: ${container}" >&2
    return 1
  fi

  if [ "$(podman inspect --format '{{.State.Running}}' "${container}" 2>/dev/null || true)" != "true" ]; then
    echo "Database container is not running: ${container}" >&2
    return 1
  fi

  # -i is required so the heredoc SQL reaches psql inside the container.
  podman exec -i "${container}" psql -U postgres -d postgres -At -F '|' -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM auth.users),
  (SELECT count(*) FROM public.conversations),
  (SELECT count(*) FROM public.messages),
  (SELECT count(*) FROM storage.objects),
  (SELECT count(*) FROM storage.buckets);
SQL
}

print_fingerprint() {
  local value="$1"
  local auth_users conversations messages storage_objects storage_buckets
  IFS='|' read -r auth_users conversations messages storage_objects storage_buckets <<< "${value}"
  printf 'auth.users:          %s\n' "${auth_users:-?}"
  printf 'conversations:       %s\n' "${conversations:-?}"
  printf 'messages:            %s\n' "${messages:-?}"
  printf 'storage.objects:     %s\n' "${storage_objects:-?}"
  printf 'storage.buckets:     %s\n' "${storage_buckets:-?}"
}

ensure_old_stack_ready() {
  local db_container="supabase_db_${OLD_ID}"
  local running="false"

  if podman container exists "${db_container}" >/dev/null 2>&1; then
    running="$(podman inspect --format '{{.State.Running}}' "${db_container}" 2>/dev/null || echo false)"
  fi

  if [ "${running}" = "true" ]; then
    return 0
  fi

  section "Restore ${OLD_ID} stack for preflight"
  echo "The previous migration attempt left the project stopped. Restarting it so the database can be fingerprinted before migration."
  "${SUPABASE_BIN}" start
  "${SUPABASE_BIN}" status >/dev/null
}

create_target_volume() {
  local source="$1"
  local target="$2"
  local label
  local -a label_args=()

  # Preserve any existing volume labels while rewriting project-scoped labels
  # to the new identity. Ensure the Supabase project label is always present so
  # future CLI lifecycle commands can discover the new persistent volumes.
  while IFS= read -r label; do
    [ -n "${label}" ] || continue
    label_args+=(--label "${label}")
  done < <(
    podman volume inspect "${source}" \
      | node --input-type=module -e '
          let input = "";
          for await (const chunk of process.stdin) input += chunk;
          const targetProject = process.argv[1];
          const parsed = JSON.parse(input);
          const labels = { ...(parsed[0]?.Labels ?? {}) };
          labels["com.supabase.cli.project"] = targetProject;
          labels["com.docker.compose.project"] = targetProject;
          for (const [key, value] of Object.entries(labels)) {
            process.stdout.write(`${key}=${String(value)}\n`);
          }
        ' "${NEW_ID}"
  )

  podman volume create "${label_args[@]}" "${target}" >/dev/null

  local project_label
  project_label="$(podman volume inspect --format '{{index .Labels "com.supabase.cli.project"}}' "${target}" 2>/dev/null || true)"
  if [ "${project_label}" != "${NEW_ID}" ]; then
    echo "Target volume ${target} is missing the expected Supabase project label." >&2
    return 1
  fi
}

import_archive_into_volume() {
  local archive="$1"
  local target="$2"
  echo "Importing ${archive} -> ${target}"
  gzip -dc "${archive}" | podman volume import "${target}" -
}

require_prerequisites() {
  [ -f "${CONFIG_FILE}" ] || { echo "Missing ${CONFIG_FILE}" >&2; exit 1; }
  [ -x "${SUPABASE_BIN}" ] || {
    echo "Repository-local Supabase CLI is missing: ${SUPABASE_BIN}" >&2
    echo "Run the normal npm install workflow first." >&2
    exit 1
  }
  command -v podman >/dev/null 2>&1 || { echo "podman not found" >&2; exit 1; }
  command -v node >/dev/null 2>&1 || { echo "node not found" >&2; exit 1; }
  command -v gzip >/dev/null 2>&1 || { echo "gzip not found" >&2; exit 1; }
  command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum not found" >&2; exit 1; }
  podman volume export --help >/dev/null 2>&1 || {
    echo "This Podman version does not support 'podman volume export'." >&2
    exit 1
  }
  podman volume import --help >/dev/null 2>&1 || {
    echo "This Podman version does not support 'podman volume import'." >&2
    exit 1
  }
}

print_plan() {
  section "Supabase project identity migration plan"
  printf 'repository:     %s\n' "${REPO_ROOT}"
  printf 'branch:         %s\n' "$(git branch --show-current 2>/dev/null || echo unknown)"
  printf 'head:           %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  printf 'current id:     %s\n' "$(project_id)"
  printf 'target id:      %s\n' "${NEW_ID}"
  echo
  printf '%-32s %-8s %s\n' "volume" "exists" "approx size"
  for volume in "${OLD_DB_VOLUME}" "${OLD_STORAGE_VOLUME}" "${NEW_DB_VOLUME}" "${NEW_STORAGE_VOLUME}"; do
    if volume_exists "${volume}"; then
      printf '%-32s %-8s %s\n' "${volume}" "yes" "$(volume_size "${volume}")"
    else
      printf '%-32s %-8s %s\n' "${volume}" "no" "-"
    fi
  done

  if [ "$(podman inspect --format '{{.State.Running}}' "supabase_db_${OLD_ID}" 2>/dev/null || true)" = "true" ]; then
    echo
    echo "Current database fingerprint:"
    current_fingerprint="$(db_fingerprint "${OLD_ID}" 2>/dev/null || true)"
    if [ -n "${current_fingerprint}" ]; then
      print_fingerprint "${current_fingerprint}"
    else
      echo "  unavailable (database may not be ready)"
    fi
  fi

  cat <<EOF

Execution will:
  1. ensure the existing '${OLD_ID}' stack is running and record a database fingerprint;
  2. stop local Supabase project '${OLD_ID}' and verify actual container state;
  3. remove only stopped '${OLD_ID}' container objects, preserving named volumes;
  4. export compressed safety archives of the DB and Storage volumes;
  5. create new '${NEW_ID}' DB/Storage volumes with project labels and import the archives;
  6. change supabase/config.toml project_id to '${NEW_ID}';
  7. start Supabase and verify the '${NEW_ID}' stack, volume mounts and database fingerprint.

The original '${OLD_ID}' DB/Storage volumes remain untouched as an additional rollback copy.
A non-zero Supabase stop exit is tolerated only when Podman confirms that every
'${OLD_ID}' project container is stopped. Running containers always abort the migration.
If a later migration step fails, the script removes only the newly-created '${NEW_ID}'
container/volume copies, restores project_id='${OLD_ID}', and restarts the original stack.

Dry-run only. Run with --execute to perform the migration.
EOF
}

rollback_needed=0
rollback() {
  local exit_code=$?
  if [ "${rollback_needed}" -ne 1 ]; then
    exit "${exit_code}"
  fi

  set +e
  echo
  echo "Migration failed; attempting rollback to '${OLD_ID}'..." >&2
  "${SUPABASE_BIN}" stop --project-id "${NEW_ID}" >/dev/null 2>&1 || true

  brepia_containers="$(project_containers "${NEW_ID}")"
  if [ -n "${brepia_containers}" ]; then
    while IFS= read -r container; do
      [ -n "${container}" ] || continue
      podman rm -f "${container}" >/dev/null 2>&1 || true
    done <<< "${brepia_containers}"
  fi

  set_project_id "${OLD_ID}" || true

  # These target volumes are copies created by this migration. Preflight refuses
  # to run when they already exist, so removing them during rollback cannot
  # destroy pre-existing user data. The original cadam volumes stay untouched.
  if volume_exists "${NEW_DB_VOLUME}"; then
    podman volume rm "${NEW_DB_VOLUME}" >/dev/null 2>&1 || true
  fi
  if volume_exists "${NEW_STORAGE_VOLUME}"; then
    podman volume rm "${NEW_STORAGE_VOLUME}" >/dev/null 2>&1 || true
  fi

  if "${SUPABASE_BIN}" start >/dev/null 2>&1; then
    echo "Rollback: original '${OLD_ID}' stack restarted from untouched source volumes." >&2
  else
    echo "Rollback WARNING: automatic restart failed. Original volumes and backup archives remain intact." >&2
  fi
  exit "${exit_code}"
}
trap rollback ERR INT TERM

require_prerequisites

if [ "${MODE}" != "--execute" ]; then
  print_plan
  exit 0
fi

section "Preflight"
if [ "$(project_id)" != "${OLD_ID}" ]; then
  echo "Expected project_id='${OLD_ID}', found '$(project_id)'. Aborting." >&2
  exit 1
fi

for volume in "${OLD_DB_VOLUME}" "${OLD_STORAGE_VOLUME}"; do
  if ! volume_exists "${volume}"; then
    echo "Required source volume is missing: ${volume}" >&2
    exit 1
  fi
done

for volume in "${NEW_DB_VOLUME}" "${NEW_STORAGE_VOLUME}"; do
  if volume_exists "${volume}"; then
    echo "Target volume already exists: ${volume}" >&2
    echo "Refusing to overwrite or merge existing target data." >&2
    exit 1
  fi
done

ensure_old_stack_ready

OLD_FINGERPRINT="$(db_fingerprint "${OLD_ID}")"
[ -n "${OLD_FINGERPRINT}" ] || { echo "Could not fingerprint the existing database." >&2; exit 1; }

echo "Database fingerprint before migration:"
print_fingerprint "${OLD_FINGERPRINT}"

print_plan
printf '\nType MIGRATE to continue: '
read -r confirmation
if [ "${confirmation}" != "MIGRATE" ]; then
  echo "Cancelled."
  exit 0
fi

BACKUP_DIR="${BACKUP_ROOT}/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${BACKUP_DIR}"
DB_ARCHIVE="${BACKUP_DIR}/${OLD_DB_VOLUME}.tar.gz"
STORAGE_ARCHIVE="${BACKUP_DIR}/${OLD_STORAGE_VOLUME}.tar.gz"

section "Stop ${OLD_ID} Supabase"
stop_project_for_migration "${OLD_ID}"

section "Archive persistent volumes"
echo "Backing up ${OLD_DB_VOLUME} -> ${DB_ARCHIVE}"
podman volume export "${OLD_DB_VOLUME}" | gzip -1 > "${DB_ARCHIVE}"
[ -s "${DB_ARCHIVE}" ] || { echo "Backup archive is empty: ${DB_ARCHIVE}" >&2; exit 1; }

echo "Backing up ${OLD_STORAGE_VOLUME} -> ${STORAGE_ARCHIVE}"
podman volume export "${OLD_STORAGE_VOLUME}" | gzip -1 > "${STORAGE_ARCHIVE}"
[ -s "${STORAGE_ARCHIVE}" ] || { echo "Backup archive is empty: ${STORAGE_ARCHIVE}" >&2; exit 1; }

sha256sum "${DB_ARCHIVE}" "${STORAGE_ARCHIVE}" > "${BACKUP_DIR}/SHA256SUMS"
printf 'old_project_id=%s\nnew_project_id=%s\n' "${OLD_ID}" "${NEW_ID}" > "${BACKUP_DIR}/migration.txt"
printf 'database_fingerprint=%s\n' "${OLD_FINGERPRINT}" >> "${BACKUP_DIR}/migration.txt"
echo "Backup manifest: ${BACKUP_DIR}/SHA256SUMS"

section "Create and import ${NEW_ID} persistent volumes"
rollback_needed=1
create_target_volume "${OLD_DB_VOLUME}" "${NEW_DB_VOLUME}"
create_target_volume "${OLD_STORAGE_VOLUME}" "${NEW_STORAGE_VOLUME}"
import_archive_into_volume "${DB_ARCHIVE}" "${NEW_DB_VOLUME}"
import_archive_into_volume "${STORAGE_ARCHIVE}" "${NEW_STORAGE_VOLUME}"
printf 'database copy size: %s\n' "$(volume_size "${NEW_DB_VOLUME}")"
printf 'storage copy size:  %s\n' "$(volume_size "${NEW_STORAGE_VOLUME}")"

section "Change project_id"
set_project_id "${NEW_ID}"
printf 'project_id: %s\n' "$(project_id)"

section "Start ${NEW_ID} Supabase"
"${SUPABASE_BIN}" start
"${SUPABASE_BIN}" status >/dev/null

DB_MOUNT="$(podman inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "supabase_db_${NEW_ID}" 2>/dev/null || true)"
STORAGE_MOUNT="$(podman inspect --format '{{range .Mounts}}{{if eq .Destination "/mnt"}}{{.Name}}{{end}}{{end}}' "supabase_storage_${NEW_ID}" 2>/dev/null || true)"

if [ "${DB_MOUNT}" != "${NEW_DB_VOLUME}" ]; then
  echo "New DB container is not mounted from ${NEW_DB_VOLUME}; got '${DB_MOUNT:-<none>}'" >&2
  false
fi
if [ "${STORAGE_MOUNT}" != "${NEW_STORAGE_VOLUME}" ]; then
  echo "New Storage container is not mounted from ${NEW_STORAGE_VOLUME}; got '${STORAGE_MOUNT:-<none>}'" >&2
  false
fi

NEW_FINGERPRINT="$(db_fingerprint "${NEW_ID}")"
if [ "${NEW_FINGERPRINT}" != "${OLD_FINGERPRINT}" ]; then
  echo "Database fingerprint changed during migration." >&2
  echo "Before: ${OLD_FINGERPRINT}" >&2
  echo "After:  ${NEW_FINGERPRINT}" >&2
  false
fi

echo "Database fingerprint after migration:"
print_fingerprint "${NEW_FINGERPRINT}"

rollback_needed=0
trap - ERR INT TERM

section "Migration complete"
printf 'project_id:       %s\n' "$(project_id)"
printf 'database volume:  %s\n' "${DB_MOUNT}"
printf 'storage volume:   %s\n' "${STORAGE_MOUNT}"
printf 'backup directory: %s\n' "${BACKUP_DIR}"

echo
echo "The Brepia data volumes are verified copies of the original CADAM volumes."
echo "The original ${OLD_DB_VOLUME} and ${OLD_STORAGE_VOLUME} volumes are intentionally retained for rollback."
echo "Do not delete the original volumes or backup archives until Brepia has passed the application smoke/regression gate."
echo "supabase/config.toml is now modified locally to project_id='${NEW_ID}'."
