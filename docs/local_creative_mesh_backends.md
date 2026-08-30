# Creative 3D backends

Brepia ships with one built-in Creative 3D backend:

```text
local/trellis2 — TRELLIS.2 — Text + image
```

TRELLIS.2 is the default and does not depend on a hosted 3D service.

## Native TRELLIS.2 path

The user-facing model ID is:

```text
local/trellis2
```

The implementation uses two llama-swap runtime IDs:

```text
creative/z-image-turbo
creative/trellis2
```

Text-to-3D:

```text
text prompt
-> Z-Image-Turbo via stable-diffusion.cpp
-> conditioning image
-> TRELLIS.2 via trellis.cpp
-> PBR GLB
-> Brepia storage and viewer
```

Image-to-3D:

```text
reference image
-> TRELLIS.2 via trellis.cpp
-> PBR GLB
-> Brepia storage and viewer
```

TRELLIS.2 currently accepts one reference image per generation.

llama-swap owns runtime startup, swapping and TTL-based unloading. Brepia calls the native TRELLIS.2 endpoint through llama-swap's upstream proxy:

```text
/upstream/creative/trellis2/generate
```

There is no separate Python mesh gateway.

## Installation

Install the native Creative runtimes with:

```bash
bash ./scripts/install-native-creative-backends.sh
```

The installer registers these llama-swap entries:

```text
creative/z-image-turbo
creative/trellis2
```

Useful overrides:

```text
PCAD_LLAMA_SWAP_URL=http://127.0.0.1:9292
PCAD_Z_IMAGE_MODEL_ID=creative/z-image-turbo
PCAD_TRELLIS2_MODEL_ID=creative/trellis2
PCAD_TRELLIS2_RESOLUTION=1024
PCAD_Z_IMAGE_SIZE=1024x1024
```

An optional llama-swap bearer token can be supplied with:

```bash
export PCAD_LLAMA_SWAP_API_KEY='...'
```

The installer supports custom runtime, model and llama-swap config locations. Run:

```bash
bash ./scripts/install-native-creative-backends.sh --help
```

for the available path options.

## Optional hosted providers

Hosted 3D providers are disabled by default. TRELLIS.2 remains available regardless of optional provider configuration.

The bundled optional provider adapter is `fal` (fal.ai). Enable it with:

```env
VITE_PCAD_CREATIVE_MESH_PROVIDERS=fal
FAL_KEY=...
```

Restart/rebuild Brepia after changing `VITE_PCAD_CREATIVE_MESH_PROVIDERS`, because Vite exposes that value to the client-side model picker at build time.

To remove fal.ai again, remove `fal` from `VITE_PCAD_CREATIVE_MESH_PROVIDERS` and restart/rebuild. Its models then disappear from the Creative picker and the server refuses requests to that provider.

Multiple optional providers can be enabled as a comma-separated list:

```env
VITE_PCAD_CREATIVE_MESH_PROVIDERS=fal,another-provider
```

The server also accepts `PCAD_CREATIVE_MESH_PROVIDERS` as a server-side override. For normal deployments, use the Vite variable so the client picker and server routing stay aligned.

## Adding another 3D service

Creative 3D providers are registered in:

```text
src/server/creativeMeshProviderRegistry.ts
```

Each provider adapter declares:

- provider ID and label;
- whether it is optional;
- the Creative models it owns;
- how configuration/credentials are detected;
- its request handler;
- whether requests need single-flight reconnect protection;
- whether Brepia should mirror generated meshes after a successful response.

Model metadata lives in:

```text
shared/creativeMeshModels.ts
```

A new hosted service is added by defining its model metadata and registering one provider adapter. `src/server/mesh.ts` resolves the selected model through the registry, so the main Creative route does not need a model-specific switch for every service.

Provider-specific API translation belongs in that provider's handler. TRELLIS.2 and its llama-swap integration remain independent of hosted adapters.

## Legacy conversations

The retired local model IDs:

```text
local/trellis-v1
local/hunyuan3d-2
local/hunyuan3d-2.1
```

are no longer selectable and their Python runtime has been removed. They are retained only as read-compatibility aliases. If an older conversation contains one of these IDs, Brepia normalizes it to:

```text
local/trellis2
```

This keeps historical conversations loadable without restoring the old backend.

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

Useful llama-swap runtime diagnostics:

```text
GET /v1/models
GET /running
```

Native Creative logs use:

```text
[native-creative-mesh]
```

Follow-up semantic editing of a locally generated TRELLIS.2 mesh remains unsupported. A local `meshId` edit request is rejected explicitly rather than silently regenerating a different mesh.
