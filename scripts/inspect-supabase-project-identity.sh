#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ID="$(sed -n 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "${REPO_ROOT}/supabase/config.toml" 2>/dev/null | head -n 1)"
PROJECT_ID="${PROJECT_ID:-<unknown>}"

section() {
  printf '\n=== %s ===\n' "$1"
}

section "Repository Supabase identity"
printf 'repo:       %s\n' "${REPO_ROOT}"
printf 'branch:     %s\n' "$(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo unknown)"
printf 'head:       %s\n' "$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
printf 'project_id: %s\n' "${PROJECT_ID}"

if ! command -v podman >/dev/null 2>&1; then
  echo
  echo "Podman is not available; container identity cannot be inspected."
  exit 0
fi

section "Supabase project containers"
container_names="$(podman ps -a --format '{{.Names}}' 2>/dev/null | grep -E "^supabase_.*_${PROJECT_ID}$" || true)"
if [ -z "${container_names}" ]; then
  echo "No containers matching supabase_*_${PROJECT_ID} found."
else
  while IFS= read -r name; do
    [ -n "${name}" ] || continue
    image="$(podman inspect --format '{{.ImageName}}' "${name}" 2>/dev/null || true)"
    status="$(podman inspect --format '{{.State.Status}}' "${name}" 2>/dev/null || true)"
    supabase_project="$(podman inspect --format '{{ index .Config.Labels "com.supabase.cli.project" }}' "${name}" 2>/dev/null || true)"
    compose_project="$(podman inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${name}" 2>/dev/null || true)"
    printf '%s\n' "${name}"
    printf '  image:            %s\n' "${image:-<unknown>}"
    printf '  state:            %s\n' "${status:-<unknown>}"
    printf '  supabase_project: %s\n' "${supabase_project:-<none>}"
    printf '  compose_project:  %s\n' "${compose_project:-<none>}"
  done <<< "${container_names}"
fi

section "Container mounts"
if [ -z "${container_names}" ]; then
  echo "No matching containers to inspect."
else
  while IFS= read -r name; do
    [ -n "${name}" ] || continue
    echo "${name}"
    mounts="$(podman inspect --format '{{range .Mounts}}{{println .Type "|" .Name "|" .Source "|" .Destination}}{{end}}' "${name}" 2>/dev/null || true)"
    if [ -n "${mounts}" ]; then
      printf '%s\n' "${mounts}" | sed 's/^/  /'
    else
      echo "  <no mounts reported>"
    fi
  done <<< "${container_names}"
fi

section "Candidate Podman volumes"
volume_names="$(podman volume ls --format '{{.Name}}' 2>/dev/null | grep -Ei "supabase|${PROJECT_ID}|pcad|brepia" || true)"
if [ -z "${volume_names}" ]; then
  echo "No matching named volumes found."
else
  while IFS= read -r volume; do
    [ -n "${volume}" ] || continue
    mountpoint="$(podman volume inspect --format '{{.Mountpoint}}' "${volume}" 2>/dev/null || true)"
    driver="$(podman volume inspect --format '{{.Driver}}' "${volume}" 2>/dev/null || true)"
    printf '%s\n' "${volume}"
    printf '  driver:     %s\n' "${driver:-<unknown>}"
    printf '  mountpoint: %s\n' "${mountpoint:-<unknown>}"
  done <<< "${volume_names}"
fi

section "Candidate Podman networks"
network_names="$(podman network ls --format '{{.Name}}' 2>/dev/null | grep -Ei "supabase|${PROJECT_ID}|pcad|brepia" || true)"
if [ -n "${network_names}" ]; then
  printf '%s\n' "${network_names}"
else
  echo "No matching networks found."
fi

section "Repository-local Supabase state files"
if [ -d "${REPO_ROOT}/supabase/.temp" ]; then
  find "${REPO_ROOT}/supabase/.temp" -maxdepth 2 -type f -printf '%P\n' 2>/dev/null | sort || true
else
  echo "No supabase/.temp directory found."
fi

section "Identity coupling summary"
echo "Read-only inspection complete."
echo "Names containing the current project_id show which local resources may need migration or recreation if project_id changes."
echo "This script does not start, stop, rename, export, import, or delete any Supabase/Podman resource."
