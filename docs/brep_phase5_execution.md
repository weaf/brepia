# BRep Phase 5 execution contract

## Status

Phase 5 — project-object contract and Rhino interoperability — is active from the accepted Phase 4 master checkpoint:

```text
75fbb88743a6c0fb1c01f9d8de43ce6054ee7246
Merge pull request #29 from weaf/feature/brep-project-definition-editing
Phase 4D: BRep project definition editing
```

Phase 5A — canonical project-object contract — is complete on:

```text
feature/brep-project-object-contract
```

PR #30 is the Phase 5A merge vehicle. After it is merged, Phase 5B — native project-object evaluation — is the next active slice.

The current implementation is the source of truth. `docs/brep_kernel_plan.md` provides the roadmap goal, while completed Phase 1–4 execution/status documents are historical evidence.

## Reconciled starting point

The accepted BRep stack already provides three core project-object concepts:

- `resultNodeId` is the canonical primary BRep feature;
- `placement` is the kernel-neutral local/insertion coordinate system intended to map to a future Grasshopper Plane;
- `metadata` carries explicit object type, classification and bounded custom string properties.

The current native evaluator:

- evaluates only the canonical `resultNodeId`;
- returns one primary body with bounds/viewer mesh;
- exports exact STEP for that primary result;
- does not yet evaluate semantic auxiliary project outputs.

No `rhino3dm`, openNURBS, RhinoCommon, Rhino.Compute or Grasshopper runtime dependency exists in the application today.

The missing Phase 5 project-object concepts after 5A are native auxiliary-output evaluation and the later Rhino/3DM interoperability proof.

## Phase 5 architecture locks

1. `BrepProject` remains Brepia's only canonical editable BRep source model.
2. Rhino/3DM/Grasshopper artifacts are interoperability outputs, never a second source of truth.
3. The existing isolated build123d/OCCT runtime remains authoritative for native BRep evaluation.
4. `resultNodeId` remains the primary BRep authority; Phase 5 must not invent a competing primary-result field.
5. Existing `placement` remains the local/insertion coordinate contract and must not silently become a local-preview transform.
6. Existing project/node/parameter identities remain stable.
7. Existing OpenSCAD workflows remain independent and unchanged.
8. Phase 5 must not require Rhino to author, edit, evaluate or STEP-export ordinary BRep projects.
9. Rhino.Compute and Grasshopper runtime/component work remain later phases unless explicitly pulled forward by a proven Phase 5 interoperability requirement.
10. Native auxiliary outputs must remain bounded and deterministic.

## Additive v1 source compatibility

Phase 5A adds an optional project-object output definition to the existing schema-version-1 project contract.

This is deliberately additive:

- existing valid v1 projects without project-object outputs remain valid and normalize exactly as before;
- no existing field changes meaning;
- no existing ID is regenerated;
- canonical package import/export continues to transport the complete normalized project snapshot;
- AI complete-snapshot schemas accept and preserve the optional field before projects begin using it.

A future breaking source-format change may introduce a new schema version, but optional Phase 5 semantic output declarations do not require one.

## 5A — Canonical project-object contract — complete

### Canonical role mapping

The complete project-object contract is intentionally composed from existing and new canonical fields:

```text
primary BRep               -> resultNodeId
local/insertion plane      -> placement
object metadata            -> metadata
auxiliary semantic outputs -> projectObject
```

`projectObject` is optional. When present it may declare:

- `footprintNodeId` — an existing feature node whose evaluated geometry is the footprint-role output;
- `clearanceEnvelopeNodeId` — an existing feature node whose evaluated geometry is the clearance-role output;
- `maintenanceEnvelopeNodeId` — an existing feature node whose evaluated geometry is the maintenance/access-role output;
- `points` — bounded stable semantic local points.

The geometry-role contract is semantic rather than kernel-topological. Phase 5A does not introduce curve/face-specific node types and does not claim that every current feature graph can produce an ideal planar footprint. Later node capabilities may improve the geometry that can be assigned to these roles without changing the role contract.

### Semantic points

Each project-object point has:

- stable `id`;
- `kind`: `connection`, `mounting`, or `cable`;
- local `position` as a three-scalar mm vector;
- optional unitless `direction` vector;
- optional human-readable `label`.

Point scalar values may use compatible published-parameter references under the same canonical unit rules as placement/features.

Points are local component data. Future Rhino/Grasshopper mapping applies the project's placement plane when composing them into a project model.

### Validation and normalization

5A provides:

- a maximum of 128 semantic points;
- duplicate/invalid point-ID rejection;
- unknown auxiliary-node-reference rejection;
- `mm` unit validation for point positions;
- `none` unit validation for point directions;
- deterministic point ordering by stable ID;
- omission of an empty `projectObject` block from canonical output;
- preservation of accepted Phase 1–4 validation behavior.

### AI compatibility

The provider-visible complete BRep project schema accepts the optional project-object definition. AI structural diffing includes project-object changes as project-level source changes. No separate AI patch format is introduced.

### Phase 4 authoring compatibility

Published-parameter usage detection includes project-object point position/direction references, preserving Phase 4D's rule that referenced parameters cannot be deleted or have their unit changed while still referenced.

Node deletion also respects semantic project-object geometry references. A node assigned as footprint/clearance/maintenance cannot be deleted until the role is changed or cleared; no hidden role rewrite is permitted.

### 5A non-goals

5A intentionally does not add:

- native evaluation of auxiliary outputs;
- 3DM export/import;
- rhino3dm dependency;
- new BRep geometry node types;
- new parameter value types;
- project-object UI authoring;
- Rhino.Compute;
- Grasshopper schema/component generation;
- placement transformation of local native preview geometry.

## 5B — Native project-object evaluation — next

Extend the existing isolated evaluator/result contract so one evaluation can provide:

- primary BRep result;
- declared auxiliary geometry-role results;
- resolved semantic points;
- resolved placement and metadata in a kernel-neutral project-object result.

Auxiliary node evaluation must reuse the same feature cache/DAG evaluation and remain bounded. Exact primary STEP behavior must remain unchanged unless an explicitly separate multi-output export is added.

## 5C — Project-object authoring and AI product integration

Add direct project-object output authoring over the same canonical source revision lifecycle:

- assign/clear footprint, clearance and maintenance role nodes;
- add/edit/remove stable semantic points;
- use existing source-write guards and immutable CAS persistence;
- expose the complete project-object definition to AI snapshot editing without a second history model.

Graph/navigation UX may identify nodes that carry semantic output roles, but graph layout remains presentation-only.

## 5D — Minimum Rhino/3DM interoperability and Phase 5 closeout

After the neutral contract and native outputs are accepted, add only the minimum 3DM/rhino3dm capability needed to prove the later Grasshopper path.

Before adding a dependency, verify and record:

- exact rhino3dm/openNURBS package/version;
- Linux/headless support in the selected implementation path;
- licensing/distribution terms;
- what exact BRep/geometry conversion is possible from the existing OCCT result without introducing Rhino as the authoritative kernel.

Target Phase 5 interoperability acceptance should prove that a representative BRep project object can produce a 3DM-compatible artifact carrying useful geometry plus placement/object metadata/semantic project outputs where the selected library supports them.

Do not broaden 5D into a Grasshopper component/runtime; that is Phase 6+ work.

## Phase 5A acceptance closeout

Phase 5A is accepted on the contract branch with the following evidence:

1. Existing schema-v1 BRep projects without `projectObject` normalize identically to their Phase 4 representation.
2. Existing nodes can be referenced as footprint, clearance and maintenance semantic outputs.
3. Unknown semantic-output node references fail canonical validation before persistence/native execution.
4. Semantic points have stable bounded IDs, supported kinds and deterministic ordering.
5. Point position scalars accept literals or `mm` published parameters and reject incompatible units/missing parameters.
6. Optional point direction accepts literals or unitless published parameters and rejects incompatible units/missing parameters.
7. Duplicate semantic point IDs and excessive point counts fail closed.
8. Phase 4D parameter usage protection includes semantic-point references.
9. Phase 4C safe node deletion blocks nodes assigned to semantic project-object geometry roles with actionable explanation and no implicit role rewrite.
10. Provider-visible AI BRep schemas accept the optional project-object definition and project diffs surface project-object changes.
11. Existing native evaluation, viewer, STEP export, immutable revisions, canonical packages and ordinary OpenSCAD paths are unchanged by the 5A implementation.
12. Quality Gate #367 passed tests, typecheck, lint, build and diff check on the accepted implementation head.

5A has no new browser or native-execution product surface, so its acceptance is intentionally contract/regression based rather than a manual browser checklist.
