#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_STEP_EXPORT_IMAGE:-localhost/pcad-step-export:scad123d-0.5.0}"

if ! command -v "$PODMAN_BIN" >/dev/null 2>&1; then
  echo "Podman is required to build the STEP sandbox image." >&2
  exit 1
fi

exec "$PODMAN_BIN" build \
  --tag "$IMAGE" \
  --file "${SCRIPT_DIR}/Containerfile" \
  "$REPO_ROOT"
