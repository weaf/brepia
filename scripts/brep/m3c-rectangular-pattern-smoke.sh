#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-m3c-rectangular.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

cat > "$WORKSPACE/result.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3cRectangularResult","name":"M3C rectangular pattern result","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[{"id":"pitchA","label":"Pitch A","type":"number","unit":"mm","default":20},{"id":"pitchBaseB","label":"Pitch base B","type":"number","unit":"mm","default":25}],"nodes":[{"id":"body","type":"box","width":10,"depth":10,"height":10},{"id":"pattern","type":"rectangularPattern","input":"body","axisA":"x","axisB":"y","countA":2,"countB":3,"spacingA":{"parameter":"pitchA"},"spacingB":{"op":"add","args":[{"parameter":"pitchBaseB"},5]}}],"resultNodeId":"pattern"},"parameterValues":{"pitchA":20,"pitchBaseB":25}}
JSON

"$RUNNER" --input "$WORKSPACE/result.json" --output "$WORKSPACE/result-output"
grep -q 'ISO-10303-21' "$WORKSPACE/result-output/model.step"
grep -a -q '^3D Geometry File Format ' "$WORKSPACE/result-output/model.3dm"
node -e "const r=require('$WORKSPACE/result-output/result.json'); const b=r.bodies; const expected=[[0,0],[0,30],[0,60],[20,0],[20,30],[20,60]]; const near=(a,b)=>Math.abs(a-b)<1e-6; if(r.status!=='success'||r.resultNodeId!=='pattern'||r.resultKind!=='instanceSet'||b?.length!==6||r.exactExport?.available!==true) process.exit(1); for(let i=0;i<expected.length;i++){if(b[i]?.id!==('pattern::'+i)||b[i]?.nodeId!=='pattern'||b[i]?.instance?.index!==i||b[i]?.instance?.sourceNodeId!=='body'||!b[i]?.viewerMesh?.indices?.length) process.exit(1); const [x,y]=expected[i]; if(!near((b[i].bounds.min[0]-b[0].bounds.min[0]),x)||!near((b[i].bounds.min[1]-b[0].bounds.min[1]),y)||!near(b[i].bounds.min[2],b[0].bounds.min[2])) process.exit(1);} console.log(JSON.stringify({result:r.resultNodeId,resultKind:r.resultKind,ids:b.map(x=>x.id),offsets:expected,exactStep:r.exactExport.available}));"

cat > "$WORKSPACE/subtract.json" <<'JSON'
{"project":{"schemaVersion":1,"id":"m3cRectangularSubtract","name":"M3C rectangular subtract","units":"mm","placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0]},"parameters":[],"nodes":[{"id":"base","type":"box","width":100,"depth":100,"height":20},{"id":"cutter","type":"cylinder","radius":3,"height":40},{"id":"cutters","type":"rectangularPattern","input":"cutter","axisA":"x","axisB":"y","countA":2,"countB":2,"spacingA":20,"spacingB":25},{"id":"singleTool","type":"cylinder","radius":2,"height":40},{"id":"singleToolAt","type":"transform","input":"singleTool","translate":[-20,-20,0]},{"id":"cut","type":"subtract","base":"base","tools":["singleToolAt","cutters"]}],"resultNodeId":"cut"},"parameterValues":{}}
JSON

"$RUNNER" --input "$WORKSPACE/subtract.json" --output "$WORKSPACE/subtract-output"
grep -q 'ISO-10303-21' "$WORKSPACE/subtract-output/model.step"
node -e "const r=require('$WORKSPACE/subtract-output/result.json'); const b=r.bodies?.[0]; if(r.status!=='success'||r.resultNodeId!=='cut'||r.resultKind!=='single'||r.bodies?.length!==1||b?.id!=='cut'||!b?.viewerMesh?.indices?.length||r.exactExport?.available!==true) process.exit(1); console.log(JSON.stringify({result:r.resultNodeId,resultKind:r.resultKind,orderedTools:['singleToolAt','cutters'],exactStep:r.exactExport.available}));"
