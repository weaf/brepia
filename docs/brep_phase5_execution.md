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

Active Phase 5C branch:

```text
feature/brep-project-object-authoring
```

The current implementation is the source of truth. `docs/brep_kernel_plan.md` provides the roadmap goal, while completed Phase 1–4 execution/status documents are historical evidence.

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
- complete canonical BRep snapshots for built-in AI, OpenCode and Codex editing paths.

No `rhino3dm`, openNURBS, RhinoCommon, Rhino.Compute or Grasshopper runtime dependency exists in the application today.

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
- provider result-contract version is `0.2.0`;
- exact STEP remains derived only from `resultNodeId`;
- auxiliary geometry is intentionally not added to the ordinary browser preview.

## 5C — Project-object authoring and AI product integration — active

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

The UI must make this distinction explicit:

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

### Graph product integration

The dependency graph remains presentation-only but identifies nodes carrying semantic project-object roles:

- `FP` — Footprint;
- `CL` — Clearance envelope;
- `MT` — Maintenance envelope.

The selected-node details expose full role names.

Safe delete is surfaced before mutation: a role-assigned node cannot be deleted until all project-object roles referencing it are explicitly cleared. There is no hidden role rewrite or cascading delete.

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

Do not add in 5C:

- auxiliary geometry overlay/toggling in the ordinary 3D viewer;
- multi-output STEP;
- 3DM/rhino3dm;
- Rhino.Compute;
- Grasshopper component/runtime generation;
- new BRep feature node types;
- kernel-topology IDs;
- a second project-object persistence/history system;
- placement transformation of local native preview geometry.

## 5D — Minimum Rhino/3DM interoperability and Phase 5 closeout — later

After 5C is accepted, add only the minimum 3DM/rhino3dm capability needed to prove the later Grasshopper path.

Before adding a dependency, verify and record:

- exact rhino3dm/openNURBS package/version;
- Linux/headless support in the selected implementation path;
- licensing/distribution terms;
- exact geometry conversion capability from the existing OCCT result without making Rhino the authoritative kernel.

Target interoperability acceptance should prove that a representative BRep project object can produce a useful 3DM-compatible artifact carrying geometry plus placement/object metadata/project-object semantics where the selected library supports them.

Do not broaden 5D into a Grasshopper component/runtime; that is Phase 6+ work.

## Phase 5A acceptance closeout

Phase 5A was accepted and merged through PR #30. Quality Gates #367 and #368 passed; the slice had no new browser/native-execution product surface and therefore used contract/regression acceptance.

## Phase 5B acceptance closeout

Phase 5B was accepted and merged through PR #31 at `2fbef6649701bd33f51d971104a303a69ac32c38`.

Evidence:

- Quality Gates #369 and #370 passed;
- real rootless-Podman build123d/OCCT smoke passed with primary result `cut`, 732 triangles, all three semantic roles and `cableEntry` resolved to `[50,10,0]` with direction `[0,0,1]`;
- focused browser regression confirmed ordinary BRep preview, Dimension-driven native re-evaluation and STEP export remained green;
- primary-result viewer/STEP behavior remained unchanged.

## Phase 5C acceptance

5C is complete only when all of the following hold:

1. Project object is collapsed by default and remains usable on desktop and mobile.
2. Footprint, clearance and maintenance roles can each be assigned and cleared through existing canonical feature IDs.
3. Assigning a role creates an immutable source revision, survives reload and produces the expected `FP`/`CL`/`MT` graph marker without changing `resultNodeId`.
4. One feature may intentionally carry multiple semantic roles and the graph communicates all assigned roles.
5. A new semantic point can be created with an explicit stable ID, kind, label and literal local position; it survives reload and appears in canonical `project.brep.json`.
6. A semantic point position can reference a compatible `mm` published parameter and optional direction can reference a compatible `none` parameter; incompatible units fail before persistence.
7. Existing semantic point IDs are read-only while label/kind/position/direction remain editable.
8. Removing points and clearing roles is explicit; clearing the final role/point canonicalizes an empty `projectObject` away.
9. Graph Delete is blocked for a role-assigned node with an actionable clear-role explanation. After roles are cleared, normal result/consumer/last-node delete guards remain authoritative.
10. Dirty parameter preview and AI streaming block project-object writes while graph navigation remains available.
11. Revision selection/restore reproduces pre/post project-object snapshots and the correct role markers/semantic points.
12. A normal AI BRep follow-up that edits unrelated geometry preserves existing project-object roles and semantic point IDs.
13. An AI BRep follow-up can intentionally assign/clear a role or add/edit/remove a semantic point through the complete canonical snapshot contract without unintended node/parameter identity churn.
14. Existing ordinary native preview remains primary-result-only and STEP still exports the primary Result.
15. OpenSCAD behavior remains unchanged.
16. Repository tests, typecheck, lint, build and diff checks are green before merge.
