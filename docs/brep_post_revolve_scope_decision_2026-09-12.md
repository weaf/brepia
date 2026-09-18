# Post-revolve modeling scope decision — 2026-09-12

Status: **DECIDED — bounded full revolve is closed across Gate A/B/C; bounded multi-loop profile extrusion is the only newly active modeling slice**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Accepted baseline

Bounded full revolve is complete across the three separate evidence layers:

1. repository / CI;
2. pinned native build123d / OCCT runtime;
3. installed Rhino 8 / Grasshopper runtime including parameter perturbation, save -> close -> reopen and strict returned-GHX validation.

The accepted closeout checkpoint is:

```text
e231f4910db95ef70f2befe968d70e6bd7e04010
Close bounded revolve Gate C acceptance
```

Repository CI on that checkpoint:

```text
Quality Gate #1086       PASS
Grasshopper Build #658   PASS
```

No further revolve implementation scope is active.

## Reconciled product gap

The existing M4 surface models one inline closed profile and a centered extrusion. Holes can already be represented indirectly as separate solid cutters plus M2 subtract, with M3 patterns available for repeated cutter placement. That remains valid, but it is unnecessarily verbose for ordinary constant-section parts such as:

- flanges;
- gaskets;
- mounting plates;
- panels with through-openings;
- sheet-like constant-section parts.

The remaining representational gap is therefore **one bounded planar outer loop with bounded inner hole loops feeding one ordinary extrusion**.

This is graph compression plus clearer CAD intent. It is not a reason to introduce a reusable sketch graph, sketch constraints, topology identities or general collection algebra.

## Selected next slice

The only newly active modeling slice is:

**bounded multi-loop profile extrusion**

The slice extends existing M4 extrusion additively. It must preserve existing single-loop payloads and their semantics.

The compatibility-first canonical direction is:

```ts
type BrepProfileLoop =
  | BrepRectangleProfile
  | BrepCircleProfile
  | BrepClosedPolylineProfile;

type BrepProfileHole = {
  loop: BrepProfileLoop;
  offsetU: BrepScalar;
  offsetV: BrepScalar;
};

// Existing outer syntax remains unchanged; holes is additive/optional.
type BrepProfile = BrepProfileLoop & {
  holes?: BrepProfileHole[];
};
```

The implementation may spell the final TypeScript union more explicitly, but it must preserve these semantics:

- old rectangle/circle/closedPolyline profile payloads remain valid and normalize identically;
- holes are not recursive;
- a hole loop reuses the existing M4 loop families;
- hole placement is a translation in the existing local M4 U/V profile plane;
- hole placement uses the existing M1 millimetre scalar AST;
- `schemaVersion: 1` remains unchanged.

The offset wrapper is required because existing rectangle and circle profiles are centered on the profile-plane origin and otherwise cannot represent separated holes.

## Explicit first-slice limits

The first slice is limited to:

- exactly one existing outer loop;
- zero through 8 inner hole loops;
- rectangle, circle and closedPolyline loop families only;
- local `offsetU` / `offsetV` translation only for holes;
- extrusion only — non-empty holes on revolve fail closed;
- at most 32 points per closedPolyline, preserving M4;
- at most 128 explicit closedPolyline points across outer + holes;
- no open loops;
- no islands;
- no holes inside holes;
- no nested loop hierarchy;
- no intersecting or touching loops;
- every hole strictly inside the outer loop;
- no duplicate/coincident loops;
- no zero-area or self-intersecting loops;
- exactly one positive-volume solid/Brep after extrusion;
- result kind remains `single`.

Clockwise/counter-clockwise winding is not canonical semantics. The explicit role (`outer` versus `hole`) determines meaning; kernel adapters may orient temporary curves/wires as required without persisting kernel topology or orientation identity.

## Preserved architecture

This decision does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d / OCCT as geometry authority;
- Rhino/GHX as interoperability compiler;
- GHX parameter-only return/import;
- canonical `schemaVersion: 1`;
- M0 parameter effectiveness;
- M1 bounded scalar AST and unit algebra;
- M2 exact-one-body Boolean semantics;
- M3 `single | instanceSet` discipline and existing collection-consumer rules;
- M3A-M3D semantics;
- existing M4 single-loop extrusion semantics;
- accepted bounded revolve semantics;
- M6 Intrinsic XYZ rotation semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Acceptance model

Use the established three-gate evidence model and keep the evidence layers separate.

### Gate A — repository / CI

Require canonical normalization, fail-closed loop validation, M0/M1 coverage, provider/AI schema, structural editor, native translation tests, Rhino compiler tests, strict GHX validation, single-loop M4 regressions, full repository gates and Grasshopper Build.

### Gate B — pinned native build123d / OCCT

Require real runtime execution, parameter perturbation, valid multi-hole geometry, invalid-loop fail-closed cases, exactly one positive-volume solid, exact STEP and independent STEP re-import.

### Gate C — installed Rhino 8 / Grasshopper

Require fresh current-compiler GHX, visible hole geometry, parameter recomputation, save -> close -> reopen, persisted controls, strict returned-GHX validation and Result Item semantics.

## Deferred / out of scope

Do not pull in:

- M5 shell/thickness;
- M7 chamfer or richer topology selectors;
- raw face/edge IDs;
- reusable sketch/profile nodes;
- sketch constraints;
- arbitrary sketch planes;
- partial or arbitrary-axis revolve;
- general collection algebra;
- pattern nesting;
- spline/NURBS authoring;
- C4 image projection;
- new M1 functions.

## Decision

Bounded full revolve is closed. The next and only active modeling expansion is **bounded multi-loop profile extrusion** under the separate implementation boundary in:

```text
docs/brep_multiloop_profile_extrusion_implementation_boundary_2026-09-12.md
```

No code should broaden beyond that boundary without a separate explicit scope decision.
