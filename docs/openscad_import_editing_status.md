# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

**Step 1 — Render safety foundation is complete and externally verified green.**

**Step 2 — Imported artifact persistence primitive is complete and externally verified green.**

**Step 3 — Local `.scad` upload is complete and externally verified green.**

**Step 4 — AI continuation is active. OpenCode streaming and CLI are manually verified. Exact imported-artifact continuity and latest-artifact selection are now automatically verified green. Refresh-before-edit and parameter-edit → AI continuity tests have been added and await operator validation.**

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

## Step 3 — Local `.scad` upload — COMPLETE

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
- [x] Navigate to the normal editor route after persistence.
- [x] Best-effort delete the conversation if authoritative imported messages fail to persist.
- [x] Add focused validation/preflight fixtures in `tests/scadImport.test.ts`.

### Verification

- [x] Focused SCAD/imported-artifact tests verified green by operator.
- [x] Full Vitest regression suite verified green by operator.
- [x] Typecheck verified green by operator.
- [x] ESLint verified green by operator.
- [x] Production build verified green by operator.
- [x] Real `.scad` model imported successfully through the product UI.
- [x] Imported model persisted as a normal pCAD model/conversation and could be modified through pCAD.
- [x] No import-path functional blocker observed in manual end-to-end use.

The focused validation suite covers extension, byte limit, strict UTF-8/BOM behavior, NUL rejection, bundled-library preflight, unsupported custom/relative dependencies, external `import(...)`/`surface(...)` dependency rejection and compiler-failure classification. These edge cases do not need to remain a Step 3 release blocker after the focused and full suites passed.

Step 3 gate closed on 2026-08-25 after the operator reported the focused/full tests and production build green and successfully imported and edited a real OpenSCAD model through pCAD.

### Mobile post-import navigation observation

An earlier mobile run appeared to return to/reload the landing view and required opening the menu to find the imported model. A later run on 2026-08-25 navigated directly to the imported model as intended. The issue is therefore intermittent/not currently reproducible and does not block the import feature. Keep it as a Step 6 regression check rather than implementing a speculative fix now.

## Step 4 — AI continuation — ACTIVE

- [x] Core import → first pCAD edit path verified manually through OpenCode streaming.
- [x] Verify the first edit receives the exact complete imported artifact, not a truncated/reconstructed copy — focused AI SDK regression verified green by operator on 2026-08-25.
- [x] Verify standard AI SDK provider boundary preserves the imported complete artifact — focused regression verified green by operator on 2026-08-25.
- [x] Verify OpenCode CLI path — imported-model edit verified successfully by operator on 2026-08-25.
- [x] Verify OpenCode streaming path — imported-model edit verified successfully by operator on 2026-08-25.
- [ ] Verify refresh before first edit — DB-style reload → AI SDK continuity regression added; operator validation pending.
- [ ] Verify parameter edit followed by AI edit — persisted edited artifact → AI SDK continuity regression added; operator validation pending.
- [ ] Verify retry/branching/history continuity.
- [x] Verify successive AI edits select the latest complete artifact rather than the original import at the OpenCode prompt boundary — focused regression verified green by operator on 2026-08-25.

### Deferred cross-mode multi-turn regression

Observed on both OpenCode streaming and CLI: one follow-up chat after an edit works, while a later turn (commonly around the third chat/iteration) can fail intermittently; in some runs three turns work. Because the behavior is shared by both execution modes and is not specific to imported OpenSCAD models, it is not treated as an import-feature blocker.

Revisit this after the external-model work is complete. The later regression should determine whether failure originates in message-tree/leaf continuity, cached chat/session state, OpenCode session handling, transport state, or latest-artifact selection. It should explicitly test 4+ sequential edits and verify every turn starts from the immediately preceding complete artifact.

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
- [ ] Recheck mobile post-import navigation over repeated imports; latest test navigated directly to the model, so only fix if the earlier landing-view behavior is reproducible.
- [ ] After external-model work, investigate intermittent 3rd/later chat failure across both OpenCode CLI and streaming with 4+ sequential-turn regression coverage.

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

Validate the new focused Step 4 refresh/parameter continuity regressions. If green, continue with retry/branch/history continuity. Do not investigate the shared third/later-turn instability yet; retain it for dedicated regression work after the external-model work.
