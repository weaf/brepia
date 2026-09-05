# BRep Phase 4 execution contract

## Status

Phase 4 — Brepia graph/editor UX — is active on current `master`.

Accepted Phase 4A checkpoint:

```text
8b13e2307e011da7df4a809a302e6f6104b01170
Merge pull request #26 from weaf/feature/brep-graph-editor
Phase 4A: direct BRep feature editing
```

Active Phase 4B branch:

```text
feature/brep-graph-visualization
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
- complete-project normalization and compare-and-set persistence for direct feature saves;
- AI creation/editing through complete validated canonical snapshots;
- restore, branch, retry and stale-write protection;
- read-only canonical `project.brep.json` inspection;
- isolated build123d/OCCT evaluation and exact native STEP export.

Phase 4A intentionally did not add a graph layout or structural DAG authoring. The next gap is dependency visualization and navigation over the already-authoritative canonical graph.

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

## 4A — Existing feature inspector/editor — complete

Phase 4A is accepted and merged. It provides:

- a structured **Features** inspector over every canonical node;
- editing for `box`, `cylinder`, `transform`, `subtract`, and `fillet`;
- literal and compatible published-parameter scalar semantics;
- complete-project validation through `normalizeBrepProject`;
- immutable source revisions with expected-leaf compare-and-set activation;
- coordination with parameter drafts/saves, revision actions, exports and AI streaming;
- browser/runtime acceptance of feature editing, persistence, revision behavior and exact STEP authority.

The 4A restrictions on node identity/type and structural authoring continue into 4B.

## 4B — Graph visualization and dependency navigation — active

### Product behavior

- Visualize the canonical BRep feature DAG inside the existing Features inspector.
- Derive all graph nodes and edges from the current `BrepProject`; persist no graph layout state.
- Direct edges from dependency/input nodes toward their consumers/result flow.
- Use deterministic topological depth so primitives appear upstream and the result flow progresses toward the result node.
- Clearly identify the canonical `resultNodeId`.
- Keep one ephemeral selected-node state synchronized between graph nodes and the existing feature list.
- Selecting a graph node must not itself mutate the project or force an edit operation.
- For the selected node, expose direct **Inputs** and **Used by** navigation links.
- Highlight the selected node, its direct inputs/consumers and incident edges sufficiently to follow local dependency flow.
- Preserve Phase 4A editing: an eligible selected node can still open the existing structured feature editor and saves use the unchanged canonical persistence path.
- Dependency navigation remains usable while feature writes are disabled by AI streaming, parameter drafts or another source action.
- The graph must remain usable in the narrow desktop Parameters panel and the mobile Parameters view through bounded scrolling rather than changing application layout.

### Graph-model behavior

- Dependency semantics come from the same canonical node-reference interpretation used by Phase 4A.
- Derived graph metadata may include depth, consumers and presentation edges, but it is not part of `BrepProject` and is never serialized.
- Graph derivation must not reorder or mutate `project.nodes`.
- Although canonical projects already reject missing references and cycles, the presentation boundary must fail closed if handed an unexpected invalid snapshot.
- Repeated semantic references may be deduplicated for presentation so one dependency pair produces one visual edge.

### Explicit 4B non-goals

Do not add in this slice:

- node creation or deletion;
- node-ID renaming;
- node-type conversion;
- dependency rewiring through graph gestures;
- result-node reassignment;
- drag/drop persistence or saved graph coordinates;
- freeform canvas authoring;
- project placement/metadata editing;
- published-parameter definition creation/deletion;
- browser-side geometry execution;
- Rhino/Grasshopper/3DM integration.

## Later Phase 4 slices

### 4C — Structural DAG authoring

Add validated node creation/deletion, dependency rewiring and result-node selection with stable-ID semantics and explicit destructive-operation handling.

### 4D — Project definition editing and closeout

Add the remaining direct project-definition surfaces that prove useful (published parameter definitions, placement and metadata), then run browser/runtime/regression acceptance and close Phase 4.

## 4B acceptance

4B is complete only when all of the following hold:

1. Every canonical BRep node appears in the dependency graph and the result node is visibly identifiable.
2. Dependency edges follow the canonical node references and point from input/dependency toward consumer.
3. A branched project such as the cabinet sample has deterministic topological levels independent of feature-list selection.
4. Clicking a graph node updates the selected state shown by the feature inspector without changing canonical project data.
5. Clicking an inspector node keeps graph selection synchronized and preserves the existing 4A edit affordance when editing is allowed.
6. Inputs and consumers of the selected node can be navigated directly.
7. Selected-node local flow is visually distinguishable from unrelated graph branches.
8. Graph navigation remains available while source editing is blocked by AI streaming or unsaved parameter state; actual feature editing remains blocked.
9. Refresh/revision changes rebuild the graph solely from the newly selected canonical source.
10. No graph position/selection data is persisted into `BrepProject`, messages or project packages.
11. Existing feature save, native preview, revision history, AI continuation and STEP export behavior remain unchanged.
12. The graph is practically scrollable/touch-usable in desktop and mobile Parameters views.
13. Repository quality gates are green and focused browser acceptance is recorded before merge.
