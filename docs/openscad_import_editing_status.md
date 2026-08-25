# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

**Step 1 — Render safety foundation is complete and externally verified green.**

**Step 2 — Imported artifact persistence primitive is implemented in code; focused runtime verification is pending.**

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

## Step 1 — Render safety foundation — COMPLETE

- [x] Shared SCAD source-size policy: 256,000 UTF-8 bytes.
- [x] Shared source-size limit with native server-side validation.
- [x] 20,000 ms request timeout for preview/export/tool worker operations.
- [x] Preview-worker terminate/recreate recovery.
- [x] Tool-worker terminate/recreate recovery.
- [x] Pending-request cleanup on timeout/crash/message error.
- [x] Ordinary compiler errors preserve a healthy worker.
- [x] 64 MiB combined primary/companion output-size guard.
- [x] Worker-side output guard before returning large results.
- [x] Native validation output guard without reading oversized output into memory.
- [x] Cached worker filesystem files replay after worker recovery.
- [x] Focused limit and lifecycle tests added.
- [x] Focused Vitest tests verified green by operator.
- [x] Full Vitest regression suite verified green by operator.
- [x] Typecheck verified green by operator.
- [x] ESLint verified green by operator.
- [x] Production build verified green by operator.

Step 1 gate closed on 2026-08-25 after operator reported all requested validation green.

## Step 2 — Imported artifact persistence primitive

### Implemented

- [x] Add typed import provenance metadata (`artifactOrigin`).
- [x] Add pure shared builder for import-event + synthetic assistant artifact rows.
- [x] Add client persistence service using one bulk `messages` INSERT for the two-row baseline.
- [x] Generate stable synthetic `tool_import_<uuid>` tool-call IDs.
- [x] Support successful baseline as `output-available` with normal build output.
- [x] Support retained compile failure as `output-error` with bounded `errorText` supplied by caller.
- [x] Ensure imported baseline never uses dangling `input-available`/`input-streaming` state.
- [x] Keep complete SCAD only in normal `build_parametric_model.input`, not ordinary chat text or metadata.
- [x] Keep import event as a user root and imported artifact as its assistant child.
- [x] Verify by focused test construction that artifact extraction sees both success and error baselines.
- [x] Verify by focused test construction that a successful imported artifact is discovered by workspace revision logic as a normal build.
- [x] Verify failed import is not falsely recorded as a successful workspace revision.
- [x] Add focused tests in `tests/importedArtifact.test.ts`.

### Runtime gate pending

- [ ] Run `tests/importedArtifact.test.ts` successfully.
- [ ] Run full Vitest regression suite successfully.
- [ ] Run typecheck successfully.
- [ ] Run ESLint successfully.
- [ ] Run production build successfully.

Recommended validation:

```bash
npm test -- tests/importedArtifact.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Do not start Step 3 until this gate passes.

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

Close the **Step 2 runtime gate**. If green, mark Step 2 complete and proceed to **Step 3 — Local `.scad` upload**.
