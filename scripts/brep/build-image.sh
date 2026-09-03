#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${PCAD_PODMAN_BIN:-podman}" build --pull=never -t "${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.8.0}" -f "$SCRIPT_DIR/Containerfile" "$SCRIPT_DIR"
