#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-c5-template.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/request.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"c5TemplateValidation","name":"C5 template validation fixture","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"width","label":"Width","type":"number","unit":"mm","default":40,"min":20,"max":80}],"nodes":[{"id":"body","type":"box","width":{"parameter":"width"},"depth":20,"height":10}],"resultNodeId":"body"},"parameterValues":{"width":60}}
JSON

"$RUNNER" --input "$WORKSPACE/request.json" --output "$WORKSPACE/output"
grep -q 'ISO-10303-21' "$WORKSPACE/output/model.step"
node -e "const r=require('$WORKSPACE/output/result.json'); const b=r.bodies?.[0], near=(a,b)=>Math.abs(a-b)<1e-6; if(r.status!=='success'||r.resultKind!=='single'||r.resultNodeId!=='body'||r.bodies?.length!==1||r.exactExport?.available!==true||!near(b.bounds.min[0],-30)||!near(b.bounds.max[0],30)) process.exit(1); console.log(JSON.stringify({resultKind:r.resultKind,width:60,bounds:b.bounds,exactStep:r.exactExport.available}));"

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
expected = (-30.0, -10.0, -5.0, 30.0, 10.0, 5.0)
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
  --volume "$WORKSPACE/output/model.step:/input/model.step:ro" \
  --volume "$WORKSPACE/verify-step.py:/verify-step.py:ro" \
  --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python \
  "$IMAGE" /verify-step.py /input/model.step
