# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

**Step 1 — Render safety foundation is implemented in code, but its runtime gate is not yet closed.**

The implementation now uses shared OpenSCAD resource limits, bounded worker requests, terminate/recreate recovery, pending-request cleanup, crash/message-error recovery, output-size guards, and replay of cached worker filesystem files after a worker reset.

Focused Vitest coverage has been added for the shared limits and worker lifecycle. The tests have not been executed in the current ChatGPT execution environment because the repository has no GitHub Actions workflow and the available local container cannot resolve GitHub to clone/install the project. Do not mark Step 1 complete until the commands and manual recovery scenarios below pass in a normal pCAD checkout.

## Completed architecture/audit work

- [x] Verify current master commit.
- [x] Audit current `EditorView` artifact selection and message-tree behavior.
- [x] Audit `OpenSCADViewer`, `useOpenSCAD`, WASM worker and worker FS behavior.
- [x] Audit `ParametricArtifact`, `build_parametric_model` and parametric part helpers.
- [x] Audit message persistence, parent/leaf semantics, retry/restore and branching.
- [x] Audit server-side DB branch loading and `convertToModelMessages()` path.
- [x] Verify OpenCode receives the authoritative current complete artifact.
- [x] Audit existing bundled BOSL/BOSL2/MCAD loading.
- [x] Audit current `import("...")` mesh-file handling and its limitations.
- [x] Audit conversation workspace and immutable model revisions.
- [x] Audit current native OpenSCAD validation limits/timeouts.
- [x] Define V1 upload boundary.
- [x] Define V1 GitHub/Gist URL-import security boundary.
- [x] Define V1 dependency boundary and V2/V3 extension path.
- [x] Identify missing worker timeout/recovery as a V1 prerequisite.
- [x] Record existing `Fix with AI` wiring gap for regression work.

## Step 1 — Render safety foundation

### Implemented

- [x] Add shared SCAD source-size policy: 256,000 UTF-8 bytes.
- [x] Share the source-size limit with native server-side OpenSCAD validation.
- [x] Add 20,000 ms request timeout for preview/export/tool worker operations.
- [x] Add preview-worker terminate/recreate recovery.
- [x] Add tool-worker terminate/recreate recovery.
- [x] Cleanly reject and clear all pending requests on timeout/crash/message error.
- [x] Preserve ordinary compiler errors without unnecessarily discarding a healthy worker.
- [x] Add 64 MiB combined primary/companion output-size guard.
- [x] Enforce output limit inside the worker before returning large results.
- [x] Enforce the same output policy in native server validation without reading an oversized output into memory.
- [x] Replay cached worker filesystem files after a timeout/crash creates a fresh worker.
- [x] Add focused limit tests in `tests/openScadLimits.test.ts`.
- [x] Add focused worker lifecycle/recovery tests in `tests/openScadWorkerClient.test.ts`.

### Runtime gate still pending

- [ ] Run focused Vitest tests successfully.
- [ ] Run the full Vitest regression suite successfully.
- [ ] Run TypeScript/typecheck successfully.
- [ ] Run ESLint successfully.
- [ ] Run production build successfully.
- [ ] Verify a normal cube compiles in the real browser worker.
- [ ] Verify a syntax error returns diagnostics without wedging the worker.
- [ ] Verify a pathological/extreme model reaches the timeout and the worker terminates.
- [ ] Verify a normal model compiles immediately after the forced timeout.
- [ ] Verify an existing `import("mesh.stl")` flow rewrites its cached file after worker recovery.
- [ ] Verify AI `build_parametric_model` compilation succeeds after a prior tool-worker timeout.

Recommended automated validation:

```bash
npm test -- tests/openScadLimits.test.ts tests/openScadWorkerClient.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Step 1 remains the active gate. **Do not start Step 2 or user-facing import until the timeout/recovery scenarios above are actually executed and pass.**

## Step 2 — Imported artifact persistence primitive

- [ ] Add import-event + synthetic assistant artifact persistence helper.
- [ ] Add import provenance metadata.
- [ ] Support `output-available` successful baseline.
- [ ] Support bounded `output-error` baseline when retained for repair.
- [ ] Ensure no dangling `input-available` initial state.
- [ ] Verify parent chain and current leaf semantics.
- [ ] Verify artifact extraction/preview discovery.
- [ ] Verify retry/restore/branch behavior.
- [ ] Verify workspace model revision discovery.

## Step 3 — Local `.scad` upload

- [ ] Add single-file import UI.
- [ ] Validate `.scad`, 256 kB max and strict UTF-8.
- [ ] Add dependency preflight.
- [ ] Run bounded compile before opening editor.
- [ ] Create parametric conversation and imported message pair.
- [ ] Open imported artifact as current preview.
- [ ] Add fixtures/tests for supported and unsupported inputs.

## Step 4 — AI continuation

- [ ] Verify first user edit receives exact imported complete artifact.
- [ ] Verify standard AI SDK provider.
- [ ] Verify OpenCode CLI.
- [ ] Verify OpenCode streaming.
- [ ] Verify refresh before first edit.
- [ ] Verify parameter edit followed by AI edit.
- [ ] Verify retry/branching/history continuity.

## Step 5 — GitHub/Gist URL import

- [ ] Add GitHub blob URL normalization.
- [ ] Add raw GitHub URL normalization.
- [ ] Add single-file Gist import.
- [ ] Enforce same source validation and dependency preflight as upload.
- [ ] Add malformed/security test cases.
- [ ] Verify no generic arbitrary-host server fetch exists.

## Step 6 — Full editor regression and product polish

- [ ] Preview regression.
- [ ] Parameter UI/persistence regression.
- [ ] Reload/history/branch regression.
- [ ] Fix with AI wiring verification/fix.
- [ ] STL export regression.
- [ ] DXF export regression.
- [ ] Share regression.
- [ ] Conversation-workspace current/revision regression.
- [ ] Ordinary non-imported conversation regression.

## V1 boundaries

In scope:

- one `.scad` upload;
- one supported GitHub/Gist `.scad` URL;
- self-contained SCAD;
- bundled BOSL/BOSL2/MCAD include/use;
- normal pCAD artifact/edit/history/export semantics.

Deferred:

- multi-file SCAD;
- ZIP projects;
- relative/custom include/use dependencies;
- imported STL/SVG/DXF assets as SCAD-project dependencies;
- workspace/file-tree UI;
- GitHub repository/directory import;
- dependency resolution;
- re-import/sync;
- generic arbitrary public URL fetching.

## Next action

Close the **Step 1 runtime gate** using the automated commands and manual worker-recovery scenarios above. If all pass, mark Step 1 complete and proceed to **Step 2 — Imported artifact persistence primitive**.
