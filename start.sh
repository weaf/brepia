#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Raise file descriptor limit (Vite watcher needs it in explicit HMR mode)
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
# Supabase CLI relies on to find project containers. Prepend a shim for local
# status/credential reads. NOx owns the Supabase container lifecycle.
export PATH="${SCRIPT_DIR}/scripts/podman:${PATH}"

echo "=== Checking Supabase (NOx-managed) ==="
if ! npx supabase status > /dev/null 2>&1; then
  echo "Supabase: ERROR - local stack is not running. Start it via NOx, then rerun ./start.sh."
  exit 1
fi
echo "Supabase: up (NOx-managed)"

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

# Read one server-only value from Vite development env files without broadly
# exporting every .env entry into the shell. This keeps the earlier narrow env
# behavior while allowing persistent provider credentials to work locally.
vite_env_value() {
  node --input-type=module - "$1" <<'NODE'
import { loadEnv } from 'vite';
const key = process.argv[2];
const values = loadEnv('development', process.cwd(), '');
process.stdout.write(values[key] ?? '');
NODE
}

if [ -z "${PCAD_CREDENTIAL_ENCRYPTION_KEY:-}" ]; then
  value="$(vite_env_value PCAD_CREDENTIAL_ENCRYPTION_KEY)"
  if [ -n "${value}" ]; then
    export PCAD_CREDENTIAL_ENCRYPTION_KEY="${value}"
  fi
fi

# Provider credentials are encrypted at rest. For local development, create a
# persistent 256-bit key if the operator did not supply one. The *.local file
# is gitignored and mode 600; the key is never printed.
if [ -z "${PCAD_CREDENTIAL_ENCRYPTION_KEY:-}" ]; then
  PCAD_LOCAL_KEY_FILE="${SCRIPT_DIR}/.pcad-credential-key.local"
  if [ ! -s "${PCAD_LOCAL_KEY_FILE}" ]; then
    umask 077
    node --input-type=module <<'NODE' > "${PCAD_LOCAL_KEY_FILE}"
import crypto from 'node:crypto';
process.stdout.write(crypto.randomBytes(32).toString('hex'));
NODE
    chmod 600 "${PCAD_LOCAL_KEY_FILE}" 2>/dev/null || true
  fi
  PCAD_CREDENTIAL_ENCRYPTION_KEY="$(cat "${PCAD_LOCAL_KEY_FILE}")"
  export PCAD_CREDENTIAL_ENCRYPTION_KEY
  echo "Provider credential encryption: local key ready"
else
  echo "Provider credential encryption: configured"
fi
unset value

echo "=== Starting OpenCode server ==="
# OpenCode server configuration:
#   OPENCODE_BASE_URL        - use an explicitly configured external server;
#                              pCAD will not start its own OpenCode process.
#   OPENCODE_PORT            - optional fixed port for pCAD's managed server.
#                              When unset, pCAD chooses a free loopback port.
#   OPENCODE_SERVER_PASSWORD - optional HTTP Basic Auth password.
#   OPENCODE_SERVER_USERNAME - optional Basic Auth username (default: opencode).
#
# Load ONLY OpenCode connection settings from Vite development env files so
# pCAD and a managed OpenCode server inherit the same explicit configuration.
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
OPENCODE_CHILD_PID=""
OPENCODE_LOG=""

# Ask the OS for an available loopback port. The tiny race between releasing
# the probe socket and starting OpenCode is handled by checking whether the
# child survives and becomes healthy; an explicit port instead fails loudly.
choose_free_port() {
  node --input-type=module <<'NODE'
import net from 'node:net';
const server = net.createServer();
server.unref();
server.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
  const address = server.address();
  if (!address || typeof address === 'string') process.exit(1);
  process.stdout.write(String(address.port));
  server.close();
});
NODE
}

cleanup_opencode() {
  if [ -n "${OPENCODE_CHILD_PID:-}" ] && kill -0 "${OPENCODE_CHILD_PID}" 2>/dev/null; then
    echo "Stopping pCAD OpenCode server (pid ${OPENCODE_CHILD_PID})..."
    kill "${OPENCODE_CHILD_PID}" 2>/dev/null || true
    wait "${OPENCODE_CHILD_PID}" 2>/dev/null || true
  fi
}
trap cleanup_opencode EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

opencode_curl() {
  if [ -n "${OPENCODE_SERVER_PASSWORD:-}" ]; then
    curl -u "${OPENCODE_SERVER_USERNAME:-opencode}:${OPENCODE_SERVER_PASSWORD}" "$@"
  else
    curl "$@"
  fi
}

if [ -n "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  echo "OpenCode auth: configured (user ${OPENCODE_SERVER_USERNAME:-opencode})"
else
  echo "OpenCode auth: not configured in pCAD environment"
fi

if [ -n "${OPENCODE_BASE_URL:-}" ]; then
  # Explicit base URL means the caller owns the OpenCode server lifecycle.
  OPENCODE_BASE_URL="${OPENCODE_BASE_URL%/}"
  export OPENCODE_BASE_URL
  OPENCODE_HEALTH="${OPENCODE_BASE_URL}/api/health"
  echo "OpenCode: using configured server ${OPENCODE_BASE_URL}"

  if opencode_curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1; then
    echo "OpenCode: up"
  else
    OPENCODE_HTTP_STATUS="$(opencode_curl -s -o /dev/null -w '%{http_code}' -m 2 "${OPENCODE_HEALTH}" 2>/dev/null || true)"
    echo "OpenCode: WARNING - configured server is not healthy (HTTP ${OPENCODE_HTTP_STATUS:-unreachable})"
  fi
else
  # No external server was configured. Start a pCAD-owned OpenCode instance.
  if [ -n "${OPENCODE_PORT:-}" ]; then
    echo "OpenCode: using configured port ${OPENCODE_PORT}"
  else
    OPENCODE_PORT="$(choose_free_port)"
    export OPENCODE_PORT
    echo "OpenCode: dynamically selected port ${OPENCODE_PORT}"
  fi

  export OPENCODE_BASE_URL="http://${OPENCODE_HOST}:${OPENCODE_PORT}"
  OPENCODE_HEALTH="${OPENCODE_BASE_URL}/api/health"
  OPENCODE_LOG="/tmp/pcad-opencode-${OPENCODE_PORT}.log"
  echo "OpenCode: ${OPENCODE_BASE_URL}"

  opencode serve --port "${OPENCODE_PORT}" \
    --hostname "${OPENCODE_HOST}" \
    > "${OPENCODE_LOG}" 2>&1 &
  OPENCODE_CHILD_PID=$!

  # Wait for the managed server to become healthy (max 20 s). If the selected
  # port was stolen in the tiny allocation race, OpenCode exits and we fail
  # with its log instead of accidentally connecting to somebody else's server.
  OPENCODE_READY=0
  for _ in $(seq 1 20); do
    if opencode_curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1; then
      OPENCODE_READY=1
      break
    fi
    if ! kill -0 "${OPENCODE_CHILD_PID}" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  if [ "${OPENCODE_READY}" -eq 1 ]; then
    echo "OpenCode: up (pid ${OPENCODE_CHILD_PID})"
  else
    echo "OpenCode: ERROR - managed server failed to start on ${OPENCODE_BASE_URL}"
    if [ -f "${OPENCODE_LOG}" ]; then
      echo "OpenCode log: ${OPENCODE_LOG}"
      tail -n 20 "${OPENCODE_LOG}" || true
    fi
    exit 1
  fi
fi

if [ "${PCAD_ENABLE_HMR:-0}" = "1" ]; then
  echo "=== Starting development server (Vite/HMR enabled) ==="
  npm run dev
else
  echo "=== Building production-like stable runtime ==="
  export VITE_ENABLE_LIFECYCLE_DEBUG="${VITE_ENABLE_LIFECYCLE_DEBUG:-1}"
  npm run build

  echo "=== Starting stable runtime (Nitro, no Vite client) ==="
  node scripts/stable-runtime-proxy.mjs
fi
