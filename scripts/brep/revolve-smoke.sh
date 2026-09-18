#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-revolve.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/stepped.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"revolveStepped","name":"Bounded revolve stepped bushing","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"body","type":"revolve","axis":"x","profile":{"type":"closedPolyline","points":[{"u":-30,"v":8},{"u":-30,"v":16},{"u":-18,"v":16},{"u":-18,"v":13},{"u":18,"v":13},{"u":18,"v":16},{"u":30,"v":16},{"u":30,"v":8}]}}],"resultNodeId":"body"},"parameterValues":{}}
JSON
"$RUNNER" --input "$WORKSPACE/stepped.json" --output "$WORKSPACE/stepped-output"
grep -q 'ISO-10303-21' "$WORKSPACE/stepped-output/model.step"
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/stepped-output/model.3dm"
node -e "const r=require('$WORKSPACE/stepped-output/result.json'); const b=r.bodies?.[0], near=(a,b)=>Math.abs(a-b)<1e-6; if(r.status!=='success'||r.resultKind!=='single'||r.resultNodeId!=='body'||r.bodies?.length!==1||b?.id!=='body'||r.exactExport?.available!==true) process.exit(1); const e={min:[-30,-16,-16],max:[30,16,16]}; for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);} console.log(JSON.stringify({fixture:'stepped-bushing',bounds:b.bounds,resultKind:r.resultKind,exactStep:r.exactExport.available}));"

cat > "$WORKSPACE/parameterized-default.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"revolveParameterized","name":"Parameterized bounded revolve","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"outerRadius","label":"Outer radius","type":"number","unit":"mm","default":18},{"id":"length","label":"Length","type":"number","unit":"mm","default":40}],"nodes":[{"id":"body","type":"revolve","axis":"z","profile":{"type":"closedPolyline","points":[{"u":{"op":"neg","args":[{"op":"mul","args":[{"parameter":"length"},0.5]}]},"v":8},{"u":{"op":"neg","args":[{"op":"mul","args":[{"parameter":"length"},0.5]}]},"v":{"parameter":"outerRadius"}},{"u":{"op":"mul","args":[{"parameter":"length"},0.5]},"v":{"parameter":"outerRadius"}},{"u":{"op":"mul","args":[{"parameter":"length"},0.5]},"v":8}]}}],"resultNodeId":"body"},"parameterValues":{"outerRadius":18,"length":40}}
JSON
"$RUNNER" --input "$WORKSPACE/parameterized-default.json" --output "$WORKSPACE/parameterized-default-output"
grep -q 'ISO-10303-21' "$WORKSPACE/parameterized-default-output/model.step"
node -e "const r=require('$WORKSPACE/parameterized-default-output/result.json'),b=r.bodies?.[0],near=(a,b)=>Math.abs(a-b)<1e-6,e={min:[-18,-18,-20],max:[18,18,20]}; if(r.status!=='success'||r.resultKind!=='single'||r.bodies?.length!==1) process.exit(1); for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);}"

node -e "const q=require('$WORKSPACE/parameterized-default.json'); q.parameterValues={outerRadius:22,length:52}; require('fs').writeFileSync('$WORKSPACE/parameterized-override.json',JSON.stringify(q));"
"$RUNNER" --input "$WORKSPACE/parameterized-override.json" --output "$WORKSPACE/parameterized-override-output"
grep -q 'ISO-10303-21' "$WORKSPACE/parameterized-override-output/model.step"
node -e "const a=require('$WORKSPACE/parameterized-default-output/result.json'),r=require('$WORKSPACE/parameterized-override-output/result.json'),b=r.bodies?.[0],near=(a,b)=>Math.abs(a-b)<1e-6,e={min:[-22,-22,-26],max:[22,22,26]}; if(r.status!=='success'||r.resultKind!=='single'||r.bodies?.length!==1) process.exit(1); for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);} if(near(a.bodies[0].bounds.max[0],b.bounds.max[0])||near(a.bodies[0].bounds.max[2],b.bounds.max[2])) process.exit(1); console.log(JSON.stringify({fixture:'parameterized',override:{outerRadius:22,length:52},bounds:b.bounds}));"

cat > "$WORKSPACE/axis-adjacent.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"revolveAxisAdjacent","name":"Axis-adjacent bounded revolve","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"body","type":"revolve","axis":"y","profile":{"type":"closedPolyline","points":[{"u":-20,"v":0},{"u":-20,"v":12},{"u":-5,"v":12},{"u":-5,"v":9},{"u":20,"v":9},{"u":20,"v":0}]}}],"resultNodeId":"body"},"parameterValues":{}}
JSON
"$RUNNER" --input "$WORKSPACE/axis-adjacent.json" --output "$WORKSPACE/axis-adjacent-output"
node -e "const r=require('$WORKSPACE/axis-adjacent-output/result.json'),b=r.bodies?.[0],near=(a,b)=>Math.abs(a-b)<1e-6,e={min:[-12,-20,-12],max:[12,20,12]}; if(r.status!=='success'||r.resultKind!=='single'||r.bodies?.length!==1) process.exit(1); for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);} console.log(JSON.stringify({fixture:'axis-adjacent',bounds:b.bounds}));"

cat > "$WORKSPACE/invalid-crossing.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"revolveInvalidCrossing","name":"Invalid crossing bounded revolve","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"body","type":"revolve","axis":"x","profile":{"type":"closedPolyline","points":[{"u":-20,"v":-2},{"u":-20,"v":12},{"u":20,"v":12},{"u":20,"v":-2}]}}],"resultNodeId":"body"},"parameterValues":{}}
JSON
if "$RUNNER" --input "$WORKSPACE/invalid-crossing.json" --output "$WORKSPACE/invalid-crossing-output" 2>"$WORKSPACE/invalid-crossing.err"; then
  echo 'Expected axis-crossing revolve profile to fail closed' >&2
  exit 1
fi
grep -q 'must keep radial v >= 0 and must not cross the rotation axis' "$WORKSPACE/invalid-crossing.err"

cat > "$WORKSPACE/verify-step.py" <<'PY'
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
expected = (-22.0, -22.0, -26.0, 22.0, 22.0, 26.0)
actual = (box.min.X, box.min.Y, box.min.Z, box.max.X, box.max.Y, box.max.Z)
if any(abs(a - e) > 1e-6 for a, e in zip(actual, expected)):
    raise SystemExit(f"unexpected exact STEP bounds: {actual}")
print({
    "build123d": build123d_version,
    "cadqueryOcpNovtk": ocp_version,
    "exactStepSolids": len(solids),
    "volume": solid.volume,
    "bounds": actual,
})
PY

command -v "$PODMAN_BIN" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: Podman executable not found" >&2; exit 69; }
"$PODMAN_BIN" image exists "$IMAGE" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: sandbox image is not built" >&2; exit 69; }
"$PODMAN_BIN" run --rm --pull=never \
  --network=none --read-only --security-opt=no-new-privileges --cap-drop=all \
  --pids-limit=64 --memory=512m --cpus=1 --userns=keep-id --user "$(id -u):$(id -g)" \
  --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777" \
  --volume "$WORKSPACE/parameterized-override-output/model.step:/input/model.step:ro" \
  --volume "$WORKSPACE/verify-step.py:/verify-step.py:ro" \
  --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python \
  "$IMAGE" /verify-step.py /input/model.step
