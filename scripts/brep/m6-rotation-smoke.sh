#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-brep-m6-rotation.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

run_axis_rotation() {
  local label="$1"
  local rotation="$2"
  local expected_min_x="$3"
  local expected_max_x="$4"
  local expected_min_y="$5"
  local expected_max_y="$6"
  local expected_min_z="$7"
  local expected_max_z="$8"
  local request_path="$WORKSPACE/${label}.json"
  local output_path="$WORKSPACE/${label}-output"

  cat > "$request_path" <<JSON
{"project":{"schemaVersion":1,"id":"${label}Smoke","name":"${label} smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"body","type":"box","width":10,"depth":20,"height":30},{"id":"rotated","type":"transform","input":"body","rotateDeg":${rotation}}],"resultNodeId":"rotated"},"parameterValues":{}}
JSON

  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  grep -a -q '^3D Geometry File Format ' "$output_path/model.3dm"
  node -e "const r=require('$output_path/result.json'); const b=r.bodies?.[0]; const near=(a,b)=>Math.abs(a-b)<1e-6; const e={min:[$expected_min_x,$expected_min_y,$expected_min_z],max:[$expected_max_x,$expected_max_y,$expected_max_z]}; if(r.status!=='success'||r.resultNodeId!=='rotated'||r.resultKind!=='single'||r.bodies?.length!==1||b?.id!=='rotated'||!b?.viewerMesh?.indices?.length||!b.bounds.min.every((v,i)=>near(v,e.min[i]))||!b.bounds.max.every((v,i)=>near(v,e.max[i]))||r.exactExport?.available!==true) process.exit(1); console.log(JSON.stringify({rotation:'$label',bounds:b.bounds,triangles:b.viewerMesh.indices.length/3,exactStep:r.exactExport.available}));"
}

run_intrinsic_xyz_dynamic() {
  local request_path="$WORKSPACE/intrinsic-xyz-dynamic.json"
  local output_path="$WORKSPACE/intrinsic-xyz-dynamic-output"

  cat > "$request_path" <<'JSON'
{"project":{"schemaVersion":1,"id":"intrinsicXyzDynamicSmoke","name":"Intrinsic XYZ dynamic smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"rx","label":"Rotate X","type":"number","unit":"deg","default":15,"min":-180,"max":180,"step":5},{"id":"ryBase","label":"Rotate Y base","type":"number","unit":"deg","default":15,"min":-180,"max":180,"step":5}],"nodes":[{"id":"body","type":"box","width":10,"depth":20,"height":30},{"id":"rotated","type":"transform","input":"body","translate":[7,11,13],"rotateDeg":[{"parameter":"rx"},{"op":"add","args":[{"parameter":"ryBase"},5]},10]}],"resultNodeId":"rotated"},"parameterValues":{"rx":30,"ryBase":15}}
JSON

  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  grep -a -q '^3D Geometry File Format ' "$output_path/model.3dm"
  node -e "const r=require('$output_path/result.json'); const b=r.bodies?.[0]; const near=(a,b)=>Math.abs(a-b)<1e-6; const e={min:[-4.38914415,-5.87340299,-5.66971729],max:[18.38914415,27.87340299,31.66971729]}; if(r.status!=='success'||r.resultNodeId!=='rotated'||r.resultKind!=='single'||r.bodies?.length!==1||b?.id!=='rotated'||!b?.viewerMesh?.indices?.length||!b.bounds.min.every((v,i)=>near(v,e.min[i]))||!b.bounds.max.every((v,i)=>near(v,e.max[i]))||r.exactExport?.available!==true) process.exit(1); console.log(JSON.stringify({rotation:'intrinsicXYZ',angles:[30,20,10],translation:[7,11,13],bounds:b.bounds,triangles:b.viewerMesh.indices.length/3,exactStep:r.exactExport.available}));"
}

run_axis_rotation rotateX90 '[90,0,0]' -5 5 -15 15 -10 10
run_axis_rotation rotateY90 '[0,90,0]' -15 15 -10 10 -5 5
run_axis_rotation rotateZ90 '[0,0,90]' -10 10 -5 5 -15 15
run_intrinsic_xyz_dynamic
