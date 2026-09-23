#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${BREPIA_STABLE_TEST_PORT:-4174}"
ARTIFACT_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/brepia-stable-regression.XXXXXX")"
PREVIEW_LOG="${ARTIFACT_ROOT}/preview.log"
PREVIEW_PID=""

cleanup() {
  if [ -n "${PREVIEW_PID}" ] && kill -0 "${PREVIEW_PID}" 2>/dev/null; then
    kill "${PREVIEW_PID}" 2>/dev/null || true
    wait "${PREVIEW_PID}" 2>/dev/null || true
  fi
  rm -rf -- "${ARTIFACT_ROOT}"
}
trap cleanup EXIT INT TERM

node --input-type=module - "${PORT}" <<'NODE'
import net from 'node:net';
const port = Number(process.argv[2]);
const server = net.createServer();
server.once('error', (error) => {
  console.error(`stable artifact regression port ${port} unavailable: ${error.message}`);
  process.exit(1);
});
server.listen({host:'127.0.0.1', port, exclusive:true}, () => server.close());
NODE

export PCAD_STABLE_ARTIFACT_DIR="${ARTIFACT_ROOT}/artifact"
npm run build

test -d "${PCAD_STABLE_ARTIFACT_DIR}/nitro/public"
test -d "${PCAD_STABLE_ARTIFACT_DIR}/nitro/server"
test -f "${PCAD_STABLE_ARTIFACT_DIR}/nitro/nitro.json"

artifact_hash() {
  find "${PCAD_STABLE_ARTIFACT_DIR}" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
}

BEFORE_HASH="$(artifact_hash)"

npm run preview -- --host 127.0.0.1 --port "${PORT}" --strictPort >"${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

READY=0
for _ in $(seq 1 80); do
  if curl -sf -m 2 "http://127.0.0.1:${PORT}/signin" >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "${PREVIEW_PID}" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

if [ "${READY}" -ne 1 ]; then
  echo "isolated preview failed to become ready" >&2
  cat "${PREVIEW_LOG}" >&2 || true
  exit 1
fi

(
  unset PCAD_STABLE_ARTIFACT_DIR
  npm run build
)

curl -sf -m 5 "http://127.0.0.1:${PORT}/signin" >/dev/null
AFTER_HASH="$(artifact_hash)"

if [ "${BEFORE_HASH}" != "${AFTER_HASH}" ]; then
  echo "stable artifact changed during unrelated worktree build" >&2
  exit 1
fi

echo "stable artifact isolation: PASS"
echo "artifact_sha256=${AFTER_HASH}"
