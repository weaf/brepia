# BRep Phase 4 execution contract

## Status

Phase 4 — Brepia graph/editor UX — starts from current `master`:

```text
0e08ddbfe6e8821716a361d3d8c0bcec33803c58
Merge pull request #25 from weaf/docs/openscad-entrypoint-readme
Refresh OpenSCAD entrypoint editing documentation
```

Branch:

```text
feature/brep-graph-editor
```

The current implementation is the source of truth. Historical BRep phase documents are evidence only unless this contract explicitly carries a boundary forward.

## Reconciled starting point

The accepted BRep stack already provides:

- canonical, kernel-neutral `BrepProject` snapshots in `shared/brepProject.ts`;
- stable project, parameter and node IDs;
- validated acyclic node references;
- current node types `box`, `cylinder`, `transform`, `subtract`, and `fillet`;
- immutable assistant `data-brep-project` source revisions selected by `current_message_leaf_id`;
- direct published-parameter editing with native preview and explicit immutable parameter revision save;
- AI creation/editing through complete validated canonical snapshots;
- restore, branch, retry and stale-write protection;
- read-only canonical `project.brep.json` inspection;
- isolated build123d/OCCT evaluation and exact native STEP export.

What is still missing is direct human editing of the feature DAG. Today node/DAG changes require AI or external package/import workflows.

## Phase 4 architecture locks

1. `BrepProject` remains the only canonical BRep authoring model.
2. A graph/editor is a view and editor over that model, never a second runtime or second source of truth.
3. Existing immutable revision lineage remains authoritative. Direct editor saves create complete normalized source snapshots rather than mutating historical revisions.
4. Direct source persistence must use compare-and-set activation against the expected active leaf so an overlapping AI/parameter/editor write cannot reactivate stale source.
5. Native evaluation remains the existing isolated build123d/OCCT path.
6. `conversation.type` remains `parametric`.
7. Existing project/node/parameter IDs remain stable unless a later explicitly scoped operation creates or deletes semantic objects.
8. OpenSCAD behavior, source routing and project editing are out of scope for Phase 4.
9. Rhino/Grasshopper, 3DM and project-object contracts remain later roadmap phases.

## 4A — Existing feature inspector/editor

Active scope for the first vertical slice.

### Product behavior

- Add a structured **Features** section to the BRep editor.
- List every canonical node in project order and show node ID, type, dependency summary and result-node status.
- Selecting a node opens a structured editor for that existing node.
- Node ID and node type are read-only in 4A.
- Support editing all fields of the five existing node types:
  - `box`: width, depth, height;
  - `cylinder`: radius, height;
  - `transform`: input, translate, rotateDeg;
  - `subtract`: base and tools;
  - `fillet`: input, radius and parallel-axis selector.
- Scalar fields can remain literal values or reference compatible published parameters.
- Node-reference fields use existing canonical node IDs.
- A save validates the complete candidate through `normalizeBrepProject` before persistence.
- Successful save creates one immutable lifecycle revision and activates it only if the expected source leaf is still current.
- The refreshed active source drives the existing native preview, revision history, AI continuation and exports.

### Concurrency / dirty-state behavior

4A must not silently reconcile competing local authoring surfaces.

Feature editing is disabled while:

- an AI turn is streaming;
- a parameter revision save is active;
- a revision action is active;
- there are unsaved parameter preview values.

If the active source changes while a feature editor is open, the editor must fail closed rather than saving against stale source.

### Explicit 4A non-goals

Do not add in this slice:

- node creation or deletion;
- node-ID renaming;
- node-type conversion;
- result-node reassignment;
- drag/drop graph layout or edge wiring;
- project placement/metadata editing;
- published-parameter definition creation/deletion;
- browser-side geometry execution;
- Rhino/Grasshopper/3DM integration.

## Later Phase 4 slices

### 4B — Graph visualization and dependency navigation

Visualize the canonical DAG, keep node selection synchronized with the inspector, and make dependencies/result flow easy to follow. The graph remains presentation/editor state only.

### 4C — Structural DAG authoring

Add validated node creation/deletion, dependency rewiring and result-node selection with stable-ID semantics and explicit destructive-operation handling.

### 4D — Project definition editing and closeout

Add the remaining direct project-definition surfaces that prove useful (published parameter definitions, placement and metadata), then run browser/runtime/regression acceptance and close Phase 4.

## 4A acceptance

4A is complete only when all of the following hold:

1. Existing nodes are discoverable and selectable in the BRep editor.
2. Structured edits work for each currently supported node type.
3. Literal/parameter scalar semantics are preserved and invalid unit references fail validation.
4. Invalid/missing node references and cycles fail closed before active source replacement.
5. A valid feature save creates a new immutable canonical revision.
6. Refresh/reopen shows the saved feature source and native geometry.
7. Restore/branch continues to operate on the same message-tree lineage.
8. A stale feature save cannot overwrite a newer AI, parameter or revision change.
9. Unsaved parameter drafts and AI streaming block direct feature writes.
10. Exact STEP derives from the selected saved BRep source after feature editing.
11. Ordinary OpenSCAD workflows remain unchanged.
12. Repository quality gates are green and the focused browser acceptance is recorded before merge.
