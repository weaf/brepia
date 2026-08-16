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

echo "=== Starting Ollama ==="
timeout 10 systemctl start ollama 2>/dev/null || echo "ollama: skipped (cannot start system service as $(id -un))"
OLLAMA_HEALTH="http://127.0.0.1:11434"
if ! curl -sf -m 2 "${OLLAMA_HEALTH}" > /dev/null 2>&1; then
  echo "Waiting for Ollama..."
  for _ in $(seq 1 15); do
    curl -sf -m 2 "${OLLAMA_HEALTH}" > /dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf -m 2 "${OLLAMA_HEALTH}" > /dev/null 2>&1 && echo "ollama: up" || echo "ollama: WARNING - not healthy"

# podman <5 cannot parse {{.Label "key"}} in ps --format templates, which the
# Supabase CLI relies on to find project containers. Prepend a shim that
# rewrites it to {{index .Labels "key"}} for the supabase step only.
export PATH="${SCRIPT_DIR}/scripts/podman:${PATH}"

echo "=== Starting Supabase ==="
npx supabase start

echo "=== Starting OpenCode server ==="
# OpenCode server configuration:
#   OPENCODE_BASE_URL  — full URL (overrides OPENCODE_PORT and default)
#   OPENCODE_PORT      — port only (legacy, ignored when OPENCODE_BASE_URL is set)
#   Default: http://127.0.0.1:4096  (matches opencodeApiUrl() default)
OPENCODE_HOST="127.0.0.1"
OPENCODE_PORT="${OPENCODE_PORT:-4096}"
OPENCODE_URL="http://${OPENCODE_HOST}:${OPENCODE_PORT}"
OPENCODE_HEALTH="${OPENCODE_BASE_URL:-${OPENCODE_URL}}/api/health"

if ! curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1; then
  # Server not ready — start it (binds loopback by default)
  nohup opencode serve --port "${OPENCODE_PORT}" \
    --hostname "${OPENCODE_HOST}" \
    > /tmp/opencode-serve.log 2>&1 &
  # Wait for server to be healthy (max 20 s)
  for _ in $(seq 1 20); do
    curl -sf -m 2 "${OPENCODE_HEALTH}" > /dev/null 2>&1 && break
    sleep 1
  done
fi

echo "=== Starting dev server ==="
npm run dev
