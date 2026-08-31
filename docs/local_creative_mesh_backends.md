# Creative 3D backends

Brepia ships with one built-in local Creative 3D product mode:

```text
local/trellis2 — TRELLIS.2 — Text + image
```

The local runtime is configured through **Settings → AI → Creative models**. Local Creative profiles group the runtime model IDs and generation settings used by the native image-to-mesh adapter.

## Native TRELLIS.2 path

The user-facing Creative model ID is:

```text
local/trellis2
```

The bundled installer registers these llama-swap runtime IDs:

```text
creative/z-image-turbo
creative/trellis2
```

A typical Local Creative profile therefore uses:

- conditioning image model: `creative/z-image-turbo`;
- mesh runtime model: `creative/trellis2`;
- adapter: `native-image-mesh-v1`;
- resolution: `512`, `1024` or `1536`;
- profile-specific conditioning-image and mesh-generation timeouts.

The runtime IDs are not hard-coded as the only allowed profile values. Brepia discovers Creative runtime IDs from llama-swap and stores the selected IDs in the Local Creative profile.

### Text-to-3D

```text
text prompt
-> configured conditioning-image runtime
-> conditioning image
-> configured native mesh runtime
-> PBR GLB
-> Brepia storage and viewer
```

With the bundled runtime IDs this is normally:

```text
text
-> Z-Image-Turbo via stable-diffusion.cpp
-> TRELLIS.2 via trellis.cpp
-> GLB
```

### Image-to-3D

```text
reference image
-> configured native mesh runtime
-> PBR GLB
-> Brepia storage and viewer
```

The current native adapter accepts one reference image per generation. When a reference image is supplied, the conditioning-image model is not required for that request. Text-to-3D requires a conditioning-image model in the selected profile.

llama-swap owns runtime startup, swapping and TTL-based unloading. Brepia reaches the selected mesh model through llama-swap's upstream proxy. For the bundled TRELLIS.2 entry this is:

```text
/upstream/creative/trellis2/generate
```

There is no separate Python mesh gateway in the current native path.

## Installation

Install the bundled native Creative runtimes with:

```bash
bash ./scripts/install-native-creative-backends.sh
```

By default the installer adds these entries to the existing llama-swap configuration without removing unrelated models:

```text
creative/z-image-turbo
creative/trellis2
```

The installer supports custom runtime, model and llama-swap configuration locations. Run:

```bash
bash ./scripts/install-native-creative-backends.sh --help
```

for the available path options.

After installation:

1. restart/reload llama-swap so it reads the updated configuration;
2. verify that the runtime IDs appear in `GET /v1/models`;
3. start Brepia;
4. open **Settings → AI → Creative models**;
5. create or update a Local Creative profile, select the discovered image/mesh runtime IDs, enable the profile and make it the default;
6. start a new Creative conversation and select `TRELLIS.2` (`local/trellis2`).

## Local Creative profiles and conversation pinning

Local Creative profiles are the primary runtime configuration. Each profile contains its own runtime model IDs, resolution and timeouts.

New Creative conversations record the Local Creative profile selected at conversation creation:

- a profile ID pins that conversation to the exact profile;
- a recorded `null` means the conversation was created without a Local Creative profile and local generation remains unavailable for that conversation;
- disabling a profile prevents new/default selection but does not by itself invalidate an already-pinned conversation;
- deleting a pinned profile or removing its mesh runtime makes that conversation fail explicitly until the profile/configuration is restored or a new conversation is started.

Legacy conversations created before profile pinning continue to follow the user's current explicit default Local Creative profile.

## Environment overrides

The following environment settings remain relevant to the native path:

```text
PCAD_LLAMA_SWAP_URL=http://127.0.0.1:9292
PCAD_TRELLIS2_RESOLUTION=1024
PCAD_Z_IMAGE_SIZE=1024x1024
```

`PCAD_TRELLIS2_RESOLUTION` is a deployment/legacy fallback. A pinned Local Creative profile's own resolution takes precedence.

An optional llama-swap bearer token can be supplied with:

```bash
export PCAD_LLAMA_SWAP_API_KEY='...'
```

Runtime model selection is no longer configured through `PCAD_Z_IMAGE_MODEL_ID` or `PCAD_TRELLIS2_MODEL_ID`. Select model IDs in the Local Creative profile instead.

Installer path overrides use:

```text
PCAD_NATIVE_CREATIVE_ROOT
PCAD_NATIVE_CREATIVE_MODELS_DIR
PCAD_LLAMA_SWAP_CONFIG
```

The `PCAD_*` prefix is retained as a compatibility-sensitive environment contract.

## Optional hosted providers

Hosted 3D providers are disabled by default. The bundled optional provider adapter is `fal` (fal.ai). Enable it with:

```env
VITE_PCAD_CREATIVE_MESH_PROVIDERS=fal
FAL_KEY=...
```

Restart/rebuild Brepia after changing `VITE_PCAD_CREATIVE_MESH_PROVIDERS`, because Vite exposes that value to the client-side model picker at build time.

To remove fal.ai again, remove `fal` from `VITE_PCAD_CREATIVE_MESH_PROVIDERS` and restart/rebuild. Its models then disappear from the Creative picker and the server refuses requests to that provider.

Multiple optional providers can be enabled as a comma-separated list. The server also accepts `PCAD_CREATIVE_MESH_PROVIDERS` as a server-side override. For normal deployments, keep client and server provider enablement aligned.

## Adding another 3D service

Creative 3D providers are registered in:

```text
src/server/creativeMeshProviderRegistry.ts
```

Model metadata lives in:

```text
shared/creativeMeshModels.ts
```

A provider adapter declares the provider/model ownership, configuration detection, request handler and persistence/reconnect behavior. `src/server/mesh.ts` resolves the selected product model through the registry, so provider-specific API translation belongs in the provider adapter rather than a growing model switch in the main route.

The native Local Creative profile/runtime path remains separate from hosted provider adapters.

## Legacy conversations

The retired local model IDs:

```text
local/trellis-v1
local/hunyuan3d-2
local/hunyuan3d-2.1
```

are no longer selectable and their old Python runtime has been removed. They remain only as read-compatibility aliases and normalize to the current local TRELLIS.2 product mode where that compatibility path applies.

## Verification

Project gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/install-native-creative-backends.sh
```

Runtime discovery:

```bash
curl -s http://127.0.0.1:9292/v1/models \
  | grep -E 'creative/(z-image-turbo|trellis2)'
```

Useful llama-swap runtime diagnostics include:

```text
GET /v1/models
GET /running
```

Native Creative logs use:

```text
[native-creative-mesh]
```

Follow-up semantic editing of a locally generated TRELLIS.2 mesh remains unsupported. A local mesh edit request is rejected explicitly rather than silently regenerating a different mesh.