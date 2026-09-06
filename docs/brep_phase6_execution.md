# BRep Phase 6 — Grasshopper export contract

## Status

Phase 6 is active on `feature/brep-grasshopper-export-contract` from the accepted Phase 5 merge checkpoint:

```text
fb7ba650710d4bf138ad747b8d4d8413731297a1
Merge pull request #33 — Phase 5D: minimum Rhino 3DM interoperability
```

Current implementation is authoritative. `docs/brep_kernel_plan.md` is roadmap context and `docs/brep_phase5_execution.md` is completed-phase evidence.

## Goal

Define a stable, versioned Grasshopper-facing contract for a canonical `BrepProject` without introducing a Grasshopper runtime yet.

Phase 6 establishes the interface that Phase 7's smart Brepia Grasshopper component must consume:

```text
canonical BrepProject snapshot
        |
        v
versioned Brepia Grasshopper contract
  inputs / outputs / placement / diagnostics
        |
        v
Phase 7 smart Grasshopper component/runtime
```

The exported contract is a generated interoperability artifact. `BrepProject` remains the only canonical editable source.

## Reconciled source capabilities

The current BRep source schema supports published **numeric** parameters only:

- `type: number`;
- units `mm | deg | none`;
- stable parameter ID separate from display label;
- default plus optional min/max/step/description.

Phase 6 therefore maps numeric parameters only. Roadmap references to string/boolean/enumeration inputs mean those types must be mapped when Brepia's canonical source schema supports them; Phase 6 must not add unsupported canonical parameter types merely to widen the Grasshopper contract.

## Contract v1

The v1 artifact kind is `brepia-grasshopper-contract` with `schemaVersion: 1`.

It carries:

- canonical normalized `BrepProject` snapshot;
- project/model identity and originating immutable Brepia revision identity;
- deterministic Grasshopper-facing input descriptors;
- deterministic standard output descriptors;
- explicit placement semantics;
- explicit diagnostics semantics.

Unknown/derived fields are not source authority. Normalization rebuilds the interface manifest from the canonical project snapshot so a stale or tampered manifest cannot redefine project semantics independently of the source.

## Input mapping

### Published numbers

Every canonical published number parameter maps to one Grasshopper item input with:

- `id` = stable Brepia parameter ID;
- `label` = display label only;
- `type = number`;
- `access = item`;
- unit `mm | deg | none`;
- default/min/max/step/description where present;
- fallback semantics `project-default` when unconnected.

Input ordering follows canonical parameter ordering, which is deterministic by stable parameter ID.

Phase 6 v1 does not expose list/tree parameter access because the canonical BRep evaluator currently accepts one scalar value per published parameter.

### Placement Plane

A standard input with stable ID `placement` is always appended after the published parameters:

- `type = plane`;
- `access = item`;
- when unconnected, use the canonical project placement resolved under the current published parameter values;
- when connected, the supplied Grasshopper Plane replaces the project placement as the target insertion plane;
- Brepia native geometry remains component-local and is not mutated in the canonical source;
- Phase 7 must transform primary geometry, auxiliary geometry and semantic point positions/directions consistently from component-local coordinates to the selected target Plane;
- placement axes are orientation semantics, not geometry scale.

This preserves the accepted Phase 5 rule that placement is an insertion/composition contract rather than a local native-preview transform.

## Output mapping

The component-facing port set is fixed in v1 so adding/removing an optional project-object role does not reorder downstream Grasshopper wires.

Ports, in order:

1. `result` — primary Rhino Brep item, required;
2. `footprint` — Rhino Brep item, optional value;
3. `clearanceEnvelope` — Rhino Brep item, optional value;
4. `maintenanceEnvelope` — Rhino Brep item, optional value;
5. `connectionPoints` — list of structured semantic points of kind `connection`;
6. `mountingPoints` — list of structured semantic points of kind `mounting`;
7. `cablePoints` — list of structured semantic points of kind `cable`;
8. `metadata` — project metadata item.

A structured semantic point preserves stable point ID, kind, transformed position, optional direction and optional label. Phase 7 may provide a custom Grasshopper data wrapper, but it must not discard these fields merely to expose naked XYZ coordinates.

`result`, `footprint`, `clearanceEnvelope` and `maintenanceEnvelope` are contractually **Brep** outputs. Phase 7 must not silently substitute tessellated mesh geometry when exact Rhino Brep conversion/solve fails; it must surface a diagnostic instead.

## Diagnostics

The v1 contract declares that evaluator/component warnings and errors are surfaced as Grasshopper runtime messages:

- warnings -> Grasshopper warning severity;
- errors -> Grasshopper error severity.

Diagnostics are not modeled as canonical project source and do not create Brepia revisions.

## Model/version identity

The contract records separately:

- stable Brepia project ID;
- canonical project source schema version;
- originating immutable Brepia revision/message ID;
- Grasshopper contract schema version.

Project identity remains stable across ordinary Brepia revisions while the source revision identity changes. This allows a project-level Grasshopper workflow to detect a revised component snapshot without treating it as an unrelated project.

## Phase 6 implementation slices

### 6A — Shared contract and deterministic mapping

- TypeScript contract types/constants;
- create/normalize/parse/serialize helpers;
- deterministic published-parameter mapping;
- fixed standard output manifest;
- explicit placement and diagnostics semantics;
- bounded artifact parsing;
- focused tests for identity, ordering, optional roles, semantic points and tamper/stale-manifest canonicalization.

### 6B — Product export surface

- expose the generated contract from the existing BRep download selector;
- use the saved canonical source snapshot, not unsaved preview parameter overrides;
- carry the active immutable revision ID as provenance/model-version identity;
- keep STEP/3DM/BRep JSON behavior unchanged;
- add focused browser/static regression coverage and documentation.

## Explicit non-goals

Phase 6 does not add:

- Rhino desktop/RhinoCommon runtime to Brepia;
- Rhino.Compute;
- a Grasshopper component implementation;
- `.gha`/`.ghpy` plugin packaging;
- `.gh` generation;
- Grasshopper execution/validation inside Brepia;
- new canonical BRep parameter types;
- editable/imported Grasshopper source;
- native translation of the Brepia feature DAG into visible Grasshopper nodes;
- changes to OpenSCAD workflows;
- mesh fallback advertised as Rhino Brep output.

Those belong to Phase 7+ unless a later accepted roadmap change explicitly moves a boundary.

## Acceptance

Phase 6 is complete when:

1. one representative BRep project deterministically maps to a versioned Grasshopper contract;
2. stable parameter IDs remain distinct from mutable display labels;
3. numeric unit/default/range metadata is preserved;
4. the standard placement Plane contract is always present with explicit unconnected/connected semantics;
5. standard output ordering remains fixed independent of optional role presence;
6. semantic point IDs/kinds/labels/directions are preserved by the contract;
7. project ID, source schema version and immutable source revision identity are explicit;
8. warnings/errors have an explicit future Grasshopper runtime-message mapping;
9. the product can download/inspect the contract without changing project source or revision history;
10. no Grasshopper/Rhino runtime becomes required for ordinary Brepia operation;
11. repository tests, typecheck, lint, build and diff checks are green;
12. focused browser acceptance confirms existing STEP/3DM/BRep JSON behavior remains unchanged.
