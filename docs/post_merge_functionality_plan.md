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

## Local Supabase lifecycle / NOx follow-up — final owner identification pending

Repository reconciliation and the first workstation inspection are complete. The current evidence does not expose any actual `nox`/`NOx` executable or NOx-named workstation configuration. The running local backend is a standard rootless-Podman Supabase CLI/Compose project named `cadam`, and the repository-local Supabase CLI sees that same stack.

Repo-side work completed:

- [x] confirmed there is no NOx implementation, launcher, service definition or configuration in this repository;
- [x] confirmed `start.sh` does not start/stop Supabase: it starts the rootless Podman socket, sets `DOCKER_HOST`, prepends the Podman compatibility shim, checks `npx supabase status`, and reads local credentials only after the stack is available;
- [x] preserved repository-local Supabase operations through `npx` after the stack is running;
- [x] reconciled `.cursor/rules/database-workflow.mdc` and `.cursor/rules/typescript-workflow.mdc`, removing stale `supabase start/stop` assumptions;
- [x] documented the current evidence and recovery boundary in `docs/local_supabase_lifecycle.md`;
- [x] added and then deepened `scripts/inspect-local-supabase-lifecycle.sh`, a read-only workstation inventory that avoids printing Supabase credential values;
- [x] updated `README.md` so NOx is not presented as a portable project dependency.

First workstation pass completed:

- [x] no `nox` or `NOx` command found;
- [x] no global `supabase` command found, which matches the repository-local CLI convention;
- [x] rootless `podman.socket` confirmed active;
- [x] repository-local Supabase CLI `2.114.0` confirmed able to detect the local stack;
- [x] full `supabase_*_cadam` container set confirmed running;
- [x] inspected containers confirmed with `com.supabase.cli.project=cadam` and `com.docker.compose.project=cadam` labels;
- [x] one candidate user service found: failed `postgres.service` with description `Supabase PostgREST`;
- [x] one candidate per-user config found: `~/.config/supabase.env`.

Remaining workstation evidence:

- [ ] inspect the safe metadata for `postgres.service` to establish what executable/configuration it belongs to and whether it is obsolete;
- [ ] inspect only the key names/references for `~/.config/supabase.env` to establish its role without exposing credential values;
- [ ] inspect system-wide launcher/service locations and selected Compose working-directory/config-file labels for any missed external NOx launcher;
- [ ] choose the single canonical start/stop/status lifecycle. If the second pass still finds no real NOx owner, retire the NOx wording and make repository-local `npx supabase start/stop/status` the explicit workstation lifecycle, retaining the rootless Podman compatibility environment where required.

Updated workstation discovery command:

```bash
bash scripts/inspect-local-supabase-lifecycle.sh
```

The second-pass output is the final evidence needed to close this workstream without guessing.

This review is infrastructure/documentation cleanup and should remain separate from AI profile/prompt evaluation unless it blocks a required local migration/regression gate.

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

## Completion / current active work

The native Creative replacement is complete. TRELLIS.2 is the sole built-in Creative backend, the project gate is green, both native generation paths have been proven, and the superseded Python runtime has been removed from both the repository and the workstation.

The final free-rotation/zoom viewer behavior is complete and manually verified.

The Settings UX and appearance plan is complete, including Phase 6 final verification.

The only remaining active item in this plan is the **final workstation owner identification for the local Supabase lifecycle**. Other deferred work should remain in its dedicated plan/status files and must not be reopened implicitly.
