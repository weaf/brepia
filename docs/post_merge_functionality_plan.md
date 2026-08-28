# Post-merge functionality improvement plan

Status: **ACTIVE on `feature/post-merge-functionality`**

Activated: 2026-08-28 after the Brepia remake was fast-forwarded into `master` at `763dbbfad453c6a9522e50aadc392ff80673bf2f`.

This plan captures functional/runtime improvements discovered while finishing the Brepia remake. It is deliberately separated from the cosmetic/rebrand work so the merged Brepia baseline remains stable while functionality evolves on a dedicated branch.

The implementation work in this document starts from the updated post-Brepia `master`; the dedicated branch was created from that exact merge state before this program was activated.

## Goals

1. Keep the current Creative workflow stable while improving local 3D generation reliability, installability and resource usage.
2. Evaluate simpler GGML/GGUF/native runtimes where they provide a real operational advantage.
3. Add local text-to-3D alternatives without silently changing the model selected by the user.
4. Reduce dependence on fragile Python/CUDA-extension stacks where a validated native replacement exists.
5. Keep output/persistence contracts compatible with the existing pCAD/Brepia Creative workflow.
6. Preserve hosted fal.ai compatibility and historical Creative model IDs.
7. Remove confirmed dead dependencies through their real package-management workflow instead of carrying obsolete runtime metadata forward.

## Current baseline after the remake branch

The intended local Creative catalog is:

- `local/trellis-v1` — text + image to 3D;
- `local/hunyuan3d-2` — image required;
- `local/hunyuan3d-2.1` — image required.

Stable Fast 3D is retired and must not be reintroduced merely for compatibility with old installer assumptions.

The existing local gateway architecture remains the baseline until a replacement is proven:

```text
Brepia/pCAD
  -> local mesh provider
  -> loopback mesh gateway
  -> one local 3D worker at a time
  -> GLB
  -> Supabase mesh persistence
  -> conversation workspace mirror
```

GPU arbitration with llama-swap remains important on a single-GPU workstation. A new backend must not assume that it may permanently occupy VRAM.

## Non-goals

- Do not reopen the Brepia visual redesign in this work.
- Do not change `CADAM Original` prompt lineage as part of local 3D runtime work.
- Do not rename compatibility-sensitive `PCAD_*`, database/storage identifiers or existing external integration IDs merely because a backend changes.
- Do not remove working Hunyuan/TRELLIS paths before a replacement has passed real end-to-end validation.
- Do not silently substitute one Creative backend for another.
- Do not couple image-to-3D support to `llama.cpp` terminology when the actual runtime is another GGML/GGUF-native project.

# Phase 0 — Establish a post-merge baseline

Start from the updated `master` after the Brepia remake merge.

- [x] Create a new dedicated functionality branch: `feature/post-merge-functionality`.
- [x] Read `AGENTS.md`, this plan and `docs/local_creative_mesh_backends.md`; preserve the relevant Brepia runtime/closeout constraints.
- [ ] Verify current Creative catalog and local gateway behavior in the real runtime.
- [ ] Run the normal project validation gate before implementation.
- [ ] Record a small benchmark set of representative text and image prompts.
- [ ] Record baseline latency, VRAM behavior, output size and failure modes for the currently retained local backends.

Acceptance criterion: the post-merge branch begins from a known-good baseline rather than treating failures inherited from the remake branch as new-backend regressions.

## Phase 0A — Dependency hygiene: remove obsolete `lottie-react`

The Brepia remake removed the only live Lottie consumer. Historically, `src/components/viewer/Loader.tsx` imported `lottie-react` and played `src/assets/adam-loading.json` with looping/autoplay behavior. The current Brepia loader instead renders `BrepiaMark` and CSS-driven motion, and `adam-loading.json` is gone.

Current static review therefore classifies `lottie-react` as an unused dependency rather than an active Brepia runtime requirement.

- [x] Confirm the current loader no longer imports or renders `lottie-react`.
- [x] Confirm the historical usage was the removed Adam loading animation.
- [ ] Remove the package with the real npm toolchain: `npm uninstall lottie-react`.
- [ ] Accept the npm-generated `package.json` / `package-lock.json` changes; do not hand-edit the lockfile.
- [ ] Re-run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` after removal.
- [ ] Confirm the Brepia loader still behaves normally after the dependency removal.

This cleanup is deliberately independent of the LLaMA-Mesh/`trellis.cpp` experiments and should not introduce visual redesign or loader behavior changes.

# Phase 1 — LLaMA-Mesh feasibility spike

Evaluate LLaMA-Mesh as an **additional** local text-to-3D backend using the existing llama.cpp/llama-swap ecosystem where practical.

The architectural attraction is that the model emits mesh representation through an LLM-style inference path instead of requiring a separate heavy Python 3D pipeline.

Questions to answer before product integration:

- [ ] Confirm the exact upstream/model license and redistribution constraints.
- [ ] Confirm current GGUF availability and the exact llama.cpp feature path required.
- [ ] Verify output representation and a deterministic conversion path into a mesh format Brepia can consume.
- [ ] Measure usable quantization on the target workstation.
- [ ] Measure cold-start time, inference time and peak VRAM.
- [ ] Test representative CAD-like prompts, not only demo objects.
- [ ] Inspect topology quality, manifoldness, scale/orientation consistency and export compatibility.
- [ ] Determine whether output should enter the existing mesh gateway contract or a llama-swap-specific provider adapter.
- [ ] Verify that running it through llama-swap does not disturb normal Qwen/OpenCode/Codex model selection.

Do not expose LLaMA-Mesh in the normal model picker until the spike can reliably produce an artifact accepted by the existing Creative persistence/viewer path.

## Experimental integration boundary

Preferred first implementation:

```text
Creative request
  -> experimental LLaMA-Mesh adapter
  -> llama-swap / llama.cpp
  -> mesh text/representation
  -> strict parser + validation
  -> OBJ/GLB conversion
  -> existing mesh persistence contract
```

Required safety properties:

- malformed generated mesh text must fail explicitly;
- parser must not execute arbitrary generated content;
- generated file paths remain conversation-scoped;
- no model auto-switching;
- failed generation must not create a false-success mesh row.

# Phase 2 — `trellis.cpp` feasibility spike

Evaluate `trellis.cpp` as a possible native GGML/GGUF replacement for part or all of the current Python TRELLIS image-to-3D runtime.

This is a separate runtime from llama.cpp even when both use the GGML/GGUF ecosystem. Keep that distinction explicit in code and documentation.

- [ ] Verify current upstream maturity, license, supported platforms and model formats.
- [ ] Build with the workstation's preferred GPU backend.
- [ ] Test supported quantizations and record disk/VRAM requirements.
- [ ] Verify image-to-textured-GLB end-to-end.
- [ ] Test model quality against the retained Python TRELLIS/Hunyuan paths.
- [ ] Test cold-start behavior and whether the process can be started/stopped cleanly for GPU arbitration.
- [ ] Check whether its HTTP/server mode is stable enough to sit behind the existing pCAD mesh provider contract.
- [ ] Verify errors/timeouts are machine-readable and can be surfaced without generic `fetch failed` messages.
- [ ] Evaluate text-to-image-to-3D capability separately from direct text-conditioned 3D generation; do not present the two as equivalent.

Preferred first architecture:

```text
Brepia local mesh provider
  -> pCAD gateway/adapter
  -> trellis.cpp server/process
  -> textured GLB
```

Avoid rewriting the main application around a prototype-specific API. Adapt the prototype to the existing provider boundary where possible.

# Phase 3 — Comparative benchmark and decision gate

Do not choose a replacement based only on installation simplicity.

For every candidate retained after the spikes, compare:

- [ ] geometry quality;
- [ ] texture quality where applicable;
- [ ] prompt adherence;
- [ ] topology/manifoldness;
- [ ] CAD/viewer/export interoperability;
- [ ] generation latency;
- [ ] cold-start latency;
- [ ] peak VRAM;
- [ ] host RAM;
- [ ] disk footprint including model snapshots;
- [ ] installation reproducibility;
- [ ] upgrade/rebuild risk;
- [ ] error observability;
- [ ] process shutdown/VRAM release behavior;
- [ ] compatibility with llama-swap GPU arbitration;
- [ ] license/deployment constraints.

Decision outcomes are allowed to be different by capability. For example, one backend may be best for text-to-3D while another remains best for image-to-3D.

# Phase 4 — Creative backend contract hardening

Before adding more selectable models, make capability and runtime behavior explicit.

- [ ] Keep one authoritative Creative backend catalog.
- [ ] Preserve explicit capabilities such as `Text + image` and `Image required`.
- [ ] Add enough backend metadata for runtime/provider routing without hardcoding UI assumptions.
- [ ] Keep early validation for image-required models.
- [ ] Never silently switch a selected model.
- [ ] Return backend-specific, actionable errors from gateway to UI.
- [ ] Improve gateway health so `installed=true` means more than “repo directory and Python executable exist”.
- [ ] Add backend readiness/import/model-file checks appropriate to each runtime.
- [ ] Keep one-heavy-worker-at-a-time policy unless measured evidence supports concurrency.

# Phase 5 — Installer and model-storage improvements

The installer must treat model snapshots as real runtime assets, not disposable cosmetic cache.

- [ ] Document which cache directories contain actual model weights.
- [ ] Make installer output distinguish code, environments, model snapshots and disposable temporary/build cache.
- [ ] Preserve valid downloaded model snapshots across environment rebuilds.
- [ ] Avoid redownloading large weights unnecessarily.
- [ ] Add optional selective backend installation if the local catalog grows.
- [ ] Add an explicit uninstall/cleanup command or script for retired backends.
- [ ] Do not store secrets in repository files or terminal output.
- [ ] Ensure rerunning the installer cannot silently erase unrelated authentication configuration.
- [ ] Verify critical imports/runtime probes before writing an environment as ready.

# Phase 6 — Product integration of validated candidates

Only candidates that pass Phase 3 should enter normal product selection.

For each accepted backend:

- [ ] Add a stable model ID.
- [ ] Add capability metadata and user-facing description.
- [ ] Add provider routing.
- [ ] Add focused validation tests.
- [ ] Add loading/progress semantics that do not invent determinate progress.
- [ ] Verify persistence to Supabase and conversation workspace.
- [ ] Verify GLB/OBJ conversion and viewer behavior as applicable.
- [ ] Verify desktop/mobile model selection and error presentation.
- [ ] Verify cancellation/reload/background behavior does not duplicate generation.

Historical model IDs already persisted in conversations must remain loadable where required.

# Phase 7 — Retire superseded runtime pieces only after proof

A native backend may replace a Python backend only after real comparative validation.

- [ ] Identify Python environments/repositories no longer required.
- [ ] Remove only dead installer/runtime code.
- [ ] Provide cleanup instructions for local disk state.
- [ ] Keep migration/backward-compatibility handling for persisted conversation metadata.
- [ ] Rerun the complete validation gate.
- [ ] Perform real Creative runtime tests before merge.

Potential end state if validation supports it:

```text
llama-swap / llama.cpp
  -> normal LLM/VLM models
  -> optional LLaMA-Mesh text-to-3D

pCAD/Brepia local mesh gateway
  -> native trellis.cpp image-to-3D
  -> retained Hunyuan backend(s) only where they still provide value
```

This is a target hypothesis, not a predetermined migration.

# Deferred functional items to revisit in the same post-merge program

The following functionality topics should remain separate work items even if they share the Creative stack:

- [ ] Local Creative follow-up / semantic mesh editing.
- [ ] Better persisted progress/state for long local mesh jobs where the backend can expose real stages.
- [ ] Remaining mobile/background recovery edge cases only when the paused issue is deliberately reopened.
- [ ] Better backend diagnostics and operator-facing health/status information.
- [ ] Repository/deployment renames only as an independent decision.

# Completion criteria

This post-merge improvement program is complete only when:

1. every newly exposed backend has passed real end-to-end generation;
2. the preferred local text-to-3D and image-to-3D paths are documented with measured tradeoffs;
3. the installer can reproduce the selected runtime stack from a clean environment;
4. model weights/cache semantics are documented so required snapshots are not mistaken for disposable cache;
5. failed workers produce actionable errors rather than generic transport failures;
6. GPU arbitration with normal local LLM/VLM use remains stable;
7. obsolete backend code/environments are removed only after their replacement is proven;
8. the normal project test/typecheck/lint/build gate is green before merge.

## Governing rule

> **Improve functionality from the clean post-Brepia master baseline, introducing new local 3D runtimes only when they measurably improve quality, reliability or operational simplicity. Preserve the merged Brepia runtime and compatibility contracts while doing so.**
