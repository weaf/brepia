# BRep Phase 5 execution contract

## Status

Phase 5 — project-object contract and Rhino interoperability — is complete and accepted.

Accepted checkpoints:

```text
601a51ee811d2bbaae236a797b7e0cecd81075eb
Merge pull request #30 — Phase 5A: BRep project-object contract

2fbef6649701bd33f51d971104a303a69ac32c38
Merge pull request #31 — Phase 5B: native BRep project-object evaluation

e7b679cfa0b89478f0ce8d016dc374ab60d423ab
Merge pull request #32 — Phase 5C: BRep project-object authoring
```

Phase 5D is complete and accepted on PR #33. The PR #33 merge commit is the final Phase 5 `master` checkpoint; do not substitute a pre-merge branch SHA for that checkpoint.

The current implementation remains the source of truth. `docs/brep_kernel_plan.md` provides roadmap context. This document is completed-phase evidence after PR #33 merges, not an active implementation queue. Detailed 5D dependency/fidelity evidence is in `docs/brep_phase5_5d_interop.md`.

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
- a shared `Model | Graph` BRep workspace where the 3D viewer and dependency graph are peer views over the same canonical project;
- headless Rhino/openNURBS interoperability through pinned `rhino3dm==8.32.1` inside the existing isolated native sandbox;
- 3DM export containing tessellated Result/project-object meshes, real semantic point objects, Brepia identity/placement/metadata user strings and the exact primary STEP embedded as `brepia-primary.step`.

RhinoCommon, Rhino desktop, Rhino.Compute and a Grasshopper runtime are not dependencies of the accepted Phase 5 application.

## Phase 5 architecture locks

1. `BrepProject` remains Brepia's only canonical editable BRep source model.
2. Rhino/3DM/Grasshopper artifacts are interoperability outputs, never a second source of truth.
3. The isolated build123d/OCCT runtime remains authoritative for native BRep evaluation and exact primary STEP.
4. `resultNodeId` remains the primary BRep authority; project-object geometry roles are auxiliary semantics, not a competing primary-result field.
5. `placement` remains the local/insertion coordinate contract and does not silently become a local-preview transform.
6. Existing project/node/parameter identities remain stable. Existing semantic point IDs remain stable while the same semantic point continues to exist.
7. Existing OpenSCAD workflows remain independent and unchanged.
8. Ordinary BRep authoring, evaluation and STEP export must not require Rhino.
9. Rhino.Compute and Grasshopper runtime/component work remain later phases unless a future roadmap explicitly changes that boundary.
10. Native primary and auxiliary outputs remain bounded and deterministic.
11. Direct project-object UI writes use the accepted full-project source-save guard and immutable CAS persistence path; no second history model exists.
12. Graph visualization remains presentation-only and never becomes source authority.
13. `Model` and `Graph` are presentation/workspace modes only; switching views does not create revisions, mutate source or change primary-result semantics.
14. 3DM tessellation must never be described as exact OCCT-to-Rhino BRep conversion. Exact primary CAD fidelity remains the embedded/native STEP artifact.
15. 3DM geometry remains in Brepia's component-local coordinates; `placement` travels as semantic insertion-plane data rather than being implicitly applied as a transform.
16. 3DM is an export/interoperability container, not canonical/imported authoring source in Phase 5.

## Additive v1 source compatibility

Phase 5A added optional `projectObject` data to schema version 1 without changing existing field meaning:

- valid existing v1 projects without `projectObject` remain valid;
- no existing project/node/parameter ID is regenerated;
- canonical package import/export transports the complete normalized project snapshot;
- AI complete-snapshot schemas accept and preserve project-object data;
- an empty project-object definition canonicalizes back to no `projectObject` field.

The 5D 3DM capability does not change the canonical source schema version.

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

A successful native evaluation includes a kernel-neutral `projectObject` result beside the accepted primary result fields:

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
- host validation treats sandbox result JSON as untrusted and verifies role IDs/resolved semantic data against the normalized request;
- accepted 5B provider result-contract version is `0.2.0`;
- exact STEP remains derived only from `resultNodeId`;
- auxiliary geometry is intentionally not added to the ordinary browser preview.

## 5C — Project-object authoring and AI product integration — complete

The accepted direct editor supports assigning/clearing Footprint, Clearance envelope and Maintenance envelope, plus adding/editing/removing stable semantic points with kind, optional label, local position and optional direction. Compatible `mm` and `none` parameter references are supported.

Existing semantic point IDs are read-only in direct editing. If semantic identity genuinely changes, the user removes the old point and creates a new one. New point IDs receive deterministic suggestions but remain explicit editable drafts before first save.

Project-object writes:

1. construct a complete next `BrepProject` through the shared project-object editing helper;
2. canonical-normalize all role/point/reference/unit rules;
3. pass through the existing `saveProjectSource(...)` guard;
4. persist through the immutable source-revision/CAS path.

No project-object database table, patch API or separate history model was introduced.

The dependency graph remains presentation-only and shows `FP`, `CL` and `MT` role markers. Role-assigned nodes are protected from delete until the role is explicitly cleared.

The accepted workspace model is **Model | Graph** in the main BRep workspace:

- `Model` renders the primary-result native 3D viewer;
- `Graph` renders the dependency graph as a full peer workspace;
- Parameters-side Features remains a compact navigator/inspector;
- Graph and Features share selection and Edit / Set result / Delete callbacks;
- view switching is ephemeral UI state;
- the same workspace modes are available in the mobile/tablet workspace sheet.

Provider-visible BRep schemas and instructions for built-in AI, OpenCode and Codex use complete project snapshots and explicitly preserve unchanged project/node/parameter/project-object identities and semantic point IDs.

## 5D — Minimum Rhino/3DM interoperability — complete

5D pins `rhino3dm==8.32.1` in the existing Python 3.12 rootless/headless native sandbox. build123d/OCCT remains authoritative for modeling/evaluation and exact primary STEP.

The 3DM artifact uses an explicit dual-representation contract:

- native Rhino Mesh objects represent the tessellated Result and declared project-object geometry for direct 3DM visibility/interoperability;
- real Rhino point objects represent resolved connection/mounting/cable points;
- document/object user strings preserve project identity, node identity, semantic roles, resolved placement, metadata and project-object semantics;
- the exact primary OCCT STEP is embedded as `brepia-primary.step`.

One unique canonical node is emitted once even if it carries multiple roles; its metadata records every role.

The native driver re-opens its generated 3DM before success and verifies millimetre units, project/placement identity and extraction/signature of the embedded STEP. The host independently bounds the artifact, requires a regular non-symlink file and verifies the 3DM header before exposing bytes.

The existing authenticated native export route remains backward-compatible for STEP and uses content negotiation for `model/vnd.3dm`. The BRep download selector exposes `.STEP`, `.3DM` and `.BREP JSON`; STEP and 3DM use current preview parameter values, while the canonical package continues to require saved source state.

Provider capability version is `0.3.0` because the native runner emits the 3DM sibling artifact in addition to the accepted result/STEP outputs.

A real native acceptance run exposed two headless integration details before closeout:

- Python `File3dmStringTable` uses mapping syntax (`model.Strings[key] = value`) rather than the initially assumed `SetString` method;
- the slim image needs `fontconfig` to avoid an invalid/default font-config environment during rhino3dm initialization.

Both were corrected and regression-covered before final acceptance. The image base pip version was not upgraded solely for 5D because it successfully installs all pinned wheels and is not part of the runtime contract.

### 5D non-goals

5D does not add:

- Rhino desktop/RhinoCommon;
- Rhino.Compute;
- Grasshopper runtime/component generation or `.gh` files;
- 3DM as canonical/editable source;
- 3DM import/authoring round trips;
- mesh-derived geometry advertised as exact BRep/NURBS;
- placement transformation of local native geometry;
- multi-result STEP;
- OpenSCAD changes.

## Phase 5 acceptance closeout

### 5A

Phase 5A was accepted and merged through PR #30. Quality Gates #367 and #368 passed; it introduced no new browser/native-execution product surface and therefore used contract/regression acceptance.

### 5B

Phase 5B was accepted and merged through PR #31 at `2fbef6649701bd33f51d971104a303a69ac32c38`.

Evidence:

- Quality Gates #369 and #370 passed;
- real rootless-Podman build123d/OCCT smoke passed with primary result `cut`, 732 triangles, all three semantic roles and `cableEntry` resolved to `[50,10,0]` with direction `[0,0,1]`;
- focused browser regression confirmed ordinary BRep preview, Dimension-driven native re-evaluation and STEP export remained green.

### 5C

Phase 5C was accepted and merged through PR #32 at `e7b679cfa0b89478f0ce8d016dc374ab60d423ab`.

Evidence:

- direct Project object authoring and stable semantic points were accepted on desktop/mobile;
- role assignment/clearing, parameter-backed point scalars, validation, immutable revision persistence, reload/restore and role-aware safe-delete behavior were accepted;
- built-in/local BRep AI preservation and intentional project-object editing flows were accepted without unintended identity churn;
- ordinary primary-result preview and STEP behavior remained unchanged;
- the accepted `Model | Graph` main-workspace design replaced the earlier narrow-panel graph presentation;
- Quality Gates #371 and #387 passed implementation stages;
- Quality Gate #388 passed the final closeout head.

### 5D and final Phase 5 acceptance

Phase 5D was product/native accepted on PR #33 on 2026-09-06.

Evidence:

- the rebuilt native image successfully installed the pinned build123d/OCCT stack plus `rhino3dm==8.32.1` and headless font configuration;
- real rootless-Podman smoke completed with primary result `cut`, 732 triangles, semantic roles `footprint`, `clearanceEnvelope`, `maintenanceEnvelope`, and `cableEntry` at `[50,10,0]` with direction `[0,0,1]`;
- the same smoke emitted both `model.step` and `model.3dm`;
- by driver contract, successful smoke also proves the generated 3DM was independently re-opened with rhino3dm, millimetre/project/placement identity round-tripped, and embedded `brepia-primary.step` was extracted with a valid STEP signature;
- browser acceptance confirmed Model/Graph, parameter-driven preview, STEP export, 3DM export and canonical BRep JSON behavior were green;
- 3DM artifacts from both tested cases opened successfully in a separate mobile application, providing independent consumer verification outside Brepia/rhino3dm;
- host malformed/oversized/header rejection and current-preview-value export behavior are regression-covered;
- Quality Gate #397 passed after the native binding/fontconfig correction with tests, typecheck, lint, build and diff check green;
- the exact documentation closeout head must pass one final Quality Gate before PR #33 merges.

Once that final closeout-head gate is green and PR #33 is merged, Phase 5 is closed. Future roadmap work must start from the resulting `master` merge checkpoint and treat this document as completed-phase evidence.
