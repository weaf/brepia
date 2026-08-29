#!/usr/bin/env bash
set -euo pipefail

# Install the transitional pCAD/Brepia native Creative stack:
#   text -> Z-Image-Turbo/stable-diffusion.cpp -> TRELLIS.2/trellis.cpp -> GLB
#   image -------------------------------------> TRELLIS.2/trellis.cpp -> GLB
#
# Runtime lifecycle remains owned by llama-swap. Large model weights default to
# llama-swap's model tree while native runtime binaries stay in a separate pCAD
# runtime root. The script appends two model entries to the existing llama-swap
# config and never removes existing models.

ROOT="${PCAD_NATIVE_CREATIVE_ROOT:-$HOME/ai/pcad-native-creative}"
MODELS_ROOT="${PCAD_NATIVE_CREATIVE_MODELS_DIR:-$HOME/ai/llama-swap/models/creative}"
LLAMA_SWAP_CONFIG="${PCAD_LLAMA_SWAP_CONFIG:-$HOME/ai/llama-swap/config/config.yaml}"

SD_RUNTIME_DIR="$ROOT/stable-diffusion.cpp"
TRELLIS_RUNTIME_DIR="$ROOT/trellis2"
Z_IMAGE_DIR="$MODELS_ROOT/z-image-turbo"
TRELLIS_MODELS_DIR="$MODELS_ROOT/trellis2"

SD_TAG="master-829-0a565f2"
SD_ARCHIVE="sd-master-0a565f2-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip"
SD_SHA256="a96c82dc1a74ca319c1951a22ba7a08732e7345a62671ec1852cce3096b87553"
SD_URL="https://github.com/leejet/stable-diffusion.cpp/releases/download/$SD_TAG/$SD_ARCHIVE"

Z_IMAGE_URL="https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K.gguf?download=true"
Z_IMAGE_FILE="$Z_IMAGE_DIR/z_image_turbo-Q4_K.gguf"
Z_IMAGE_SHA256="14b375ab4f226bc5378f68f37e899ef3c2242b8541e61e2bc1aff40976086fbd"

QWEN_URL="https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf?download=true"
QWEN_FILE="$Z_IMAGE_DIR/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
QWEN_SHA256="3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597"

VAE_URL="https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors?download=true"
VAE_FILE="$Z_IMAGE_DIR/ae.safetensors"
VAE_SHA256="afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38"

usage() {
  cat <<EOF
Usage: $0 [--root DIR] [--models-dir DIR] [--llama-swap-config FILE]

Defaults:
  runtime root:       $ROOT
  model root:         $MODELS_ROOT
  llama-swap config:  $LLAMA_SWAP_CONFIG

Model layout:
  <model root>/z-image-turbo/
  <model root>/trellis2/

The installer downloads roughly:
  Z-Image-Turbo Q4_K            ~3.9 GB
  Qwen3-4B text encoder Q4_K_M  ~2.5 GB
  VAE                              335 MB
  TRELLIS.2 Q8                  ~9.5 GB
plus native runtime binaries.

Environment overrides:
  PCAD_NATIVE_CREATIVE_ROOT
  PCAD_NATIVE_CREATIVE_MODELS_DIR
  PCAD_LLAMA_SWAP_CONFIG

Existing old pCAD TRELLIS/Hunyuan runtimes are not removed.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --root)
      ROOT="$2"; shift 2
      SD_RUNTIME_DIR="$ROOT/stable-diffusion.cpp"
      TRELLIS_RUNTIME_DIR="$ROOT/trellis2"
      ;;
    --models-dir)
      MODELS_ROOT="$2"; shift 2
      Z_IMAGE_DIR="$MODELS_ROOT/z-image-turbo"
      TRELLIS_MODELS_DIR="$MODELS_ROOT/trellis2"
      Z_IMAGE_FILE="$Z_IMAGE_DIR/z_image_turbo-Q4_K.gguf"
      QWEN_FILE="$Z_IMAGE_DIR/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
      VAE_FILE="$Z_IMAGE_DIR/ae.safetensors"
      ;;
    --llama-swap-config)
      LLAMA_SWAP_CONFIG="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

for tool in curl unzip sha256sum find grep; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Missing required command: $tool" >&2
    exit 1
  }
done

mkdir -p "$ROOT" "$MODELS_ROOT" "$Z_IMAGE_DIR" "$SD_RUNTIME_DIR" "$TRELLIS_RUNTIME_DIR"

checksum_ok() {
  local destination="$1" expected="$2"
  [ -s "$destination" ] && printf '%s  %s\n' "$expected" "$destination" | sha256sum -c - >/dev/null 2>&1
}

download_checked() {
  local url="$1" destination="$2" expected="$3"
  if checksum_ok "$destination" "$expected"; then
    echo "==> already present and verified: $destination"
    return
  fi
  if [ -e "$destination" ]; then
    echo "==> checksum mismatch/incomplete file; redownloading: $destination"
    rm -f "$destination"
  fi
  mkdir -p "$(dirname "$destination")"
  echo "==> downloading $(basename "$destination")"
  curl -fL --retry 3 --retry-delay 2 -C - -o "$destination" "$url"
  printf '%s  %s\n' "$expected" "$destination" | sha256sum -c -
}

echo "==> installing stable-diffusion.cpp Vulkan runtime ($SD_TAG)"
SD_ZIP="$ROOT/$SD_ARCHIVE"
download_checked "$SD_URL" "$SD_ZIP" "$SD_SHA256"
if ! find "$SD_RUNTIME_DIR" -type f -name sd-server -print -quit | grep -q .; then
  rm -rf "$SD_RUNTIME_DIR"/*
  unzip -q "$SD_ZIP" -d "$SD_RUNTIME_DIR"
fi
SD_SERVER="$(find "$SD_RUNTIME_DIR" -type f -name sd-server -print -quit)"
[ -n "$SD_SERVER" ] || {
  echo "sd-server not found after extracting $SD_ARCHIVE" >&2
  exit 1
}
chmod +x "$SD_SERVER"

echo "==> downloading and verifying Z-Image-Turbo runtime weights"
download_checked "$Z_IMAGE_URL" "$Z_IMAGE_FILE" "$Z_IMAGE_SHA256"
download_checked "$QWEN_URL" "$QWEN_FILE" "$QWEN_SHA256"
download_checked "$VAE_URL" "$VAE_FILE" "$VAE_SHA256"

echo "==> installing TRELLIS.2 Q8 CUDA runtime and models"
TRELLIS_SERVER="$TRELLIS_RUNTIME_DIR/runtime/trellis-server"
TRELLIS_MODEL_MARKER="$TRELLIS_MODELS_DIR/shape_dec.gguf"
if [ ! -x "$TRELLIS_SERVER" ] || [ ! -s "$TRELLIS_MODEL_MARKER" ]; then
  curl -fsSL https://raw.githubusercontent.com/pwilkin/trellis.cpp/main/install/install.sh \
    | bash -s -- \
      --backend cuda \
      --dest "$TRELLIS_RUNTIME_DIR" \
      --models-dir "$TRELLIS_MODELS_DIR" \
      --quant q8 \
      --skip-app \
      -y
else
  echo "==> already present: $TRELLIS_SERVER"
  echo "==> already present: $TRELLIS_MODELS_DIR"
fi
[ -x "$TRELLIS_SERVER" ] || {
  echo "trellis-server not found at $TRELLIS_SERVER" >&2
  exit 1
}
[ -s "$TRELLIS_MODEL_MARKER" ] || {
  echo "TRELLIS.2 models not found under $TRELLIS_MODELS_DIR" >&2
  exit 1
}

if [ ! -f "$LLAMA_SWAP_CONFIG" ]; then
  echo "llama-swap config not found: $LLAMA_SWAP_CONFIG" >&2
  echo "Pass --llama-swap-config FILE or set PCAD_LLAMA_SWAP_CONFIG." >&2
  exit 1
fi

if grep -qE '^[[:space:]]+creative/z-image-turbo:' "$LLAMA_SWAP_CONFIG" || \
   grep -qE '^[[:space:]]+creative/trellis2:' "$LLAMA_SWAP_CONFIG"; then
  echo "==> Creative llama-swap entries already exist; leaving config unchanged"
  echo "    Verify their paths manually if the runtime or model root changed."
else
  BACKUP="$LLAMA_SWAP_CONFIG.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$LLAMA_SWAP_CONFIG" "$BACKUP"
  echo "==> backed up llama-swap config to $BACKUP"
  cat >> "$LLAMA_SWAP_CONFIG" <<EOF

  creative/z-image-turbo:
    ttl: 30
    checkEndpoint: /
    cmd: >
      "$SD_SERVER"
      --listen-ip 127.0.0.1
      --listen-port \${PORT}
      --diffusion-fa
      --diffusion-model "$Z_IMAGE_FILE"
      --vae "$VAE_FILE"
      --llm "$QWEN_FILE"
      --offload-to-cpu
      --cfg-scale 1.0
      --height 1024
      --width 1024
      --steps 8
    proxy: http://127.0.0.1:\${PORT}

  creative/trellis2:
    ttl: 30
    checkEndpoint: /health
    cmd: >
      "$TRELLIS_SERVER"
      --models "$TRELLIS_MODELS_DIR"
      --host 127.0.0.1
      --port \${PORT}
    proxy: http://127.0.0.1:\${PORT}
EOF
  echo "==> appended creative/z-image-turbo and creative/trellis2 to llama-swap"
fi

cat <<EOF

Native Creative runtime installed.

Runtime root:
  $ROOT

Model root:
  $MODELS_ROOT

Model directories:
  $Z_IMAGE_DIR
  $TRELLIS_MODELS_DIR

llama-swap model IDs:
  creative/z-image-turbo
  creative/trellis2

Next:
  1. Restart/reload llama-swap so it reads the updated config.
  2. Verify both IDs appear in: curl http://127.0.0.1:9292/v1/models
  3. Start pCAD and select TRELLIS.2 (local/trellis2).
  4. Test one image-to-3D generation first, then one text-to-3D generation.

The old Python TRELLIS/Hunyuan stack has NOT been removed.
EOF
