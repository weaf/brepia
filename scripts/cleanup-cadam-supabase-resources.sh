#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

OLD_ID="cadam"
NEW_ID="brepia"
CONFIG_FILE="${REPO_ROOT}/supabase/config.toml"
BACKUP_ROOT="${REPO_ROOT}/supabase/.temp/project-id-migration-backups"
MODE="${1:-}"

section() {
  printf '\n=== %s ===\n' "$1"
}

project_id() {
  sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([^"]+)"[[:space:]]*$/\1/p' "${CONFIG_FILE}" | head -n 1
}

volume_exists() {
  podman volume exists "$1" >/dev/null 2>&1
}

container_running() {
  local container="$1"
  [ "$(podman inspect --format '{{.State.Running}}' "${container}" 2>/dev/null || true)" = "true" ]
}

containers_using_volume() {
  local wanted="$1"
  local container mounts

  while IFS= read -r container; do
    [ -n "${container}" ] || continue
    mounts="$(podman inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}} {{end}}{{end}}' "${container}" 2>/dev/null || true)"
    for mounted in ${mounts}; do
      if [ "${mounted}" = "${wanted}" ]; then
        printf '%s\n' "${container}"
      fi
    done
  done < <(podman ps -a --format '{{.Names}}' 2>/dev/null)
}

legacy_containers() {
  podman ps -a --format '{{.Names}}' 2>/dev/null \
    | grep -E "^supabase_.*_${OLD_ID}$" || true
}

legacy_networks() {
  podman network ls --format '{{.Name}}' 2>/dev/null \
    | grep -E "^supabase_.*_${OLD_ID}$|^supabase_network_${OLD_ID}$" || true
}

legacy_volumes() {
  podman volume ls --format '{{.Name}}' 2>/dev/null \
    | grep -E "^supabase_.*_${OLD_ID}$" || true
}

require_safe_brepia_state() {
  local current
  current="$(project_id)"
  if [ "${current}" != "${NEW_ID}" ]; then
    echo "Refusing cleanup: supabase/config.toml project_id is '${current:-<missing>}', expected '${NEW_ID}'." >&2
    exit 1
  fi

  for volume in "supabase_db_${NEW_ID}" "supabase_storage_${NEW_ID}"; do
    if ! volume_exists "${volume}"; then
      echo "Refusing cleanup: active Brepia volume is missing: ${volume}" >&2
      exit 1
    fi
  done

  for container in "supabase_db_${NEW_ID}" "supabase_storage_${NEW_ID}"; do
    if ! container_running "${container}"; then
      echo "Refusing cleanup: active Brepia container is not running: ${container}" >&2
      exit 1
    fi
  done
}

require_legacy_volumes_unused() {
  local volume users
  while IFS= read -r volume; do
    [ -n "${volume}" ] || continue
    users="$(containers_using_volume "${volume}")"
    if [ -n "${users}" ]; then
      echo "Refusing cleanup: legacy volume ${volume} is still mounted by:" >&2
      printf '%s\n' "${users}" >&2
      exit 1
    fi
  done < <(legacy_volumes)
}

print_inventory() {
  section "Legacy Supabase cleanup inventory"
  printf 'repository:  %s\n' "${REPO_ROOT}"
  printf 'branch:      %s\n' "$(git branch --show-current 2>/dev/null || echo unknown)"
  printf 'head:        %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  printf 'project_id:  %s\n' "$(project_id)"

  printf '\ncontainers:\n'
  legacy_containers | sed 's/^/  /' || true
  [ -n "$(legacy_containers)" ] || echo '  <none>'

  printf '\nnetworks:\n'
  legacy_networks | sed 's/^/  /' || true
  [ -n "$(legacy_networks)" ] || echo '  <none>'

  printf '\nvolumes:\n'
  legacy_volumes | sed 's/^/  /' || true
  [ -n "$(legacy_volumes)" ] || echo '  <none>'

  printf '\nbackup archives:\n'
  if [ -d "${BACKUP_ROOT}" ]; then
    find "${BACKUP_ROOT}" -maxdepth 2 -type f -printf '  %p\n' 2>/dev/null | sort || true
  else
    echo '  <none>'
  fi
}

require_safe_brepia_state
require_legacy_volumes_unused
print_inventory

cat <<EOF

This cleanup removes only stopped legacy '${OLD_ID}' Supabase containers,
legacy '${OLD_ID}' networks and volumes whose names match supabase_*_${OLD_ID}.
The active '${NEW_ID}' containers/volumes are never targeted.
Migration backup archives under:
  ${BACKUP_ROOT}
are intentionally retained.
EOF

if [ "${MODE}" != "--execute" ]; then
  echo
  echo "Dry-run only. Re-run with --execute to remove the listed legacy Podman resources."
  exit 0
fi

if [ -n "$(podman ps --format '{{.Names}}' 2>/dev/null | grep -E "^supabase_.*_${OLD_ID}$" || true)" ]; then
  echo "Refusing cleanup: at least one legacy '${OLD_ID}' container is still running." >&2
  exit 1
fi

printf '\nType CLEANUP to remove the legacy Podman resources: '
read -r confirmation
if [ "${confirmation}" != "CLEANUP" ]; then
  echo "Cleanup cancelled."
  exit 1
fi

section "Remove stopped legacy containers"
while IFS= read -r container; do
  [ -n "${container}" ] || continue
  podman rm "${container}"
done < <(legacy_containers)

section "Remove legacy networks"
while IFS= read -r network; do
  [ -n "${network}" ] || continue
  podman network rm "${network}"
done < <(legacy_networks)

section "Remove legacy volumes"
while IFS= read -r volume; do
  [ -n "${volume}" ] || continue
  if [ -n "$(containers_using_volume "${volume}")" ]; then
    echo "Refusing to remove ${volume}: it became mounted during cleanup." >&2
    exit 1
  fi
  podman volume rm "${volume}"
done < <(legacy_volumes)

section "Cleanup complete"
echo "Legacy '${OLD_ID}' Podman resources matching the guarded patterns were removed."
echo "Brepia resources remain active, and migration backup archives were retained at:"
echo "  ${BACKUP_ROOT}"
