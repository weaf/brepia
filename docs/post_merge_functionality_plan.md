# Post-merge functionality improvement plan

Status: **ACTIVE on `feature/post-merge-functionality`**

The Brepia stable-runtime and persistence architecture remains the protected baseline. `CADAM Original` lineage remains unchanged.

## Creative 3D — current architecture

TRELLIS.2 is the only built-in Creative 3D backend:

```text
local/trellis2 -> TRELLIS.2
```

Image-to-3D:

```text
reference image
-> pCAD create_mesh
-> llama-swap /upstream/creative/trellis2/generate
-> trellis.cpp / TRELLIS.2
-> PBR GLB
-> Supabase + viewer + conversation workspace
```

Text-to-3D:

```text
text prompt
-> pCAD create_mesh
-> llama-swap /v1/images/generations
-> stable-diffusion.cpp / Z-Image-Turbo
-> conditioning image
-> llama-swap /upstream/creative/trellis2/generate
-> trellis.cpp / TRELLIS.2
-> PBR GLB
-> Supabase + viewer + conversation workspace
```

llama-swap owns model lifecycle/GPU arbitration. No separate local mesh gateway is required.

Runtime IDs:

```text
creative/z-image-turbo
creative/trellis2
```

## Verified runtime proof

The native replacement has been exercised successfully in Brepia:

- [x] llama-swap exposes both Creative runtime IDs.
- [x] image -> TRELLIS.2 produced a real viewable 3D model.
- [x] text -> Z-Image-Turbo -> TRELLIS.2 produced a real viewable 3D model.
- [x] Creative model output remains downloadable through the model viewer.
- [x] native Creative generation remains behind the existing reconnect/single-flight protection.

Still to verify after the final cleanup commits:

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] final image-to-3D smoke test
- [ ] final text-to-3D smoke test

## Retired local backends

The previous Python/CUDA product backends are no longer selectable or routable:

```text
local/trellis-v1
local/hunyuan3d-2
local/hunyuan3d-2.1
```

Removed from the active repository runtime:

- [x] `src/server/localMesh.ts`
- [x] `scripts/install-local-mesh-backends.sh`
- [x] `scripts/local-mesh/gateway.py`
- [x] `scripts/local-mesh/worker.py`
- [x] old model configuration and loading-time entries

Historical conversations are not rewritten. The retired local IDs are read-compatibility aliases and normalize forward to:

```text
local/trellis2
```

The old workstation installation can be removed explicitly with:

```bash
bash ./scripts/remove-legacy-creative-backends.sh
```

The cleanup is limited to the retired `pcad-mesh-gateway.service` and old `PCAD_MESH_HOME` tree (default `~/.local/share/pcad-mesh`). It does not touch the llama-swap TRELLIS.2/Z-Image model storage.

## Optional hosted Creative providers

Hosted 3D services are no longer part of the Creative core. They are registered as optional provider adapters.

The existing fal.ai integration is the first optional adapter. It is disabled by default and can be enabled with:

```env
VITE_PCAD_CREATIVE_MESH_PROVIDERS=fal
FAL_KEY=...
```

Removing `fal` from the provider list removes its models from the picker and disables server routing for that provider after restart/rebuild.

Provider extension points:

```text
shared/creativeMeshModels.ts
src/server/creativeMeshProviderRegistry.ts
```

A future service adds model metadata plus one provider adapter. The main `src/server/mesh.ts` route resolves the adapter through the registry rather than accumulating provider-specific model switches.

## Native installation

Installer:

```bash
bash ./scripts/install-native-creative-backends.sh
```

It installs/configures:

- stable-diffusion.cpp + Z-Image-Turbo;
- Qwen text encoder and VAE required by Z-Image;
- trellis.cpp + TRELLIS.2 Q8;
- llama-swap entries for both runtimes.

The native installer does not depend on the retired Python Creative stack.

## Creative UI rules

- TRELLIS.2 is the fallback/default Creative model.
- TRELLIS.2 supports text or one reference image.
- reference-image limits come from Creative model metadata.
- unavailable/removed Creative selections repair to the first selectable model instead of leaving a blank picker.
- downloads are exposed from the opened model viewer, not through generated asset links in chat text.
- follow-up semantic editing of a TRELLIS.2 mesh remains unsupported and is rejected explicitly.

## Invariants

- Preserve the stable-runtime/mobile recovery architecture.
- Preserve existing Supabase/storage contracts.
- Preserve `CADAM Original` identity and prompt lineage.
- Do not restore Stable Fast 3D.
- Do not introduce a second generic local model gateway while llama-swap can own runtime lifecycle.
- Keep hosted Creative services optional and isolated from the native TRELLIS.2 core.

## Completion criteria

The Creative replacement is complete when the final project gate and post-cleanup smoke tests are green. After that, the branch can proceed to remaining post-merge functionality work.
