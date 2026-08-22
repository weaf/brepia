# Local Creative mesh backends

pCAD Creative mode supports four local open-source 3D backends alongside the
legacy fal.ai backends.

| pCAD ID | Backend | Text -> 3D | Image -> 3D | Notes |
| --- | --- | ---: | ---: | --- |
| `local/trellis-v1` | Microsoft TRELLIS v1 | Yes | Yes | Recommended default local text-to-3D backend. |
| `local/hunyuan3d-2` | Tencent Hunyuan3D-2 | No | Yes | Shape generation through the official Hunyuan pipeline. |
| `local/hunyuan3d-2.1` | Tencent Hunyuan3D-2.1 | No | Yes | Shape pipeline only in the first pCAD integration; chosen to fit a 24 GB GPU reliably. |
| `local/stable-fast-3d` | Stability AI Stable Fast 3D | No | Yes | Hugging Face gated model. |
| `quality` | fal.ai legacy Draft | Yes | Yes | Requires `FAL_KEY`. |
| `fast` | fal.ai legacy Textureless | Yes | Yes | Requires `FAL_KEY`. |
| `ultra` | fal.ai legacy Max Quality | Yes | Yes | Requires `FAL_KEY`. |

The historical fal.ai IDs are intentionally unchanged so existing Creative
conversations remain loadable and reproducible.

## Architecture

The main pCAD server never imports the local PyTorch stacks. Local requests go
to a small loopback gateway:

```text
pCAD create_mesh
  -> src/server/mesh.ts
      -> local/* -> src/server/localMesh.ts
                   -> 127.0.0.1:8180 pCAD mesh gateway
                      -> exactly one GPU worker on 127.0.0.1:8190
      -> quality/fast/ultra -> src/server/falMesh.ts (legacy fal.ai)
```

Each local backend has its own Python environment. The gateway kills the active
worker before starting a different backend, so only one heavyweight CUDA model
owns VRAM at a time. This is intentional for 24 GB consumer GPUs.

Local generation does not consume hosted mesh billing tokens. fal.ai requests
continue through the existing billing path unchanged.

## One-step installation

From the pCAD repository:

```bash
bash ./scripts/install-local-mesh-backends.sh --install-system-deps
```

Without the optional apt/sudo step:

```bash
bash ./scripts/install-local-mesh-backends.sh
```

Default installation location:

```text
~/.local/share/pcad-mesh/
  bin/micromamba
  repos/
  envs/
  runtime/
  cache/huggingface/
  logs/
  config/env
```

The installer creates isolated environments, clones the four official
repositories, installs their dependencies, downloads Hugging Face weights and
installs a user service:

```text
pcad-mesh-gateway.service
```

Check it with:

```bash
systemctl --user status pcad-mesh-gateway.service
curl -s http://127.0.0.1:8180/health | python -m json.tool
```

pCAD defaults to this gateway URL automatically. Override it only when needed:

```bash
export PCAD_MESH_GATEWAY_URL=http://127.0.0.1:8180
```

## Stable Fast 3D access

Stable Fast 3D weights are gated on Hugging Face. Request access to
`stabilityai/stable-fast-3d`, create a read token, then run:

```bash
export HF_TOKEN='hf_...'
bash ./scripts/install-local-mesh-backends.sh
```

The token is written only to
`~/.local/share/pcad-mesh/config/env` with mode `0600`; it is never written to
the pCAD repository.

If no token is supplied, the other three local backends are installed normally
and Stable Fast 3D code is installed but its gated weights remain unavailable.

## Installer options

```text
--install-system-deps  Install common Ubuntu/Debian build dependencies via sudo apt.
--skip-weights         Do not prefetch model weights; non-gated models download on first use.
--no-service           Install runtimes but do not enable the user systemd service.
```

The installer is designed to be rerunnable. Repositories are updated with a
fast-forward when possible and existing environments are reused.

## GPU / model behavior

TRELLIS v1 is the local backend that accepts a plain text prompt. Hunyuan3D-2,
Hunyuan3D-2.1 and Stable Fast 3D require a reference image in the current pCAD
integration; pCAD rejects incompatible text-only requests before starting GPU
inference.

Hunyuan3D-2.1's upstream documentation reports approximately 10 GB VRAM for
shape, 21 GB for texture and 29 GB with shape+texture together. The initial pCAD
worker therefore uses the shape pipeline only. PBR painting can be added later
as a sequential worker stage without changing the pCAD mesh provider contract.

## Logs

Gateway service:

```bash
journalctl --user -u pcad-mesh-gateway.service -f
```

Backend worker logs:

```bash
ls -lh ~/.local/share/pcad-mesh/logs/
tail -f ~/.local/share/pcad-mesh/logs/worker-local-trellis-v1.log
```

## Validation

Before installing the heavyweight Python stacks, validate the TypeScript side:

```bash
npm run typecheck
npx tsx --test tests/creativeMeshModels.test.ts
```

After installation:

```bash
curl -s http://127.0.0.1:8180/health | python -m json.tool
```

Then create a new Creative conversation and explicitly select one of the local
backends in the model picker. A local request must not require `FAL_KEY`.
