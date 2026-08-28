# Local Creative mesh backends

pCAD Creative mode supports three local open-source 3D backends alongside the
legacy fal.ai backends.

| pCAD ID | Backend | Text -> 3D | Image -> 3D | Notes |
| --- | --- | ---: | ---: | --- |
| `local/trellis-v1` | Microsoft TRELLIS v1 | Yes | Yes | Text-to-GLB and managed runtime dependencies validated in pCAD. |
| `local/hunyuan3d-2` | Tencent Hunyuan3D-2 | No | Yes | Image-to-GLB path manually validated in pCAD. |
| `local/hunyuan3d-2.1` | Tencent Hunyuan3D-2.1 | No | Yes | Shape pipeline only in the first pCAD integration; runtime validation pending. |
| `quality` | fal.ai legacy Draft | Yes | Yes | Requires `FAL_KEY`. |
| `fast` | fal.ai legacy Textureless | Yes | Yes | Requires `FAL_KEY`. |
| `ultra` | fal.ai legacy Max Quality | Yes | Yes | Requires `FAL_KEY`. |

Stable Fast 3D was removed from the pCAD local backend set. It duplicated the
image-to-3D role already covered by Hunyuan/TRELLIS while adding a gated model,
an additional native runtime and extra installer failure modes.

The historical fal.ai IDs are intentionally unchanged so existing Creative
conversations remain loadable and reproducible.

## Current Local Creative v1 boundary

The verified local v1 path is:

```text
reference image or TRELLIS text prompt
-> pCAD Creative tool
-> selected local backend
-> loopback mesh gateway
-> generated GLB
-> Supabase mesh storage
-> pCAD viewer
-> conversation workspace models/generated/
```

`local/trellis-v1` has been manually validated for text-to-3D through the pCAD
runtime. `local/hunyuan3d-2` has been manually validated through the complete
image-to-3D path.

Follow-up editing of an existing locally generated mesh is **not enabled in v1**.
The stable local mesh entrypoint rejects local `meshId` edit requests instead of
silently regenerating or reporting a false success. Deterministic/semantic mesh
editing is deferred work.

Runtime validation still pending independently of the working TRELLIS and
Hunyuan3D-2 paths:

- Hunyuan3D-2.1 runtime validation
- full llama-swap GPU unload/reload arbitration validation

## Architecture

The main pCAD server never imports the local PyTorch stacks. Local requests go
to a small loopback gateway:

```text
pCAD create_mesh
  -> src/server/mesh.ts
      -> local/* -> src/server/localMesh.ts
                   -> 127.0.0.1:8180 pCAD mesh gateway
                      -> GPU arbitration with llama-swap
                      -> exactly one GPU worker on 127.0.0.1:8190
      -> quality/fast/ultra -> src/server/falMesh.ts (legacy fal.ai)
```

Each local backend has its own Python environment. The gateway kills the active
worker before starting a different backend, so only one heavyweight local 3D
model owns VRAM at a time.

With GPU arbitration enabled, the gateway also checks llama-swap before a local
3D generation. If llama-swap has a resident LLM/VLM, the gateway requests a
manual unload and waits until `/running` reports no resident model before the
3D worker starts. The default `PCAD_MESH_KEEP_WARM=false` then stops the 3D
worker before `create_mesh` returns. The next LLM/VLM request can therefore let
llama-swap load its model again normally. pCAD does not need to know which LLM
was previously resident.

This is intentional for a single 24 GB consumer GPU. It is model-family
hot-swapping, not concurrent execution.

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

For runtime/environment installation without prefetching large Hugging Face
repositories:

```bash
bash ./scripts/install-local-mesh-backends.sh --skip-weights
```

This is the recommended development path while selective checkpoint prefetch is
still being refined. Models can download the checkpoint they need on first use.

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

The installer creates isolated environments, clones the three official
repositories, installs their dependencies and installs a user service:

```text
pcad-mesh-gateway.service
```

Unless `--skip-weights` is used, it also attempts weight prefetch. Repository
prefetch can be substantially larger than the individual checkpoint used by a
worker, so use `--skip-weights` when disk/download size matters. The directory
`cache/huggingface` contains downloaded model weights; deleting it forces those
weights to be downloaded again.

Check the gateway with:

```bash
systemctl --user status pcad-mesh-gateway.service
curl -s http://127.0.0.1:8180/health | python3 -m json.tool
```

pCAD defaults to this gateway URL automatically. Override it only when needed:

```bash
export PCAD_MESH_GATEWAY_URL=http://127.0.0.1:8180
```

## GPU arbitration with llama-swap

The installer defaults to:

```text
PCAD_GPU_ARBITRATION=auto
PCAD_LLAMA_SWAP_URL=http://127.0.0.1:9292
PCAD_LLAMA_SWAP_UNLOAD_TIMEOUT=90
PCAD_MESH_KEEP_WARM=false
```

`auto` means that a running llama-swap is coordinated with automatically, but a
machine without llama-swap can still use the local mesh gateway. Use `required`
when local 3D generation must fail closed unless llama-swap can be contacted:

```bash
export PCAD_GPU_ARBITRATION=required
bash ./scripts/install-local-mesh-backends.sh
```

Use `off` to disable cross-runtime arbitration:

```bash
export PCAD_GPU_ARBITRATION=off
```

If llama-swap is protected by a bearer token, set:

```bash
export PCAD_LLAMA_SWAP_API_KEY='...'
```

The gateway health response exposes the arbitration state:

```bash
curl -s http://127.0.0.1:8180/health | python3 -m json.tool
```

Look for `arbitration.mode`, `arbitration.connected`,
`arbitration.lastAction`, and `activeModel`.

For normal single-GPU pCAD use, leave `PCAD_MESH_KEEP_WARM=false`. Setting it to
`true` is only appropriate when enough VRAM exists to keep the selected 3D
worker resident while later LLM requests run.

## Installer options

```text
--install-system-deps  Install common Ubuntu/Debian build dependencies via sudo apt.
--skip-weights         Do not prefetch model weights; models download on first use.
--no-service           Install runtimes but do not enable the user systemd service.
--recreate-envs        Force recreation of all managed Python environments.
```

The installer is designed to be rerunnable. Repository checkouts and the shared
Hugging Face cache are preserved. Managed environments are recreated when their
pCAD bootstrap spec changes or when `--recreate-envs` is requested.

## GPU / model behavior

TRELLIS v1 accepts a plain text prompt or a reference image. Hunyuan3D-2 and
Hunyuan3D-2.1 require a reference image in the current pCAD integration; pCAD
rejects incompatible text-only requests before starting GPU inference.

Hunyuan3D-2.1's upstream documentation reports approximately 10 GB VRAM for
shape, 21 GB for texture and 29 GB with shape+texture together. The initial pCAD
worker therefore uses the shape pipeline only. PBR painting can be added later
as a sequential worker stage without changing the pCAD mesh provider contract.

The legacy CUDA profile used by TRELLIS is intentionally isolated from the
Ubuntu host toolchain: Python 3.10, PyTorch cu121, CUDA toolkit/nvcc 12.1 and
GCC/G++ 12 live in the managed environment. Hunyuan environments use the modern
cu124 profile. The system NVIDIA driver/toolkit is not modified.

The clean installer runs the same explicit TRELLIS runtime repair that has been
validated in pCAD before writing the TRELLIS environment ready marker. This
covers the CUDA extensions and runtime dependencies that upstream setup can
otherwise skip while still returning success.

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

Validate the TypeScript side:

```bash
npm run typecheck
npx tsx --test tests/creativeMeshModels.test.ts
```

Validate the lightweight Python gateway without loading a model:

```bash
python3 -m py_compile scripts/local-mesh/gateway.py scripts/local-mesh/worker.py
bash -n scripts/install-local-mesh-backends.sh
```

After installation:

```bash
curl -s http://127.0.0.1:8180/health | python3 -m json.tool
```

Then create a new Creative conversation and explicitly select one of the local
backends in the model picker. A local request must not require `FAL_KEY`.

The manually validated Hunyuan3D-2 acceptance path is:

```text
new Creative conversation
-> select local/hunyuan3d-2
-> attach reference image
-> generate mesh
-> GLB visible in pCAD
-> generated mesh mirrored to conversations/<uuid>/models/generated/
```

For the separate GPU arbitration runtime test, first let llama-swap load an
LLM/VLM and confirm it appears in its `/running` endpoint. Start a local Creative
generation and observe the gateway health/logs. The expected sequence is:

```text
llama-swap model resident
-> gateway unloads llama-swap
-> local 3D worker starts
-> GLB is generated
-> local 3D worker exits
-> next LLM request reloads through llama-swap
```

This arbitration sequence remains a dedicated runtime validation item until it
has been observed end-to-end.
