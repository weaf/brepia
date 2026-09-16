#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_path="${1:-/tmp/brepia-g2-context-${timestamp}.jsonl}"
preload_path="${repo_root}/scripts/brep-g2-context-capture.cjs"

mkdir -p "$(dirname "${evidence_path}")"
: > "${evidence_path}"

export PCAD_G2_CONTEXT_EVIDENCE_JSONL="${evidence_path}"
if [[ -n "${NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS} --require=${preload_path}"
else
  export NODE_OPTIONS="--require=${preload_path}"
fi

echo "Phase G2 bounded context evidence capture enabled."
echo "Evidence: ${evidence_path}"
echo "Start one representative Native BRep generation with OpenCode Streaming."
echo "After the run, analyze with:"
echo "  node scripts/analyze-brep-g2-context.mjs '${evidence_path}'"
echo

cd "${repo_root}"
exec ./start.sh
