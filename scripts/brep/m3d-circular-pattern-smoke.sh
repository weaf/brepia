#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-m3d-circular.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/result-default.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3dCircularResult","name":"M3D circular pattern result","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"radius","label":"Radius","type":"number","unit":"mm","default":30},{"id":"angleStep","label":"Angle step","type":"number","unit":"deg","default":60}],"nodes":[{"id":"seed","type":"box","width":10,"depth":6,"height":4},{"id":"seedAt","type":"transform","input":"seed","translate":[{"parameter":"radius"},7,0]},{"id":"pattern","type":"circularPattern","input":"seedAt","axis":"z","center":[5,-10,0],"count":6,"angleStepDeg":{"parameter":"angleStep"}}],"resultNodeId":"pattern"},"parameterValues":{"radius":30,"angleStep":60}}
JSON

"$RUNNER" --input "$WORKSPACE/result-default.json" --output "$WORKSPACE/result-default-output"
grep -q 'ISO-10303-21' "$WORKSPACE/result-default-output/model.step"
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/result-default-output/model.3dm"
node -e "const r=require('$WORKSPACE/result-default-output/result.json'); const b=r.bodies; const near=(a,b)=>Math.abs(a-b)<1e-6; const center=[5,-10]; if(r.status!=='success'||r.resultNodeId!=='pattern'||r.resultKind!=='instanceSet'||b?.length!==6||r.exactExport?.available!==true) process.exit(1); const c0=[(b[0].bounds.min[0]+b[0].bounds.max[0])/2,(b[0].bounds.min[1]+b[0].bounds.max[1])/2]; for(let i=0;i<6;i++){if(b[i]?.id!==('pattern::'+i)||b[i]?.nodeId!=='pattern'||b[i]?.instance?.index!==i||b[i]?.instance?.sourceNodeId!=='seedAt'||!b[i]?.viewerMesh?.indices?.length) process.exit(1); const a=i*Math.PI/3, dx=c0[0]-center[0], dy=c0[1]-center[1], ex=center[0]+Math.cos(a)*dx-Math.sin(a)*dy, ey=center[1]+Math.sin(a)*dx+Math.cos(a)*dy, actual=[(b[i].bounds.min[0]+b[i].bounds.max[0])/2,(b[i].bounds.min[1]+b[i].bounds.max[1])/2]; if(!near(actual[0],ex)||!near(actual[1],ey)) process.exit(1); if(!near((b[i].bounds.min[2]+b[i].bounds.max[2])/2,(b[0].bounds.min[2]+b[0].bounds.max[2])/2)) process.exit(1);} console.log(JSON.stringify({result:r.resultNodeId,resultKind:r.resultKind,count:b.length,ids:b.map(x=>x.id),center,rightHandStepDeg:60,exactStep:r.exactExport.available}));"

cat > "$WORKSPACE/result-override.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3dCircularResultOverride","name":"M3D circular pattern override","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"radius","label":"Radius","type":"number","unit":"mm","default":30},{"id":"angleStep","label":"Angle step","type":"number","unit":"deg","default":60}],"nodes":[{"id":"seed","type":"box","width":10,"depth":6,"height":4},{"id":"seedAt","type":"transform","input":"seed","translate":[{"parameter":"radius"},7,0]},{"id":"pattern","type":"circularPattern","input":"seedAt","axis":"z","center":[5,-10,0],"count":6,"angleStepDeg":{"parameter":"angleStep"}}],"resultNodeId":"pattern"},"parameterValues":{"radius":40,"angleStep":45}}
JSON

"$RUNNER" --input "$WORKSPACE/result-override.json" --output "$WORKSPACE/result-override-output"
grep -q 'ISO-10303-21' "$WORKSPACE/result-override-output/model.step"
node -e "const a=require('$WORKSPACE/result-default-output/result.json'), r=require('$WORKSPACE/result-override-output/result.json'); const near=(a,b)=>Math.abs(a-b)<1e-6, center=[5,-10], c=(body)=>[(body.bounds.min[0]+body.bounds.max[0])/2,(body.bounds.min[1]+body.bounds.max[1])/2]; if(r.status!=='success'||r.resultKind!=='instanceSet'||r.bodies?.length!==6||r.exactExport?.available!==true) process.exit(1); const d0=c(a.bodies[0]), o0=c(r.bodies[0]); if(!near(o0[0]-d0[0],10)||!near(o0[1]-d0[1],0)) process.exit(1); const dx=o0[0]-center[0],dy=o0[1]-center[1],rad=Math.PI/4,expected=[center[0]+Math.cos(rad)*dx-Math.sin(rad)*dy,center[1]+Math.sin(rad)*dx+Math.cos(rad)*dy],o1=c(r.bodies[1]); if(!near(o1[0],expected[0])||!near(o1[1],expected[1])) process.exit(1); const d1=c(a.bodies[1]); if(near(o1[0],d1[0])&&near(o1[1],d1[1])) process.exit(1); console.log(JSON.stringify({override:{radius:40,angleStepDeg:45},seedCenterShift:[o0[0]-d0[0],o0[1]-d0[1]],instance1:o1,exactStep:r.exactExport.available}));"

cat > "$WORKSPACE/subtract.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3dCircularSubtract","name":"M3D circular subtract","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"plate","type":"box","width":300,"depth":300,"height":20},{"id":"cutter","type":"cylinder","radius":5,"height":40},{"id":"cutterAt","type":"transform","input":"cutter","translate":[80,50,0]},{"id":"cutters","type":"circularPattern","input":"cutterAt","axis":"z","center":[50,50,0],"count":6,"angleStepDeg":60},{"id":"cut","type":"subtract","base":"plate","tools":["cutters"]}],"resultNodeId":"cut"},"parameterValues":{}}
JSON

"$RUNNER" --input "$WORKSPACE/subtract.json" --output "$WORKSPACE/subtract-output"
grep -q 'ISO-10303-21' "$WORKSPACE/subtract-output/model.step"
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/subtract-output/model.3dm"
node -e "const r=require('$WORKSPACE/subtract-output/result.json'); const b=r.bodies?.[0]; if(r.status!=='success'||r.resultNodeId!=='cut'||r.resultKind!=='single'||r.bodies?.length!==1||b?.id!=='cut'||b?.instance!=null||!b?.viewerMesh?.indices?.length||r.exactExport?.available!==true) process.exit(1); console.log(JSON.stringify({patternTool:'cutters',count:6,result:r.resultNodeId,resultKind:r.resultKind,triangles:b.viewerMesh.indices.length/3,exactStep:r.exactExport.available}));"

cat > "$WORKSPACE/verify-step.py" <<'PY'
import sys
from importlib.metadata import version
from build123d import GeomType, import_step

build123d_version = version("build123d")
ocp_version = version("cadquery-ocp-novtk")
if build123d_version != "0.11.1" or ocp_version != "7.9.3.1.1":
    raise SystemExit(
        f"unexpected pinned CAD runtime build123d={build123d_version} cadquery-ocp-novtk={ocp_version}"
    )
shape = import_step(sys.argv[1])
solids = list(shape.solids())
cylinders = [face for face in shape.faces() if face.geom_type == GeomType.CYLINDER]
if len(solids) != 1 or len(cylinders) != 6:
    raise SystemExit(f"expected one solid with six cylindrical hole faces, got solids={len(solids)} cylinders={len(cylinders)}")
print({"build123d": build123d_version, "cadqueryOcpNovtk": ocp_version, "exactStepSolids": len(solids), "cylindricalHoleFaces": len(cylinders)})
PY

command -v "$PODMAN_BIN" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: Podman executable not found" >&2; exit 69; }
"$PODMAN_BIN" image exists "$IMAGE" >/dev/null 2>&1 || { echo "BREP_SANDBOX_UNAVAILABLE: sandbox image is not built" >&2; exit 69; }
"$PODMAN_BIN" run --rm --pull=never \
  --network=none --read-only --security-opt=no-new-privileges --cap-drop=all \
  --pids-limit=64 --memory=512m --cpus=1 --userns=keep-id --user "$(id -u):$(id -g)" \
  --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777" \
  --volume "$WORKSPACE/subtract-output/model.step:/input/model.step:ro" \
  --volume "$WORKSPACE/verify-step.py:/verify-step.py:ro" \
  --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python \
  "$IMAGE" /verify-step.py /input/model.step

cat > "$WORKSPACE/invalid.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3dCircularInvalid","name":"M3D circular invalid","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"angleStep","label":"Angle step","type":"number","unit":"deg","default":60}],"nodes":[{"id":"seed","type":"box","width":10,"depth":6,"height":4},{"id":"pattern","type":"circularPattern","input":"seed","axis":"z","center":[0,0,0],"count":6,"angleStepDeg":{"parameter":"angleStep"}}],"resultNodeId":"pattern"},"parameterValues":{"angleStep":0}}
JSON
if "$RUNNER" --input "$WORKSPACE/invalid.json" --output "$WORKSPACE/invalid-zero-output" 2>"$WORKSPACE/invalid-zero.err"; then
  echo 'Expected zero circular angle step to fail closed' >&2
  exit 1
fi
grep -q 'angleStepDeg must resolve to a non-zero degree value' "$WORKSPACE/invalid-zero.err"

node -e "const q=require('$WORKSPACE/invalid.json'); q.parameterValues.angleStep=61; require('fs').writeFileSync('$WORKSPACE/invalid-overturn.json',JSON.stringify(q));"
if "$RUNNER" --input "$WORKSPACE/invalid-overturn.json" --output "$WORKSPACE/invalid-overturn-output" 2>"$WORKSPACE/invalid-overturn.err"; then
  echo 'Expected over-one-turn circular pattern to fail closed' >&2
  exit 1
fi
grep -q 'abs(angleStepDeg) \* count must not exceed 360 degrees' "$WORKSPACE/invalid-overturn.err"
