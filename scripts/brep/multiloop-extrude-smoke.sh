#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-multiloop-extrude.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/default.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"multiLoopExtrudeNative","name":"Bounded multi-loop extrusion native fixture","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"width","label":"Width","type":"number","unit":"mm","default":100},{"id":"margin","label":"Margin","type":"number","unit":"mm","default":35},{"id":"holeRadius","label":"Hole radius","type":"number","unit":"mm","default":7}],"nodes":[{"id":"plate","type":"extrude","axis":"z","depth":8,"profile":{"type":"rectangle","width":{"parameter":"width"},"height":70,"holes":[{"loop":{"type":"circle","radius":{"parameter":"holeRadius"}},"offsetU":{"op":"sub","args":[{"op":"div","args":[{"parameter":"width"},2]},{"parameter":"margin"}]},"offsetV":0},{"loop":{"type":"closedPolyline","points":[{"u":-5,"v":-4},{"u":5,"v":-4},{"u":5,"v":4},{"u":-5,"v":4}]},"offsetU":-20,"offsetV":0}]}}],"resultNodeId":"plate"},"parameterValues":{"width":100,"margin":35,"holeRadius":7}}
JSON

"$RUNNER" --input "$WORKSPACE/default.json" --output "$WORKSPACE/default-output"
grep -q 'ISO-10303-21' "$WORKSPACE/default-output/model.step"
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/default-output/model.3dm"
node -e "const r=require('$WORKSPACE/default-output/result.json'),b=r.bodies?.[0],near=(a,b)=>Math.abs(a-b)<1e-6,e={min:[-50,-35,-4],max:[50,35,4]}; if(r.status!=='success'||r.resultKind!=='single'||r.resultNodeId!=='plate'||r.bodies?.length!==1||b?.id!=='plate'||r.exactExport?.available!==true) process.exit(1); for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);} console.log(JSON.stringify({fixture:'multi-loop-default',bounds:b.bounds,resultKind:r.resultKind,exactStep:r.exactExport.available}));"

node - <<'NODE' "$WORKSPACE/default.json" "$WORKSPACE/override.json"
const fs = require('fs');
const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
source.parameterValues = { width: 120, margin: 40, holeRadius: 9 };
fs.writeFileSync(process.argv[3], JSON.stringify(source));
NODE

"$RUNNER" --input "$WORKSPACE/override.json" --output "$WORKSPACE/override-output"
grep -q 'ISO-10303-21' "$WORKSPACE/override-output/model.step"
node -e "const a=require('$WORKSPACE/default-output/result.json'),r=require('$WORKSPACE/override-output/result.json'),b=r.bodies?.[0],near=(a,b)=>Math.abs(a-b)<1e-6,e={min:[-60,-35,-4],max:[60,35,4]}; if(r.status!=='success'||r.resultKind!=='single'||r.bodies?.length!==1) process.exit(1); for(let i=0;i<3;i++){if(!near(b.bounds.min[i],e.min[i])||!near(b.bounds.max[i],e.max[i])) process.exit(1);} if(near(a.bodies[0].bounds.min[0],b.bounds.min[0])||near(a.bodies[0].bounds.max[0],b.bounds.max[0])) process.exit(1); console.log(JSON.stringify({fixture:'multi-loop-override',override:{width:120,margin:40,holeRadius:9},bounds:b.bounds}));"

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
expected_bounds = (-60.0, -35.0, -4.0, 60.0, 35.0, 4.0)
actual_bounds = (box.min.X, box.min.Y, box.min.Z, box.max.X, box.max.Y, box.max.Z)
if any(abs(a - e) > 1e-6 for a, e in zip(actual_bounds, expected_bounds)):
    raise SystemExit(f"unexpected exact STEP bounds: {actual_bounds}")
expected_volume = (120.0 * 70.0 - math.pi * 9.0 * 9.0 - 10.0 * 8.0) * 8.0
if abs(solid.volume - expected_volume) > 1e-4:
    raise SystemExit(
        f"unexpected exact STEP volume: actual={solid.volume} expected={expected_volume}"
    )
print({
    "build123d": build123d_version,
    "cadqueryOcpNovtk": ocp_version,
    "exactStepSolids": len(solids),
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
  --volume "$WORKSPACE/override-output/model.step:/input/model.step:ro" \
  --volume "$WORKSPACE/verify-step.py:/verify-step.py:ro" \
  --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python \
  "$IMAGE" /verify-step.py /input/model.step
