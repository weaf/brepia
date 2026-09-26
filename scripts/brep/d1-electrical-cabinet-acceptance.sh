#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RUNNER="${PCAD_BREP_RUNNER:-$SCRIPT_DIR/pcad-brep-sandbox}"
PODMAN_BIN="${PCAD_PODMAN_BIN:-podman}"
IMAGE="${PCAD_BREP_IMAGE:-localhost/brepia-brep:build123d-0.11.1}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/brepia-d1-cabinet.XXXXXX")"
trap 'rm -rf "$WORKSPACE"' EXIT

node - "$ROOT_DIR/shared/productTemplates/electricalCabinetV1.json" "$WORKSPACE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [sourcePath, workspace] = process.argv.slice(2);
const project = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const defaults = Object.fromEntries(
  project.parameters.map((parameter) => [parameter.id, parameter.default]),
);

for (const angle of [0, 90]) {
  fs.writeFileSync(
    path.join(workspace, 'request-' + angle + '.json'),
    JSON.stringify({
      project,
      parameterValues: { ...defaults, doorOpenAngleDeg: angle },
    }),
  );
}
NODE

for angle in 0 90; do
  "$RUNNER"     --input "$WORKSPACE/request-$angle.json"     --output "$WORKSPACE/output-$angle"
  grep -q 'ISO-10303-21' "$WORKSPACE/output-$angle/model.step"
done

node - "$WORKSPACE" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const workspace = process.argv[2];
const rows = [];

for (const angle of [0, 90]) {
  const result = JSON.parse(
    fs.readFileSync(path.join(workspace, 'output-' + angle + '/result.json'), 'utf8'),
  );
  if (result.status !== 'success') {
    throw new Error('expected native success at ' + angle + ' degrees');
  }
  if (result.resultKind !== 'single' || result.bodies?.length !== 1) {
    throw new Error('expected exactly one native body at ' + angle + ' degrees');
  }
  if (result.resultNodeId !== 'cabinet') {
    throw new Error('unexpected result node at ' + angle + ' degrees');
  }
  if (!Array.isArray(result.warnings) || result.warnings.length !== 0) {
    throw new Error('expected zero native warnings at ' + angle + ' degrees');
  }
  if (result.exactExport?.available !== true) {
    throw new Error('expected exact STEP at ' + angle + ' degrees');
  }

  const stepPath = path.join(workspace, 'output-' + angle + '/model.step');
  const step = fs.readFileSync(stepPath);
  rows.push({
    angle,
    bounds: result.bounds,
    stepBytes: step.length,
    stepSha256: crypto.createHash('sha256').update(step).digest('hex'),
  });
}

const closed = rows[0];
const open = rows[1];
if (JSON.stringify(closed.bounds) === JSON.stringify(open.bounds)) {
  throw new Error('0 and 90 degree aggregate bounds must differ');
}
if (open.bounds.max[1] <= closed.bounds.max[1] + 500) {
  throw new Error(
    '90 degree door must materially extend outward: closed=' +
      closed.bounds.max[1] +
      ', open=' +
      open.bounds.max[1],
  );
}
if (closed.stepSha256 === open.stepSha256) {
  throw new Error('0 and 90 degree STEP digests must differ');
}

fs.writeFileSync(
  path.join(workspace, 'native-evidence.json'),
  JSON.stringify(rows, null, 2),
);
console.log(JSON.stringify(rows, null, 2));
NODE

cat > "$WORKSPACE/verify-step.py" <<'PY'
import json
import sys
from importlib.metadata import version
from build123d import import_step

workspace = sys.argv[1]
build123d_version = version("build123d")
ocp_version = version("cadquery-ocp-novtk")
if build123d_version != "0.11.1" or ocp_version != "7.9.3.1.1":
    raise SystemExit(
        f"unexpected pinned CAD runtime build123d={build123d_version} cadquery-ocp-novtk={ocp_version}"
    )

with open(f"{workspace}/native-evidence.json", encoding="utf-8") as handle:
    evidence = {row["angle"]: row for row in json.load(handle)}

summary = []
for angle in (0, 90):
    shape = import_step(f"{workspace}/output-{angle}/model.step")
    solids = list(shape.solids())
    if len(solids) != 1:
        raise SystemExit(
            f"expected exactly one imported solid at {angle} degrees, got {len(solids)}"
        )
    solid = solids[0]
    if solid.volume <= 0:
        raise SystemExit(
            f"expected positive imported volume at {angle} degrees, got {solid.volume}"
        )
    box = solid.bounding_box()
    actual = (
        box.min.X,
        box.min.Y,
        box.min.Z,
        box.max.X,
        box.max.Y,
        box.max.Z,
    )
    expected_bounds = evidence[angle]["bounds"]
    expected = tuple(expected_bounds["min"] + expected_bounds["max"])
    if any(abs(a - e) > 1e-5 for a, e in zip(actual, expected)):
        raise SystemExit(
            f"STEP/native bounds mismatch at {angle} degrees: actual={actual} expected={expected}"
        )
    summary.append(
        {
            "angle": angle,
            "solids": len(solids),
            "volume": solid.volume,
            "bounds": actual,
        }
    )

print(
    {
        "build123d": build123d_version,
        "cadqueryOcpNovtk": ocp_version,
        "reimports": summary,
    }
)
PY

command -v "$PODMAN_BIN" >/dev/null 2>&1 || {
  echo "BREP_SANDBOX_UNAVAILABLE: Podman executable not found" >&2
  exit 69
}
"$PODMAN_BIN" image exists "$IMAGE" >/dev/null 2>&1 || {
  echo "BREP_SANDBOX_UNAVAILABLE: sandbox image is not built" >&2
  exit 69
}
"$PODMAN_BIN" run --rm --pull=never   --network=none --read-only --security-opt=no-new-privileges --cap-drop=all   --pids-limit=64 --memory=768m --cpus=1 --userns=keep-id --user "$(id -u):$(id -g)"   --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777"   --volume "$WORKSPACE:/workspace:ro"   --env HOME=/tmp --entrypoint=/opt/brepia-brep-venv/bin/python   "$IMAGE" /workspace/verify-step.py /workspace

echo "D1_ELECTRICAL_CABINET_ACCEPTANCE_PASS"
