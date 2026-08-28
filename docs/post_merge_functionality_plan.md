# Post-merge functionality improvement plan

Status: **ACTIVE on `feature/post-merge-functionality`**

Activated: 2026-08-28 after the Brepia remake was fast-forwarded into `master` at `763dbbfad453c6a9522e50aadc392ff80673bf2f`.

This program evolves functionality from the known-good post-Brepia baseline. The stable runtime, persistence contracts, historical IDs and `CADAM Original` lineage remain protected while the local Creative runtime is replaced.

## Operator decision — skip the old Phase 0 benchmark gate

On 2026-08-28 the operator explicitly chose to skip the pre-implementation Creative benchmark/baseline phase.

Reason: the current local Creative implementation is already known to work. The safer and more useful sequence is now:

```text
keep current runtime working
-> implement the new native runtime in parallel
-> validate new image-to-3D end-to-end
-> validate new text-to-3D end-to-end
-> only then remove the superseded local Python runtime
```

This means there is **no requirement to benchmark the old TRELLIS/Hunyuan stack before implementation**. The old stack remains the rollback path until the replacement is proven.

The normal project gate before this work was green. After the Lottie cleanup the operator reported all of these green on 2026-08-28:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

## Locked target architecture

The primary product backend is one Creative model ID:

```text
local/trellis2  ->  TRELLIS.2
```

It supports both text and image input.

### Text-to-3D

```text
text prompt
  -> pCAD
  -> llama-swap
  -> creative/z-image-turbo
  -> stable-diffusion.cpp / Z-Image-Turbo
  -> conditioning PNG
  -> llama-swap /upstream/creative/trellis2/generate
  -> trellis.cpp / TRELLIS.2
  -> textured/PBR GLB
  -> existing Supabase + conversation workspace + viewer contract
```

### Image-to-3D

```text
user image
  -> pCAD
  -> llama-swap /upstream/creative/trellis2/generate
  -> trellis.cpp / TRELLIS.2
  -> textured/PBR GLB
  -> existing Supabase + conversation workspace + viewer contract
```

### Important simplification discovered during implementation

A separate translator process/gateway is **not required**.

Current llama-swap exposes a generic `/upstream/<model>/<path>` passthrough and resolves model IDs containing slashes. Therefore pCAD can do the small request-shape adaptation inside its existing server boundary and still let llama-swap own process startup, swapping, TTL and GPU arbitration.

The resulting boundary is:

```text
pCAD src/server/nativeCreativeMesh.ts
  -> OpenAI image API for Z-Image when text input is used
  -> multipart request through llama-swap /upstream/... for TRELLIS.2
```

Do not introduce another general-purpose local model gateway unless a future runtime proves that llama-swap cannot manage it directly.

## Runtime IDs

Product/persisted ID:

- `local/trellis2` — TRELLIS.2, text + image capable.

llama-swap runtime IDs:

- `creative/z-image-turbo` — `stable-diffusion.cpp` + Z-Image-Turbo.
- `creative/trellis2` — `trellis.cpp` / TRELLIS.2.

The runtime IDs are intentionally separate from the product ID. Changing an implementation detail later must not require renaming persisted Creative model metadata.

## Transitional compatibility

Until the new path passes real runtime validation, keep these existing local IDs and their implementation intact:

- `local/trellis-v1`
- `local/hunyuan3d-2`
- `local/hunyuan3d-2.1`

Keep historical fal.ai IDs unchanged:

- `quality`
- `fast`
- `ultra`

Stable Fast 3D remains retired and must not return.

# Phase 1 — Parallel application integration

Goal: make the new path selectable without changing or deleting the working old path.

Current implementation status:

- [x] Add stable product ID `local/trellis2` to the authoritative Creative catalog.
- [x] Expose TRELLIS.2 as `Text + image`, GLB output, no semantic follow-up mesh editing yet.
- [x] Preserve the old three local model IDs during the transition.
- [x] Add UI mesh configuration for `local/trellis2`.
- [x] Add catalog/input-validation tests for the new model.
- [x] Route `local/trellis2` to a dedicated native handler while leaving `src/server/localMesh.ts` unchanged for the old backends.
- [x] Preserve the existing local single-flight/reconnect protection in `src/server/mesh.ts` for the new backend.
- [x] For image input, send the reference image directly to TRELLIS.2.
- [x] For text-only input, generate a hidden conditioning image through `creative/z-image-turbo`, then send it to TRELLIS.2.
- [x] Route TRELLIS.2 through llama-swap `/upstream/creative/trellis2/generate`; no second gateway/translator service.
- [x] Preserve existing Supabase mesh persistence and conversation-workspace mirroring.
- [x] Mark a failed native generation as failure; do not create false-success mesh rows.
- [x] Reject multiple reference images explicitly while the selected TRELLIS server contract accepts one image.
- [x] Add a transitional loading-time entry so the exhaustive `CreativeModel` timing map remains type-safe.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` on the implementation commits.

Implementation files include:

- `shared/creativeMeshModels.ts`
- `src/constants/meshConstants.ts`
- `src/lib/creativeInputValidation.ts`
- `src/hooks/useLoadingProgress.tsx`
- `src/server/mesh.ts`
- `src/server/nativeCreativeMesh.ts`
- `tests/creativeMeshModels.test.ts`

Acceptance criterion: the application compiles/tests cleanly while the old and new local backends coexist.

# Phase 2 — Reproducible native runtime install

Goal: install both native runtimes without destroying the working Python stack.

Implemented installer:

```text
scripts/install-native-creative-backends.sh
```

Initial runtime choices:

- Z-Image-Turbo: Q4_K diffusion model.
- Z-Image text encoder: Qwen3-4B-Instruct-2507 Q4_K_M.
- Z-Image VAE: `ae.safetensors`.
- `stable-diffusion.cpp`: pinned Linux Vulkan binary release for installation simplicity.
- TRELLIS.2: Q8 weights, using the official `trellis.cpp` CUDA runtime installer.
- llama-swap TTL: 30 seconds for both Creative runtime entries during validation.

Installer behavior:

- [x] Keep runtime/model files outside the pCAD repository.
- [x] Reuse already downloaded files where practical.
- [x] Verify the pinned stable-diffusion.cpp archive checksum.
- [x] Use the official TRELLIS.2 installer with `--quant q8 --backend cuda --skip-app`.
- [x] Back up the current llama-swap config before appending Creative entries.
- [x] Add `creative/z-image-turbo` and `creative/trellis2` only; do not alter existing Qwen/vision models.
- [x] Do not remove the existing local mesh service or Python environments.
- [ ] Run shell syntax/static validation locally.
- [ ] Run the installer on the target workstation.
- [ ] Restart/reload llama-swap and confirm both new runtime IDs appear in `/v1/models`.

If Vulkan Z-Image proves materially slower than desired, replace only that runtime build with CUDA later. The pCAD/llama-swap contract must not change merely because the backend build changes.

# Phase 3 — Runtime proof before removal

The new path is not considered proven by compilation or model discovery alone.

Run in this order so failures are easy to isolate.

## 3A — Image-to-3D first

- [ ] Select `TRELLIS.2` / `local/trellis2` in Creative mode.
- [ ] Attach one reference image.
- [ ] Produce a real GLB through `llama-swap -> trellis.cpp`.
- [ ] Confirm GLB is visible in the pCAD viewer.
- [ ] Confirm mesh row/storage persistence succeeds.
- [ ] Confirm conversation workspace mirroring succeeds.
- [ ] Confirm llama-swap unloads the runtime after TTL and VRAM is released.

## 3B — Text-to-3D

- [ ] Select `TRELLIS.2` with no reference image.
- [ ] Generate a conditioning PNG through `creative/z-image-turbo`.
- [ ] Confirm llama-swap swaps from Z-Image to TRELLIS.2 rather than keeping both heavyweight workers resident.
- [ ] Produce and display a real GLB.
- [ ] Confirm persistence/workspace mirroring succeeds.
- [ ] Confirm actionable errors if either runtime is unavailable.

## 3C — Runtime regressions

- [ ] Verify reconnect/background behavior does not duplicate a generation.
- [ ] Verify failed generations remain failures rather than completed mesh records.
- [ ] Verify an existing old local backend still works during the transition.
- [ ] Rerun `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` after any fixes found by runtime testing.

Acceptance criterion:

> Both image-to-3D and text-to-3D must produce real, persisted, viewable GLBs through the new llama-swap-managed path before any old runtime is removed.

# Phase 4 — Remove the superseded local Python stack

Start only after Phase 3 is green.

Removal target if the new backend succeeds:

- old loopback pCAD mesh gateway runtime;
- old per-backend Python workers/environments for TRELLIS v1 and Hunyuan;
- obsolete installer/service code tied only to those workers;
- normal product selection entries for superseded local backends.

Requirements:

- [ ] Decide how historical conversations containing old local IDs remain readable; persisted metadata must not crash the UI.
- [ ] Remove old local models from new model selection without rewriting historical records.
- [ ] Remove `scripts/local-mesh/gateway.py` / worker code only when no active route depends on it.
- [ ] Remove or replace `scripts/install-local-mesh-backends.sh` only when the native installer fully covers the supported local product path.
- [ ] Provide explicit cleanup instructions for the old `~/.local/share/pcad-mesh` installation/service.
- [ ] Remove dead old runtime configuration from active application code.
- [ ] Rerun the complete project validation gate.
- [ ] Run final text-to-3D and image-to-3D smoke tests after cleanup.

Do **not** delete the old stack merely because the new runtime starts. Removal requires real generated GLBs in pCAD.

# Optional challenger — Pixal3D / trellis2.c

Pixal3D remains an interesting quality challenger, but it is **not a blocker for implementing or shipping the locked TRELLIS.2 path** under the operator's revised sequence.

Reopen it only after the new primary backend works if there is a concrete reason to seek better image reconstruction quality.

- [ ] Optional A/B against TRELLIS.2 using identical images.
- [ ] Replace the primary backend only for a clear quality win that does not materially worsen installation/runtime simplicity.

LLaMA-Mesh, Qwen-Image-2512, FLUX.2 Klein, Step1X-3D and other researched alternatives remain deferred unless the locked path fails a real requirement.

# Completed dependency cleanup

`lottie-react` was removed because the Brepia loader no longer uses the historical Adam Lottie animation.

- [x] Removed with npm (`3fdc7fa55a560d48522f391f39dbf2213e4771d6`).
- [x] npm-generated `package.json` / `package-lock.json` changes retained.
- [x] Operator reported test/typecheck/lint/build green after removal.

# Non-goals / invariants

- Do not reopen the Brepia visual redesign.
- Do not change `CADAM Original` prompt lineage.
- Do not revert the stable-runtime/mobile recovery architecture.
- Do not rename compatibility-sensitive `PCAD_*`, database/storage identifiers or external integration IDs just because the runtime changes.
- Do not silently substitute one selected Creative backend for another.
- Do not introduce another generic gateway while llama-swap can own lifecycle/routing directly.
- Do not remove a working fallback before its replacement is proven end-to-end.

# Completion criteria

The local Creative replacement is complete when:

1. `local/trellis2` generates a real GLB from an uploaded image;
2. `local/trellis2` generates a real GLB from text through Z-Image-Turbo;
3. both paths use llama-swap lifecycle/GPU arbitration successfully;
4. persistence, workspace mirroring and viewer behavior remain correct;
5. the old Python local mesh runtime has been removed only after those proofs;
6. historical data remains safe;
7. the final `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` gate is green.

## Governing rule

> **Implement the native Z-Image-Turbo + TRELLIS.2 path beside the known-working local stack, prove both text-to-3D and image-to-3D in the real application, and only then remove the superseded Python runtime.**
