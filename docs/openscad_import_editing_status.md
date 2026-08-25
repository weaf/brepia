# OpenSCAD Import & Existing Model Editing — status

Branch: `feature/openscad-import-editing`
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Last updated: 2026-08-25

## Current state

Architecture audit is complete and the V1 architecture is approved.

**Step 1 — Render safety foundation is complete and externally verified green.**

**Step 2 — Imported artifact persistence primitive is complete and externally verified green.**

**Step 3 — Local `.scad` upload is complete and externally verified green.**

**Step 4 — AI continuation is complete and externally verified green for the import-specific contract.**

**Step 5 — GitHub/Gist URL import is complete and externally verified green.**

**Step 6 — Full editor regression and product polish is complete and externally verified green.**

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
- [x] Accept the Android/browser filename alias `.scad.txt` while continuing to reject ordinary `.txt` files.
- [x] Expose both `.scad` and `.scad.txt` in the mobile file picker.
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
- [x] Android/browser `.scad.txt` filename alias verified with real SCAD files.
- [x] Imported model persisted as a normal pCAD model/conversation and could be modified through pCAD.
- [x] No import-path functional blocker observed in manual end-to-end use.

The focused validation suite covers extension, Android `.scad.txt` alias handling, byte limit, strict UTF-8/BOM behavior, NUL rejection, bundled-library preflight, unsupported custom/relative dependencies, external `import(...)`/`surface(...)` dependency rejection and compiler-failure classification. These edge cases do not need to remain a Step 3 release blocker after the focused and full suites passed.

Step 3 gate closed on 2026-08-25 after the operator reported the focused/full tests and production build green and successfully imported and edited a real OpenSCAD model through pCAD. The later Android filename compatibility regression was also fixed and verified before final Step 6 closure.

### Mobile post-import navigation observation

An earlier mobile run appeared to return to/reload the landing view and required opening the menu to find the imported model. A later run on 2026-08-25 navigated directly to the imported model as intended. Repeated final mobile imports also opened the imported models correctly, so the earlier landing-view behavior was not reproduced and no speculative navigation fix was introduced.

## Step 4 — AI continuation — COMPLETE

- [x] Core import → first pCAD edit path verified manually through OpenCode streaming.
- [x] First edit receives the exact complete imported artifact, not a truncated/reconstructed copy.
- [x] Standard AI SDK provider boundary preserves the complete imported artifact.
- [x] OpenCode CLI imported-model edit verified manually.
- [x] OpenCode streaming imported-model edit verified manually.
- [x] Refresh before first edit preserves the imported artifact through DB-style reload → AI SDK conversion.
- [x] Parameter edit followed by AI edit sends the persisted edited artifact rather than the original import.
- [x] Retry/branching keeps sibling branch artifacts isolated and selected leaf determines the artifact used for continuation.
- [x] History/restore preserves the exact complete artifact when restored as a new leaf.
- [x] Successive AI edits select the latest complete artifact rather than the original import at the OpenCode prompt boundary.
- [x] Focused Step 4 regression tests verified green by operator.
- [x] Typecheck verified green by operator after Step 4 regressions.
- [x] ESLint verified green by operator after Step 4 regressions.

Step 4 gate closed on 2026-08-25 after operator reported all focused continuity regressions, typecheck and ESLint green. The import-specific continuation contract is therefore complete across standard AI SDK conversion, OpenCode CLI/streaming, refresh, parameters, branch selection and restore/history.

### Deferred cross-mode multi-turn regression

Observed on both OpenCode streaming and CLI: one follow-up chat after an edit works, while a later turn (commonly around the third chat/iteration) can fail intermittently; in some runs three turns work. Because the behavior is shared by both execution modes and is not specific to imported OpenSCAD models, it is not treated as an import-feature blocker.

Revisit this after the external-model work is complete. The later regression should determine whether failure originates in message-tree/leaf continuity, cached chat/session state, OpenCode session handling, transport state, or latest-artifact selection. It should explicitly test 4+ sequential edits and verify every turn starts from the immediately preceding complete artifact.

## Step 5 — GitHub/Gist URL import — COMPLETE

- [x] GitHub blob URL normalization.
- [x] Raw `raw.githubusercontent.com` URL normalization.
- [x] Single-file Gist import with exactly one `.scad` candidate.
- [x] Same 256,000-byte source limit, UTF-8 validation and dependency preflight as local upload.
- [x] Provider-specific authenticated server retrieval through fixed `api.github.com` endpoints.
- [x] Accept normal percent-encoded GitHub file-path syntax, including encoded spaces and separators, by decoding exactly once before validation.
- [x] Reject URL credentials, unsupported hosts, query parameters, raw/encoded traversal forms, double-encoded path syntax, backslashes/control characters and non-SCAD file paths.
- [x] Reject malformed/ambiguous/truncated Gist payloads.
- [x] No generic arbitrary-host `fetch(userUrl)` server path introduced.
- [x] Local upload and GitHub/Gist import reuse the same bounded compile → conversation → imported-artifact persistence service.
- [x] Focused GitHub/import/security tests verified green by operator.
- [x] Typecheck verified green by operator.
- [x] ESLint verified green by operator.
- [x] Production build verified green by operator.
- [x] GitHub blob import verified manually through product UI, including a real path containing encoded whitespace/separator syntax.
- [x] Raw GitHub import verified manually through product UI.
- [x] Single-file Gist import verified manually through product UI.

Step 5 gate closed on 2026-08-25 after the operator reported all automated validation green and manually verified all three supported URL forms in the product UI. The later encoded-path compatibility regression was also fixed with traversal/double-encoding protections retained and verified before final Step 6 closure.

### Build warnings observed during Step 5 validation

The production build succeeds, but two pre-existing/general build warnings were observed and should be handled separately from the OpenSCAD import feature:

- `lottie-web` uses direct `eval` inside `node_modules/lottie-web/build/player/lottie.js`; this is third-party code and is relevant to future CSP/security-hardening or dependency replacement/upgrade work.
- Vite/Rolldown reports some minified chunks larger than 1000 kB; treat this as bundle/performance technical debt and review dynamic imports/code splitting during broader product optimization.

Neither warning originates from the SCAD URL-import implementation and neither blocks Step 5.

## Step 6 — Full editor regression and product polish — COMPLETE

- [x] Preview regression.
- [x] Parameter UI/persistence regression.
- [x] Reload/history/branch regression.
- [x] Fix with AI wiring verification/fix.
- [x] STL export regression.
- [x] DXF export regression.
- [x] Share regression.
- [x] Conversation-workspace current/revision regression.
- [x] Ordinary non-imported conversation regression.
- [x] Repeated mobile post-import navigation regression; imported models opened consistently and the earlier landing-view behavior was not reproduced, so no speculative navigation fix was added.

The export/share/workspace gate was closed on 2026-08-25 after the operator reported the requested focused imported-artifact test, typecheck, ESLint and production build green and manually confirmed mobile STL/DXF export plus public share behavior working.

A mobile parity defect was fixed in commit `82359c8f91afa1a6f08f213767b75ed7d810d768`: mobile STL/DXF downloads now mirror exports best-effort into the same conversation workspace as desktop while keeping the browser download primary.

The final mobile import pass exposed two concrete compatibility regressions rather than the earlier intermittent navigation observation:

- Android/browser file selection can expose a valid SCAD source as `*.scad.txt`; local import now accepts that specific alias while ordinary `.txt` remains rejected.
- Legitimate GitHub file links can contain percent-encoded path characters such as `%20` and `%2F`; URL normalization now decodes exactly once, validates the decoded path, and still rejects traversal, double-encoding, backslashes and control characters before the server constructs its fixed `api.github.com` request.

The operator then reported focused import tests, typecheck, ESLint and production build green and confirmed the affected files/import links work in the product.

Step 6 gate closed on 2026-08-25. Steps 1–6 are complete; the feature branch is ready for final merge preparation, while the unrelated regressions below remain explicitly out of scope.

## Deferred separate regressions discovered during Step 6

### Empty assistant persistence after early provider failure

If a provider fails before emitting an assistant payload, `aiChat.ts` can attempt to persist an empty assistant message and PostgreSQL rejects it via `messages_payload_present`. Harden this separately by skipping empty assistant persistence; it is not part of the OpenSCAD import contract.

### Loading/spinner completion synchronization

After an AI model has apparently completed generation, the editor can remain in a loading/spinner state until reload, while the completed artifact is already persisted and appears immediately after reload. Investigate `ChatSession` status transitions, `isChatStreaming`, auto-continuation completion semantics and the persistence/query-refresh race. Do not fix this with an arbitrary timeout.

### Cross-mode third/later OpenCode turn

Keep the previously observed intermittent third/later turn failure deferred until after the external-model work. Test 4+ sequential turns across both CLI and streaming and verify every turn continues from the immediately preceding complete artifact.

## V1 boundaries

In scope:

- one `.scad` upload (including the mobile/browser `.scad.txt` filename alias for otherwise valid SCAD text);
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

Perform the final branch/master diff and regression assessment, then prepare `feature/openscad-import-editing` for merge into `master`.

Do not merge until the operator explicitly approves the merge. Keep the loading-state, empty-assistant-provider-failure and third/later OpenCode-turn regressions separate unless explicitly chosen as the next workstream.
