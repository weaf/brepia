# OpenSCAD Import — Step 6 regression checklist

Status: active
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

- Import the model using local SCAD upload or one of the supported GitHub/Gist URL forms.
- The editor opens directly.
- The imported geometry becomes the active preview without clicking an Eye button.
- No AI turn starts automatically.

Expected architecture: the DB branch seeds `ChatSession`; its latest-preview effect selects the imported `tool-build_parametric_model` artifact and calls `onViewArtifact`.

### A2 — parameter UI and persistence

- Change `width` from 20 to a visibly different value, e.g. 35.
- Preview updates.
- Change `height` as a second parameter edit.
- Refresh the browser.
- Both edited values remain in the parameter controls and preview.
- Reset/default semantics still point at the originally authored values (20 and 10), not the edited values.

Expected architecture: parameter changes rewrite the canonical build tool input on the assistant message. `metadata.originalCode` is captured lazily on first edit so defaults survive reload while live values come from the persisted edited artifact.

### A3 — history / branch selection

- Ask AI for one model edit and let it finish.
- Create or select an alternate branch using the existing retry/edit/history controls.
- Switch between the two leaves.
- Preview follows the selected leaf and does not remain stuck on the other branch.
- Refresh while the alternate leaf is selected.
- The same branch and corresponding preview return after reload.

Expected architecture: `conversations.current_message_leaf_id` is authoritative; `Tree.getPath()` rebuilds the selected branch and `ChatSession` selects the latest complete artifact on that path.

## B. Fix with AI — CORE FLOW VERIFIED, MODEL-SELECTION UX POLISH PENDING

Implementation status:

- [x] Add bounded compiler-diagnostic prompt builder.
- [x] Do not duplicate the full SCAD source in the repair prompt; the active complete artifact remains authoritative.
- [x] Route `Fix with AI` through the existing conversation submit path rather than creating a second transport/API path.
- [x] Keep current model, execution mode, DB persistence and active leaf semantics identical to a normal user message.
- [x] Preserve serialized `OpenSCADError` identity across the worker boundary so the button renders for real compile errors.
- [x] Focused prompt/submit-bridge/import/worker-error regressions verified green by operator.
- [x] Typecheck verified green by operator.
- [x] ESLint verified green by operator.
- [x] Production build verified green by operator.
- [x] Manually trigger a real OpenSCAD compile error and verify the `Fix with AI` button renders.
- [x] Pressing `Fix with AI` reaches the normal chat/model transport.
- [x] Complete one successful AI repair turn with a deliberately misspelled OpenSCAD parameter and verify the repaired artifact becomes the active preview.
- [ ] Improve error-state UX so the user can deliberately choose/confirm the AI model before the repair turn is submitted; do not silently fall back to a different model.

Manual observations on 2026-08-25:

- The deliberately broken source used `heiht` instead of `height`; OpenSCAD produced a real compile error and the `Fix with AI` action rendered.
- An initial repair attempt used the conversation's saved/default `openai/gpt-5.6-sol` selection. pCAD routed that model through the built-in OpenRouter provider, which had no usable credential and correctly failed with `Missing Authentication header`.
- After the operator selected a working model in the existing chat model picker and pressed `Fix with AI` again, the repair completed successfully. This verifies the repair bridge, active-artifact continuity and normal model transport end-to-end.
- Product UX should therefore make model choice explicit at the error state rather than treating a stale/default saved model as an implicit repair choice. The repair must continue to use the normal conversation model state; there must not be a separate hidden "fix model" or automatic provider fallback.

A secondary server-hardening issue was exposed by the failed provider call: when a provider fails before emitting any assistant payload, `aiChat.ts` currently attempts to persist an empty assistant message and PostgreSQL rejects it via `messages_payload_present`. Track this separately and ensure empty provider responses are skipped rather than persisted. Do not conflate this with the OpenSCAD import or Fix-with-AI routing contract.

The repair bridge is conversation-id keyed and forwards into the already-mounted normal chat submit callback. It contains no AI transport, fetch or persistence implementation of its own.

## C. Remaining Step 6 checks

After A and the model-selection UX polish in B:

- STL export
- DXF export
- share flow
- conversation-workspace `models/current.scad`
- immutable model revisions
- ordinary non-imported parametric conversation
- repeated mobile post-import navigation

The previously observed intermittent third/later OpenCode turn remains explicitly deferred until after the external-model work.
