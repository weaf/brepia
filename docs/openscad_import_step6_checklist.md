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

## B. Fix with AI — implementation required

Audit result: `OpenSCADPreview` exposes a `fixError(error)` callback and conditionally renders the `Fix with AI` button, but `EditorView` currently mounts `OpenSCADPreview` without supplying `fixError` on desktop or mobile.

Do not mark this regression green until the editor wires the button into the normal ChatSession send path without creating a second AI/chat transport.

## C. Remaining Step 6 checks

After A and B:

- STL export
- DXF export
- share flow
- conversation-workspace `models/current.scad`
- immutable model revisions
- ordinary non-imported parametric conversation
- repeated mobile post-import navigation

The previously observed intermittent third/later OpenCode turn remains explicitly deferred until after the external-model work.
