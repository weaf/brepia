#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

stage="${1:-}"
identifier="${BREP_GHX_IDENTIFIER:-${BREP_GHX_EMAIL:-${B9_EMAIL:-}}}"
password="${BREP_GHX_PASSWORD:-${B9_PASSWORD:-}}"
origin="${BREPIA_ACCEPTANCE_ORIGIN:-http://localhost:3000}"
output_dir="${BREPIA_PHASE9_DIR:-test-results/phase9-roundtrip}"
manifest="$output_dir/manifest.json"
returned_default="$output_dir/phase9-host-saved.ghx"

if [[ -z "$identifier" || -z "$password" ]]; then
  echo "Set BREP_GHX_IDENTIFIER/BREP_GHX_PASSWORD (or BREP_GHX_EMAIL / B9_EMAIL/B9_PASSWORD) first." >&2
  exit 2
fi

case "$stage" in
  prepare)
    BREPIA_ACCEPTANCE_ORIGIN="$origin" \
      BREPIA_PHASE9_STAGE=prepare \
      npx playwright test -c playwright.brep-phase9.config.ts
    echo
    echo "Phase 9 prepare complete against $origin."
    echo "Open: $output_dir/phase9-source.ghx"
    echo "In Rhino/Grasshopper set Width=1500 and Height=2300, solve, save, close, reopen, solve again."
    echo "Save/copy the Rhino-saved file as: $returned_default"
    ;;
  finalize)
    returned="${2:-${BREPIA_PHASE9_RETURNED_GHX:-$returned_default}}"
    if [[ ! -f "$manifest" ]]; then
      echo "Phase 9 manifest not found: $manifest" >&2
      echo "Run '$0 prepare' first and complete the Rhino save/reopen step before finalize." >&2
      exit 2
    fi
    if [[ ! -f "$returned" ]]; then
      echo "Returned Rhino-saved GHX not found: $returned" >&2
      exit 2
    fi
    BREPIA_ACCEPTANCE_ORIGIN="$origin" \
      BREPIA_PHASE9_STAGE=finalize \
      BREPIA_PHASE9_RETURNED_GHX="$returned" \
      npx playwright test -c playwright.brep-phase9.config.ts
    echo
    echo "Phase 9 browser finalize complete against $origin."
    echo "Final installed-host check: open $output_dir/phase9-continued.ghx in Rhino/Grasshopper."
    echo "Confirm it opens/solves without repair and shows the 1500 x 700 x 2300 box."
    ;;
  *)
    echo "Usage: $0 prepare|finalize [returned-ghx]" >&2
    exit 2
    ;;
esac
