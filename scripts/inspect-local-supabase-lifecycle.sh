#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

section() {
  printf '\n=== %s ===\n' "$1"
}

print_command() {
  local name="$1"
  local path
  path="$(command -v "${name}" 2>/dev/null || true)"
  if [ -n "${path}" ]; then
    printf '%-12s %s\n' "${name}:" "${path}"
  else
    printf '%-12s %s\n' "${name}:" "not found"
  fi
}

section "Repository"
printf 'root:       %s\n' "${REPO_ROOT}"
printf 'branch:     %s\n' "$(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo unknown)"
printf 'head:       %s\n' "$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"

section "Candidate commands"
print_command nox
print_command NOx
print_command supabase
print_command podman
print_command node
print_command npm
print_command npx

section "User systemd units"
if command -v systemctl >/dev/null 2>&1; then
  printf 'podman.socket: %s\n' "$(systemctl --user is-active podman.socket 2>/dev/null || echo unavailable)"

  unit_matches="$({
    systemctl --user list-unit-files --no-legend 2>/dev/null || true
    systemctl --user list-units --all --type=service --no-legend --plain 2>/dev/null || true
  } | grep -Ei 'nox|supabase|pcad|brepia|cadam' | sort -u || true)"

  if [ -n "${unit_matches}" ]; then
    printf '%s\n' "${unit_matches}"
  else
    echo "No matching user units found."
  fi
else
  echo "systemctl not available."
fi

section "Candidate per-user files"
found_files=0
for root in \
  "${HOME}/.config" \
  "${HOME}/.config/systemd/user" \
  "${HOME}/.local/bin" \
  "${HOME}/.local/share/applications" \
  "${HOME}/bin"; do
  [ -e "${root}" ] || continue
  while IFS= read -r path; do
    [ -n "${path}" ] || continue
    printf '%s\n' "${path}"
    found_files=1
  done < <(
    find "${root}" -maxdepth 4 \
      \( -iname '*nox*' -o -iname '*supabase*' -o -iname '*cadam*' -o -iname '*brepia*' -o -iname '*pcad*' \) \
      -print 2>/dev/null | sort -u | head -n 100
  )
done

# A launcher or service can reference NOx/Supabase without carrying it in the
# filename. Search only small user launcher/service directories and print file
# names, never matching file contents.
for root in "${HOME}/.config/systemd/user" "${HOME}/.local/share/applications"; do
  [ -d "${root}" ] || continue
  while IFS= read -r path; do
    [ -n "${path}" ] || continue
    printf '%s\n' "${path}"
    found_files=1
  done < <(grep -RIlE 'NOx|\bnox\b|Supabase|supabase|cadam|Brepia|pCAD' "${root}" 2>/dev/null | sort -u | head -n 100)
done

if [ "${found_files}" -eq 0 ]; then
  echo "No matching per-user files found in the inspected locations."
fi

section "Relevant Podman containers"
if command -v podman >/dev/null 2>&1; then
  container_rows="$(podman ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null | grep -Ei 'supabase|cadam|brepia|pcad' || true)"
  if [ -n "${container_rows}" ]; then
    printf '%s\n' "${container_rows}"

    echo
    echo "Selected lifecycle labels:"
    while IFS= read -r name; do
      [ -n "${name}" ] || continue
      supabase_project="$(podman inspect --format '{{ index .Config.Labels "com.supabase.cli.project" }}' "${name}" 2>/dev/null || true)"
      compose_project="$(podman inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${name}" 2>/dev/null || true)"
      printf '%s\tsupabase_project=%s\tcompose_project=%s\n' \
        "${name}" "${supabase_project:-<none>}" "${compose_project:-<none>}"
    done < <(printf '%s\n' "${container_rows}" | cut -f1)
  else
    echo "No matching Podman containers found (or Podman socket is unavailable)."
  fi
else
  echo "podman not available."
fi

section "Repository-local Supabase CLI"
LOCAL_SUPABASE="${REPO_ROOT}/node_modules/.bin/supabase"
if [ -x "${LOCAL_SUPABASE}" ]; then
  printf 'version:    %s\n' "$("${LOCAL_SUPABASE}" --version 2>/dev/null || echo unknown)"

  # Match start.sh's compatibility environment, but do not start the socket or
  # print `supabase status` output because it may contain local API keys.
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
  export PATH="${REPO_ROOT}/scripts/podman:${PATH}"

  if "${LOCAL_SUPABASE}" status >/dev/null 2>&1; then
    echo "status:     local stack detected"
  else
    echo "status:     local stack not detected (or Podman socket unavailable)"
  fi
else
  echo "Repository-local Supabase CLI is not installed in node_modules."
  echo "Run the project's normal npm install workflow before using CLI operations."
fi

section "Interpretation"
echo "This helper is read-only. It does not start/stop Supabase or Podman and does not print Supabase credentials."
echo "Use the command/unit/file/container evidence above to identify what the workstation currently calls NOx."
