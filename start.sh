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

echo "=== Starting dev server ==="
npm run dev
