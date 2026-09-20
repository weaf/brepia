#!/usr/bin/env bash
set -euo pipefail

operation="${1:?operation required}"
target="${2:?target directory required}"
cd "$target"

echo "=== Dquark Brepia runner ==="
echo "operation=$operation"
echo "repo=$(pwd)"
echo "head=$(git rev-parse HEAD)"
echo "branch=$(git branch --show-current || true)"
echo "node=$(node --version 2>/dev/null || echo unavailable)"
echo "npm=$(npm --version 2>/dev/null || echo unavailable)"
echo

case "$operation" in
  reconcile)
    git status --short --branch
    echo
    git --no-pager log -5 --oneline --decorate
    echo
    node -e 'const p=require("./package.json"); for (const k of ["lint","typecheck","test","build","test:brep-gap-audit"]) if (p.scripts?.[k]) console.log(k+"="+p.scripts[k])'
    ;;
  quality)
    npm ci
    npm run lint
    npm run typecheck
    npm test
    npm run build
    git diff --check
    ;;
  gap-audit)
    npm ci
    npm run test:brep-gap-audit
    git diff --check
    ;;
  *)
    echo "Rejected unsupported operation: $operation" >&2
    exit 64
    ;;
esac
