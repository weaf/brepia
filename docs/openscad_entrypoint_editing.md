# Direct OpenSCAD entrypoint editing

Status: focused post-BRep Phase 3 Parametric/OpenSCAD follow-up.

Baseline: `master` at `24af5eedc69efd34cfc2893114714a800fb8fe82`.

## Scope

Allow the active OpenSCAD project's declared `entrypointPath` (normally `main.scad`) to be edited and saved directly from **Project files**, using the existing project-native persistence path.

This is not a new editor/versioning system and does not change BRep, Rhino/Grasshopper, AI routing, conversation types, or the normalized `OpenScadProject` contract.

## Required behavior

- The declared entrypoint is editable with the same source editor and Save/Discard flow as support `.scad` files.
- Saving replaces only that file's content inside the complete normalized `OpenScadProject` snapshot.
- `entrypointPath`, support files and the asset manifest remain unchanged.
- Pending parameter writes are drained before a project-file save.
- Project-file persistence is rejected while an AI turn is streaming, including if streaming begins while queued parameter writes are being drained.
- A direct entrypoint save is treated as an authored source change and becomes the new parameter baseline: `metadata.originalCode` is set to the saved entrypoint source.
- Parameter controls are reparsed immediately from the saved entrypoint and future parameter writes rebuild from that source rather than the pre-save source.
- Preview/export state is invalidated so rendering and exports use the newly persisted complete project snapshot.
- Support-file saves remain parts-only and do not rewrite message metadata.

## Parameter baseline semantics

`metadata.originalCode` is the baseline used to preserve Reset / slider-home / auto-range values across parameter-control edits. A parameter-control edit does not redefine that baseline.

A direct entrypoint source save is different: it is an explicit source-authoring action. The saved source therefore becomes the new baseline. A later parameter-control edit can then persist a derived entrypoint while the authored source remains available through `metadata.originalCode`.

This also keeps conversation-workspace reconstruction bounded: when the saved entrypoint equals `metadata.originalCode`, the current direct-authored snapshot is collected once; a later parameter edit can produce the normal baseline + parameter-edit pair while preserving all support files/assets.

## Validation

Focused regression coverage verifies:

- direct entrypoint replacement preserves exact `entrypointPath`, support files and assets;
- a direct-authored entrypoint whose source equals `metadata.originalCode` is collected as one workspace snapshot;
- a subsequent parameter edit produces the expected baseline/current pair while preserving the complete project snapshot.

Final acceptance additionally requires the repository Quality Gate and manual browser verification of edit/save/render/reload plus a parameter change after source save.
