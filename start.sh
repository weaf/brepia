#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Raise file descriptor limit (Vite watcher needs it)
ulimit -n 65536 2>/dev/null || true

# Warn if inotify instance limit is too low (Vite watch + podman containers)
INOTIFY_MAX="$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo 0)"
if [ "${INOTIFY_MAX}" -lt 512 ]; then
  echo "WARNING: fs.inotify.max_user_instances=${INOTIFY_MAX} (<512) may break the Vite watcher. Set it as root:"
  echo "  sudo sysctl fs.inotify.max_user_instances=512"
fi

echo "=== Starting Podman socket ==="
systemctl --user enable podman.socket --now
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
echo "DOCKER_HOST=$DOCKER_HOST"

echo "=== Starting llama-swap ==="
systemctl --user start llama-swap 2>/dev/null || echo "llama-swap: systemd start failed - trying to proceed anyway"
LLAMA_HEALTH="http://127.0.0.1:9292/health"
if ! curl -sf -m 2 "${LLAMA_HEALTH}" > /dev/null 2>&1; then
  echo "Waiting for llama-swap..."
  for _ in $(seq 1 30); do
    curl -sf -m 2 "${LLAMA_HEALTH}" > /dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf -m 2 "${LLAMA_HEALTH}" > /dev/null 2>&1 && echo "llama-swap: up" || echo "llama-swap: WARNING - not healthy"

# podman <5 cannot parse {{.Label "key"}} in ps --format templates, which the
# Supabase CLI relies on to find project containers. Prepend a shim that
# rewrites it to {{index .Labels "key"}} for the supabase step only.
export PATH="${SCRIPT_DIR}/scripts/podman:${PATH}"

echo "=== Starting Supabase ==="
npx supabase start

# Make the running local Supabase credentials available to the TanStack/Vite
# server process. Recent Supabase CLI pretty output shows publishable/secret
# keys, while `status -o env` still provides the legacy ANON_KEY and
# SERVICE_ROLE_KEY names used by this app. Never print these values here.
SUPABASE_STATUS_ENV="$(npx supabase status -o env 2>/dev/null || true)"
supabase_env_value() {
  printf '%s\n' "${SUPABASE_STATUS_ENV}" | awk -F= -v wanted="$1" '
    $1 == wanted {
      sub(/^[^=]*=/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  '
}

if [ -z "${VITE_SUPABASE_URL:-}" ]; then
  SUPABASE_API_URL="$(supabase_env_value API_URL)"
  if [ -n "${SUPABASE_API_URL}" ]; then
    export VITE_SUPABASE_URL="${SUPABASE_API_URL}"
  fi
fi

if [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  SUPABASE_ANON_KEY="$(supabase_env_value ANON_KEY)"
  if [ -n "${SUPABASE_ANON_KEY}" ]; then
    export VITE_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
  fi
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  LOCAL_SERVICE_ROLE_KEY="$(supabase_env_value SERVICE_ROLE_KEY)"
  if [ -n "${LOCAL_SERVICE_ROLE_KEY}" ]; then
    export SUPABASE_SERVICE_ROLE_KEY="${LOCAL_SERVICE_ROLE_KEY}"
  fi
fi

echo "=== Starting OpenCode server ==="
# OpenCode server configuration:
#   OPENCODE_BASE_URL        — full URL (overrides OPENCODE_PORT and default)
#   OPENCODE_PORT            — port only (legacy, ignored when OPENCODE_BASE_URL is set)
#   OPENCODE_SERVER_PASSWORD — optional HTTP Basic Auth password
#   OPENCODE_SERVER_USERNAME — optional Basic Auth username (default: opencode)
#   Default: http://127.0.0.1:4096  (matches opencodeApiUrl() default)
#
# OpenCode can consume project .env values itself, while the pCAD/TanStack
# server reads OPENCODE_* from process.env. Load ONLY the OpenCode connection
# settings from Vite's development env files so both processes use the same
# credentials. This deliberately avoids the previous broad server-env import.
vite_env_value() {
  node --input-type=module - "$1" <<'NODE'
import { loadEnv } from 'vite';
const key = process.argv[2];
const values = loadEnv('development', process.cwd(), '');
process.stdout.write(values[key] ?? '');
NODE
}

for key in OPENCODE_BASE_URL OPENCODE_PORT OPENCODE_SERVER_USERNAME OPENCODE_SERVER_PASSWORD; do
  if [ -z "${!key}" ]; then
    value="$(vite_env_value "$key")"
    if [ -n "${value}" ]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  fi
done
unset key value

OPENCODE_HOST="127.0.0.1"
OPENCODE_PORT="${OPENCODE_PORT:-4096}"
OPENCODE_URL="http://${OPENCODE_HOST}:${OPENCODE_PORT}"
OPENCODE_HEALTH="${OPENCODE_BASE_URL:-${OPENCODE_URL}}/api/health"

if [ -n "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  echo "OpenCode auth: configured (user ${OPENCODE_SERVER_USERNAME:-opencode})"
else
  echo "OpenCode auth: not configured in pCAD environment"
fi

# Use the same Basic Auth credentials as `opencode serve` when configured.
# This prevents an authenticated healthy server from being mistaken for a
# failed server because its health endpoint correctly returns HTTP 401.
opencode_curl() {
  if [ -n "${OPENCODE_SERVER_PASSWORD:-}" ]; then
    curl -u "${OPENCODE_SERVER_USERNAME:-opencode}:${OPENCODE_SERVER_PASSWORD}" "$@"
  else
    curl "$@"
  fi
}

if ! opencode_curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1; then
  # Server not ready — start it (binds loopback by default)
  nohup opencode serve --port "${OPENCODE_PORT}" \
    --hostname "${OPENCODE_HOST}" \
    > /tmp/opencode-serve.log 2>&1 &
  # Wait for server to be healthy (max 20 s)
  for _ in $(seq 1 20); do
    opencode_curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1 && break
    sleep 1
  done
fi

if opencode_curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1; then
  echo "OpenCode: up"
else
  OPENCODE_HTTP_STATUS="$(opencode_curl -s -o /dev/null -w '%{http_code}' -m 2 "${OPENCODE_HEALTH}" 2>/dev/null || true)"
  if [ "${OPENCODE_HTTP_STATUS}" = "401" ]; then
    echo "OpenCode: WARNING - server requires Basic Auth but pCAD credentials are missing or rejected"
    echo "OpenCode: set matching OPENCODE_SERVER_PASSWORD/USERNAME in .env.local or the shell environment"
  else
    echo "OpenCode: WARNING - not healthy (HTTP ${OPENCODE_HTTP_STATUS:-unreachable})"
  fi
fi

echo "=== Starting dev server ==="
npm run dev
