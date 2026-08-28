#!/usr/bin/env bash
set -euo pipefail

# Install the transitional pCAD/Brepia native Creative stack:
#   text -> Z-Image-Turbo/stable-diffusion.cpp -> TRELLIS.2/trellis.cpp -> GLB
#   image -------------------------------------> TRELLIS.2/trellis.cpp -> GLB
#
# Runtime lifecycle remains owned by llama-swap. The script appends two model
# entries to an existing llama-swap config and never removes existing models.

ROOT="${PCAD_NATIVE_CREATIVE_ROOT:-$HOME/ai/pcad-native-creative}"
LLAMA_SWAP_CONFIG="${PCAD_LLAMA_SWAP_CONFIG:-$HOME/ai/llama-swap/config/config.yaml}"
Z_IMAGE_DIR="$ROOT/z-image"
SD_RUNTIME_DIR="$ROOT/stable-diffusion.cpp"
TRELLIS_DIR="$ROOT/trellis2"

SD_TAG="master-829-0a565f2"
SD_ARCHIVE="sd-master-0a565f2-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip"
SD_SHA256="a96c82dc1a74ca319c1951a22ba7a08732e7345a62671ec1852cce3096b87553"
SD_URL="https://github.com/leejet/stable-diffusion.cpp/releases/download/$SD_TAG/$SD_ARCHIVE"

Z_IMAGE_URL="https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K.gguf?download=true"
Z_IMAGE_FILE="$Z_IMAGE_DIR/z_image_turbo-Q4_K.gguf"
QWEN_URL="https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf?download=true"
QWEN_FILE="$Z_IMAGE_DIR/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
VAE_URL="https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors?download=true"
VAE_FILE="$Z_IMAGE_DIR/ae.safetensors"

usage() {
  cat <<EOF
Usage: $0 [--root DIR] [--llama-swap-config FILE]

Defaults:
  runtime root:       $ROOT
  llama-swap config:  $LLAMA_SWAP_CONFIG

The installer downloads roughly:
  Z-Image-Turbo Q4_K            ~3.9 GB
  Qwen3-4B text encoder Q4_K_M  ~2.5 GB
  VAE                              335 MB
  TRELLIS.2 Q8                  ~9.5 GB
plus native runtime binaries.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --root)
      ROOT="$2"; shift 2
      Z_IMAGE_DIR="$ROOT/z-image"
      SD_RUNTIME_DIR="$ROOT/stable-diffusion.cpp"
      TRELLIS_DIR="$ROOT/trellis2"
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

for tool in curl unzip sha256sum find; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "Missing required command: $tool" >&2
    exit 1
  }
done

mkdir -p "$ROOT" "$Z_IMAGE_DIR" "$SD_RUNTIME_DIR"

download() {
  local url="$1" destination="$2"
  if [ -s "$destination" ]; then
    echo "==> already present: $destination"
    return
  fi
  mkdir -p "$(dirname "$destination")"
  echo "==> downloading $(basename "$destination")"
  curl -fL --retry 3 --retry-delay 2 -C - -o "$destination" "$url"
}

echo "==> installing stable-diffusion.cpp Vulkan runtime ($SD_TAG)"
SD_ZIP="$ROOT/$SD_ARCHIVE"
download "$SD_URL" "$SD_ZIP"
echo "$SD_SHA256  $SD_ZIP" | sha256sum -c -
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

echo "==> downloading Z-Image-Turbo runtime weights"
download "$Z_IMAGE_URL" "$Z_IMAGE_FILE"
download "$QWEN_URL" "$QWEN_FILE"
download "$VAE_URL" "$VAE_FILE"

echo "==> installing TRELLIS.2 Q8 CUDA runtime and models"
if [ ! -x "$TRELLIS_DIR/runtime/trellis-server" ]; then
  curl -fsSL https://raw.githubusercontent.com/pwilkin/trellis.cpp/main/install/install.sh \
    | bash -s -- \
      --backend cuda \
      --dest "$TRELLIS_DIR" \
      --models-dir "$TRELLIS_DIR/models" \
      --quant q8 \
      --skip-app \
      -y
else
  echo "==> already present: $TRELLIS_DIR/runtime/trellis-server"
fi
TRELLIS_SERVER="$TRELLIS_DIR/runtime/trellis-server"
[ -x "$TRELLIS_SERVER" ] || {
  echo "trellis-server not found at $TRELLIS_SERVER" >&2
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
  echo "    Verify paths manually if the runtime root changed."
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
      --models "$TRELLIS_DIR/models"
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
