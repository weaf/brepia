#!/usr/bin/env bash
set -euo pipefail

PCAD_MESH_HOME="${PCAD_MESH_HOME:-$HOME/.local/share/pcad-mesh}"
TRELLIS_ENV="$PCAD_MESH_HOME/envs/trellis"
PYTHON="$TRELLIS_ENV/bin/python"

say() { printf '\n\033[1;34m[pCAD TRELLIS]\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m[pCAD TRELLIS error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -x "$PYTHON" ]] || die "TRELLIS environment not found at $TRELLIS_ENV"

read -r TORCH_VERSION TORCH_CUDA < <(
  "$PYTHON" - <<'PY'
import torch
print(torch.__version__, torch.version.cuda or "")
PY
)

[[ "$TORCH_CUDA" == "12.1" ]] || \
  die "Expected TRELLIS PyTorch CUDA 12.1, got torch=$TORCH_VERSION cuda=$TORCH_CUDA"

say "TRELLIS PyTorch: $TORCH_VERSION (CUDA $TORCH_CUDA)"

# TRELLIS upstream setup.sh compares torch.__version__ to bare values such as
# 2.4.0. Official PyTorch CUDA wheels report 2.4.0+cu121, so the upstream
# --xformers/--kaolin branches can silently print 'unsupported' and continue
# successfully without installing either package. Install their matching
# wheels explicitly and use --no-deps so our pinned torch/cu121 stack cannot be
# replaced by pip dependency resolution.
say "Installing xformers for torch 2.4 / cu121"
"$PYTHON" -m pip install --no-deps \
  xformers==0.0.27.post2 \
  --index-url https://download.pytorch.org/whl/cu121

say "Installing NVIDIA Kaolin for torch 2.4 / cu121"
"$PYTHON" -m pip install --no-deps \
  kaolin \
  -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html

say "Verifying TRELLIS runtime imports"
"$PYTHON" - <<'PY'
import importlib.metadata as metadata
import torch
import xformers
import kaolin

assert torch.version.cuda == "12.1", torch.version.cuda
print("torch:", torch.__version__)
print("torch CUDA:", torch.version.cuda)
print("xformers:", metadata.version("xformers"))
print("kaolin:", metadata.version("kaolin"))
print("TRELLIS runtime dependencies: OK")
PY
