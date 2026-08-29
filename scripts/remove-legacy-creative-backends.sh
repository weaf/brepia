#!/usr/bin/env bash
set -euo pipefail

LEGACY_HOME="${PCAD_MESH_HOME:-$HOME/.local/share/pcad-mesh}"
SERVICE_NAME="pcad-mesh-gateway.service"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME"
ASSUME_YES=0

usage() {
  cat <<EOF
Usage: ./scripts/remove-legacy-creative-backends.sh [--yes]

Removes only the retired Python Creative stack installed by the old
install-local-mesh-backends.sh script:

  $LEGACY_HOME
  $SERVICE_FILE

The native TRELLIS.2/Z-Image installation under llama-swap and
~/ai/pcad-native-creative is not touched.

Options:
  --yes       Do not ask for confirmation.
  -h, --help  Show this help.

Environment:
  PCAD_MESH_HOME  Override the old installer root if it was customized.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) ASSUME_YES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

case "$LEGACY_HOME" in
  ""|"/"|"$HOME"|"$HOME/.local"|"$HOME/.local/share")
    echo "Refusing unsafe legacy root: $LEGACY_HOME" >&2
    exit 1
    ;;
esac

printf 'Retired Creative runtime root: %s\n' "$LEGACY_HOME"
if [[ -d "$LEGACY_HOME" ]]; then
  du -sh "$LEGACY_HOME" 2>/dev/null || true
else
  echo "Legacy runtime directory is already absent."
fi

if [[ $ASSUME_YES -ne 1 ]]; then
  printf 'Remove the retired TRELLIS v1/Hunyuan Python runtime? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "Cancelled."; exit 0 ;;
  esac
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
fi

if [[ -f "$SERVICE_FILE" ]]; then
  rm -f -- "$SERVICE_FILE"
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload >/dev/null 2>&1 || true
  systemctl --user reset-failed "$SERVICE_NAME" >/dev/null 2>&1 || true
fi

if [[ -d "$LEGACY_HOME" ]]; then
  rm -rf -- "$LEGACY_HOME"
fi

echo "Legacy Creative runtime removed."
echo "TRELLIS.2 and llama-swap model storage were not modified."
