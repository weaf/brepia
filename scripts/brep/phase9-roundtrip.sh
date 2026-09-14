#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

stage="${1:-}"
identifier="${BREP_GHX_IDENTIFIER:-${BREP_GHX_EMAIL:-${B9_EMAIL:-}}}"
password="${BREP_GHX_PASSWORD:-${B9_PASSWORD:-}}"
output_dir="${BREPIA_PHASE9_DIR:-test-results/phase9-roundtrip}"
returned_default="$output_dir/phase9-host-saved.ghx"

if [[ -z "$identifier" || -z "$password" ]]; then
  echo "Set BREP_GHX_IDENTIFIER/BREP_GHX_PASSWORD (or BREP_GHX_EMAIL / B9_EMAIL/B9_PASSWORD) first." >&2
  exit 2
fi

case "$stage" in
  prepare)
    BREPIA_PHASE9_STAGE=prepare \
      npx playwright test -c playwright.brep-phase9.config.ts
    echo
    echo "Phase 9 prepare complete."
    echo "Open: $output_dir/phase9-source.ghx"
    echo "In Rhino/Grasshopper set Width=1500 and Height=2300, solve, save, close, reopen, solve again."
    echo "Save/copy the Rhino-saved file as: $returned_default"
    ;;
  finalize)
    returned="${2:-${BREPIA_PHASE9_RETURNED_GHX:-$returned_default}}"
    if [[ ! -f "$returned" ]]; then
      echo "Returned Rhino-saved GHX not found: $returned" >&2
      exit 2
    fi
    BREPIA_PHASE9_STAGE=finalize \
      BREPIA_PHASE9_RETURNED_GHX="$returned" \
      npx playwright test -c playwright.brep-phase9.config.ts
    echo
    echo "Phase 9 browser finalize complete."
    echo "Final installed-host check: open $output_dir/phase9-continued.ghx in Rhino/Grasshopper."
    echo "Confirm it opens/solves without repair and shows the 1500 x 700 x 2300 box."
    ;;
  *)
    echo "Usage: $0 prepare|finalize [returned-ghx]" >&2
    exit 2
    ;;
esac
