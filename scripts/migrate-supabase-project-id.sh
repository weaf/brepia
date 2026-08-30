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

db_fingerprint() {
  local project="$1"
  local container="supabase_db_${project}"

  if ! podman container exists "${container}" >/dev/null 2>&1; then
    echo "Database container not found: ${container}" >&2
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

require_prerequisites() {
  [ -f "${CONFIG_FILE}" ] || { echo "Missing ${CONFIG_FILE}" >&2; exit 1; }
  [ -x "${SUPABASE_BIN}" ] || {
    echo "Repository-local Supabase CLI is missing: ${SUPABASE_BIN}" >&2
    echo "Run the normal npm install workflow first." >&2
    exit 1
  }
  command -v podman >/dev/null 2>&1 || { echo "podman not found" >&2; exit 1; }
  command -v gzip >/dev/null 2>&1 || { echo "gzip not found" >&2; exit 1; }
  command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum not found" >&2; exit 1; }
  podman volume rename --help >/dev/null 2>&1 || {
    echo "This Podman version does not support 'podman volume rename'." >&2
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

  if podman container exists "supabase_db_${OLD_ID}" >/dev/null 2>&1; then
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
  1. record a database fingerprint for the running '${OLD_ID}' stack;
  2. stop local Supabase project '${OLD_ID}' without --no-backup;
  3. export compressed safety archives of the DB and Storage volumes;
  4. rename the existing persistent volumes to the '${NEW_ID}' names;
  5. change supabase/config.toml project_id to '${NEW_ID}';
  6. start Supabase and verify the '${NEW_ID}' stack, volume mounts and database fingerprint.

The migration does not delete backup archives or unrelated volumes/networks.
If a migration step fails after the volumes are renamed, the script attempts to
stop '${NEW_ID}', restore project_id='${OLD_ID}', rename the volumes back, and
restart the original stack.

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

  set_project_id "${OLD_ID}" || true

  if volume_exists "${NEW_DB_VOLUME}" && ! volume_exists "${OLD_DB_VOLUME}"; then
    podman volume rename "${NEW_DB_VOLUME}" "${OLD_DB_VOLUME}" || true
  fi
  if volume_exists "${NEW_STORAGE_VOLUME}" && ! volume_exists "${OLD_STORAGE_VOLUME}"; then
    podman volume rename "${NEW_STORAGE_VOLUME}" "${OLD_STORAGE_VOLUME}" || true
  fi

  if "${SUPABASE_BIN}" start >/dev/null 2>&1; then
    echo "Rollback: original '${OLD_ID}' stack restarted." >&2
  else
    echo "Rollback WARNING: automatic restart failed. Backup archives remain under ${BACKUP_ROOT}." >&2
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

section "Stop ${OLD_ID} Supabase"
"${SUPABASE_BIN}" stop --project-id "${OLD_ID}"

if podman ps -a --format '{{.Names}}' | grep -Eq "^supabase_.*_${OLD_ID}$"; then
  echo "Old project containers still exist after stop; refusing to rename mounted resources." >&2
  exit 1
fi

section "Archive persistent volumes"
for volume in "${OLD_DB_VOLUME}" "${OLD_STORAGE_VOLUME}"; do
  archive="${BACKUP_DIR}/${volume}.tar.gz"
  echo "Backing up ${volume} -> ${archive}"
  podman volume export "${volume}" | gzip -1 > "${archive}"
  [ -s "${archive}" ] || { echo "Backup archive is empty: ${archive}" >&2; exit 1; }
done
sha256sum "${BACKUP_DIR}"/*.tar.gz > "${BACKUP_DIR}/SHA256SUMS"
printf 'old_project_id=%s\nnew_project_id=%s\n' "${OLD_ID}" "${NEW_ID}" > "${BACKUP_DIR}/migration.txt"
printf 'database_fingerprint=%s\n' "${OLD_FINGERPRINT}" >> "${BACKUP_DIR}/migration.txt"

echo "Backup manifest: ${BACKUP_DIR}/SHA256SUMS"

section "Rename persistent volumes"
rollback_needed=1
podman volume rename "${OLD_DB_VOLUME}" "${NEW_DB_VOLUME}"
podman volume rename "${OLD_STORAGE_VOLUME}" "${NEW_STORAGE_VOLUME}"

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
echo "The old data has been moved by volume rename and separately archived."
echo "Do not delete the backup archives or any remaining cadam-named stale resources until Brepia has passed the application smoke/regression gate."
echo "supabase/config.toml is now modified locally to project_id='${NEW_ID}'."
