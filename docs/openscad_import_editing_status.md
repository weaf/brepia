# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

**Step 1 — Render safety foundation is complete and externally verified green.**

**Step 2 — Imported artifact persistence primitive is complete and externally verified green.**

**Step 3 — Local `.scad` upload is implemented in code; typecheck and ESLint are verified green, while tests/build/UI verification remain pending.**

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

## Step 2 — Imported artifact persistence primitive — COMPLETE

- [x] Typed import provenance metadata (`artifactOrigin`).
- [x] Pure shared builder for import-event + synthetic assistant artifact rows.
- [x] Client persistence service using one bulk `messages` INSERT for the two-row baseline.
- [x] Stable synthetic `tool_import_<uuid>` tool-call IDs.
- [x] Successful baseline as `output-available` with normal build output.
- [x] Retained compile failure as `output-error` with bounded `errorText` supplied by caller.
- [x] No dangling `input-available`/`input-streaming` initial state.
- [x] Complete SCAD only in normal `build_parametric_model.input`, not ordinary chat text or metadata.
- [x] Import event is a user root; imported artifact is its assistant child.
- [x] Artifact extraction sees both success and error baselines.
- [x] Successful imported artifact is discovered by workspace revision logic as a normal build.
- [x] Failed imported artifact is not falsely recorded as a successful workspace revision.
- [x] Imported assistant leaf is explicitly set after bulk insert so current leaf does not depend on multi-row processing order.
- [x] Focused tests in `tests/importedArtifact.test.ts`.
- [x] Focused Step 2 test verified green by operator.
- [x] Full Vitest regression suite verified green by operator.
- [x] Typecheck verified green by operator.
- [x] ESLint verified green by operator.
- [x] Production build verified green by operator.

Step 2 gate closed on 2026-08-25 after operator reported all requested validation green.

## Step 3 — Local `.scad` upload

### Implemented

- [x] Add a dedicated `Import SCAD` action on the signed-in parametric landing page.
- [x] Keep SCAD import separate from ordinary image/STL chat attachments.
- [x] Accept one `.scad` file only; extension check is case-insensitive.
- [x] Enforce shared 256,000-byte limit before decoding.
- [x] Strict UTF-8 decoding with optional UTF-8 BOM removal.
- [x] Reject NUL/binary-like input.
- [x] Enforce minimum source length required by the normal parametric artifact contract.
- [x] Dependency preflight accepts bundled BOSL, BOSL2 and MCAD include/use.
- [x] Dependency preflight rejects custom/relative include/use.
- [x] Dependency preflight rejects `import(...)` and `surface(...)` external file dependencies in V1.
- [x] Ignore dependency-looking examples inside comments and string literals.
- [x] Run bounded OpenSCAD compile through the hardened long-lived tool worker before conversation creation.
- [x] Treat timeout/worker/output-limit failures as blocking import failures.
- [x] Retain ordinary OpenSCAD compile/syntax failures as `output-error` so the imported source can be opened and repaired by AI later.
- [x] Bound retained compiler diagnostics to 12,000 characters.
- [x] Create a normal parametric conversation using the currently selected model and OpenCode execution mode.
- [x] Preserve the user's current prompt profile in imported conversation settings.
- [x] Persist the imported two-message baseline without starting an AI turn.
- [x] Navigate directly to the normal editor after persistence.
- [x] Best-effort delete the conversation if authoritative imported messages fail to persist.
- [x] Add focused validation/preflight fixtures in `tests/scadImport.test.ts`.

### Runtime/UI gate pending

- [ ] Run `tests/scadImport.test.ts` successfully.
- [ ] Run `tests/importedArtifact.test.ts` successfully after deterministic-leaf change.
- [ ] Run full Vitest regression suite successfully.
- [x] Run typecheck successfully — verified green by operator on 2026-08-25.
- [x] Run ESLint successfully — verified green by operator on 2026-08-25.
- [ ] Run production build successfully.
- [ ] Import a self-contained cube SCAD from the landing page and verify automatic editor preview.
- [ ] Import a BOSL2 SCAD and verify bundled library compilation.
- [ ] Import a BOSL SCAD and verify bundled library compilation.
- [ ] Import an MCAD SCAD and verify bundled library compilation.
- [ ] Verify a syntax-broken SCAD opens as a retained error artifact instead of disappearing or starting AI automatically.
- [ ] Verify oversized SCAD is rejected before conversation creation.
- [ ] Verify invalid UTF-8/NUL source is rejected before conversation creation.
- [ ] Verify custom include/use is rejected with an explicit unsupported-dependency message.
- [ ] Verify `import("mesh.stl")`, SVG/DXF-style external assets and `surface(...)` dependencies are rejected in V1.
- [ ] Verify refresh after successful import keeps the imported model as the current artifact.

Recommended automated validation:

```bash
npm test -- tests/scadImport.test.ts tests/importedArtifact.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Step 3 remains the active gate. **Do not start Step 4 until the automated suite and core browser import scenarios above pass.**

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

Close the remaining **Step 3 runtime/UI gate**: focused tests, full regression suite, production build and browser import scenarios. If green, mark Step 3 complete and proceed to **Step 4 — AI continuation**.
