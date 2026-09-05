# BRep Phase 4 execution contract

## Status

Phase 4 — Brepia graph/editor UX — is complete.

Accepted Phase 4 checkpoints:

```text
Phase 4A
PR #26 — Phase 4A: direct BRep feature editing

Phase 4B
1f71a34367fbb923d829a5be61fc2acfe3eb0d44
Merge pull request #27 from weaf/feature/brep-graph-visualization
Phase 4B: BRep dependency graph navigation

Phase 4C
bb5ac6e29d8361074cfb78881e1b4a0ab7575c82
Merge pull request #28 from weaf/feature/brep-structural-dag-authoring
Phase 4C: structural BRep DAG authoring

Phase 4D
PR #29 — Phase 4D: BRep project definition editing
```

PR #29 is the Phase 4 closeout vehicle. Its merge commit on `master` is the final Phase 4 master checkpoint.

The current implementation is the source of truth. Historical BRep phase documents are evidence only unless explicitly selected for a later task.

## Completed Phase 4 product surface

The accepted BRep stack now provides:

- canonical, kernel-neutral `BrepProject` snapshots in `shared/brepProject.ts`;
- stable project, published-parameter and feature/node IDs;
- validated acyclic feature references;
- current node types `box`, `cylinder`, `transform`, `subtract`, and `fillet`;
- immutable assistant `data-brep-project` source revisions selected by `current_message_leaf_id`;
- direct published-parameter value editing with native preview and explicit immutable parameter revision save;
- direct structured editing of every existing feature type from Phase 4A;
- dependency graph visualization, synchronized selection and Inputs / Used by navigation from Phase 4B;
- validated node creation/deletion, dependency rewiring and explicit result-node selection from Phase 4C;
- direct project-definition editing for project name, published numeric parameter definitions, placement plane and metadata from Phase 4D;
- complete-project normalization and compare-and-set persistence for direct source saves;
- AI creation/editing through complete validated canonical snapshots;
- restore, branch, retry and stale-write protection;
- read-only canonical `project.brep.json` inspection;
- isolated build123d/OCCT evaluation and exact native STEP export.

## Phase 4 architecture locks carried forward

1. `BrepProject` remains the only canonical BRep authoring model.
2. Graph/editor/project-definition UI is a view and editor over that model, never a second runtime or second source of truth.
3. Immutable revision lineage remains authoritative. Direct editor saves create complete normalized source snapshots rather than mutating historical revisions.
4. Direct source persistence uses compare-and-set activation against the expected active leaf so overlapping AI/parameter/editor writes cannot reactivate stale source.
5. Native evaluation remains the existing isolated build123d/OCCT path.
6. `conversation.type` remains `parametric`.
7. Existing project/node/parameter IDs remain stable. New semantic objects receive stable IDs at creation.
8. OpenSCAD behavior, source routing and project editing remain separate from the BRep graph/editor contract.
9. Rhino/Grasshopper, 3DM and project-object interoperability remain later roadmap phases.

## 4A — Existing feature inspector/editor — complete

Phase 4A provides structured editing for all existing node types, literal/parameter scalar semantics, complete-project validation, immutable source revisions and browser/native acceptance.

## 4B — Graph visualization and dependency navigation — complete

Phase 4B provides deterministic presentation-only graph derivation, result visualization, synchronized graph/inspector selection, Inputs / Used by navigation and mobile/desktop browser acceptance. No layout or selection state is persisted.

## 4C — Structural DAG authoring — complete

Phase 4C provides validated creation of all current node types, explicit stable IDs, structured dependency rewiring, explicit result-node selection, confirmed non-cascading safe deletion and immutable source revisions.

Newly created detached features intentionally do not become the rendered result until **Set result** is explicitly chosen. The native viewer renders the canonical `resultNodeId`; this is model semantics rather than a rendering defect. A future UX pass may make that behavior more pedagogical without changing the canonical contract.

## 4D — Project definition editing — complete

Phase 4D adds a compact, collapsed-by-default **Project definition** surface inside the existing Parameters scroll flow. The editor covers:

1. stable project identity display and editable project name;
2. published numeric parameter definitions;
3. reusable component placement plane;
4. bounded object metadata and custom properties.

All definition edits remain draft UI state until **Save project definition**. A successful save creates one complete immutable BRep source revision through the existing guarded `saveProjectSource` / `onProjectSourceCommit` compare-and-set path.

### Project identity

- `project.id` is stable and read-only.
- `project.name` is directly editable.
- Schema version and unit system are not exposed as editable fields.

### Published parameter definitions

The **Dimensions** section edits current parameter values/default-backed preview controls. **Project definition** edits the reusable published parameter contract.

For numeric published parameters:

- new parameters receive explicit stable IDs;
- label, default, optional min/max/step and description are editable;
- unit may be `mm`, `deg`, or `none`;
- existing parameter IDs are read-only;
- duplicate/invalid IDs and invalid numeric bounds fail canonical validation;
- referenced parameters cannot be deleted;
- a referenced existing parameter cannot change unit until its references are rewired;
- usage detection covers feature scalars/vectors and the placement plane;
- removing an unreferenced parameter creates historical change only when the definition revision is saved.

Phase 4 does not add string/boolean/enum parameter types.

### Placement plane

Canonical placement remains:

```text
origin: mm vector
xAxis: unitless vector
yAxis: unitless vector
```

Each scalar may be a literal or compatible published-parameter reference.

Placement is the reusable component placement contract intended for future Grasshopper/project composition. It is not a hidden transform applied to current local OCCT/build123d component geometry, so editing placement does not promise that the native local preview visibly moves.

The candidate definition is canonicalized and default parameter values must resolve to non-zero, non-collinear placement axes before persistence. Dynamic parameter overrides continue through the existing evaluation-time placement validation.

### Metadata

Phase 4D directly edits the bounded metadata already carried by `BrepProject`:

- optional `objectType`;
- optional `classification`;
- bounded custom string properties.

Property keys remain canonical BRep IDs and values remain bounded text.

## Concurrency and revision semantics

Feature, structural and project-definition source writes share the same source-authoring guard and are blocked while:

- an AI turn is streaming;
- unsaved parameter preview values exist;
- a parameter revision save is active;
- another source save is active;
- a revision action is active;
- an export action that already blocks source editing is active.

Read-only project files, graph navigation and ordinary viewing remain available according to the accepted editor behavior.

Every accepted authoring operation persists a complete canonical source snapshot and preserves historical revisions. Restore/revision selection can therefore move between pre/post feature, structural and definition states without mutating history.

## Explicit Phase 4 non-goals

Phase 4 intentionally does not add:

- editing `project.id`, schema version or unit system;
- renaming existing node or parameter IDs;
- node-type conversion for existing nodes;
- parameter value types beyond numeric;
- implicit cascading node or parameter-reference deletion;
- graph drag/drop rewiring or persisted graph coordinates;
- freeform canvas authoring;
- applying the placement plane as a new native geometry transform;
- new BRep node types beyond the accepted five;
- browser-side geometry execution;
- Grasshopper/Rhino/3DM export or runtime integration;
- broader OpenSCAD UX changes.

## Phase 4 acceptance closeout

Phase 4A–4C were browser/native accepted and merged before 4D began.

Phase 4D browser acceptance was recorded on 2026-09-05. The accepted checks covered:

- responsive Project definition UI on desktop/mobile;
- project-name persistence with stable project ID;
- published parameter creation/editing/removal and validation;
- referenced-parameter delete/unit protection;
- placement editing and non-zero/non-collinear validation;
- metadata editing and validation;
- immutable revision selection/restore across definition changes;
- regression of ordinary parameter/feature editing;
- canonical project-package and exact STEP export behavior;
- unsaved-parameter/source-write coordination.

Quality Gate #365 passed tests, typecheck, lint, build and diff check on the accepted Phase 4D implementation before closeout.

With PR #29 merged, BRep Phase 4 is complete. Later work should start from current `master` and treat this document as completed-phase evidence rather than an active task queue.
