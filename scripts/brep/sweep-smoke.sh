#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-sweep.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/base.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"boundedSweep","name":"Bounded planar elbow sweep","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"tubeDiameter","label":"Tube diameter","type":"number","unit":"mm","default":40},{"id":"firstLeg","label":"First leg","type":"number","unit":"mm","default":1000},{"id":"secondLeg","label":"Second leg","type":"number","unit":"mm","default":700},{"id":"bendRadius","label":"Bend radius","type":"number","unit":"mm","default":150}],"nodes":[{"id":"body","type":"sweep","profile":{"type":"circle","radius":{"op":"div","args":[{"parameter":"tubeDiameter"},2]}},"path":{"type":"planarElbow90","planeNormalAxis":"z","firstLegLength":{"parameter":"firstLeg"},"secondLegLength":{"parameter":"secondLeg"},"bendRadius":{"parameter":"bendRadius"}}}],"resultNodeId":"body"},"parameterValues":{"tubeDiameter":40,"firstLeg":1000,"secondLeg":700,"bendRadius":150}}
JSON

node - "$WORKSPACE/base.json" "$WORKSPACE" <<'NODE'
const fs = require('fs');
const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const workspace = process.argv[3];
for (const axis of ['x', 'y', 'z']) {
  const next = structuredClone(source);
  next.project.id = `boundedSweep${axis}`;
  next.project.nodes[0].path.planeNormalAxis = axis;
  fs.writeFileSync(`${workspace}/${axis}.json`, JSON.stringify(next));
}
const bend = structuredClone(source);
bend.parameterValues.bendRadius = 180;
fs.writeFileSync(`${workspace}/bend-180.json`, JSON.stringify(bend));
const diameter = structuredClone(source);
diameter.parameterValues.tubeDiameter = 50;
fs.writeFileSync(`${workspace}/diameter-50.json`, JSON.stringify(diameter));
const invalidRadius = structuredClone(source);
invalidRadius.parameterValues.tubeDiameter = 300;
fs.writeFileSync(`${workspace}/invalid-radius.json`, JSON.stringify(invalidRadius));
const invalidLeg = structuredClone(source);
invalidLeg.parameterValues.firstLeg = 0;
fs.writeFileSync(`${workspace}/invalid-leg.json`, JSON.stringify(invalidLeg));
NODE

for axis in x y z; do
  "$RUNNER" --input "$WORKSPACE/$axis.json" --output "$WORKSPACE/$axis-output"
  grep -q 'ISO-10303-21' "$WORKSPACE/$axis-output/model.step"
  grep -a -q '^3D Geometry File Format ' "$WORKSPACE/$axis-output/model.3dm"
done

node - "$WORKSPACE" <<'NODE'
const path = process.argv[2];
const near = (a, b) => Math.abs(a - b) < 1e-5;
const expected = {
  x: { min: [-20, 0, -20], max: [20, 1170, 850] },
  y: { min: [-20, -20, 0], max: [850, 20, 1170] },
  z: { min: [0, -20, -20], max: [1170, 850, 20] },
};
for (const axis of ['x', 'y', 'z']) {
  const result = require(`${path}/${axis}-output/result.json`);
  const body = result.bodies?.[0];
  if (
    result.status !== 'success' ||
    result.resultKind !== 'single' ||
    result.resultNodeId !== 'body' ||
    result.bodies?.length !== 1 ||
    body?.id !== 'body' ||
    result.exactExport?.available !== true
  ) process.exit(1);
  for (let index = 0; index < 3; index += 1) {
    if (
      !near(body.bounds.min[index], expected[axis].min[index]) ||
      !near(body.bounds.max[index], expected[axis].max[index])
    ) process.exit(1);
  }
}
console.log(JSON.stringify({
  fixture: 'axis-parity',
  x: require(`${path}/x-output/result.json`).bodies[0].bounds,
  y: require(`${path}/y-output/result.json`).bodies[0].bounds,
  z: require(`${path}/z-output/result.json`).bodies[0].bounds,
}));
NODE

"$RUNNER" --input "$WORKSPACE/bend-180.json" --output "$WORKSPACE/bend-180-output"
"$RUNNER" --input "$WORKSPACE/diameter-50.json" --output "$WORKSPACE/diameter-50-output"

node - "$WORKSPACE" <<'NODE'
const path = process.argv[2];
const near = (a, b) => Math.abs(a - b) < 1e-5;
const nominal = require(`${path}/z-output/result.json`).bodies[0].bounds;
const bend = require(`${path}/bend-180-output/result.json`).bodies[0].bounds;
const diameter = require(`${path}/diameter-50-output/result.json`).bodies[0].bounds;
const expectedBend = { min: [0, -20, -20], max: [1200, 880, 20] };
const expectedDiameter = { min: [0, -25, -25], max: [1175, 850, 25] };
for (let index = 0; index < 3; index += 1) {
  if (!near(bend.min[index], expectedBend.min[index]) || !near(bend.max[index], expectedBend.max[index])) process.exit(1);
  if (!near(diameter.min[index], expectedDiameter.min[index]) || !near(diameter.max[index], expectedDiameter.max[index])) process.exit(1);
}
if (near(nominal.max[0], bend.max[0]) || near(nominal.max[0], diameter.max[0])) process.exit(1);
console.log(JSON.stringify({ fixture: 'parameter-perturbation', bendRadius: 180, tubeDiameter: 50, bend, diameter }));
NODE

if "$RUNNER" --input "$WORKSPACE/invalid-radius.json" --output "$WORKSPACE/invalid-radius-output" 2>"$WORKSPACE/invalid-radius.err"; then
  echo 'Expected sweep profile radius >= bend radius to fail closed' >&2
  exit 1
fi
grep -q 'profile radius must resolve smaller than bendRadius' "$WORKSPACE/invalid-radius.err"

if "$RUNNER" --input "$WORKSPACE/invalid-leg.json" --output "$WORKSPACE/invalid-leg-output" 2>"$WORKSPACE/invalid-leg.err"; then
  echo 'Expected zero first sweep leg to fail closed' >&2
  exit 1
fi
grep -q 'firstLegLength must resolve to a positive millimetre value' "$WORKSPACE/invalid-leg.err"

cat > "$WORKSPACE/verify-step.py" <<'PY'
import math
import sys
from importlib.metadata import version
from build123d import import_step

build123d_version = version("build123d")
ocp_version = version("cadquery-ocp-novtk")
if build123d_version != "0.11.1" or ocp_version != "7.9.3.1.1":
    raise SystemExit(
        f"unexpected pinned CAD runtime build123d={build123d_version} cadquery-ocp-novtk={ocp_version}"
    )

shape = import_step(sys.argv[1])
solids = list(shape.solids())
if len(solids) != 1:
    raise SystemExit(f"expected exactly one imported solid, got {len(solids)}")
solid = solids[0]
if solid.volume <= 0:
    raise SystemExit(f"expected positive imported volume, got {solid.volume}")

box = solid.bounding_box()
expected_bounds = (0.0, -20.0, -20.0, 1170.0, 850.0, 20.0)
actual_bounds = (box.min.X, box.min.Y, box.min.Z, box.max.X, box.max.Y, box.max.Z)
if any(abs(a - e) > 1e-5 for a, e in zip(actual_bounds, expected_bounds)):
    raise SystemExit(f"unexpected exact STEP bounds: {actual_bounds}")

centerline_length = 1000.0 + math.pi * 150.0 / 2.0 + 700.0
expected_volume = math.pi * 20.0 * 20.0 * centerline_length
if abs(solid.volume - expected_volume) > 1e-4:
    raise SystemExit(
        f"unexpected exact STEP volume: actual={solid.volume} expected={expected_volume}"
    )

print({
    "build123d": build123d_version,
    "cadqueryOcpNovtk": ocp_version,
    "exactStepSolids": len(solids),
    "centerlineLength": centerline_length,
    "volume": solid.volume,
    "bounds": actual_bounds,
})
PY

command -v "$PODMAN_BIN" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: Podman executable not found" >&2; exit 69; }
"$PODMAN_BIN" image exists "$IMAGE" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: sandbox image is not built" >&2; exit 69; }
"$PODMAN_BIN" run --rm --pull=never \
  --network=none --read-only --security-opt=no-new-privileges --cap-drop=all \
  --pids-limit=64 --memory=512m --cpus=1 --userns=keep-id --user "$(id -u):$(id -g)" \
  --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777" \
  --volume "$WORKSPACE/z-output/model.step:/input/model.step:ro" \
  --volume "$WORKSPACE/verify-step.py:/verify-step.py:ro" \
  --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python \
  "$IMAGE" /verify-step.py /input/model.step
