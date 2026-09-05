# BRep Phase 5 execution contract

## Status

Phase 5 — project-object contract and Rhino interoperability — is active.

Accepted Phase 5A checkpoint:

```text
601a51ee811d2bbaae236a797b7e0cecd81075eb
Merge pull request #30 from weaf/feature/brep-project-object-contract
Phase 5A: BRep project-object contract
```

Accepted Phase 5B checkpoint:

```text
2fbef6649701bd33f51d971104a303a69ac32c38
Merge pull request #31 from weaf/feature/brep-project-object-evaluation
Phase 5B: native BRep project-object evaluation
```

Accepted Phase 5C checkpoint:

```text
e7b679cfa0b89478f0ce8d016dc374ab60d423ab
Merge pull request #32 — Phase 5C: BRep project-object authoring
Phase 5C: BRep project-object authoring
```

Active Phase 5D branch:

```text
feature/brep-rhino3dm-interoperability
```

The current implementation is the source of truth. `docs/brep_kernel_plan.md` provides the roadmap goal, while completed Phase 1–4 execution/status documents are historical evidence. The detailed 5D dependency/fidelity contract is recorded in `docs/brep_phase5_5d_interop.md`.

## Reconciled Phase 5 architecture

The accepted BRep stack now provides:

- `resultNodeId` as the canonical primary BRep feature;
- `placement` as the kernel-neutral local/insertion coordinate system intended to map to a future Grasshopper Plane;
- `metadata` for explicit object type, classification and bounded custom properties;
- optional canonical `projectObject` source semantics for footprint, clearance-envelope and maintenance-envelope feature roles plus stable local connection/mounting/cable points;
- isolated build123d/OCCT evaluation of the primary result and declared project-object auxiliary geometry;
- resolved placement/metadata/semantic points in the native evaluation result;
- exact STEP export from the primary `resultNodeId` only;
- immutable project source revisions with compare-and-set activation;
- complete canonical BRep snapshots for built-in AI, OpenCode and Codex editing paths;
- a shared `Model | Graph` BRep workspace where the 3D viewer and dependency graph are peer views over the same canonical project rather than forcing the graph into the narrow Parameters inspector.

Phase 5D adds `rhino3dm` only inside the existing isolated native sandbox as a headless 3DM interoperability/document dependency. It does not introduce RhinoCommon, Rhino desktop, Rhino.Compute or a Grasshopper runtime into the application.

## Phase 5 architecture locks

1. `BrepProject` remains Brepia's only canonical editable BRep source model.
2. Rhino/3DM/Grasshopper artifacts are interoperability outputs, never a second source of truth.
3. The existing isolated build123d/OCCT runtime remains authoritative for native BRep evaluation.
4. `resultNodeId` remains the primary BRep authority; project-object geometry roles are auxiliary semantics and never a competing primary-result field.
5. Existing `placement` remains the local/insertion coordinate contract and must not silently become a local-preview transform.
6. Existing project/node/parameter identities remain stable. Existing semantic point IDs are also stable while the same point continues to exist.
7. Existing OpenSCAD workflows remain independent and unchanged.
8. Phase 5 must not require Rhino to author, edit, evaluate or STEP-export ordinary BRep projects.
9. Rhino.Compute and Grasshopper runtime/component work remain later phases unless explicitly pulled forward by a proven interoperability requirement.
10. Native auxiliary outputs must remain bounded and deterministic.
11. Direct UI project-object writes must use the accepted full-project source-save guard and immutable CAS persistence path; no second history model is allowed.
12. Graph visualization remains presentation-only and never becomes source authority.
13. `Model` and `Graph` are presentation/workspace modes only; switching views must not create revisions, mutate project source or change primary-result semantics.
14. 3DM tessellation must never be described as exact OCCT-to-Rhino BRep conversion. Exact primary CAD fidelity remains the native STEP artifact.
15. 3DM geometry remains in Brepia's local component coordinates; `placement` travels as semantic insertion-plane data and is not implicitly applied as a transform.

## Additive v1 source compatibility

Phase 5A added optional `projectObject` data to schema version 1. This remains additive:

- valid existing v1 projects without `projectObject` remain valid;
- no existing source field changes meaning;
- no existing ID is regenerated;
- canonical package import/export transports the complete normalized project snapshot;
- AI complete-snapshot schemas accept and preserve project-object data;
- an empty project-object definition canonicalizes back to no `projectObject` field.

A future breaking source-format change may introduce a new schema version, but these optional semantic outputs do not require one.

## 5A — Canonical project-object contract — complete

Canonical project-object mapping:

```text
primary BRep               -> resultNodeId
local/insertion plane      -> placement
object metadata            -> metadata
auxiliary semantic outputs -> projectObject
```

`projectObject` may declare:

- `footprintNodeId`;
- `clearanceEnvelopeNodeId`;
- `maintenanceEnvelopeNodeId`;
- bounded stable semantic local `points`.

Each point has a stable ID, kind `connection | mounting | cable`, local mm position, optional unitless direction and optional label. Compatible published-parameter references are supported. Geometry roles reference canonical feature node IDs rather than kernel-topology IDs.

5A also protects referenced parameters and role-assigned nodes from destructive Phase 4 authoring operations without hidden cascading rewrites.

## 5B — Native project-object evaluation — complete

A successful native evaluation includes a kernel-neutral `projectObject` result alongside the accepted primary result fields:

```text
status / provider / projectId / resultNodeId
bodies / bounds                 <- primary result remains authoritative
projectObject
  placement                     <- resolved insertion/local plane
  metadata                      <- canonical object metadata when present
  geometry
    footprint                   <- evaluated role body when declared
    clearanceEnvelope           <- evaluated role body when declared
    maintenanceEnvelope         <- evaluated role body when declared
  points[]                      <- resolved semantic local points
warnings / exactExport
```

Key invariants:

- top-level `bodies`/`bounds` remain primary-result-only;
- auxiliary role geometry uses the same build123d/OCCT DAG cache and stable node IDs;
- semantic scalars resolve under the exact current parameter values;
- host validation treats sandbox result JSON as untrusted and verifies role IDs and resolved semantic data against the normalized request;
- provider result-contract version is `0.2.0` for the accepted 5B checkpoint;
- exact STEP remains derived only from `resultNodeId`;
- auxiliary geometry is intentionally not added to the ordinary browser preview.

## 5C — Project-object authoring and AI product integration — complete

### Direct authoring surface

5C adds a compact, collapsed-by-default **Project object** section beside the accepted Phase 4D project-definition editor.

The editor supports:

- assigning or clearing Footprint;
- assigning or clearing Clearance envelope;
- assigning or clearing Maintenance envelope;
- assigning the same feature node to multiple roles when intentionally desired;
- adding, editing and removing semantic points;
- stable point IDs;
- point kind `connection`, `mounting` or `cable`;
- optional point label;
- local mm position with literal or compatible `mm` published-parameter scalars;
- optional unitless direction with literal or compatible `none` published-parameter scalars.

Existing semantic point IDs are read-only in the direct editor. Changing a point's label, kind, position or direction preserves identity. If the semantic identity genuinely changes, the user removes the old point and creates a new one.

New point IDs are explicit editable drafts before first save and receive deterministic current-snapshot suggestions such as `connection`, `connection2`, and so on.

### Result versus project-object roles

The UI makes this distinction explicit:

- **Result** is the canonical primary body used by the ordinary 3D preview and exact primary STEP export.
- **Footprint / Clearance / Maintenance** are semantic auxiliary outputs evaluated separately by the native runtime.

Assigning a project-object role does not implicitly change Result, and Set result does not implicitly rewrite project-object roles.

5C does not add auxiliary-geometry overlay/toggling to the ordinary browser viewer. That can be added later as a presentation/UX capability without changing canonical source semantics.

### Canonical write path

Project-object UI writes:

1. construct a complete next `BrepProject` through `replaceBrepProjectObjectDefinition(...)`;
2. canonical-normalize all role/point/reference/unit rules before persistence;
3. call the existing `saveProjectSource(...)` guard;
4. persist through the accepted `onProjectSourceCommit(...)` immutable source-revision/CAS path.

No project-object-specific database tables, patch API or history model are introduced.

The existing source-write guards therefore continue to block project-object writes while:

- a parameter preview is dirty;
- another source/parameter/revision/export write is active;
- the current AI turn is streaming.

Read-only graph navigation remains available under those conditions.

### Graph product integration and workspace

The dependency graph remains presentation-only and identifies nodes carrying semantic project-object roles:

- `FP` — Footprint;
- `CL` — Clearance envelope;
- `MT` — Maintenance envelope.

The selected-node details expose full role names. Safe delete is surfaced before mutation: a role-assigned node cannot be deleted until all project-object roles referencing it are explicitly cleared. There is no hidden role rewrite or cascading delete.

The accepted 5C workspace uses **Model | Graph** as peer modes in the main BRep workspace:

- `Model` renders the existing primary-result native 3D viewer;
- `Graph` renders the dependency graph in the main workspace rather than constraining it to the Parameters-panel width;
- the Parameters-side Features section remains a compact navigator/inspector and exposes a Graph shortcut;
- the main Graph view and Features inspector share the same feature selection and the same Edit / Set result / Delete callbacks;
- view switching is ephemeral UI state and does not write project source or revision history;
- the same workspace modes are available inside the existing mobile/tablet workspace sheet.

This replaces the interim attempt to make the full dependency graph fit every possible Parameters-panel width. The graph no longer depends on device-viewport heuristics to decide its primary workspace layout.

### AI product integration

The provider-visible structured BRep schema already accepted `projectObject` in 5A. 5C completes model-facing behavior by making project-object semantics explicit across:

- `tool.build_brep_project`;
- injected `context.brep_project`;
- OpenCode native BRep transport;
- Codex native BRep transport.

All four paths instruct the model/agent to:

- return complete project snapshots, never patches;
- preserve unchanged project/node/parameter identities;
- preserve unchanged project-object role assignments;
- preserve existing semantic point IDs while editing the same semantic point;
- keep `resultNodeId` distinct from auxiliary project-object roles;
- use only schema-supported role and semantic-point fields;
- respect mm versus unitless scalar compatibility.

No separate AI project-object tool or patch protocol is introduced.

### 5C non-goals

5C does not add:

- auxiliary geometry overlay/toggling in the ordinary 3D viewer;
- multi-output STEP;
- 3DM/rhino3dm;
- Rhino.Compute;
- Grasshopper component/runtime generation;
- new BRep feature node types;
- kernel-topology IDs;
- a second project-object persistence/history system;
- placement transformation of local native preview geometry.

## 5D — Minimum Rhino/3DM interoperability and Phase 5 closeout — active

5D pins `rhino3dm==8.32.1` inside the existing Python 3.12 rootless/headless native sandbox. build123d/OCCT remains authoritative for evaluation and exact primary STEP.

The 3DM interoperability artifact is intentionally dual-representation:

- native Rhino Mesh objects represent the current tessellated Result and declared project-object geometry for direct 3DM visibility/interoperability;
- real Rhino point objects represent resolved connection/mounting/cable points;
- document/object user strings preserve project identity, node identity, semantic roles, resolved placement, metadata and project-object semantics;
- the exact primary OCCT STEP is embedded as `brepia-primary.step` so CAD fidelity is preserved without claiming that a tessellated mesh is an exact Rhino Brep.

One unique canonical node is emitted once even if it carries multiple roles. Its object metadata records every role.

The driver re-opens its own generated 3DM before success and verifies millimetre units, project/placement identity and extraction/signature of the embedded STEP. The host separately bounds the regular-file artifact and verifies the 3DM header before bytes are exposed.

The existing authenticated `/api/brep/export/step` transport remains backward-compatible for STEP and negotiates 3DM when the client sends `Accept: model/vnd.3dm`. The existing BRep download selector exposes `.STEP`, `.3DM` and `.BREP JSON`; STEP and 3DM operate on current preview parameter values while the canonical package continues to require saved source state.

Provider capability version is `0.3.0` in 5D because the native runner now emits a 3DM sibling artifact in addition to the accepted result/STEP outputs. The canonical source schema remains version 1 and is unchanged.

### 5D non-goals

5D does not add:

- Rhino desktop/RhinoCommon;
- Rhino.Compute;
- Grasshopper runtime/component generation or `.gh` files;
- 3DM as canonical/editable project source;
- 3DM import or authoring round trips;
- mesh-derived geometry advertised as exact BRep/NURBS;
- placement transformation of local native geometry;
- multi-result STEP;
- OpenSCAD changes.

Detailed dependency/fidelity/acceptance evidence is maintained in `docs/brep_phase5_5d_interop.md`.

## Phase 5A acceptance closeout

Phase 5A was accepted and merged through PR #30. Quality Gates #367 and #368 passed; the slice had no new browser/native-execution product surface and therefore used contract/regression acceptance.

## Phase 5B acceptance closeout

Phase 5B was accepted and merged through PR #31 at `2fbef6649701bd33f51d971104a303a69ac32c38`.

Evidence:

- Quality Gates #369 and #370 passed;
- real rootless-Podman build123d/OCCT smoke passed with primary result `cut`, 732 triangles, all three semantic roles and `cableEntry` resolved to `[50,10,0]` with direction `[0,0,1]`;
- focused browser regression confirmed ordinary BRep preview, Dimension-driven native re-evaluation and STEP export remained green;
- primary-result viewer/STEP behavior remained unchanged.

## Phase 5C acceptance closeout

Phase 5C was accepted and merged through PR #32 at `e7b679cfa0b89478f0ce8d016dc374ab60d423ab`.

Evidence:

- direct Project object authoring for footprint, clearance, maintenance and semantic points was accepted on desktop/mobile;
- role assignment/clearing, stable semantic-point identity, parameter-backed point scalars, validation, immutable revision persistence, reload/restore and role-aware safe-delete behavior were accepted;
- built-in/local BRep AI preservation and intentional project-object editing flows were accepted without unintended canonical identity churn;
- ordinary primary-result preview and STEP behavior remained unchanged;
- graph role markers and project-object interactions were accepted;
- the initial narrow Parameters-panel graph UX was replaced with the accepted `Model | Graph` main-workspace design after browser feedback;
- the final focused browser check accepted Model/Graph switching and the larger graph workspace as the preferred permanent BRep interaction model;
- Quality Gates #371 and #387 passed during implementation;
- Quality Gate #388 passed the final closeout head with tests, typecheck, lint, build and diff check green;
- GitHub verified the PR #32 merge commit and `master` advanced exactly to the accepted merge checkpoint above.

## Phase 5D acceptance

5D and Phase 5 are complete only after all of the following hold:

1. the pinned native image builds with build123d/OCCT plus `rhino3dm==8.32.1`;
2. real rootless-Podman smoke emits valid `result.json`, exact `model.step` and `model.3dm`;
3. the driver re-opens the 3DM headlessly and verifies millimetre units, project/placement identity and embedded exact STEP extraction;
4. a representative project preserves primary Result, FP/CL/MT roles and semantic points in the 3DM contract without duplicate meshes for one multi-role node;
5. host validation rejects malformed/oversized 3DM artifacts before bytes are exposed;
6. authenticated STEP export remains unchanged and 3DM export returns the negotiated media type/artifact;
7. the BRep download selector exposes `.3DM`, including current unsaved preview parameter values just like STEP;
8. ordinary Model/Graph, parameter evaluation, immutable revisions, STEP and BRep JSON regressions remain green;
9. OpenSCAD behavior remains unchanged;
10. repository tests, typecheck, lint, build and diff checks are green;
11. Phase 5 execution documentation is reconciled and Phase 5 is marked complete only after the acceptance evidence above is recorded.
