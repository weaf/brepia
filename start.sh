#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Starting Podman socket ==="
systemctl --user enable podman.socket --now
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
echo "DOCKER_HOST=$DOCKER_HOST"

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
