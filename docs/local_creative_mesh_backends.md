# Local Creative mesh backends

pCAD is transitioning its local Creative runtime from three Python/CUDA backends to one llama-swap-managed native product backend:

```text
local/trellis2 — TRELLIS.2 — Text + image
```

The old local backends remain available **only during validation**. They are removed after the new path has produced real GLBs from both image and text inside pCAD.

## Transitional Creative catalog

| pCAD ID | Backend | Text -> 3D | Image -> 3D | Runtime status |
| --- | --- | ---: | ---: | --- |
| `local/trellis2` | Z-Image-Turbo + TRELLIS.2 | Yes | Yes | New native path; runtime validation pending. |
| `local/trellis-v1` | Microsoft TRELLIS v1 | Yes | Yes | Existing working Python fallback during transition. |
| `local/hunyuan3d-2` | Tencent Hunyuan3D-2 | No | Yes | Existing working Python fallback during transition. |
| `local/hunyuan3d-2.1` | Tencent Hunyuan3D-2.1 | No | Yes | Transitional legacy backend. |
| `quality` | fal.ai legacy Draft | Yes | Yes | Historical hosted ID; requires `FAL_KEY`. |
| `fast` | fal.ai legacy Textureless | Yes | Yes | Historical hosted ID; requires `FAL_KEY`. |
| `ultra` | fal.ai legacy Max Quality | Yes | Yes | Historical hosted ID; requires `FAL_KEY`. |

Stable Fast 3D remains retired.

The historical fal.ai IDs and persisted local IDs are not rewritten. Removal of an old selectable runtime must not make historical conversation metadata unsafe to load.

# New native Creative path

## Product ID versus runtime IDs

The user-facing/persisted product ID is:

```text
local/trellis2
```

The runtime implementation is split into two llama-swap entries:

```text
creative/z-image-turbo
creative/trellis2
```

This separation is intentional. Product persistence should not need to change if a runtime binary or quantization changes later.

## Text-to-3D

```text
text prompt
-> pCAD Creative create_mesh
-> src/server/mesh.ts
-> src/server/nativeCreativeMesh.ts
-> llama-swap /v1/images/generations
-> creative/z-image-turbo
-> stable-diffusion.cpp
-> Z-Image-Turbo conditioning PNG
-> llama-swap /upstream/creative/trellis2/generate
-> trellis.cpp / TRELLIS.2
-> textured/PBR GLB
-> Supabase mesh storage
-> pCAD viewer
-> conversation workspace models/generated/
```

The conditioning image is an implementation artifact; it is not exposed as a separate Creative product model.

## Image-to-3D

```text
reference image
-> pCAD Creative create_mesh
-> src/server/mesh.ts
-> src/server/nativeCreativeMesh.ts
-> llama-swap /upstream/creative/trellis2/generate
-> trellis.cpp / TRELLIS.2
-> textured/PBR GLB
-> Supabase mesh storage
-> pCAD viewer
-> conversation workspace models/generated/
```

The initial integration accepts one reference image for TRELLIS.2. Multiple requested images fail explicitly rather than being silently ignored.

## Why there is no new mesh gateway

Current llama-swap provides a generic passthrough endpoint:

```text
/upstream/<model>/<path>
```

It resolves configured model IDs that themselves contain slashes and starts/swaps the corresponding process before proxying the request. Therefore `creative/trellis2` can expose its native `/generate` endpoint through:

```text
/upstream/creative/trellis2/generate
```

pCAD only adapts its existing `create_mesh` request into TRELLIS.2 multipart form inside `src/server/nativeCreativeMesh.ts`.

There is no second model registry, translator daemon or new generic gateway. llama-swap owns process lifecycle/GPU arbitration; pCAD owns application validation, persistence and conversation state.

# GPU lifecycle

Both new runtime entries are configured with short validation TTLs so they release resources after use:

```text
creative/z-image-turbo  ttl: 30
creative/trellis2       ttl: 30
```

With normal llama-swap group routing, only the requested heavyweight model should remain active. The expected text path is:

```text
Z-Image process starts
-> conditioning PNG produced
-> TRELLIS.2 request starts
-> llama-swap swaps away Z-Image as needed
-> TRELLIS.2 generates GLB
-> TRELLIS.2 unloads after TTL
```

The actual GPU lifecycle must be observed during runtime acceptance before the old stack is removed.

# Installation

The new installer is:

```bash
bash ./scripts/install-native-creative-backends.sh
```

Default runtime location:

```text
~/ai/pcad-native-creative/
  stable-diffusion.cpp/
  z-image/
    z_image_turbo-Q4_K.gguf
    Qwen3-4B-Instruct-2507-Q4_K_M.gguf
    ae.safetensors
  trellis2/
    runtime/trellis-server
    models/
```

Default llama-swap config target:

```text
~/ai/llama-swap/config/config.yaml
```

Override either path when needed:

```bash
PCAD_NATIVE_CREATIVE_ROOT=/other/runtime/path \
PCAD_LLAMA_SWAP_CONFIG=/other/config.yaml \
bash ./scripts/install-native-creative-backends.sh
```

## Initial runtime choices

Z-Image side:

- pinned `stable-diffusion.cpp` Linux Vulkan binary;
- Z-Image-Turbo Q4_K;
- Qwen3-4B-Instruct-2507 Q4_K_M text encoder;
- `ae.safetensors` VAE;
- 8 sampling steps / CFG 1.0;
- 1024 x 1024 default conditioning image.

The installer verifies SHA256 for the pinned `stable-diffusion.cpp` archive and all three Z-Image model assets.

TRELLIS.2 side:

- official `trellis.cpp` installer;
- CUDA runtime;
- Q8 weights (~9.5 GB, upstream describes them as near-lossless);
- no Trellis Studio desktop app.

The native installer **does not remove** the existing Python mesh gateway, service, repositories, environments or model cache.

It backs up the llama-swap config before adding:

```yaml
creative/z-image-turbo:
  ttl: 30
  checkEndpoint: /
  # stable-diffusion.cpp sd-server command

creative/trellis2:
  ttl: 30
  checkEndpoint: /health
  # trellis-server command
```

# pCAD configuration

Defaults:

```text
PCAD_LLAMA_SWAP_URL=http://127.0.0.1:9292
PCAD_Z_IMAGE_MODEL_ID=creative/z-image-turbo
PCAD_TRELLIS2_MODEL_ID=creative/trellis2
PCAD_TRELLIS2_RESOLUTION=1024
PCAD_Z_IMAGE_SIZE=1024x1024
```

Optional bearer token:

```bash
export PCAD_LLAMA_SWAP_API_KEY='...'
```

The native handler checks `/v1/models` first and returns an actionable 503 when the required runtime ID is not configured.

# Validation sequence

Validate application code before downloading/starting the new runtimes:

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/install-native-creative-backends.sh
```

Then install the runtimes:

```bash
bash ./scripts/install-native-creative-backends.sh
```

Restart/reload llama-swap and verify discovery:

```bash
curl -s http://127.0.0.1:9292/v1/models \
  | grep -E 'creative/(z-image-turbo|trellis2)'
```

Test **image-to-3D first**. This isolates TRELLIS.2 and avoids mixing a Z-Image problem into the first smoke test:

```text
new Creative conversation
-> select TRELLIS.2
-> attach one reference image
-> generate
-> GLB visible in pCAD
-> mesh persisted
-> conversation workspace mirror updated
```

Then test text-to-3D:

```text
new Creative conversation
-> select TRELLIS.2
-> text prompt only
-> Z-Image conditioning image generated internally
-> TRELLIS.2 generates GLB
-> GLB visible/persisted/mirrored
```

Also observe llama-swap `/running` or UI/activity during both tests to confirm model swapping and later VRAM release.

# Existing Python runtime during transition

The old path remains intact while validation is in progress:

```text
local/trellis-v1 | local/hunyuan3d-2 | local/hunyuan3d-2.1
-> src/server/localMesh.ts
-> 127.0.0.1:8180 pCAD mesh gateway
-> Python GPU worker
-> GLB
```

Its installer remains:

```bash
bash ./scripts/install-local-mesh-backends.sh
```

Do not uninstall or clean `~/.local/share/pcad-mesh` yet.

# Removal gate

The old Python runtime may be removed only after all of these are true:

- [ ] `local/trellis2` image-to-3D produces a real viewable GLB.
- [ ] `local/trellis2` text-to-3D produces a real viewable GLB through Z-Image-Turbo.
- [ ] Supabase persistence succeeds for both.
- [ ] conversation workspace mirroring succeeds for both.
- [ ] llama-swap swapping/TTL releases resources correctly.
- [ ] reconnect/background behavior does not duplicate generation.
- [ ] project test/typecheck/lint/build gate is green.

After that proof, remove normal selection and runtime code for the superseded local Python backends while keeping historical persisted data safe.

# Follow-up editing

Follow-up semantic editing of a locally generated mesh remains deferred. `meshId` edit requests to the new native backend are rejected explicitly rather than silently regenerating a mesh or claiming an edit succeeded.

# Logs and diagnostics

The new handler logs with:

```text
[native-creative-mesh]
```

Useful llama-swap endpoints include:

```text
GET /v1/models
GET /running
```

Old gateway diagnostics remain available during the transition through its existing systemd service/logs.
