#!/usr/bin/env bash
set -euo pipefail

# pCAD local Creative backend installer.
#
# Installs four isolated local 3D inference environments plus the lightweight
# gateway that swaps one GPU worker at a time:
#   - TRELLIS v1
#   - Hunyuan3D-2
#   - Hunyuan3D-2.1 (shape pipeline; 24 GB-safe)
#   - Stable Fast 3D (Hugging Face gated)
#
# The gateway also coordinates with llama-swap by default: before starting a
# local 3D worker it unloads resident llama-swap models, then stops the 3D
# worker after generation so the next LLM request can load normally.
#
# Each environment is versioned with a pCAD bootstrap spec. An environment is
# marked ready only after its complete install succeeds. Missing/stale markers
# cause that environment to be deleted and recreated, preventing partially
# installed Python/CUDA stacks from being reused after a failed bootstrap.
#
# Default install root: ~/.local/share/pcad-mesh
# No sudo is used unless --install-system-deps is explicitly supplied.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PCAD_MESH_HOME="${PCAD_MESH_HOME:-$HOME/.local/share/pcad-mesh}"
INSTALL_SYSTEM_DEPS=0
DOWNLOAD_WEIGHTS=1
ENABLE_SERVICE=1
RECREATE_ENVS=0

# Bump an individual spec whenever its Python/CUDA/dependency bootstrap changes.
# Old or partial environments are then recreated automatically on the next run.
GATEWAY_ENV_SPEC="pcad-gateway-py310-v2"
HUNYUAN2_ENV_SPEC="hunyuan3d2-py310-torch251-cu124-v2"
HUNYUAN21_ENV_SPEC="hunyuan3d21-py310-torch251-cu124-bpy400-v4"
TRELLIS_ENV_SPEC="trellis-py310-torch240-cu121-v2"
SF3D_ENV_SPEC="sf3d-py310-torch240-cu121-v2"

usage() {
  cat <<'EOF'
Usage: ./scripts/install-local-mesh-backends.sh [options]

Options:
  --install-system-deps  Install common Ubuntu/Debian build packages with sudo apt.
  --skip-weights         Install code/environments but do not prefetch model weights.
  --no-service           Do not install/enable the user systemd gateway service.
  --recreate-envs        Force recreation of all five managed Python environments.
  -h, --help             Show this help.

Environment variables:
  PCAD_MESH_HOME                 Install root (default ~/.local/share/pcad-mesh)
  HF_TOKEN                       Hugging Face read token. Required for Stable Fast 3D weights.
  HF_HOME                        Optional HF cache override; default is under PCAD_MESH_HOME.
  PCAD_GPU_ARBITRATION           auto (default), required, or off.
  PCAD_LLAMA_SWAP_URL            llama-swap base URL (default http://127.0.0.1:9292).
  PCAD_LLAMA_SWAP_API_KEY        Optional bearer token for llama-swap.
  PCAD_LLAMA_SWAP_UNLOAD_TIMEOUT Seconds to wait for VRAM release (default 90).
  PCAD_MESH_KEEP_WARM            Keep a 3D worker resident after generation (default false).

The script is safe to re-run. Repository checkouts and the shared Hugging Face
cache are preserved. Managed Python environments are reused only when their
completed pCAD bootstrap spec matches the current installer.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-system-deps) INSTALL_SYSTEM_DEPS=1 ;;
    --skip-weights) DOWNLOAD_WEIGHTS=0 ;;
    --no-service) ENABLE_SERVICE=0 ;;
    --recreate-envs) RECREATE_ENVS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

BIN_DIR="$PCAD_MESH_HOME/bin"
REPOS_DIR="$PCAD_MESH_HOME/repos"
ENVS_DIR="$PCAD_MESH_HOME/envs"
RUNTIME_DIR="$PCAD_MESH_HOME/runtime"
LOGS_DIR="$PCAD_MESH_HOME/logs"
CONFIG_DIR="$PCAD_MESH_HOME/config"
STATE_DIR="$PCAD_MESH_HOME/state"
export HF_HOME="${HF_HOME:-$PCAD_MESH_HOME/cache/huggingface}"
MAMBA_ROOT_PREFIX="$PCAD_MESH_HOME/micromamba"
MAMBA="$BIN_DIR/micromamba"

mkdir -p "$BIN_DIR" "$REPOS_DIR" "$ENVS_DIR" "$RUNTIME_DIR" \
  "$LOGS_DIR" "$CONFIG_DIR" "$STATE_DIR" "$HF_HOME"

say() { printf '\n\033[1;34m[pCAD mesh]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[pCAD mesh warning]\033[0m %s\n' "$*" >&2; }
die() { printf '\n\033[1;31m[pCAD mesh error]\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "$(uname -s)" != "Linux" ]]; then
  die "This one-step installer currently targets Linux."
fi
if [[ "$(uname -m)" != "x86_64" ]]; then
  die "This installer currently targets Linux x86_64 NVIDIA systems."
fi

if [[ $INSTALL_SYSTEM_DEPS -eq 1 ]]; then
  command -v apt-get >/dev/null 2>&1 || die "--install-system-deps currently supports apt-based systems only."
  say "Installing common build dependencies"
  sudo apt-get update
  sudo apt-get install -y \
    git curl wget ca-certificates tar bzip2 build-essential cmake ninja-build \
    pkg-config python3-dev ffmpeg libgl1 libglib2.0-0
fi

for command_name in git curl tar bzip2; do
  command -v "$command_name" >/dev/null 2>&1 || \
    die "Missing $command_name. On Ubuntu rerun with --install-system-deps."
done

if ! command -v nvidia-smi >/dev/null 2>&1; then
  die "nvidia-smi is not available. Install/repair the NVIDIA driver before installing GPU backends."
fi
say "Detected NVIDIA GPU"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader || true

install_micromamba() {
  if [[ -x "$MAMBA" ]]; then
    return
  fi
  say "Installing private micromamba runtime"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp:-}"' RETURN
  curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest \
    | tar -xj -C "$tmp" bin/micromamba
  install -m 0755 "$tmp/bin/micromamba" "$MAMBA"
  rm -rf "$tmp"
  trap - RETURN
}
install_micromamba
export MAMBA_ROOT_PREFIX

mamba_run() {
  local env_path="$1"
  shift
  "$MAMBA" run -p "$env_path" "$@"
}

assert_managed_env_path() {
  local env_path="$1"
  case "$env_path" in
    "$ENVS_DIR"/*) ;;
    *) die "Refusing to manage environment outside $ENVS_DIR: $env_path" ;;
  esac
  [[ "$env_path" != "$ENVS_DIR" ]] || die "Refusing to remove the environment root"
}

env_marker() {
  printf '%s/.pcad-env-spec\n' "$1"
}

prepare_env() {
  local env_path="$1"
  local expected_spec="$2"
  local marker
  local current_spec=""
  marker="$(env_marker "$env_path")"
  assert_managed_env_path "$env_path"

  if [[ -f "$marker" ]]; then
    current_spec="$(cat "$marker")"
  fi

  if [[ $RECREATE_ENVS -eq 1 && -d "$env_path" ]]; then
    say "Recreating $(basename "$env_path") environment (--recreate-envs)"
    rm -rf -- "$env_path"
    return
  fi

  if [[ -d "$env_path" && "$current_spec" != "$expected_spec" ]]; then
    if [[ -n "$current_spec" ]]; then
      say "Recreating $(basename "$env_path") environment (spec changed: $current_spec -> $expected_spec)"
    else
      say "Recreating $(basename "$env_path") environment (legacy or incomplete install)"
    fi
    rm -rf -- "$env_path"
  fi
}

mark_env_ready() {
  local env_path="$1"
  local expected_spec="$2"
  local marker
  marker="$(env_marker "$env_path")"
  printf '%s\n' "$expected_spec" > "$marker"
}

ensure_basic_env() {
  local env_path="$1"
  if [[ ! -x "$env_path/bin/python" ]]; then
    "$MAMBA" create -y -p "$env_path" -c conda-forge python=3.10 pip
  fi
}

ensure_cuda121_torch24_env() {
  local env_path="$1"
  if [[ ! -x "$env_path/bin/python" ]]; then
    "$MAMBA" create -y -p "$env_path" \
      -c pytorch -c nvidia -c conda-forge \
      python=3.10 pip pytorch=2.4.0 torchvision=0.19.0 \
      pytorch-cuda=12.1 cuda-toolkit=12.1
  fi
}

clone_or_update() {
  local url="$1"
  local destination="$2"
  local recurse="${3:-0}"
  if [[ -d "$destination/.git" ]]; then
    say "Updating $(basename "$destination")"
    git -C "$destination" fetch --prune origin
    git -C "$destination" pull --ff-only || \
      warn "Could not fast-forward $destination; keeping the existing checkout."
    if [[ "$recurse" == "1" ]]; then
      git -C "$destination" submodule update --init --recursive
    fi
    return
  fi
  say "Cloning $(basename "$destination")"
  if [[ "$recurse" == "1" ]]; then
    git clone --recurse-submodules "$url" "$destination"
  else
    git clone "$url" "$destination"
  fi
}

GATEWAY_ENV="$ENVS_DIR/gateway"
TRELLIS_ENV="$ENVS_DIR/trellis"
HUNYUAN2_ENV="$ENVS_DIR/hunyuan3d-2"
HUNYUAN21_ENV="$ENVS_DIR/hunyuan3d-2.1"
SF3D_ENV="$ENVS_DIR/stable-fast-3d"

TRELLIS_REPO="$REPOS_DIR/TRELLIS"
HUNYUAN2_REPO="$REPOS_DIR/Hunyuan3D-2"
HUNYUAN21_REPO="$REPOS_DIR/Hunyuan3D-2.1"
SF3D_REPO="$REPOS_DIR/stable-fast-3d"

# A previous successful install may have an active user service. Stop it before
# replacing its Python environment/runtime, then re-enable it at the end.
if command -v systemctl >/dev/null 2>&1 && systemctl --user is-active --quiet pcad-mesh-gateway.service 2>/dev/null; then
  say "Stopping existing pCAD mesh gateway during environment maintenance"
  systemctl --user stop pcad-mesh-gateway.service
fi

prepare_env "$GATEWAY_ENV" "$GATEWAY_ENV_SPEC"
prepare_env "$HUNYUAN2_ENV" "$HUNYUAN2_ENV_SPEC"
prepare_env "$HUNYUAN21_ENV" "$HUNYUAN21_ENV_SPEC"
prepare_env "$TRELLIS_ENV" "$TRELLIS_ENV_SPEC"
prepare_env "$SF3D_ENV" "$SF3D_ENV_SPEC"

clone_or_update https://github.com/microsoft/TRELLIS.git "$TRELLIS_REPO" 1
clone_or_update https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git "$HUNYUAN2_REPO"
clone_or_update https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1.git "$HUNYUAN21_REPO"
clone_or_update https://github.com/Stability-AI/stable-fast-3d.git "$SF3D_REPO"

say "Installing pCAD mesh gateway environment"
ensure_basic_env "$GATEWAY_ENV"
mamba_run "$GATEWAY_ENV" python -m pip install -U pip
mamba_run "$GATEWAY_ENV" python -m pip install fastapi uvicorn httpx huggingface-hub
mark_env_ready "$GATEWAY_ENV" "$GATEWAY_ENV_SPEC"

say "Installing Hunyuan3D-2 environment"
ensure_basic_env "$HUNYUAN2_ENV"
mamba_run "$HUNYUAN2_ENV" python -m pip install -U pip
mamba_run "$HUNYUAN2_ENV" python -m pip install \
  torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
  --index-url https://download.pytorch.org/whl/cu124
mamba_run "$HUNYUAN2_ENV" bash -c \
  "cd '$HUNYUAN2_REPO' && python -m pip install -r requirements.txt && python -m pip install -e . && python -m pip install fastapi uvicorn"
mark_env_ready "$HUNYUAN2_ENV" "$HUNYUAN2_ENV_SPEC"

say "Installing Hunyuan3D-2.1 shape environment"
ensure_basic_env "$HUNYUAN21_ENV"
mamba_run "$HUNYUAN21_ENV" python -m pip install -U pip
mamba_run "$HUNYUAN21_ENV" python -m pip install \
  torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 \
  --index-url https://download.pytorch.org/whl/cu124
# Upstream pins bpy==4.0 but does not currently include Blender's package index.
# Keep normal PyPI as the primary index for dependencies such as Cython and add
# Blender's official package index only as an additional source for bpy 4.0.
mamba_run "$HUNYUAN21_ENV" python -m pip install \
  --extra-index-url https://download.blender.org/pypi/ \
  'bpy==4.0.0'
mamba_run "$HUNYUAN21_ENV" bash -c \
  "cd '$HUNYUAN21_REPO' && python -m pip install -r requirements.txt && python -m pip install fastapi uvicorn"
mark_env_ready "$HUNYUAN21_ENV" "$HUNYUAN21_ENV_SPEC"

say "Installing TRELLIS v1 environment (this compiles CUDA extensions and can take a while)"
ensure_cuda121_torch24_env "$TRELLIS_ENV"
mamba_run "$TRELLIS_ENV" bash -c \
  "cd '$TRELLIS_REPO' && bash ./setup.sh --basic --xformers --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast"
mamba_run "$TRELLIS_ENV" python -m pip install fastapi uvicorn
mark_env_ready "$TRELLIS_ENV" "$TRELLIS_ENV_SPEC"

say "Installing Stable Fast 3D environment"
ensure_cuda121_torch24_env "$SF3D_ENV"
mamba_run "$SF3D_ENV" python -m pip install -U pip setuptools==69.5.1 wheel
mamba_run "$SF3D_ENV" bash -c \
  "cd '$SF3D_REPO' && python -m pip install -r requirements.txt && python -m pip install fastapi uvicorn"
mark_env_ready "$SF3D_ENV" "$SF3D_ENV_SPEC"

say "Installing gateway runtime files"
install -m 0644 "$REPO_ROOT/scripts/local-mesh/gateway.py" "$RUNTIME_DIR/gateway.py"
install -m 0644 "$REPO_ROOT/scripts/local-mesh/worker.py" "$RUNTIME_DIR/worker.py"

# Persist only local runtime configuration. Never write tokens into the repo.
ENV_FILE="$CONFIG_DIR/env"
{
  printf 'HF_HOME=%s\n' "$HF_HOME"
  printf 'PCAD_GPU_ARBITRATION=%s\n' "${PCAD_GPU_ARBITRATION:-auto}"
  printf 'PCAD_LLAMA_SWAP_URL=%s\n' "${PCAD_LLAMA_SWAP_URL:-http://127.0.0.1:9292}"
  printf 'PCAD_LLAMA_SWAP_UNLOAD_TIMEOUT=%s\n' "${PCAD_LLAMA_SWAP_UNLOAD_TIMEOUT:-90}"
  printf 'PCAD_MESH_KEEP_WARM=%s\n' "${PCAD_MESH_KEEP_WARM:-false}"
  if [[ -n "${PCAD_LLAMA_SWAP_API_KEY:-}" ]]; then
    printf 'PCAD_LLAMA_SWAP_API_KEY=%s\n' "$PCAD_LLAMA_SWAP_API_KEY"
  fi
  if [[ -n "${HF_TOKEN:-}" ]]; then
    printf 'HF_TOKEN=%s\n' "$HF_TOKEN"
  fi
} > "$ENV_FILE"
chmod 0600 "$ENV_FILE"

prefetch() {
  local repo_id="$1"
  say "Downloading model weights: $repo_id"
  if ! mamba_run "$GATEWAY_ENV" python -c \
    'import os,sys; from huggingface_hub import snapshot_download; snapshot_download(repo_id=sys.argv[1], token=os.environ.get("HF_TOKEN"))' \
    "$repo_id"; then
    return 1
  fi
}

if [[ $DOWNLOAD_WEIGHTS -eq 1 ]]; then
  prefetch microsoft/TRELLIS-image-large
  prefetch microsoft/TRELLIS-text-xlarge
  prefetch tencent/Hunyuan3D-2
  prefetch tencent/Hunyuan3D-2.1

  if [[ -n "${HF_TOKEN:-}" ]]; then
    if prefetch stabilityai/stable-fast-3d; then
      touch "$STATE_DIR/stable-fast-3d.ready"
    else
      warn "Stable Fast 3D weights could not be downloaded. Confirm that your HF account has accepted the model access terms."
      rm -f "$STATE_DIR/stable-fast-3d.ready"
    fi
  else
    warn "HF_TOKEN is not set. Stable Fast 3D code is installed, but its gated weights are not available yet. Request access to stabilityai/stable-fast-3d, export HF_TOKEN, then rerun this script."
    rm -f "$STATE_DIR/stable-fast-3d.ready"
  fi
else
  warn "Weight prefetch skipped. Non-gated models will download from Hugging Face on first use. Stable Fast 3D still requires HF_TOKEN/access."
fi

if [[ $ENABLE_SERVICE -eq 1 ]]; then
  command -v systemctl >/dev/null 2>&1 || die "systemctl is unavailable; rerun with --no-service or install systemd."
  SERVICE_DIR="$HOME/.config/systemd/user"
  SERVICE_FILE="$SERVICE_DIR/pcad-mesh-gateway.service"
  mkdir -p "$SERVICE_DIR"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=pCAD local Creative mesh gateway
After=network.target

[Service]
Type=simple
Environment=PCAD_MESH_HOME=$PCAD_MESH_HOME
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-$ENV_FILE
ExecStart=$GATEWAY_ENV/bin/python $RUNTIME_DIR/gateway.py --host 127.0.0.1 --port 8180
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

  say "Enabling pcad-mesh-gateway.service"
  systemctl --user daemon-reload
  systemctl --user enable --now pcad-mesh-gateway.service

  say "Waiting for gateway health endpoint"
  healthy=0
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8180/health >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep 1
  done
  if [[ $healthy -ne 1 ]]; then
    systemctl --user status pcad-mesh-gateway.service --no-pager || true
    die "Gateway did not become healthy on http://127.0.0.1:8180"
  fi
fi

say "Installation complete"
cat <<EOF

Local Creative backends:
  TRELLIS v1          local/trellis-v1
  Hunyuan3D-2         local/hunyuan3d-2
  Hunyuan3D-2.1       local/hunyuan3d-2.1
  Stable Fast 3D      local/stable-fast-3d

Legacy fal.ai backends remain selectable as quality / fast / ultra.

Install root:  $PCAD_MESH_HOME
HF cache:      $HF_HOME
Gateway:       http://127.0.0.1:8180
GPU arbiter:   ${PCAD_GPU_ARBITRATION:-auto} -> ${PCAD_LLAMA_SWAP_URL:-http://127.0.0.1:9292}

Useful commands:
  curl -s http://127.0.0.1:8180/health | python -m json.tool
  systemctl --user status pcad-mesh-gateway.service
  journalctl --user -u pcad-mesh-gateway.service -f
  ls -lh "$LOGS_DIR"
EOF
