#!/usr/bin/env bash
set -euo pipefail

PCAD_MESH_HOME="${PCAD_MESH_HOME:-$HOME/.local/share/pcad-mesh}"
TRELLIS_ENV="$PCAD_MESH_HOME/envs/trellis"
PYTHON="$TRELLIS_ENV/bin/python"
TRELLIS_CC="$TRELLIS_ENV/bin/x86_64-conda-linux-gnu-cc"
TRELLIS_CXX="$TRELLIS_ENV/bin/x86_64-conda-linux-gnu-c++"

say() { printf '\n\033[1;34m[pCAD TRELLIS]\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m[pCAD TRELLIS error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -x "$PYTHON" ]] || die "TRELLIS environment not found at $TRELLIS_ENV"
[[ -x "$TRELLIS_ENV/bin/nvcc" ]] || die "TRELLIS CUDA compiler not found at $TRELLIS_ENV/bin/nvcc"
[[ -x "$TRELLIS_CC" ]] || die "TRELLIS C compiler not found at $TRELLIS_CC"
[[ -x "$TRELLIS_CXX" ]] || die "TRELLIS C++ compiler not found at $TRELLIS_CXX"

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
  kaolin==0.18.0 \
  -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html

# Kaolin 0.18.0 declares warp-lang, usd-core and pygltflib as normal runtime
# dependencies. We install Kaolin itself with --no-deps to protect the pinned
# torch/CUDA environment, so add the runtime pieces TRELLIS actually reaches
# explicitly. The Jupyter visualization requirements are intentionally omitted.
say "Installing Kaolin/TRELLIS runtime dependencies"
"$PYTHON" -m pip install \
  warp-lang==1.8.1 \
  usd-core \
  pygltflib

# TRELLIS post-processing imports nvdiffrast while converting generated output
# to GLB. Upstream installs it from source. Build it explicitly in the managed
# CUDA 12.1/GCC 12 environment so a partially successful upstream setup cannot
# leave text/image inference working but GLB export broken at runtime.
say "Installing nvdiffrast for TRELLIS GLB post-processing"
"$PYTHON" -m pip install -U setuptools wheel ninja
CUDA_HOME="$TRELLIS_ENV" \
CUDACXX="$TRELLIS_ENV/bin/nvcc" \
CUDAHOSTCXX="$TRELLIS_CXX" \
CC="$TRELLIS_CC" \
CXX="$TRELLIS_CXX" \
PATH="$TRELLIS_ENV/bin:$PATH" \
  "$PYTHON" -m pip install --no-build-isolation \
  git+https://github.com/NVlabs/nvdiffrast.git

say "Verifying TRELLIS runtime imports"
PYTHONWARNINGS=ignore "$PYTHON" - <<'PY'
import importlib.metadata as metadata
import torch
import xformers
import warp
import pygltflib
import nvdiffrast.torch as dr
from pxr import Usd
import kaolin

assert torch.version.cuda == "12.1", torch.version.cuda
assert dr is not None
print("torch:", torch.__version__)
print("torch CUDA:", torch.version.cuda)
print("xformers:", metadata.version("xformers"))
print("kaolin:", metadata.version("kaolin"))
print("warp-lang:", metadata.version("warp-lang"))
print("usd-core:", metadata.version("usd-core"))
print("pygltflib:", metadata.version("pygltflib"))
print("nvdiffrast: import OK")
print("TRELLIS runtime dependencies: OK")
PY
