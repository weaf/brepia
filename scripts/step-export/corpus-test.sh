#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE_DIR="${SCRIPT_DIR}/fixtures"
RUNNER="${PCAD_STEP_EXPORT_RUNNER:-${SCRIPT_DIR}/pcad-scad2step-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_STEP_EXPORT_IMAGE:-localhost/pcad-step-export:scad123d-0.5.0}"
WORKDIR="$(mktemp -d)"
KEEP_ARTIFACTS="${PCAD_STEP_CORPUS_KEEP:-0}"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
  if [ "$KEEP_ARTIFACTS" = "1" ]; then
    echo "STEP corpus artifacts kept at: $WORKDIR"
  else
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ ! -x "$RUNNER" ]; then
  echo "STEP corpus: runner is not executable: $RUNNER" >&2
  exit 69
fi
if ! command -v "$PODMAN_BIN" >/dev/null 2>&1; then
  echo "STEP corpus: Podman executable not found: $PODMAN_BIN" >&2
  exit 69
fi
if ! "$PODMAN_BIN" image exists "$IMAGE" >/dev/null 2>&1; then
  echo "STEP corpus: sandbox image is not built: $IMAGE" >&2
  exit 69
fi

inspect_step() {
  local step_file="$1"
  shift
  "$PODMAN_BIN" run \
    --rm \
    --pull=never \
    --network=none \
    --read-only \
    --security-opt=no-new-privileges \
    --cap-drop=all \
    --pids-limit=128 \
    --memory=2g \
    --cpus=1 \
    --userns=keep-id \
    --user "$(id -u):$(id -g)" \
    --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=256m" \
    --volume "${SCRIPT_DIR}/inspect-step.py:/opt/pcad-step/inspect-step.py:ro" \
    --volume "${step_file}:/input/model.step:ro" \
    --env HOME=/tmp \
    --entrypoint /opt/pcad-step-venv/bin/python \
    "$IMAGE" \
    /opt/pcad-step/inspect-step.py /input/model.step "$@"
}

run_case() {
  local name="$1"
  local fallback_expectation="$2"
  shift 2
  local fixture="${FIXTURE_DIR}/${name}.scad"
  local case_dir="${WORKDIR}/${name}"
  local step_file="${case_dir}/model.step"
  local log_file="${case_dir}/converter.log"
  local inspector_log="${case_dir}/inspector.log"

  mkdir -p "$case_dir"
  printf '%-28s ' "$name"

  if ! "$RUNNER" "$fixture" -o "$step_file" >"$log_file" 2>&1; then
    echo "FAIL (conversion)"
    sed 's/^/  | /' "$log_file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  if [ ! -s "$step_file" ] || ! grep -q 'ISO-10303-21' "$step_file"; then
    echo "FAIL (invalid Part 21 output)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  if grep -q 'rendered to a mesh via OpenSCAD' "$log_file"; then
    if [ "$fallback_expectation" != "fallback" ]; then
      echo "FAIL (unexpected mesh fallback)"
      sed 's/^/  | /' "$log_file"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      return
    fi
  elif [ "$fallback_expectation" = "fallback" ]; then
    echo "FAIL (expected mesh fallback warning missing)"
    sed 's/^/  | /' "$log_file"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  if ! inspect_step "$step_file" "$@" >"$inspector_log" 2>&1; then
    echo "FAIL (B-Rep inspection)"
    sed 's/^/  | /' "$inspector_log"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi

  if [ "$fallback_expectation" = "fallback" ]; then
    printf 'PASS  FALLBACK  '
  else
    printf 'PASS  BREP      '
  fi
  tail -n 1 "$inspector_log"
  PASS_COUNT=$((PASS_COUNT + 1))
}

run_case 01-cube exact \
  --expect-solids 1 --expect-bbox 10,20,30 --require-surface PLANE=6
run_case 02-cylinder exact \
  --expect-solids 1 --expect-bbox 14,14,25 --require-surface CYLINDER=1
run_case 03-sphere exact \
  --expect-solids 1 --expect-bbox 18,18,18 --require-surface SPHERE=1
run_case 04-boolean-hole exact \
  --expect-solids 1 --expect-bbox 30,20,10 --require-surface CYLINDER=1
run_case 05-union exact \
  --expect-solids 1 --expect-bbox 30,20,10 --require-surface PLANE=6
run_case 06-intersection exact \
  --expect-solids 1 --expect-bbox 10,15,16 --require-surface PLANE=6
run_case 07-linear-extrude exact \
  --expect-solids 1 --expect-bbox 20,10,12 --require-surface PLANE=6
run_case 08-rotate-extrude exact \
  --expect-solids 1 --expect-bbox 30,30,10 --require-surface CYLINDER=2
run_case 09-hull-polyhedral exact \
  --expect-solids 1 --expect-bbox 30,20,15 --require-surface PLANE=6
run_case 10-minkowski-rounding exact \
  --expect-solids 1 --expect-bbox 24,14,9 --require-surface PLANE=1 \
  --require-surface CYLINDER=1 --require-surface SPHERE=1
run_case 11-bosl exact \
  --expect-solids 1 --expect-bbox 18,14,8 --require-surface PLANE=6
run_case 12-bosl2 exact \
  --expect-solids 1 --expect-bbox 21,17,9 --require-surface PLANE=6
run_case 13-mcad-gear exact \
  --expect-solids 1 --min-faces 10
run_case 14-color-multibody exact \
  --expect-solids 2 --min-colored-nodes 2 --require-surface CYLINDER=1
run_case 15-linear-extrude-twist fallback \
  --min-solids 1 --min-faces 10 --skip-manifold
run_case 16-hull-three-spheres fallback \
  --min-solids 1 --min-faces 10 --skip-manifold

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo
echo "STEP corpus: ${PASS_COUNT}/${TOTAL} PASS"
if [ "$FAIL_COUNT" -ne 0 ]; then
  echo "STEP corpus: ${FAIL_COUNT} case(s) failed" >&2
  exit 1
fi

echo "STEP corpus PASS"
