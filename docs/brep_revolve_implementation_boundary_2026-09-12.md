# Bounded full revolve implementation boundary

Status: **locked — implementation not started**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Reconciled parent checkpoint:

```text
496409e2388fff92ff5efa088b991764044c8f04
Add bounded revolve implementation plan
```

PR #36 must remain open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Purpose

This record locks the implementation boundary for the first Brepia revolve slice before any revolve code is added.

The selected scope is deliberately narrower than a general CAD revolve feature:

- full 360 degree revolve only;
- existing inline M4 `BrepProfile` grammar only;
- canonical local X/Y/Z rotation axes through the canonical local origin only;
- result kind `single` only;
- exactly one valid solid/Brep result;
- no partial/start angles;
- no arbitrary-vector axes;
- no topology-attached axes;
- no open profiles;
- no new M1 scalar functions;
- no reusable sketch/profile graph value;
- canonical `schemaVersion: 1` remains unchanged.

build123d/OCCT remains geometry authority. Rhino/GHX remains an interoperability compiler and installed-host evidence surface only.

## Reconciliation findings

The current implementation imposes several concrete constraints on revolve.

### Canonical profile grammar

`shared/brepProject.ts` already defines the inline M4 profile grammar:

```ts
type BrepRectangleProfile = {
  type: 'rectangle';
  width: BrepScalar;
  height: BrepScalar;
};

type BrepCircleProfile = {
  type: 'circle';
  radius: BrepScalar;
};

type BrepClosedPolylineProfilePoint = {
  u: BrepScalar;
  v: BrepScalar;
};

type BrepClosedPolylineProfile = {
  type: 'closedPolyline';
  points: BrepClosedPolylineProfilePoint[];
};
```

The `u` and `v` coordinates of `closedPolyline` are already full M1 scalars. Therefore radial and axial revolve dimensions can be parameterized without a new profile schema or new scalar functions.

### M4 extrusion frame must not be reused

The native M4 path currently places a profile in the plane normal to the extrusion axis. The Rhino compiler mirrors that extrusion-specific rule.

A revolve profile instead has to lie in a plane containing its rotation axis. Reusing M4's extrusion plane selection would therefore be semantically wrong even though it reuses the same profile grammar.

The shared closed-polyline validator is geometrically reusable, but its current error text is extrusion-specific (`BRep extrude ...`). Implementation should make that validation operation-neutral rather than route revolve through an extrusion helper.

### Result and collection algebra

The existing result lattice is only:

```text
single | instanceSet
```

Revolve introduces no new collection kind. A revolve node is intrinsically `single`.

Existing policy remains unchanged:

- M2 Booleans require exact-one-body semantics;
- only `subtract.tools[]` may consume an `instanceSet`;
- no new nested/general collection algebra is introduced.

### Editor and dependency model

A revolve node owns an inline profile and a canonical axis; it has no upstream geometry input. In `brepProjectEditing.ts` it therefore has the same dependency shape as `box`, `cylinder` and `extrude`: no node dependencies.

Its profile scalar references must still participate in parameter-usage/effectiveness tracking exactly as the same profile fields do for M4 extrusion.

### Native boundary

`scripts/brep/brep_driver.py` currently has an extrusion-specific `extrude_profile_shape()` and exact-one-solid helpers. Revolve must get a dedicated profile-to-revolve translation and must not be implemented as an extrusion-frame variation.

Native output remains subject to the server's existing `single` result contract and exact STEP path.

### Rhino/GHX boundary

`shared/brepGrasshopperRhinoScript.ts` compiles the canonical graph to a self-contained RhinoCommon Python component. It must mirror the same revolve frame and admissibility rules, but it does not become geometry authority.

The generated component source is Brepia-owned state. Host-saved GHX return/import remains parameter-only: parameter values may change; generated script/graph/wiring/result-access semantics may not.

## Locked canonical node contract

The first slice adds exactly this node shape:

```ts
export type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: BrepAxis;
};
```

No `angle`, `startAngle`, `origin`, axis vector, input body, face/edge reference or topology identity is added.

The rotation axis is the selected canonical local world axis through `(0, 0, 0)` before project placement. Downstream canonical transforms remain the mechanism for moving/rotating the resulting body.

`brepNodeValueKind(revolve)` is always `single`.

## Locked revolve profile-frame contract

### Invariant

For every axis:

- local profile `u` is the **axial** coordinate along the positive canonical rotation-axis direction;
- local profile `v` is the **radial** coordinate along one deterministic positive perpendicular direction;
- the profile-plane normal is `N = U x V`;
- `(U, V, N)` is right-handed;
- the rotation axis is the line `v = 0` in profile coordinates.

This gives one cyclic rule rather than three unrelated special cases.

### Exact mapping

| `axis` | axial `U` | radial `V` | `N = U x V` | profile plane | canonical mapping of `(u, v)` |
| --- | --- | --- | --- | --- | --- |
| `x` | `+X` | `+Y` | `+Z` | XY | `(u, v, 0)` |
| `y` | `+Y` | `+Z` | `+X` | YZ | `(0, u, v)` |
| `z` | `+Z` | `+X` | `+Y` | XZ | `(v, 0, u)` |

The conceptual sweep is +360 degrees around `+U`. For a full revolution the final set of points is direction-invariant, but the positive direction is still part of the contract so native and Rhino implementations cannot silently diverge and a future partial-revolve design cannot retroactively redefine this slice.

### Implementation rule

Native and Rhino translators must implement the mapping above explicitly. They must not infer semantics from a library's named `XY`, `YZ` or `XZ` plane if that named plane's internal X/Y basis would change the table above.

Canonical/default validation, native build123d/OCCT execution and Rhino/GHX execution must all use this same `(u, v) -> world` contract.

## Locked radial admissibility contract

The first slice supports only profiles lying on one side of the rotation axis.

After scalar resolution:

1. every resolved profile boundary point must satisfy `v >= 0`;
2. any resolved `v < 0` is an unsupported axis crossing and fails closed;
3. a profile wholly in `v > 0` is admissible and represents an annular/through-bore turned section;
4. a profile may touch `v = 0` only through at least one non-zero-length boundary segment that lies on `v = 0`;
5. isolated point-only contact with `v = 0` is outside this first slice and fails closed;
6. the existing non-zero-area, no-zero-length-edge and no-self-intersection profile rules still apply;
7. native geometry must still resolve to exactly one valid positive-volume solid.

The `v` comparisons above are exact canonical scalar comparisons. No new user-visible tolerance or M1 concept is introduced. Kernel-level near-degeneracy remains a native geometry concern and must fail closed if a valid single positive-volume solid cannot be produced.

### Consequence for existing profile families

M4 `rectangle` and `circle` profiles are centered at the profile origin. With `v = 0` defined as the rotation axis, their positive-size boundaries necessarily extend to both positive and negative `v`.

Therefore, in this first revolve slice:

- `rectangle` remains a valid M4 profile but is rejected when used by `revolve` as unsupported axis crossing;
- `circle` remains a valid M4 profile but is rejected when used by `revolve` as unsupported axis crossing;
- `closedPolyline` is the intended revolve profile family for turned parts.

This is preferable to silently inventing a radial profile offset or changing M4 profile centering semantics. A future profile-placement/sketch decision may broaden that surface explicitly.

## Validation layers

### Canonical normalization and default validation

Canonical normalization must:

- accept the additive `revolve` node while keeping `schemaVersion: 1`;
- normalize the existing inline profile grammar without changing M4 semantics;
- normalize only canonical `x | y | z` axis values;
- classify revolve as `single`;
- apply statically decidable profile geometry checks;
- resolve default parameter values and apply the radial admissibility rules;
- reject default configurations that cross the axis or otherwise violate the bounded contract before native execution.

### Runtime override validation

M0/M1 runtime overrides must be resolved before geometry execution. An override that changes a previously valid profile into an axis-crossing, degenerate, self-intersecting or otherwise unsupported revolve profile must fail closed before accepting a geometry result.

M1 remains unchanged:

- canonical expression depth: 12;
- canonical expression node limit: 64;
- no new functions/operators.

### Native geometry validation

The pinned build123d/OCCT evaluator remains geometry authority and must additionally require:

- one and only one resulting solid;
- valid non-null shape;
- positive volume;
- no unexpected compound/multi-solid result;
- exact STEP export from that authoritative shape.

A kernel result that cannot satisfy those conditions is an evaluation failure, not a reason to broaden canonical semantics.

### Rhino/GHX validation

The Rhino compiler must mirror canonical frame/admissibility semantics and produce exactly one closed solid Brep for a valid revolve node.

Installed Rhino acceptance remains interoperability evidence only. It cannot be used to relax a native failure or redefine canonical geometry semantics.

Returned host-saved GHX validation remains parameter-only and must continue rejecting generated-script, graph, wiring or Result Item/List access tampering.

## Provider and AI authoring boundary

Provider-facing authoring adds the bounded `revolve` variant only. It must preserve the existing finite/reference-free provider schema strategy and provider scalar-expression depth 2.

No new general sweep vocabulary should be introduced. The model-facing description should state:

- `u` is axial;
- `v` is non-negative radial distance;
- the profile must not cross the axis;
- use `closedPolyline` for first-slice revolved turned parts;
- full 360 degrees is implicit and not authorable as an angle field.

Provider acceptance must not expose partial angles, arbitrary axes, topology references or a generic sketch system.

## Structural-editor boundary

The structural editor may create/edit the same bounded revolve node but must not introduce free-form code or a second expression language.

Required behavior:

- node type is stable after creation, as for existing nodes;
- `axis` is an X/Y/Z selector only;
- profile editing reuses existing expression-preserving M4 profile fields;
- profile `u`/`v` scalar references remain visible to parameter usage/effectiveness checks;
- revolve has no node dependency/input selector;
- invalid axis-crossing/default geometry is surfaced through canonical validation rather than silently clamped or moved.

## Locked target fixtures

These fixtures are part of the implementation target and should be added before or with repository implementation. Coordinates below are profile `(u, v)` coordinates and closure is implicit.

### R1 — stepped bushing / non-cylinder turned part

Axis: `x` for the primary fixture.

```text
(-30,  8)
(-30, 16)
(-18, 16)
(-18, 13)
( 18, 13)
( 18, 16)
( 30, 16)
( 30,  8)
```

Expected semantics:

- inner radius 8 mm throughout;
- 16 mm outer-radius end lands;
- 13 mm outer-radius center section;
- exact one hollow stepped solid;
- cannot reduce to one cylinder primitive.

Equivalent X/Y/Z mapping tests must establish frame parity even if the product-like primary acceptance fixture uses one axis.

### R2 — radial + axial M0/M1 parameter effectiveness

Published parameters:

```text
outerRadius = 18 mm
length      = 40 mm
```

Use existing M1 expressions only:

```text
uMin = neg(mul(length, 0.5))
uMax = mul(length, 0.5)
```

Profile:

```text
(uMin, 8)
(uMin, outerRadius)
(uMax, outerRadius)
(uMax, 8)
```

Required perturbation target:

```text
outerRadius: 18 -> 22
length:      40 -> 52
```

Both changes must alter authoritative native geometry. The nested `neg(mul(...))` expression intentionally stays within the existing provider expression-depth-2 surface.

### R3 — valid axis-adjacent profile

```text
(-20,  0)
(-20, 12)
( -5, 12)
( -5,  9)
( 20,  9)
( 20,  0)
```

The implicit closing edge lies on `v = 0`, giving a non-zero-length axis boundary. Expected result: one valid stepped solid with no through bore.

### R4 — explicit unsupported axis crossing

```text
(-20, -2)
(-20, 12)
( 20, 12)
( 20, -2)
```

This is a simple non-zero-area closed polyline, so it isolates the revolve-specific rule. It must fail canonical/default validation as unsupported axis crossing before either geometry backend is treated as authority.

Also require a runtime-override variant in which a valid non-negative radial parameter resolves negative after an override; that must fail closed before accepting native geometry.

### R5 — centered M4-profile compatibility regression

A positive M4 `rectangle` and `circle` must continue to work for extrusion, while the same inline profile families under `revolve` are rejected by the first-slice radial admissibility rule. This prevents revolve work from changing M4 centering semantics.

### R6 — later external-runtime acceptance

After repository implementation is complete, use the product-like revolve fixture for:

- exact STEP export from the pinned native evaluator;
- independent STEP re-import in the pinned build123d/OCCT runtime;
- installed Rhino 8 / Grasshopper solve;
- radial and axial parameter perturbation;
- save -> close -> reopen;
- strict returned-GHX parameter-only validation.

R6 is not repository evidence and must be recorded in separate native and installed-Rhino evidence documents.

## Repository implementation surface after this boundary

Only after this document is committed may revolve code be added.

Expected implementation touch points are bounded to:

- `shared/brepProject.ts`
  - additive node type/union;
  - normalization/default validation;
  - value-kind semantics;
  - revolve-specific radial admissibility;
- `shared/brepProfileGeometry.ts`
  - make shared profile-geometry validation operation-neutral without changing M4 behavior;
- `shared/brepProjectIntegrity.ts`
  - preserve graph/cardinality rules with revolve as `single`;
- `shared/brepScalar.ts`
  - no grammar expansion; only existing traversal/effectiveness integration if required;
- `shared/brepProjectEditing.ts`
  - no dependencies for revolve;
  - profile parameter-usage tracking;
- provider/AI canonical schema and instructions
  - bounded revolve variant;
  - provider expression depth 2 unchanged;
- server evaluation/result validation
  - existing exact-one `single` output contract remains sufficient unless a concrete gap is found;
- `scripts/brep/brep_driver.py`
  - dedicated explicit revolve frame;
  - full revolve;
  - exact-one-valid-positive-volume solid;
- `shared/brepGrasshopperRhinoScript.ts`
  - same explicit frame/admissibility semantics in RhinoCommon;
  - Result remains Item for revolve;
- executable GHX / returned-GHX validation
  - no semantic broadening; parameter-only return remains invariant;
- tests and product-like fixtures.

If implementation discovers that any of these assumptions cannot be satisfied without a new canonical concept, stop and reconcile this boundary rather than broadening the feature implicitly.

## Evidence gates remain separate

### Gate A — repository / CI

Repository completion must establish focused revolve coverage plus all existing quality/build gates. This is repository evidence only.

### Gate B — real pinned native runtime

After Gate A, separately run the rootless pinned build123d/OCCT runtime, perturb parameters, verify cardinality/geometry, export exact STEP and independently re-import it. Record a dedicated native-runtime evidence document.

### Gate C — installed Rhino 8 / Grasshopper

After Gate B, separately generate fresh GHX, solve in installed Rhino 8 / Grasshopper, perturb parameters, save/close/reopen and validate the host-saved GHX through the strict returned-GHX validator. Record a dedicated Rhino evidence document.

No gate may be described as evidence for another gate.

## Preserved architecture and deferrals

This boundary does not change:

- M0 parameter effectiveness;
- M1 depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- `single | instanceSet`;
- only `subtract.tools[]` may consume `instanceSet`;
- M3A-M3D repetition/symmetry semantics;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ rotation semantics;
- Grasshopper Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Decision

The bounded full-revolve implementation boundary is locked as follows:

1. canonical node is `{ id, type: 'revolve', profile: BrepProfile, axis: BrepAxis }`;
2. profile `u` is axial and profile `v` is non-negative radial distance;
3. X/Y/Z use the single cyclic right-handed frame table in this document;
4. axis crossing is rejected rather than repaired or kernel-dependent;
5. first-slice axis contact is allowed only through a non-zero-length `v = 0` boundary segment;
6. `closedPolyline` is the practical first-slice turned-profile family; centered rectangle/circle remain unchanged for M4 and are rejected for revolve;
7. revolve is `single` and must produce exactly one valid positive-volume solid/Brep;
8. build123d/OCCT stays geometry authority; Rhino/GHX mirrors semantics for interoperability only;
9. GHX return stays parameter-only;
10. repository, native and installed-Rhino evidence remain strictly separate.

Revolve implementation may begin only from this locked contract.