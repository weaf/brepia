# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

Implementation has not started.

## Completed

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

## Pending

### Step 1 — Render safety foundation

- [ ] Add shared SCAD source-size policy.
- [ ] Add preview-worker compile timeout.
- [ ] Add preview-worker terminate/recreate recovery.
- [ ] Add tool-worker compile timeout.
- [ ] Add tool-worker terminate/recreate recovery.
- [ ] Cleanly reject/clear pending requests on timeout/crash.
- [ ] Add bounded output-size handling.
- [ ] Verify normal compile after forced timeout.
- [ ] Verify AI tool compile after forced timeout.

### Step 2 — Imported artifact persistence primitive

- [ ] Add import-event + synthetic assistant artifact persistence helper.
- [ ] Add import provenance metadata.
- [ ] Support `output-available` successful baseline.
- [ ] Support bounded `output-error` baseline when retained for repair.
- [ ] Ensure no dangling `input-available` initial state.
- [ ] Verify parent chain and current leaf semantics.
- [ ] Verify artifact extraction/preview discovery.
- [ ] Verify retry/restore/branch behavior.
- [ ] Verify workspace model revision discovery.

### Step 3 — Local `.scad` upload

- [ ] Add single-file import UI.
- [ ] Validate `.scad`, 256 kB max and strict UTF-8.
- [ ] Add dependency preflight.
- [ ] Run bounded compile before opening editor.
- [ ] Create parametric conversation and imported message pair.
- [ ] Open imported artifact as current preview.
- [ ] Add fixtures/tests for supported and unsupported inputs.

### Step 4 — AI continuation

- [ ] Verify first user edit receives exact imported complete artifact.
- [ ] Verify standard AI SDK provider.
- [ ] Verify OpenCode CLI.
- [ ] Verify OpenCode streaming.
- [ ] Verify refresh before first edit.
- [ ] Verify parameter edit followed by AI edit.
- [ ] Verify retry/branching/history continuity.

### Step 5 — GitHub/Gist URL import

- [ ] Add GitHub blob URL normalization.
- [ ] Add raw GitHub URL normalization.
- [ ] Add single-file Gist import.
- [ ] Enforce same source validation and dependency preflight as upload.
- [ ] Add malformed/security test cases.
- [ ] Verify no generic arbitrary-host server fetch exists.

### Step 6 — Full editor regression and product polish

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

Start **Step 1 — Render safety foundation**. Do not implement import UI before timeout/recovery behavior is proven for both the preview worker and the long-lived AI tool worker.
