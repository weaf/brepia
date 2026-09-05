# BRep Phase 4 execution contract

## Status

Phase 4 — Brepia graph/editor UX — is active on current `master`.

Accepted Phase 4B checkpoint:

```text
1f71a34367fbb923d829a5be61fc2acfe3eb0d44
Merge pull request #27 from weaf/feature/brep-graph-visualization
Phase 4B: BRep dependency graph navigation
```

Active Phase 4C branch:

```text
feature/brep-structural-dag-authoring
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
- direct structured editing of every existing feature type from Phase 4A;
- dependency graph visualization, synchronized selection and Inputs / Used by navigation from Phase 4B;
- complete-project normalization and compare-and-set persistence for direct source saves;
- AI creation/editing through complete validated canonical snapshots;
- restore, branch, retry and stale-write protection;
- read-only canonical `project.brep.json` inspection;
- isolated build123d/OCCT evaluation and exact native STEP export.

Phase 4A already permits structured dependency changes in existing nodes through `transform.input`, `subtract.base/tools`, and `fillet.input`. Phase 4C completes direct structural DAG authoring by adding node creation, safe node deletion, and explicit result-node selection over the same canonical source model.

## Phase 4 architecture locks

1. `BrepProject` remains the only canonical BRep authoring model.
2. The graph/editor is a view and editor over that model, never a second runtime or second source of truth.
3. Existing immutable revision lineage remains authoritative. Structural editor saves create complete normalized source snapshots rather than mutating historical revisions.
4. Direct source persistence must use compare-and-set activation against the expected active leaf so an overlapping AI/parameter/editor write cannot reactivate stale source.
5. Native evaluation remains the existing isolated build123d/OCCT path.
6. `conversation.type` remains `parametric`.
7. Existing project/node/parameter IDs remain stable. A node receives its stable ID at creation; existing node IDs are never renamed in Phase 4C.
8. OpenSCAD behavior, source routing and project editing are out of scope for Phase 4.
9. Rhino/Grasshopper, 3DM and project-object contracts remain later roadmap phases.

## 4A — Existing feature inspector/editor — complete

Phase 4A provides structured editing for all existing node types, literal/parameter scalar semantics, complete-project validation, immutable source revisions and browser/native acceptance.

## 4B — Graph visualization and dependency navigation — complete

Phase 4B provides deterministic presentation-only graph derivation, result visualization, synchronized graph/inspector selection, Inputs / Used by navigation and mobile/desktop browser acceptance. No layout or selection state is persisted.

## 4C — Structural DAG authoring — active

### Product behavior

- Add direct creation of all five currently supported BRep node types.
- A newly created node receives an explicit stable node ID. That ID must satisfy the canonical ID contract and must not already exist.
- Creation uses the same structured scalar/reference controls as the existing feature editor where applicable.
- New nodes do **not** implicitly replace the current result node. Result selection is an explicit separate action.
- Existing structured reference controls remain the supported Phase 4C dependency-rewiring surface:
  - `transform.input`;
  - `subtract.base` and `subtract.tools`;
  - `fillet.input`.
- Add an explicit **Set result** operation for any existing node.
- Add an explicit **Delete feature** operation with confirmation.
- Every structural operation validates the complete candidate project through `normalizeBrepProject` before persistence and then uses the existing immutable source-revision compare-and-set path.
- The graph and feature list rebuild only from the newly selected canonical source after a structural revision becomes active.

### Stable-ID semantics

- Existing node IDs remain immutable.
- Creation accepts a new user-visible ID and validates it against the canonical `BrepProject` rules.
- Duplicate IDs fail before persistence.
- Deleting a node does not make its historical ID disappear from previous immutable revisions; a later new revision may technically reuse a deleted ID if it passes the canonical snapshot contract, but the UI should generate a fresh non-conflicting suggestion rather than encouraging reuse.

### Safe deletion semantics

Phase 4C intentionally does not perform hidden cascading graph mutation.

A node may be deleted only when all of the following are true:

1. it is not the current `resultNodeId`;
2. no current node references it as an input/base/tool;
3. deleting it leaves at least one node in the project.

If a node has consumers, the user must first rewire or remove those consumer references. If the node is the result, another result must be selected first. This makes every destructive dependency change explicit and keeps revision diffs understandable.

### Creation defaults

Creation dialogs may seed safe editable defaults, but defaults are only draft UI state until Save:

- `box`: literal width/depth/height values;
- `cylinder`: literal radius/height values;
- `transform`: an existing input plus a translation draft;
- `fillet`: an existing input, literal radius and axis selector;
- `subtract`: an existing base plus at least one distinct existing tool.

The complete candidate is still canonicalized and validated before persistence.

### Concurrency / dirty-state behavior

Structural writes are disabled while:

- an AI turn is streaming;
- there are unsaved parameter preview values;
- a parameter source save is active;
- another source save is active;
- a revision action is active;
- an export action that already blocks source editing is active.

Read-only graph navigation remains available while writes are blocked.

### Explicit 4C non-goals

Do not add in this slice:

- node-ID renaming;
- node-type conversion for existing nodes;
- graph drag/drop rewiring;
- implicit cascading delete;
- persisted graph coordinates/layout;
- freeform canvas authoring;
- project placement/metadata editing;
- published-parameter definition creation/deletion;
- browser-side geometry execution;
- Rhino/Grasshopper/3DM integration.

## Later Phase 4 slice

### 4D — Project definition editing and closeout

Add the remaining direct project-definition surfaces that prove useful (published parameter definitions, placement and metadata), then run browser/runtime/regression acceptance and close Phase 4.

## 4C acceptance

4C is complete only when all of the following hold:

1. A new `box` can be created with a new stable ID, appears in graph/list after save, and survives refresh/reopen.
2. A new `cylinder` can be created and canonical validation rejects an invalid/duplicate ID without changing active source.
3. A new `transform` or `fillet` can reference an existing node and appears at the correct dependency depth after save.
4. A new `subtract` requires a base plus at least one tool and produces the expected dependency edges after save.
5. Existing dependency fields can be rewired and cycle/missing-reference validation still fails closed before active source replacement.
6. **Set result** creates one immutable source revision and updates result highlighting/native geometry from that selected node.
7. A non-result node with no consumers can be deleted only after explicit confirmation and remains present in older revisions.
8. Delete is blocked for the active result node and for a node with consumers, with actionable explanation rather than implicit cascade.
9. Restore/revision selection can move between pre- and post-structural snapshots with the correct graph/source each time.
10. Unsaved parameter state and AI streaming block structural writes while graph navigation remains usable.
11. Exact STEP and project-package export derive from the selected saved canonical BRep source after structural edits.
12. Ordinary OpenSCAD workflows remain unchanged.
13. Repository quality gates are green and focused desktop/mobile browser acceptance is recorded before merge.
