#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-brep-smoke.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/request.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"nativeSmoke","name":"Native smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"metadata":{"objectType":"smoke-object","classification":"brep-test"},"projectObject":{"footprintNodeId":"body","clearanceEnvelopeNodeId":"finished","maintenanceEnvelopeNodeId":"body","points":[{"id":"cableEntry","kind":"cable","label":"Cable entry","position":[{"parameter":"width"},10,0],"direction":[0,0,1]}]},"parameters":[{"id":"width","label":"Width","type":"number","unit":"mm","default":40,"min":20,"max":80}],"nodes":[{"id":"body","type":"box","width":{"parameter":"width"},"depth":20,"height":20},{"id":"finished","type":"fillet","input":"body","radius":2,"selector":{"kind":"parallelToAxis","axis":"z"}},{"id":"hole","type":"cylinder","radius":4,"height":30},{"id":"holeAt","type":"transform","input":"hole","translate":[20,10,-5]},{"id":"cut","type":"subtract","base":"finished","tools":["holeAt"]}],"resultNodeId":"cut"},"parameterValues":{"width":50}}
JSON

"$RUNNER" --input "$WORKSPACE/request.json" --output "$WORKSPACE/output"
for artifact in \
  model.step \
  brepia-footprint.step \
  brepia-clearance-envelope.step \
  brepia-maintenance-envelope.step; do
  grep -q 'ISO-10303-21' "$WORKSPACE/output/$artifact"
done
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/output/model.3dm"
node -e "const r=require('$WORKSPACE/output/result.json'); const p=r.projectObject; if(r.status!=='success'||r.resultNodeId!=='cut'||r.bodies?.length!==1||!r.bodies[0]?.viewerMesh?.indices?.length||p?.geometry?.footprint?.id!=='body'||p?.geometry?.clearanceEnvelope?.id!=='finished'||p?.geometry?.maintenanceEnvelope?.id!=='body'||p?.points?.[0]?.position?.[0]!==50||p?.placement?.zAxis?.[2]!==1) process.exit(1); console.log(JSON.stringify({result:r.resultNodeId,triangles:r.bodies[0].viewerMesh.indices.length/3,roles:Object.keys(p.geometry),point:p.points[0],artifacts:['model.step','brepia-footprint.step','brepia-clearance-envelope.step','brepia-maintenance-envelope.step','model.3dm']}));"

run_boolean_success() {
  local kind="$1"
  local request_path="$WORKSPACE/${kind}.json"
  local output_path="$WORKSPACE/${kind}-output"
  cat > "$request_path" <<JSON
{"project":{"schemaVersion":1,"id":"${kind}Smoke","name":"${kind} smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"outer","type":"box","width":20,"depth":20,"height":20},{"id":"inner","type":"box","width":10,"depth":10,"height":10},{"id":"booleanResult","type":"${kind}","inputs":["outer","inner"]}],"resultNodeId":"booleanResult"},"parameterValues":{}}
JSON
  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  node -e "const r=require('$output_path/result.json'); if(r.status!=='success'||r.resultNodeId!=='booleanResult'||r.bodies?.length!==1||!r.bodies[0]?.viewerMesh?.indices?.length) process.exit(1); console.log(JSON.stringify({boolean:'$kind',result:r.resultNodeId,triangles:r.bodies[0].viewerMesh.indices.length/3}));"
}

run_boolean_fail_closed() {
  local kind="$1"
  local request_path="$WORKSPACE/${kind}-disjoint.json"
  local output_path="$WORKSPACE/${kind}-disjoint-output"
  local error_path="$WORKSPACE/${kind}-disjoint.err"
  cat > "$request_path" <<JSON
{"project":{"schemaVersion":1,"id":"${kind}Disjoint","name":"${kind} disjoint","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"left","type":"box","width":10,"depth":10,"height":10},{"id":"right","type":"box","width":10,"depth":10,"height":10},{"id":"rightAt","type":"transform","input":"right","translate":[40,0,0]},{"id":"booleanResult","type":"${kind}","inputs":["left","rightAt"]}],"resultNodeId":"booleanResult"},"parameterValues":{}}
JSON
  if "$RUNNER" --input "$request_path" --output "$output_path" 2>"$error_path"; then
    echo "Expected disjoint ${kind} to fail closed" >&2
    exit 1
  fi
  grep -q 'unsupported_result_cardinality' "$error_path"
}

run_mirror_success() {
  local axis="$1"
  local expected_min_x="$2"
  local expected_max_x="$3"
  local expected_min_y="$4"
  local expected_max_y="$5"
  local expected_min_z="$6"
  local expected_max_z="$7"
  local request_path="$WORKSPACE/mirror-${axis}.json"
  local output_path="$WORKSPACE/mirror-${axis}-output"
  cat > "$request_path" <<JSON
{"project":{"schemaVersion":1,"id":"mirror${axis}Smoke","name":"Mirror ${axis} smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"planeOffset","label":"Plane offset","type":"number","unit":"mm","default":0,"min":-20,"max":20}],"nodes":[{"id":"body","type":"box","width":20,"depth":10,"height":6},{"id":"moved","type":"transform","input":"body","translate":[30,30,30]},{"id":"mirrored","type":"mirror","input":"moved","normalAxis":"${axis}","offset":{"parameter":"planeOffset"}}],"resultNodeId":"mirrored"},"parameterValues":{"planeOffset":5}}
JSON
  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  grep -a -q '^3D Geometry File Format ' "$output_path/model.3dm"
  node -e "const r=require('$output_path/result.json'); const b=r.bodies?.[0]; const near=(a,b)=>Math.abs(a-b)<1e-6; const e={min:[$expected_min_x,$expected_min_y,$expected_min_z],max:[$expected_max_x,$expected_max_y,$expected_max_z]}; if(r.status!=='success'||r.resultNodeId!=='mirrored'||r.bodies?.length!==1||!b?.viewerMesh?.indices?.length||!b.bounds.min.every((v,i)=>near(v,e.min[i]))||!b.bounds.max.every((v,i)=>near(v,e.max[i]))) process.exit(1); console.log(JSON.stringify({mirror:'$axis',offset:5,result:r.resultNodeId,bounds:b.bounds,triangles:b.viewerMesh.indices.length/3}));"
}

run_linear_pattern_result() {
  local request_path="$WORKSPACE/linear-pattern-result.json"
  local output_path="$WORKSPACE/linear-pattern-result-output"
  cat > "$request_path" <<'JSON'
{"project":{"schemaVersion":1,"id":"linearPatternResultSmoke","name":"Linear pattern result smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"pitch","label":"Pitch","type":"number","unit":"mm","default":20,"min":5,"max":40}],"nodes":[{"id":"body","type":"box","width":10,"depth":10,"height":10},{"id":"pattern","type":"linearPattern","input":"body","axis":"x","count":3,"spacing":{"parameter":"pitch"}}],"resultNodeId":"pattern"},"parameterValues":{"pitch":20}}
JSON
  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  grep -a -q '^3D Geometry File Format ' "$output_path/model.3dm"
  node -e "const r=require('$output_path/result.json'); const b=r.bodies; const near=(a,b)=>Math.abs(a-b)<1e-6; if(r.status!=='success'||r.resultNodeId!=='pattern'||r.resultKind!=='instanceSet'||b?.length!==3||r.exactExport?.available!==true) process.exit(1); for(let i=0;i<3;i++){if(b[i]?.id!==('pattern::'+i)||b[i]?.nodeId!=='pattern'||b[i]?.instance?.index!==i||b[i]?.instance?.sourceNodeId!=='body'||!b[i]?.viewerMesh?.indices?.length) process.exit(1);} for(let i=1;i<3;i++){if(!near(b[i].bounds.min[0]-b[i-1].bounds.min[0],20)||!near(b[i].bounds.max[0]-b[i-1].bounds.max[0],20)) process.exit(1); for(const axis of [1,2]) if(!near(b[i].bounds.min[axis],b[0].bounds.min[axis])||!near(b[i].bounds.max[axis],b[0].bounds.max[axis])) process.exit(1);} if(!near(r.bounds.min[0],b[0].bounds.min[0])||!near(r.bounds.max[0],b[2].bounds.max[0])) process.exit(1); console.log(JSON.stringify({pattern:r.resultNodeId,resultKind:r.resultKind,bodies:b.map(x=>({id:x.id,index:x.instance.index,bounds:x.bounds})),aggregateBounds:r.bounds,exactStep:r.exactExport.available}));"
}

run_linear_pattern_subtract_tool() {
  local request_path="$WORKSPACE/linear-pattern-subtract.json"
  local output_path="$WORKSPACE/linear-pattern-subtract-output"
  cat > "$request_path" <<'JSON'
{"project":{"schemaVersion":1,"id":"linearPatternSubtractSmoke","name":"Linear pattern subtract smoke","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"pitch","label":"Pitch","type":"number","unit":"mm","default":12,"min":8,"max":16}],"nodes":[{"id":"plate","type":"box","width":100,"depth":30,"height":20},{"id":"cutter","type":"cylinder","radius":3,"height":40},{"id":"cutters","type":"linearPattern","input":"cutter","axis":"x","count":4,"spacing":{"parameter":"pitch"}},{"id":"cut","type":"subtract","base":"plate","tools":["cutters"]}],"resultNodeId":"cut"},"parameterValues":{"pitch":12}}
JSON
  "$RUNNER" --input "$request_path" --output "$output_path"
  grep -q 'ISO-10303-21' "$output_path/model.step"
  grep -a -q '^3D Geometry File Format ' "$output_path/model.3dm"
  node -e "const r=require('$output_path/result.json'); const b=r.bodies?.[0]; if(r.status!=='success'||r.resultNodeId!=='cut'||r.resultKind!=='single'||r.bodies?.length!==1||b?.id!=='cut'||b?.instance!=null||!b?.viewerMesh?.indices?.length||r.exactExport?.available!==true) process.exit(1); console.log(JSON.stringify({patternTool:'cutters',count:4,result:r.resultNodeId,resultKind:r.resultKind,triangles:b.viewerMesh.indices.length/3,exactStep:r.exactExport.available}));"
}

run_boolean_success union
run_boolean_success intersect
run_boolean_fail_closed union
run_boolean_fail_closed intersect
run_mirror_success x -30 -10 25 35 27 33
run_mirror_success y 20 40 -25 -15 27 33
run_mirror_success z 20 40 25 35 -23 -17
run_linear_pattern_result
run_linear_pattern_subtract_tool
