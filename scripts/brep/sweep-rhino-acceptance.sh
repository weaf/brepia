#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VITEST="$ROOT_DIR/node_modules/.bin/vitest"
TEST_FILE="tests/brepSweepRhinoAcceptanceTool.test.ts"

if [[ ! -x "$VITEST" ]]; then
  echo "Missing $VITEST. Run npm ci first." >&2
  exit 1
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/brep/sweep-rhino-acceptance.sh generate [output-dir]
  scripts/brep/sweep-rhino-acceptance.sh validate <returned.ghx>

Generated defaults:
  Tube diameter = 40 mm
  Bend radius   = 150 mm

Gate C edit target:
  Tube diameter 40 -> 50 mm
  Bend radius   150 -> 180 mm

Host steps:
  1. Open the generated GHX in installed Rhino 8 / Grasshopper.
  2. Confirm it solves as one smooth circular-section 90-degree elbow Result item.
  3. Change Tube diameter to 50 and Bend radius to 180.
  4. Confirm geometry recomputes and remains one smooth solid.
  5. Save as sweep-planar-elbow-z-returned.ghx.
  6. Close Grasshopper/Rhino, reopen the saved GHX and solve again.
  7. Return the saved GHX and run validate.
EOF
  exit 2
}

command="${1:-}"
case "$command" in
  generate)
    output_dir="${2:-$ROOT_DIR/tmp/sweep-rhino-acceptance}"
    mkdir -p "$output_dir"
    (
      cd "$ROOT_DIR"
      SWEEP_RHINO_MODE=generate \
        SWEEP_RHINO_OUTPUT_DIR="$output_dir" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    printf 'Sweep fixture: %s/sweep-planar-elbow-z.ghx\n' "$output_dir"
    printf 'Gate C edit target: Tube diameter 40 -> 50, Bend radius 150 -> 180\n'
    ;;
  validate)
    [[ $# -eq 2 ]] || usage
    returned_file="$2"
    (
      cd "$ROOT_DIR"
      SWEEP_RHINO_MODE=validate \
        SWEEP_RHINO_RETURNED="$returned_file" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    ;;
  *)
    usage
    ;;
esac
