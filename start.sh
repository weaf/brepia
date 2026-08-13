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
if ! curl -sf -m 2 http://127.0.0.1:4096/api/model > /dev/null 2>&1; then
  nohup opencode serve --port 4096 > /tmp/opencode-serve.log 2>&1 &
  for _ in $(seq 1 20); do
    curl -sf -m 2 http://127.0.0.1:4096/api/model > /dev/null 2>&1 && break
    sleep 1
  done
fi

echo "=== Starting dev server ==="
npm run dev
