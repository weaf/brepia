# OpenSCAD Import — Step 6 regression checklist

Status: complete
Date: 2026-08-25
Branch: `feature/openscad-import-editing`

This checklist verifies imported projects through the real editor UI after Steps 1–5. It intentionally separates product-level regression checks from the already-green lower-level continuity tests.

## A. Preview, parameters, reload and branch/history

Use one imported parametric model with at least two top-level editable numeric parameters, for example:

```scad
width = 20; // [10:50]
height = 10; // [5:30]
cube([width, width, height]);
```

### A1 — initial preview

- [x] Import the model using local SCAD upload or one of the supported GitHub/Gist URL forms.
- [x] The editor opens directly.
- [x] The imported geometry becomes the active preview without clicking an Eye button.
- [x] No AI turn starts automatically.

Expected architecture: the DB branch seeds `ChatSession`; its latest-preview effect selects the imported `tool-build_parametric_model` artifact and calls `onViewArtifact`.

### A2 — parameter UI and persistence

- [x] Change `width` from 20 to a visibly different value, e.g. 35.
- [x] Preview updates.
- [x] Change `height` as a second parameter edit.
- [x] Refresh the browser.
- [x] Both edited values remain in the parameter controls and preview.
- [x] Reset/default semantics still point at the originally authored values (20 and 10), not the edited values.

Expected architecture: parameter changes rewrite the canonical build tool input on the assistant message. `metadata.originalCode` is captured lazily on first edit so defaults survive reload while live values come from the persisted edited artifact.

### A3 — history / branch selection

- [x] Ask AI for one model edit and let it finish.
- [x] Create or select an alternate branch using the existing retry/edit/history controls.
- [x] Switch between the two leaves.
- [x] Preview follows the selected leaf and does not remain stuck on the other branch.
- [x] Refresh while the alternate leaf is selected.
- [x] The same branch and corresponding preview return after reload.

Expected architecture: `conversations.current_message_leaf_id` is authoritative; `Tree.getPath()` rebuilds the selected branch and `ChatSession` selects the latest complete artifact on that path.

## B. Fix with AI — COMPLETE

- [x] Add bounded compiler-diagnostic prompt builder.
- [x] Do not duplicate the full SCAD source in the repair prompt; the active complete artifact remains authoritative.
- [x] Route `Fix with AI` through the existing conversation submit path rather than creating a second transport/API path.
- [x] Keep current model, execution mode, DB persistence and active leaf semantics identical to a normal user message.
- [x] Preserve serialized `OpenSCADError` identity across the worker boundary so the button renders for real compile errors.
- [x] Manually trigger a real OpenSCAD compile error and verify the button renders.
- [x] Complete a successful repair turn and verify the repaired artifact becomes the active preview.
- [x] Expose the normal conversation model selection directly in the compile-error state before `Fix with AI`.
- [x] Keep that selector bound to the same conversation model state; no hidden repair model or automatic fallback.
- [x] Manually verify the error-state model selector and successful repair UX.
- [x] Focused model-picker/submit/fix/worker regression tests verified green by operator.
- [x] Typecheck verified green by operator after model-selection UX.
- [x] ESLint verified green by operator after model-selection UX.
- [x] Production build verified green by operator after model-selection UX.

Manual observations on 2026-08-25:

- The deliberately broken source used `heiht` instead of `height`; OpenSCAD produced a real compile error and `Fix with AI` rendered.
- An initial repair attempt used `openai/gpt-5.6-sol`, routed through OpenRouter without a usable credential, and correctly failed with `Missing Authentication header`.
- After selecting a working model, `Fix with AI` repaired the model successfully.
- Model selection does not change OpenCode execution mode. The conversation keeps `settings.openCodeExecutionMode`; when absent, editor state defaults to `cli`. Hosted/local provider calls use their normal transport regardless of this setting.

A secondary server-hardening issue was exposed by the failed provider call: when a provider fails before emitting any assistant payload, `aiChat.ts` can attempt to persist an empty assistant message and PostgreSQL rejects it via `messages_payload_present`. Track this separately; do not conflate it with the OpenSCAD repair contract.

## C. Export, share and workspace regression — COMPLETE

### C1 — STL / DXF / SCAD export

- [x] Desktop audit: STL uses the current preview output and mirrors the export best-effort into the conversation workspace.
- [x] Desktop audit: DXF is generated from the current active SCAD source and mirrored best-effort into the conversation workspace.
- [x] Desktop audit: SCAD download uses the current active source and intentionally does not create a duplicate `exports/` artifact because source history lives under `models/`.
- [x] Identify mobile parity gap: mobile STL/DXF previously downloaded only to the browser and did not mirror workspace exports.
- [x] Implement mobile STL/DXF workspace mirroring while keeping browser download primary and workspace persistence best-effort.
- [x] Run focused imported-artifact regression, typecheck, lint and production build after the mobile parity fix; operator reported all green.
- [x] Manually verify mobile STL download on an imported model.
- [x] Manually verify mobile DXF download on an imported model.

### C2 — Share

- [x] Audit public access boundary: conversation and message RLS only expose rows when `conversation.privacy = 'public'`.
- [x] Audit ShareView branch semantics: initial local leaf comes from `conversation.current_message_leaf_id` and the visible branch is rebuilt with `Tree.getPath()`.
- [x] Audit preview semantics: ShareView chooses the latest complete artifact/mesh on the selected branch rather than the latest chronological sibling globally.
- [x] Verify imported synthetic `output-available` build artifacts satisfy the same ShareView preview contract as generated artifacts.
- [x] Verify the editor share preview uses the current/persisted active-branch artifact rather than a separate canonical SCAD store.
- [x] Manually make an imported conversation public and open its share URL while logged out/incognito.
- [x] Verify the shared preview corresponds to the currently selected branch.

### C3 — Conversation workspace current source and immutable revisions

- [x] `collectSuccessfulParametricBuilds()` walks only the active parent chain.
- [x] Imported successful synthetic build is explicitly covered as a normal workspace `build` revision in `tests/importedArtifact.test.ts`.
- [x] Failed imported `output-error` artifact is explicitly excluded from successful workspace revisions.
- [x] Existing workspace tests cover immutable numbered revisions, idempotency, branch switching and parameter-edit revisions.
- [x] `models/current.scad` follows the latest successful source on the active branch.
- [x] A normal chat request synchronizes model sources before generation.
- [x] An STL/DXF export request synchronizes model sources before attaching export bytes to the matching revision.
- [x] Workspace remains a best-effort mirror; Supabase message-tree state remains authoritative immediately after import.
- [x] Focused imported-artifact gate remained green after the mobile parity change; typecheck, lint and production build were also green.

Operator reported the requested automated gate and the mobile export/share end-to-end checks working on 2026-08-25.

## D. Final Step 6 regressions — COMPLETE

- [x] Ordinary non-imported parametric conversation regression verified end-to-end.
- [x] Repeated mobile post-import navigation regression verified; imports consistently opened the imported model and the earlier intermittent landing-view behavior was not reproduced.
- [x] Android/browser `.scad.txt` filename compatibility issue reproduced, fixed and verified with real files.
- [x] Legitimate GitHub percent-encoded file paths (`%20`, `%2F`) reproduced, fixed and verified while traversal/double-encoding protections remained covered by regression tests.
- [x] Focused SCAD/GitHub import tests green after the final compatibility fixes.
- [x] Typecheck green after final compatibility fixes.
- [x] ESLint green after final compatibility fixes.
- [x] Production build green after final compatibility fixes.

Step 6 closed on 2026-08-25.

### Deferred loading-state regression

Observed manually on 2026-08-25: after an AI model has apparently completed the model generation, the editor can remain in the loading/spinner state for a long time. Reloading the page then immediately shows the completed model.

This strongly suggests a client-side completion/loading-state synchronization problem rather than lost model output: the completed artifact survives reload and can be reconstructed from persisted state. Investigate later as a separate regression. Check at minimum:

- `ChatSession` AI SDK status transition and `onLoadingChange` lifecycle;
- whether `isChatStreaming` is cleared after the final tool/output step;
- auto-continuation / `answer_user` completion semantics;
- race between persisted assistant artifact, query refresh and chat status;
- whether behavior differs between OpenCode CLI, OpenCode streaming and normal provider transports.

Do not paper over this with an arbitrary timeout. The UI should stop loading from an authoritative completion condition and reveal the already-persisted artifact without requiring a page reload.

The empty-assistant persistence issue after an early provider failure and the previously observed intermittent third/later OpenCode turn remain explicitly deferred and separate from the import feature. The cross-mode third/later turn investigation remains scheduled after the external-model work and should include 4+ sequential turns.
