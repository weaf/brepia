#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

target="${1:-}"
case "$target" in
  A|B|C|D|E) ;;
  *)
    echo "Usage: $0 A|B|C|D|E" >&2
    exit 2
    ;;
esac

identifier="${BREPIA_GAP_IDENTIFIER:-${BREP_GHX_IDENTIFIER:-${B9_EMAIL:-}}}"
password="${BREPIA_GAP_PASSWORD:-${BREP_GHX_PASSWORD:-${B9_PASSWORD:-}}}"
origin="${BREPIA_GAP_ORIGIN:-http://localhost:3000}"

if [[ -z "$identifier" || -z "$password" ]]; then
  echo "Set BREPIA_GAP_IDENTIFIER/BREPIA_GAP_PASSWORD (or supported acceptance fallbacks) first." >&2
  exit 2
fi

if ! curl -fsS "$origin/" >/dev/null; then
  echo "Brepia is not reachable at $origin." >&2
  exit 2
fi

BREPIA_BREP_GAP_TARGET="$target" \
BREPIA_GAP_ORIGIN="$origin" \
npx playwright test -c playwright.brep-product-gap.config.ts

echo
echo "Target $target capture complete: test-results/brep-product-gap/${target,,}/manifest.json"
