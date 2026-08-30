# Post-merge functionality improvement plan

Status: **ACTIVE on `feature/post-merge-functionality`**

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

## Local Supabase lifecycle / NOx follow-up

The repository currently states that **NOx owns the local Supabase service lifecycle**, and `start.sh` assumes the Supabase stack has already been started through NOx. This needs an explicit workstation-level review before the convention is treated as authoritative long-term.

Follow-up tasks:

- [ ] identify exactly what `NOx` refers to on the current development workstation;
- [ ] locate its configuration, service definition, scripts or launcher and document the real start/stop/status commands;
- [ ] verify whether NOx still actively owns the pCAD/Brepia Supabase containers or whether the documentation reflects an older local setup;
- [ ] verify how the NOx-managed lifecycle interacts with the repository-local `npx supabase` CLI, Podman socket/shim and `start.sh`;
- [ ] choose one canonical local Supabase lifecycle and remove stale/ambiguous instructions from `AGENTS.md`, `start.sh` comments and related docs;
- [ ] preserve the current rule that migrations and type generation use the repository-local CLI after the local stack is running, unless the review establishes a better supported workflow;
- [ ] document recovery/troubleshooting steps for a missing or stopped local Supabase stack so future agents do not guess or substitute another lifecycle manager silently.

This review is infrastructure/documentation cleanup and should remain separate from the AI profile/prompt evaluation work unless it blocks the required local migration/regression gate.

## 3D viewer interaction — free rotation (completed)

The primary Parametric/OpenSCAD viewer now uses unrestricted trackball-style rotation instead of the previous constrained orbit behavior.

Completed outcomes:

- [x] unrestricted rotation around all axes;
- [x] pan and zoom preserved;
- [x] model bounds/visual center remains the practical rotation target, so usability no longer depends on a convenient OpenSCAD origin;
- [x] desktop ViewGizmo can still snap back to canonical views after free rotation;
- [x] the control change was isolated from prompt/profile and stable-runtime behavior;
- [x] manual functional review confirmed the new rotation behavior works as intended.

Focused automated pointer/touch interaction coverage was not added before the control replacement. Add it later only if viewer-control regressions justify dedicated browser interaction tests.

## Settings UX and appearance — active

The next active UI/UX workstream is documented in:

- `docs/settings_ux_plan.md`

The plan covers:

- responsive Settings width and stable top alignment;
- responsive desktop/mobile Settings navigation;
- application-level `System / Light / Dark` appearance;
- optional information-hierarchy cleanup for advanced AI settings;
- contrast, focus, target-size, reflow, and reduced-motion review;
- desktop/mobile visual and repository regression gates.

This work must remain cosmetic/interaction-focused and must not alter Parametric, Creative, AI routing/profile semantics, Supabase contracts, or the stable-runtime recovery architecture.

## Completion

The native Creative replacement is complete. TRELLIS.2 is the sole built-in Creative backend, the project gate is green, both native generation paths have been proven, and the superseded Python runtime has been removed from both the repository and the workstation.

The free-rotation viewer improvement is also complete and manually verified. The active user-facing follow-up on this branch is now the Settings UX and appearance plan, with the local Supabase/NOx lifecycle review remaining a separate infrastructure/documentation task.
