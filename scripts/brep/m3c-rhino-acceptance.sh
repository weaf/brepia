#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VITEST="$ROOT_DIR/node_modules/.bin/vitest"
TEST_FILE="tests/brepM3CRhinoAcceptanceTool.test.ts"

if [[ ! -x "$VITEST" ]]; then
  echo "Missing $VITEST. Run npm ci first." >&2
  exit 1
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/brep/m3c-rhino-acceptance.sh generate [output-dir]
  scripts/brep/m3c-rhino-acceptance.sh validate <final-returned.ghx> <cutters-returned.ghx> [expectedPitchA] [expectedPitchBaseB]

If expected values are omitted, validation accepts any in-bounds persisted parameter
perturbation from the generated defaults and reports the observed values.
EOF
  exit 2
}

command="${1:-}"
case "$command" in
  generate)
    output_dir="${2:-$ROOT_DIR/tmp/m3c-rhino-acceptance}"
    mkdir -p "$output_dir"
    (
      cd "$ROOT_DIR"
      M3C_RHINO_MODE=generate \
        M3C_RHINO_OUTPUT_DIR="$output_dir" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    printf 'Final pattern: %s\n' "$output_dir/m3c-final-rectangular-pattern.ghx"
    printf 'Pattern cutters: %s\n' "$output_dir/m3c-rectangular-pattern-cutters.ghx"
    ;;
  validate)
    [[ $# -ge 3 ]] || usage
    final_file="$2"
    cutters_file="$3"
    expected_pitch_a="${4:-}"
    expected_pitch_base_b="${5:-}"
    (
      cd "$ROOT_DIR"
      M3C_RHINO_MODE=validate \
        M3C_RHINO_RETURNED_FINAL="$final_file" \
        M3C_RHINO_RETURNED_CUTTERS="$cutters_file" \
        M3C_RHINO_EXPECTED_PITCH_A="$expected_pitch_a" \
        M3C_RHINO_EXPECTED_PITCH_BASE_B="$expected_pitch_base_b" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    ;;
  *)
    usage
    ;;
esac
