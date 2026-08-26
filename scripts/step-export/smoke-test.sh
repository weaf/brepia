#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

cat > "${WORKDIR}/model.scad" <<'SCAD'
difference() {
  cube([30, 20, 10], center = true);
  cylinder(h = 20, r = 4, center = true, $fn = 96);
}
SCAD

"${SCRIPT_DIR}/pcad-scad2step-sandbox" \
  "${WORKDIR}/model.scad" \
  -o "${WORKDIR}/model.step"

[ -s "${WORKDIR}/model.step" ] || {
  echo "STEP smoke test failed: no output file" >&2
  exit 1
}

grep -q 'ISO-10303-21' "${WORKDIR}/model.step" || {
  echo "STEP smoke test failed: output is not a STEP Part 21 file" >&2
  exit 1
}

# This fixture contains a true cylindrical hole. A successful B-Rep conversion
# should preserve an analytic cylindrical surface rather than tessellating it.
grep -q 'CYLINDRICAL_SURFACE' "${WORKDIR}/model.step" || {
  echo "STEP smoke test failed: expected analytic cylindrical surface was not preserved" >&2
  exit 1
}

echo "STEP sandbox smoke test PASS"
