# Post-merge functionality improvement plan

Status: **COMPLETE on `feature/post-merge-functionality`**

The Brepia stable-runtime and persistence architecture remains the protected baseline. `CADAM Original` lineage remains unchanged.

## Creative 3D — completed native migration

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
- [x] `npm test` reported green after the final Creative cleanup.
- [x] `npm run typecheck` reported green after the final Creative cleanup.
- [x] `npm run lint` reported green after the final Creative cleanup.
- [x] `npm run build` reported green after the final Creative cleanup.
- [x] native installer shell syntax reported green.
- [x] legacy cleanup script shell syntax reported green.
- [x] the legacy workstation runtime was removed with `scripts/remove-legacy-creative-backends.sh`.

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

The legacy workstation installation has also been removed. The cleanup was limited to the retired `pcad-mesh-gateway.service` and old `PCAD_MESH_HOME` tree (default `~/.local/share/pcad-mesh`) and did not touch the llama-swap TRELLIS.2/Z-Image model storage.

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

## Local Supabase lifecycle — completed

The lifecycle review is complete. The earlier references to a workstation manager named **NOx** were incorrect; the user identified the likely source as a typo where `npx` was intended.

Repository and workstation evidence agree:

- [x] no `nox` or `NOx` executable was found;
- [x] no NOx service, launcher or configuration was found;
- [x] no global `supabase` binary is required;
- [x] the repository contains Supabase CLI `^2.114.0` as a dev dependency;
- [x] rootless `podman.socket` is active on the workstation;
- [x] the running containers are the standard Supabase CLI/Compose project `cadam`;
- [x] inspected containers carry `com.supabase.cli.project=cadam` and `com.docker.compose.project=cadam`;
- [x] repository-local Supabase CLI `2.114.0` detects the running stack;
- [x] the failed generated `postgres.service` is not the owner of the healthy `cadam` stack;
- [x] `~/.config/supabase.env` contains legacy/local Supabase credential configuration but does not establish a separate lifecycle manager;
- [x] `.cursor/rules/database-workflow.mdc`, `.cursor/rules/typescript-workflow.mdc`, `AGENTS.md` and `README.md` are reconciled to the repository-local `npx supabase` workflow;
- [x] `docs/local_supabase_lifecycle.md` records the final evidence and canonical commands;
- [x] `scripts/inspect-local-supabase-lifecycle.sh` remains available as read-only troubleshooting inventory;
- [x] `start.sh` now configures the rootless Podman socket/shim, checks `npx supabase status`, and automatically runs `npx supabase start` when the local stack is not already running.

Canonical lifecycle:

```text
./start.sh
  -> ensure rootless Podman socket
  -> configure DOCKER_HOST + Podman compatibility shim
  -> npx supabase status
  -> npx supabase start when needed
  -> read local Supabase env without printing credentials
  -> continue Brepia startup
```

Explicit lifecycle commands remain:

```bash
npx supabase start
npx supabase status
npx supabase stop
```

On the current rootless-Podman workstation those direct lifecycle/status commands use the same `DOCKER_HOST` and `scripts/podman` compatibility environment documented in `docs/local_supabase_lifecycle.md`.

Supabase is intentionally left running when Brepia exits.

## 3D viewer interaction — free rotation (completed)

The primary Parametric/OpenSCAD viewer now uses unrestricted arcball-style rotation. The earlier TrackballControls implementation was replaced after final UX testing exposed an orthographic zoom-out regression; the current ArcballControls implementation restores bidirectional wheel zoom while retaining free rotation.

Completed outcomes:

- [x] unrestricted rotation around all axes;
- [x] pan and bidirectional zoom preserved;
- [x] model bounds/visual center remains the practical rotation target, so usability no longer depends on a convenient OpenSCAD origin;
- [x] desktop ViewGizmo can still snap back to canonical views after free rotation;
- [x] the control change was isolated from prompt/profile and stable-runtime behavior;
- [x] manual functional review confirmed the final rotation/zoom behavior works as intended.

Focused automated pointer/touch interaction coverage was not added before the control replacement. Add it later only if viewer-control regressions justify dedicated browser interaction tests.

## Settings UX and appearance — completed

The completed workstream is documented in:

- `docs/settings_ux_plan.md`

Completed outcomes include:

- [x] responsive Settings width and stable top alignment;
- [x] responsive desktop/mobile Settings navigation;
- [x] application-level `System / Light / Dark` appearance with persistence and live System behavior;
- [x] theme-aware shared/app surfaces including the final Light-theme conversation/sidebar regressions;
- [x] clearer Common/Advanced AI settings information hierarchy;
- [x] contrast, focus, target-size, reflow, and reduced-motion improvements;
- [x] desktop/mobile visual verification;
- [x] responsive/reflow verification including narrow phones and 200% zoom;
- [x] appearance/reload/viewer-independence verification;
- [x] keyboard/accessibility spot checks;
- [x] final repository regression gate user-confirmed complete.

Phase 6 is closed as implemented and tested. Future Settings changes should be treated as new requirements or concrete regressions rather than continuation of this UX plan.

## Completion

All workstreams tracked by this post-merge functionality plan are complete:

- [x] native Creative backend migration and cleanup;
- [x] final free-rotation/bidirectional-zoom viewer behavior;
- [x] Settings UX/appearance implementation and Phase 6 verification;
- [x] local Supabase lifecycle reconciliation and correction from erroneous NOx wording to repository-local `npx supabase` ownership.

Other deferred/future work remains governed by its dedicated plan/status documents and must not be reopened implicitly as part of this completed plan.
