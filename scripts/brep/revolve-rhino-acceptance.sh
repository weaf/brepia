#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VITEST="$ROOT_DIR/node_modules/.bin/vitest"
TEST_FILE="tests/brepRevolveRhinoAcceptanceTool.test.ts"

if [[ ! -x "$VITEST" ]]; then
  echo "Missing $VITEST. Run npm ci first." >&2
  exit 1
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/brep/revolve-rhino-acceptance.sh generate [output-dir]
  scripts/brep/revolve-rhino-acceptance.sh validate <parameterized-returned.ghx> <axis-adjacent-returned.ghx> [expectedOuterRadius] [expectedLength]

The generated primary fixture starts at outerRadius=18 and length=40.
The Gate C target edit is outerRadius=22 and length=52; validate uses those
values by default unless explicit expected values are supplied.
EOF
  exit 2
}

command="${1:-}"
case "$command" in
  generate)
    output_dir="${2:-$ROOT_DIR/tmp/revolve-rhino-acceptance}"
    mkdir -p "$output_dir"
    (
      cd "$ROOT_DIR"
      REVOLVE_RHINO_MODE=generate \
        REVOLVE_RHINO_OUTPUT_DIR="$output_dir" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    printf 'Parameterized revolve: %s\n' "$output_dir/revolve-parameterized-z.ghx"
    printf 'Axis-adjacent revolve: %s\n' "$output_dir/revolve-axis-adjacent-y.ghx"
    printf 'Gate C edit target: Outer radius 18 -> 22, Length 40 -> 52\n'
    ;;
  validate)
    [[ $# -ge 3 ]] || usage
    parameterized_file="$2"
    axis_adjacent_file="$3"
    expected_outer_radius="${4:-22}"
    expected_length="${5:-52}"
    (
      cd "$ROOT_DIR"
      REVOLVE_RHINO_MODE=validate \
        REVOLVE_RHINO_RETURNED_PARAMETERIZED="$parameterized_file" \
        REVOLVE_RHINO_RETURNED_AXIS_ADJACENT="$axis_adjacent_file" \
        REVOLVE_RHINO_EXPECTED_OUTER_RADIUS="$expected_outer_radius" \
        REVOLVE_RHINO_EXPECTED_LENGTH="$expected_length" \
        "$VITEST" run "$TEST_FILE" --reporter=verbose
    )
    ;;
  *)
    usage
    ;;
esac
