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
  local mountpoint
  mountpoint="$(volume_mountpoint "$1")"
  if [ -n "${mountpoint}" ] && [ -e "${mountpoint}" ]; then
    du -sh "${mountpoint}" 2>/dev/null | awk '{print $1}' || echo unknown
  else
    echo unknown
  fi
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

  cat <<EOF

Execution will:
  1. stop local Supabase project '${OLD_ID}' without --no-backup;
  2. export compressed safety archives of the DB and Storage volumes;
  3. rename the existing persistent volumes to the '${NEW_ID}' names;
  4. change supabase/config.toml project_id to '${NEW_ID}';
  5. start Supabase and verify that the '${NEW_ID}' stack is healthy.

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
