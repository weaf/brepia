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
print_command supabase
print_command podman
print_command node
print_command npm
print_command npx

section "User systemd units"
unit_matches=""
if command -v systemctl >/dev/null 2>&1; then
  printf 'podman.socket: %s\n' "$(systemctl --user is-active podman.socket 2>/dev/null || echo unavailable)"

  unit_matches="$({
    systemctl --user list-unit-files --no-legend 2>/dev/null || true
    systemctl --user list-units --all --type=service --no-legend --plain 2>/dev/null || true
  } | grep -Ei 'supabase|pcad|brepia|cadam|postgrest' | sort -u || true)"

  if [ -n "${unit_matches}" ]; then
    printf '%s\n' "${unit_matches}"
  else
    echo "No matching user units found."
  fi
else
  echo "systemctl not available."
fi

section "Matching unit metadata"
if command -v systemctl >/dev/null 2>&1 && [ -n "${unit_matches}" ]; then
  while IFS= read -r unit; do
    [ -n "${unit}" ] || continue
    case "${unit}" in
      *.service|*.socket)
        description="$(systemctl --user show "${unit}" -p Description --value 2>/dev/null || true)"
        fragment="$(systemctl --user show "${unit}" -p FragmentPath --value 2>/dev/null || true)"
        active="$(systemctl --user show "${unit}" -p ActiveState --value 2>/dev/null || true)"
        sub="$(systemctl --user show "${unit}" -p SubState --value 2>/dev/null || true)"
        env_files="$(systemctl --user show "${unit}" -p EnvironmentFiles --value 2>/dev/null || true)"
        exec_start="$(systemctl --user show "${unit}" -p ExecStart --value 2>/dev/null || true)"
        exec_path="$(printf '%s\n' "${exec_start}" | sed -n 's/.*path=\([^ ;]*\).*/\1/p' | head -n 1)"

        printf '%s\n' "${unit}"
        printf '  description: %s\n' "${description:-<none>}"
        printf '  state:       %s/%s\n' "${active:-unknown}" "${sub:-unknown}"
        printf '  fragment:    %s\n' "${fragment:-<none>}"
        printf '  exec path:   %s\n' "${exec_path:-<not resolved>}"
        printf '  env files:   %s\n' "${env_files:-<none>}"
        ;;
    esac
  done < <(printf '%s\n' "${unit_matches}" | awk '{print $1}' | sort -u)
else
  echo "No matching unit metadata to inspect."
fi

section "Candidate Supabase files"
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
      \( -iname '*supabase*' -o -iname '*cadam*' -o -iname '*brepia*' -o -iname '*pcad*' \) \
      -print 2>/dev/null | sort -u | head -n 100
  )
done

# A launcher or service can reference Supabase without carrying it in the
# filename. Search only small launcher/service directories and print file names,
# never matching file contents.
for root in \
  "${HOME}/.config/systemd/user" \
  "${HOME}/.local/share/applications" \
  "/etc/systemd/user" \
  "/usr/lib/systemd/user" \
  "/usr/share/applications"; do
  [ -d "${root}" ] || continue
  while IFS= read -r path; do
    [ -n "${path}" ] || continue
    printf '%s\n' "${path}"
    found_files=1
  done < <(grep -RIlE 'Supabase|supabase|cadam|Brepia|pCAD|PostgREST' "${root}" 2>/dev/null | sort -u | head -n 100)
done

if [ "${found_files}" -eq 0 ]; then
  echo "No matching user/system launcher files found in the inspected locations."
fi

section "Supabase env key names"
SUPABASE_ENV_FILE="${HOME}/.config/supabase.env"
if [ -r "${SUPABASE_ENV_FILE}" ]; then
  printf 'file:       %s\n' "${SUPABASE_ENV_FILE}"
  echo "keys only (values intentionally redacted):"
  key_names="$(grep -E '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=' "${SUPABASE_ENV_FILE}" 2>/dev/null \
    | sed -E 's/^[[:space:]]*export[[:space:]]+//' \
    | cut -d= -f1 \
    | sort -u || true)"
  if [ -n "${key_names}" ]; then
    printf '%s\n' "${key_names}"
  else
    echo "No shell-style KEY=VALUE entries detected."
  fi
else
  echo "No readable ~/.config/supabase.env file."
fi

section "Relevant process names"
process_names="$(ps -eo comm= 2>/dev/null | grep -Ei 'supabase|postgrest|gotrue|realtime' | sort -u || true)"
if [ -n "${process_names}" ]; then
  printf '%s\n' "${process_names}"
else
  echo "No matching host process names found."
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
      compose_dir="$(podman inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${name}" 2>/dev/null || true)"
      compose_files="$(podman inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "${name}" 2>/dev/null || true)"
      supabase_version="$(podman inspect --format '{{ index .Config.Labels "com.supabase.cli.version" }}' "${name}" 2>/dev/null || true)"
      printf '%s\n' "${name}"
      printf '  supabase_project: %s\n' "${supabase_project:-<none>}"
      printf '  compose_project:  %s\n' "${compose_project:-<none>}"
      printf '  compose_dir:      %s\n' "${compose_dir:-<none>}"
      printf '  compose_files:    %s\n' "${compose_files:-<none>}"
      printf '  supabase_version: %s\n' "${supabase_version:-<none>}"
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
echo "This helper is read-only. It does not start/stop Supabase or Podman and does not print Supabase credential values."
echo "Canonical lifecycle: repository-local npx supabase with the rootless Podman environment configured by ./start.sh."
