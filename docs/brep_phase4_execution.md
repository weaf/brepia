# BRep Phase 4 execution contract

## Status

Phase 4 — Brepia graph/editor UX — is active on current `master`.

Accepted Phase 4C checkpoint:

```text
bb5ac6e29d8361074cfb78881e1b4a0ab7575c82
Merge pull request #28 from weaf/feature/brep-structural-dag-authoring
Phase 4C: structural BRep DAG authoring
```

Active Phase 4D branch:

```text
feature/brep-project-definition-editing
```

The current implementation is the source of truth. Historical BRep phase documents are evidence only unless this contract explicitly carries a boundary forward.

## Reconciled starting point

The accepted BRep stack already provides:

- canonical, kernel-neutral `BrepProject` snapshots in `shared/brepProject.ts`;
- stable project, parameter and node IDs;
- validated acyclic node references;
- current node types `box`, `cylinder`, `transform`, `subtract`, and `fillet`;
- immutable assistant `data-brep-project` source revisions selected by `current_message_leaf_id`;
- direct published-parameter value editing with native preview and explicit immutable parameter revision save;
- direct structured editing of every existing feature type from Phase 4A;
- dependency graph visualization, synchronized selection and Inputs / Used by navigation from Phase 4B;
- validated node creation/deletion, dependency rewiring and explicit result-node selection from Phase 4C;
- complete-project normalization and compare-and-set persistence for direct source saves;
- AI creation/editing through complete validated canonical snapshots;
- restore, branch, retry and stale-write protection;
- read-only canonical `project.brep.json` inspection;
- isolated build123d/OCCT evaluation and exact native STEP export.

The remaining Phase 4 gap is direct editing of the reusable project definition itself: published parameter definitions, component placement contract and project metadata.

## Phase 4 architecture locks

1. `BrepProject` remains the only canonical BRep authoring model.
2. Graph/editor/project-definition UI is a view and editor over that model, never a second runtime or second source of truth.
3. Existing immutable revision lineage remains authoritative. Direct editor saves create complete normalized source snapshots rather than mutating historical revisions.
4. Direct source persistence must use compare-and-set activation against the expected active leaf so overlapping AI/parameter/editor writes cannot reactivate stale source.
5. Native evaluation remains the existing isolated build123d/OCCT path.
6. `conversation.type` remains `parametric`.
7. Existing project/node/parameter IDs remain stable. New semantic objects receive stable IDs at creation.
8. OpenSCAD behavior, source routing and project editing remain out of scope for Phase 4.
9. Rhino/Grasshopper, 3DM and project-object export contracts remain later roadmap phases.

## 4A — Existing feature inspector/editor — complete

Phase 4A provides structured editing for all existing node types, literal/parameter scalar semantics, complete-project validation, immutable source revisions and browser/native acceptance.

## 4B — Graph visualization and dependency navigation — complete

Phase 4B provides deterministic presentation-only graph derivation, result visualization, synchronized graph/inspector selection, Inputs / Used by navigation and mobile/desktop browser acceptance. No layout or selection state is persisted.

## 4C — Structural DAG authoring — complete

Phase 4C provides validated creation of all current node types, explicit stable IDs, existing structured dependency rewiring, explicit result-node selection, confirmed non-cascading safe deletion and immutable source revisions. Desktop/mobile browser acceptance confirmed the intended semantics, including that newly created detached features do not become the rendered result until **Set result** is explicitly chosen.

## 4D — Project definition editing and Phase 4 closeout — active

### Product behavior

Add a compact **Project definition** surface inside the existing Parameters scroll flow. It remains collapsed by default so normal parameter and feature authoring retain vertical priority, especially on mobile.

The editor covers four canonical definition areas:

1. project identity display and editable project name;
2. published numeric parameter definitions;
3. reusable component placement plane;
4. object metadata and custom properties.

All definition edits are draft UI state until the user explicitly chooses **Save project definition**. A successful save creates one complete immutable BRep source revision through the existing guarded `saveProjectSource` / `onProjectSourceCommit` compare-and-set path.

### Project identity

- `project.id` is stable and read-only.
- `project.name` is directly editable and canonical validation remains authoritative for text bounds.
- Schema version and unit system are not exposed as editable fields.

### Published parameter definitions

The existing **Dimensions** section continues to edit the current values/default-backed preview controls. 4D separately edits the reusable published parameter contract.

For numeric published parameters:

- add a new parameter with an explicit stable ID;
- edit label, default, optional min/max/step and description;
- choose unit `mm`, `deg`, or `none` for new or currently unreferenced parameters;
- existing parameter IDs are read-only;
- existing numeric parameter type remains `number`;
- duplicate/invalid IDs and invalid numeric bounds are rejected by canonical normalization;
- referenced parameters cannot be deleted;
- a referenced existing parameter cannot change unit until its references have been rewired;
- parameter usage detection covers both feature scalars/vectors and the placement plane;
- removing an unreferenced parameter is explicit draft state and becomes historical only when the definition revision is saved.

4D does not add string/boolean/enum parameter types.

### Placement plane

Canonical placement remains:

```text
origin: mm vector
xAxis: unitless vector
yAxis: unitless vector
```

Each scalar may remain a literal or reference a compatible published parameter.

Placement semantics are deliberately explicit:

- it is the reusable component placement contract intended for future Grasshopper/project composition;
- it is **not** a hidden transform applied to the current local OCCT/build123d component geometry;
- editing placement therefore does not promise that the native local preview visibly moves;
- the candidate definition is canonicalized and its default parameter values must resolve to non-zero, non-collinear placement axes before persistence.

Dynamic parameter overrides continue to pass through the existing evaluation-time placement validation.

### Metadata

Directly edit the bounded canonical metadata already supported by `BrepProject`:

- optional `objectType`;
- optional `classification`;
- bounded custom string properties.

Property keys remain canonical BRep IDs and values remain bounded text. Empty/duplicate/invalid property keys fail before source persistence.

### Concurrency / dirty-state behavior

Project-definition writes use the same source-authoring guard as Phase 4C and are disabled while:

- an AI turn is streaming;
- there are unsaved parameter preview values;
- a parameter revision save is active;
- another source save is active;
- a revision action is active;
- an export action that already blocks source editing is active.

Read-only project files, graph navigation and ordinary viewing remain available according to the existing accepted behavior.

### Explicit 4D non-goals

Do not add in this slice:

- editing `project.id`, schema version or unit system;
- renaming existing parameter IDs;
- new parameter value types beyond numeric;
- hidden cascade deletion of parameter references;
- applying the placement plane as a new native geometry transform;
- editable graph coordinates/freeform canvas behavior;
- new BRep node types;
- browser-side geometry execution;
- Grasshopper/Rhino/3DM export or runtime integration;
- broader OpenSCAD UX changes.

## 4D acceptance and Phase 4 closeout

Phase 4 closes only when all of the following hold:

1. **Project definition** is compact/collapsible in desktop and mobile Parameters views and opens a usable responsive editor dialog.
2. Project name can be changed and survives refresh/reopen while stable project ID remains unchanged/read-only.
3. A new numeric published parameter can be added with a stable ID and appears in **Dimensions** after the new source revision activates.
4. Parameter label/default/min/max/step/description edits survive refresh/reopen and continue to drive the existing parameter controls/native preview correctly.
5. Duplicate/invalid parameter IDs and invalid min/max/default/step combinations are rejected before active source replacement.
6. Referenced parameters cannot be deleted and their unit cannot be changed until references are rewired; the UI identifies the canonical usage fields.
7. An unreferenced parameter can be removed and remains present in older immutable revisions.
8. Placement origin/xAxis/yAxis literals and compatible parameter references can be edited; zero/collinear default axes are rejected before persistence.
9. Placement copy clearly explains that it is a component/project-composition contract and does not claim to move local native preview geometry.
10. Metadata object type, classification and custom properties can be added/edited/removed and survive refresh/reopen; invalid property keys fail closed.
11. Definition saves create one immutable source revision and restore/revision selection moves correctly between pre/post-definition snapshots.
12. Unsaved parameter preview and AI streaming block definition writes without breaking existing read-only/navigation behavior.
13. Exact STEP and canonical project-package export remain derived from the selected saved source; ordinary OpenSCAD workflows remain unchanged.
14. Repository tests/typecheck/lint/build/diff checks are green and focused desktop/mobile browser acceptance is recorded before merge.

After acceptance, this document should be updated in the same branch to record the final Phase 4 checkpoint and mark Phase 4 complete before merge.
