#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VITEST="$ROOT_DIR/node_modules/.bin/vitest"
TEST_FILE="tests/brepM3DRhinoAcceptanceTool.test.ts"

if [[ ! -x "$VITEST" ]]; then
  echo "Missing $VITEST. Run npm ci first." >&2
  exit 1
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/brep/m3d-rhino-acceptance.sh generate [output-dir]
  scripts/brep/m3d-rhino-acceptance.sh validate <final-returned.ghx> <cutters-returned.ghx> [expectedRadius] [expectedAngleStepDeg]

If expected values are omitted, validation accepts any in-bounds persisted parameter
perturbation from the generated defaults and reports the observed values.
EOF
  exit 2
}

command="${1:-}"
case "$command" in
  generate)
    output_dir="${2:-$ROOT_DIR/tmp/m3d-rhino-acceptance}"
    mkdir -p "$output_dir"
    (
      cd "$ROOT_DIR"
      M3D_RHINO_MODE=generate \
        M3D_RHINO_OUTPUT_DIR="$output_dir" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    printf 'Final pattern: %s\n' "$output_dir/m3d-final-circular-pattern.ghx"
    printf 'Pattern cutters: %s\n' "$output_dir/m3d-circular-pattern-cutters.ghx"
    ;;
  validate)
    [[ $# -ge 3 ]] || usage
    final_file="$2"
    cutters_file="$3"
    expected_radius="${4:-}"
    expected_angle_step="${5:-}"
    (
      cd "$ROOT_DIR"
      M3D_RHINO_MODE=validate \
        M3D_RHINO_RETURNED_FINAL="$final_file" \
        M3D_RHINO_RETURNED_CUTTERS="$cutters_file" \
        M3D_RHINO_EXPECTED_RADIUS="$expected_radius" \
        M3D_RHINO_EXPECTED_ANGLE_STEP="$expected_angle_step" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    ;;
  *)
    usage
    ;;
esac
