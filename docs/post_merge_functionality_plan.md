# Post-merge functionality improvement plan

Status: **ACTIVE on `feature/post-merge-functionality`**

Activated: 2026-08-28 after the Brepia remake was fast-forwarded into `master` at `763dbbfad453c6a9522e50aadc392ff80673bf2f`.

This plan captures functional/runtime improvements discovered while finishing the Brepia remake. It is deliberately separated from the cosmetic/rebrand work so the merged Brepia baseline remains stable while functionality evolves on a dedicated branch.

The implementation work in this document starts from the updated post-Brepia `master`; the dedicated branch was created from that exact merge state before this program was activated.

## Goals

1. Keep the current Creative workflow stable while improving local 3D generation reliability, installability and resource usage.
2. Prefer simple native/GGML/GGUF runtimes when they provide comparable or better output than the current Python/CUDA-extension stack.
3. Provide both text-to-3D and image-to-3D without silently changing the model/path selected by the user.
4. Reduce dependence on fragile Python/CUDA-extension stacks where a validated native replacement exists.
5. Keep output/persistence contracts compatible with the existing pCAD/Brepia Creative workflow.
6. Preserve hosted fal.ai compatibility and historical Creative model IDs.
7. Remove confirmed dead dependencies through their real package-management workflow instead of carrying obsolete runtime metadata forward.
8. Route local model lifecycle through `llama-swap` where practical, using only thin protocol translation when an upstream runtime is not OpenAI-compatible.

## Locked target architecture — 2026-08-28 research decision

A broader current-runtime/model review was completed before implementation. The primary architecture is now locked unless real benchmark evidence disproves it.

### Primary text-to-3D path

```text
text prompt
  -> llama-swap
  -> Z-Image-Turbo / stable-diffusion.cpp
  -> generated conditioning image
  -> llama-swap
  -> thin OpenAI-protocol translator
  -> TRELLIS.2 / trellis.cpp
  -> textured/PBR GLB
  -> existing Brepia persistence/viewer contract
```

### Primary image-to-3D path

```text
user image
  -> llama-swap
  -> thin OpenAI-protocol translator
  -> TRELLIS.2 / trellis.cpp
  -> textured/PBR GLB
  -> existing Brepia persistence/viewer contract
```

### Why this is the primary path

- `stable-diffusion.cpp` provides a native/GGML-oriented image runtime and is already a natural fit for `llama-swap`.
- Z-Image-Turbo is the preferred text-conditioning model because it provides a strong quality/resource/installability balance for the target workstation.
- `trellis.cpp` provides a native TRELLIS.2 runtime with textured GLB output and a process model suitable for GPU load/unload arbitration.
- Text-to-3D and image-to-3D converge on the same primary 3D backend instead of requiring two separate product-facing 3D models.
- The target avoids rebuilding the product around a heavy Python/CUDA-extension stack.

### Integration rule: translator, not another gateway

Do **not** create a second general-purpose model gateway merely because `trellis.cpp` does not natively expose the OpenAI protocol expected by `llama-swap`.

Instead, add a deliberately small protocol translator whose only responsibilities are:

- accept the chosen OpenAI-compatible request shape;
- validate/translate request fields into the `trellis.cpp` request contract;
- call the local `trellis.cpp` server/process;
- translate success/error/artifact metadata back into the chosen OpenAI-compatible response shape;
- expose enough health information for `llama-swap` lifecycle management.

The translator must **not** own:

- model selection;
- GPU arbitration;
- a second model registry;
- persistence;
- conversation state;
- automatic model fallback/switching;
- artifact mirroring.

Those responsibilities remain with `llama-swap`, pCAD/Brepia and the existing persistence layer as appropriate.

## Mandatory challenger before product lock-in

The only required A/B challenger is:

- **Pixal3D via `trellis2.c`** for image-to-3D.

It is retained because its explicit pixel-to-3D correspondence may improve reconstruction quality while remaining compatible with a native CUDA/Vulkan direction.

It is **not** the default implementation because its runtime/server integration is currently less mature than `trellis.cpp`. It replaces TRELLIS.2/`trellis.cpp` only if the controlled benchmark shows a clear quality gain without unacceptable installation, reliability or lifecycle cost.

Other researched alternatives such as Qwen-Image-2512, FLUX.2 Klein, Step1X-3D, Shap-E and LLaMA-Mesh are not mandatory implementation candidates. They may be reopened only if the locked primary path fails a documented requirement.

## Current baseline after the remake branch

The intended current local Creative catalog is:

- `local/trellis-v1` — text + image to 3D;
- `local/hunyuan3d-2` — image required;
- `local/hunyuan3d-2.1` — image required.

Stable Fast 3D is retired and must not be reintroduced merely for compatibility with old installer assumptions.

The existing local gateway architecture remains the baseline until the replacement path is proven:

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
- Do not introduce Ollama, vLLM or another serving layer unless it solves a measured problem not already handled by llama-swap plus the selected native runtimes.
- Do not build a new generic gateway when a thin protocol translator is sufficient.

# Phase 0 — Establish a post-merge baseline

Start from the updated `master` after the Brepia remake merge.

- [x] Create a new dedicated functionality branch: `feature/post-merge-functionality`.
- [x] Read `AGENTS.md`, this plan and `docs/local_creative_mesh_backends.md`; preserve the relevant Brepia runtime/closeout constraints.
- [ ] Verify current Creative catalog and local gateway behavior in the real runtime.
- [x] Run the normal project validation gate before implementation (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` reported green by the operator on 2026-08-28 after the Lottie cleanup).
- [ ] Record a small benchmark set of representative text and image prompts.
- [ ] Record baseline latency, VRAM behavior, output size and failure modes for the currently retained local backends.

Acceptance criterion: the post-merge branch begins from a known-good baseline rather than treating failures inherited from the remake branch as new-backend regressions.

## Phase 0A — Dependency hygiene: remove obsolete `lottie-react`

The Brepia remake removed the only live Lottie consumer. Historically, `src/components/viewer/Loader.tsx` imported `lottie-react` and played `src/assets/adam-loading.json` with looping/autoplay behavior. The current Brepia loader instead renders `BrepiaMark` and CSS-driven motion, and `adam-loading.json` is gone.

Current static review therefore classifies `lottie-react` as an unused dependency rather than an active Brepia runtime requirement.

Removal was committed on this branch as `3fdc7fa55a560d48522f391f39dbf2213e4771d6` (`chore: remove unused lottie-react dependency`). The commit is one fast-forward commit after the plan activation commit and changes only `package.json` and `package-lock.json`.

- [x] Confirm the current loader no longer imports or renders `lottie-react`.
- [x] Confirm the historical usage was the removed Adam loading animation.
- [x] Remove the package with the real npm toolchain: `npm uninstall lottie-react`.
- [x] Accept the npm-generated `package.json` / `package-lock.json` changes; do not hand-edit the lockfile.
- [x] Re-run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` after removal; operator reported all green on 2026-08-28.
- [ ] Confirm the Brepia loader still behaves normally after the dependency removal during the next runtime smoke.

This cleanup is independent of the new Creative runtime work and must not introduce visual redesign or loader behavior changes.

# Phase 1 — Validate the locked Z-Image-Turbo + TRELLIS.2 native path

The first implementation spike is the locked primary architecture, not LLaMA-Mesh.

## Phase 1A — Z-Image-Turbo / stable-diffusion.cpp

- [ ] Confirm exact upstream/model license and redistribution constraints for the selected Z-Image-Turbo weights.
- [ ] Select a stable `stable-diffusion.cpp` build/release path for the target workstation.
- [ ] Select the initial GGUF/quantization and record model-file dependencies including text encoder/VAE requirements.
- [ ] Verify direct text-to-image generation outside pCAD.
- [ ] Verify OpenAI-compatible image generation through `llama-swap`.
- [ ] Measure cold-start, generation latency, peak VRAM, host RAM and shutdown/VRAM release.
- [ ] Verify deterministic error handling and health/readiness behavior.
- [ ] Verify generated conditioning images are suitable for 3D rather than merely attractive standalone images.

## Phase 1B — TRELLIS.2 / trellis.cpp

- [ ] Confirm exact upstream/runtime/model license and redistribution constraints.
- [ ] Select the initial quantization, preferring the best quality that reliably fits the target workstation.
- [ ] Verify image-to-textured/PBR-GLB generation outside pCAD.
- [ ] Measure cold-start, generation latency, peak VRAM, host RAM, output size and shutdown/VRAM release.
- [ ] Inspect topology, manifoldness where relevant, orientation/scale consistency and viewer/export compatibility.
- [ ] Verify machine-readable failures/timeouts.
- [ ] Verify the process/server can be cleanly started and stopped under llama-swap lifecycle expectations.

## Phase 1C — Thin OpenAI protocol translator for trellis.cpp

Before writing the translator, define the minimum contract in documentation/tests.

- [ ] Choose the OpenAI-compatible request/response surface used through `llama-swap`; do not pretend GLB output is an image response if that creates misleading semantics.
- [ ] Define image input, seed/options, artifact metadata and error mapping.
- [ ] Keep translator stateless and local.
- [ ] Add health/readiness behavior required by llama-swap.
- [ ] Confirm llama-swap can own process start/stop/TTL and GPU arbitration for the translated TRELLIS service.
- [ ] Ensure failed generation cannot create a false-success mesh row.
- [ ] Ensure generated file paths/artifacts remain conversation-scoped once pCAD persistence is involved.

## Phase 1D — Full locked pipeline spike

```text
text -> Z-Image-Turbo -> conditioning image -> TRELLIS.2 -> GLB
image ---------------------------------------------> TRELLIS.2 -> GLB
```

- [ ] Run representative text-to-3D prompts end-to-end.
- [ ] Run representative image-to-3D inputs end-to-end.
- [ ] Verify one-heavy-worker-at-a-time GPU behavior.
- [ ] Verify Z-Image is unloaded before/while TRELLIS requires the GPU when necessary.
- [ ] Verify no automatic model switching or hidden fallback occurs.
- [ ] Record measured results for Phase 3 comparison.

Acceptance criterion: the locked primary path must reliably produce a Brepia-viewable GLB from both text and image inputs with reproducible installation and clean GPU lifecycle behavior.

# Phase 2 — Pixal3D / trellis2.c challenger spike

This is a deliberately narrow challenger test, not a second product architecture.

- [ ] Confirm exact Pixal3D and `trellis2.c` licenses and redistribution constraints.
- [ ] Verify current native CUDA support on the target workstation.
- [ ] Verify image-to-textured-GLB end-to-end from the CLI/runtime.
- [ ] Measure installation complexity, cold-start, generation latency, peak VRAM, host RAM and output size.
- [ ] Compare geometry/reference-image adherence against TRELLIS.2/`trellis.cpp` using exactly the same benchmark images.
- [ ] Inspect topology, PBR/material output, orientation/scale consistency and viewer/export compatibility.
- [ ] Verify process shutdown/VRAM release behavior.
- [ ] Determine the minimum server/protocol wrapper required for llama-swap operation.
- [ ] Reject the challenger unless the quality gain is clear enough to justify any additional operational complexity.

Decision rule:

> **TRELLIS.2/`trellis.cpp` remains the default unless Pixal3D/`trellis2.c` wins materially on real output quality while remaining acceptably simple to install, serve, stop and integrate.**

# Phase 3 — Comparative benchmark and final runtime decision gate

The benchmark must use the same inputs and evaluation criteria for the primary path and challenger.

Compare:

- [ ] geometry quality;
- [ ] texture/PBR quality;
- [ ] conditioning/reference-image adherence;
- [ ] text prompt adherence through the full text-to-image-to-3D pipeline;
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

Default decision if results are comparable: choose **Z-Image-Turbo + TRELLIS.2/trellis.cpp** because it has the simpler/more mature runtime path.

# Phase 4 — Creative backend contract hardening

Before replacing normal product selection, make capability and runtime behavior explicit.

- [ ] Keep one authoritative Creative backend catalog.
- [ ] Preserve explicit capabilities such as `Text + image` and `Image required` where historical backends remain visible.
- [ ] Model the new primary path so text and image inputs can share the same 3D backend without UI-level duplication.
- [ ] Add enough backend metadata for runtime/provider routing without hardcoding UI assumptions.
- [ ] Never silently switch a selected model/path.
- [ ] Return backend-specific, actionable errors to the UI.
- [ ] Make readiness mean actual model/runtime health, not merely that a directory/executable exists.
- [ ] Keep one-heavy-worker-at-a-time policy unless measured evidence supports concurrency.
- [ ] Keep the thin translator free of application persistence/business logic.

# Phase 5 — Installer and model-storage improvements

The installer must treat model snapshots as real runtime assets, not disposable cosmetic cache.

- [ ] Provide a reproducible install/update path for `stable-diffusion.cpp`, Z-Image-Turbo and the selected TRELLIS runtime.
- [ ] Document which directories contain runtime binaries, model weights, text encoders/VAEs and disposable build/temp cache.
- [ ] Preserve valid downloaded model snapshots across environment rebuilds.
- [ ] Avoid redownloading large weights unnecessarily.
- [ ] Add optional selective backend installation only if useful after the final benchmark decision.
- [ ] Add an explicit uninstall/cleanup command or script for retired backends.
- [ ] Do not store secrets in repository files or terminal output.
- [ ] Ensure rerunning the installer cannot silently erase unrelated authentication configuration.
- [ ] Verify runtime probes before writing an environment as ready.

# Phase 6 — Product integration of the validated path

Only the Phase 3 winner enters the normal product path.

- [ ] Add stable model/backend IDs as required without breaking persisted historical IDs.
- [ ] Add capability metadata and user-facing descriptions.
- [ ] Add routing through llama-swap and the thin translator where required.
- [ ] Add focused validation tests.
- [ ] Add loading/progress semantics that do not invent determinate progress.
- [ ] Verify persistence to Supabase and conversation workspace.
- [ ] Verify GLB viewer behavior and exports.
- [ ] Verify desktop/mobile model/input selection and error presentation.
- [ ] Verify cancellation/reload/background behavior does not duplicate generation.
- [ ] Verify text-to-3D and image-to-3D both use the intended selected path with no hidden fallback.

Historical model IDs already persisted in conversations must remain loadable where required.

# Phase 7 — Retire superseded runtime pieces only after proof

A native backend may replace a Python backend only after real comparative and product validation.

- [ ] Identify Python environments/repositories no longer required.
- [ ] Remove only dead installer/runtime code.
- [ ] Provide cleanup instructions for local disk state.
- [ ] Keep migration/backward-compatibility handling for persisted conversation metadata.
- [ ] Rerun the complete validation gate.
- [ ] Perform real Creative runtime tests before merge.

Potential validated end state:

```text
llama-swap
  -> normal LLM/VLM models
  -> Z-Image-Turbo / stable-diffusion.cpp
  -> TRELLIS.2 translator / trellis.cpp

Brepia Creative
  text -> Z-Image-Turbo -> image -> TRELLIS.2 -> GLB
  image -------------------------> TRELLIS.2 -> GLB
```

Pixal3D/`trellis2.c` replaces the TRELLIS.2 runtime only if the controlled challenger benchmark materially justifies it.

# Deferred experimental candidates

These are explicitly **not** on the critical implementation path:

- LLaMA-Mesh direct text-to-mesh: technically attractive for llama.cpp/llama-swap but limited by output/detail considerations and licensing concerns identified during research.
- Qwen-Image-2512: reopen only if Z-Image-Turbo conditioning quality proves insufficient and the added VRAM/runtime cost is justified.
- FLUX.2 Klein: reopen only if a measured fast/low-resource text-conditioning profile becomes useful.
- TripoSG, Step1X-3D, Shap-E and other researched alternatives: reopen only if the locked primary/challenger paths fail a documented requirement.

# Deferred functional items to revisit in the same post-merge program

The following functionality topics should remain separate work items even if they share the Creative stack:

- [ ] Local Creative follow-up / semantic mesh editing.
- [ ] Better persisted progress/state for long local mesh jobs where the backend can expose real stages.
- [ ] Remaining mobile/background recovery edge cases only when the paused issue is deliberately reopened.
- [ ] Better backend diagnostics and operator-facing health/status information.
- [ ] Repository/deployment renames only as an independent decision.

# Completion criteria

This post-merge improvement program is complete only when:

1. the selected text-to-3D and image-to-3D paths have passed real end-to-end generation;
2. the TRELLIS.2 primary path has been compared against the mandatory Pixal3D challenger using the same benchmark set;
3. the preferred local path is documented with measured tradeoffs;
4. the installer can reproduce the selected runtime stack from a clean environment;
5. model weights/cache semantics are documented so required snapshots are not mistaken for disposable cache;
6. failed workers produce actionable errors rather than generic transport failures;
7. GPU arbitration with normal local LLM/VLM use remains stable under llama-swap;
8. obsolete backend code/environments are removed only after their replacement is proven;
9. the normal project test/typecheck/lint/build gate is green before merge.

## Governing rule

> **Use Z-Image-Turbo + TRELLIS.2/trellis.cpp as the default target architecture, with llama-swap owning model lifecycle and only a thin OpenAI-protocol translator where required. Benchmark Pixal3D/trellis2.c once as the quality challenger, and change the target only if measured results clearly justify the added complexity. Preserve the merged Brepia runtime and compatibility contracts throughout.**
