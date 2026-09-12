# Bounded full revolve status

Status: **repository/CI implementation complete — real pinned native runtime and installed Rhino 8 / Grasshopper acceptance pending**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Scope

This status records only the bounded first full-revolve slice locked in:

```text
docs/brep_revolve_implementation_boundary_2026-09-12.md
```

The canonical node is:

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The slice remains deliberately bounded:

- full 360 degree revolve only;
- existing inline M4 `BrepProfile` grammar;
- canonical local X/Y/Z axis through the canonical local origin;
- `resultKind: single`;
- exactly one positive-volume solid/Brep;
- no partial/start angles;
- no arbitrary-vector or topology-attached axes;
- no open profiles;
- no reusable sketch/profile graph;
- no new M1 operators/functions;
- canonical `schemaVersion: 1` remains unchanged.

## Locked profile frame

Profile `u` is axial and `v` is radial.

| axis | axial U | radial V | mapping `(u,v)` |
| --- | --- | --- | --- |
| X | +X | +Y | `(u,v,0)` |
| Y | +Y | +Z | `(0,u,v)` |
| Z | +Z | +X | `(v,0,u)` |

The first slice requires resolved radial `v >= 0`. A profile crossing to negative radial values fails closed. Axis contact at `v = 0` is accepted only through a non-zero-length boundary segment; isolated point-only contact fails closed.

M4 rectangle/circle profiles remain centered and unchanged for extrusion. Because that centering crosses the revolve axis, the first revolve slice rejects rectangle/circle and uses `closedPolyline` for turned-part profiles rather than inventing an implicit radial offset.

## Repository implementation

The repository surface is implemented across:

- canonical node/normalization/value-kind semantics;
- shared profile validation;
- M0 reachability and parameter effectiveness;
- M1 scalar traversal with the existing depth 12 / node limit 64;
- effective runtime-override validation before kernel execution;
- provider-facing finite/reference-free schema with expression depth 2 unchanged;
- Native BRep AI authoring instructions;
- structural Add/Edit UI with expression-preserving profile fields;
- native build123d/OCCT translation;
- Rhino 8 Python 3 / GHX translation;
- Result Item semantics;
- strict generated-GHX validation;
- focused repository parity/regression tests.

Primary repository checkpoints:

```text
7f01c9feecdba991d85c648f6257391eb512f218
Lock bounded revolve implementation boundary
Quality Gate #1073       PASS
Grasshopper Build #645   PASS

8395bf6c7c97fba79b948b8316a16dee5e610359
Add bounded revolve canonical contract
Grasshopper Build #646   PASS
Quality Gate #1074       FAILED only on two expected UI exhaustiveness errors;
                         all 161 test files / 992 tests passed.

b59510fa0f874ede5e3bf724367761cc4eb21475
Add bounded revolve authoring surfaces
Quality Gate #1075       PASS
Grasshopper Build #647   PASS

ed4e0312254ef42e051fb8ce850c92c9f091d919
Add bounded revolve native translation and parity tests
Quality Gate #1077       PASS
Grasshopper Build #649   PASS
```

The intermediate `8395bf6c...` Quality Gate failure is not an accepted completion checkpoint; it is retained here only to record that the new discriminated-union member exposed exactly the expected structural-editor exhaustiveness gap and that the test suite itself stayed green. The gap was closed in `b59510fa...`.

## Canonical and runtime-request validation

Canonical/default validation now:

- accepts additive `revolve` under schema v1;
- treats revolve as a no-input `single` producer;
- reuses the bounded closed-polyline geometry checks;
- rejects negative radial `v`;
- rejects isolated point-only axis contact;
- rejects centered rectangle/circle under the bounded revolve surface.

Request normalization repeats the effective profile checks after published parameter overrides are resolved. A runtime override that turns a valid radial value negative therefore fails before a kernel result can be accepted.

## M0 / M1 preservation

Revolve profile `u`/`v` scalars participate in the same scalar traversal and M0 parameter-effectiveness analysis as existing authoritative geometry fields.

No M1 grammar or safety bound changed:

```text
canonical scalar depth       12
canonical scalar node limit  64
provider expression depth     2
```

The locked parameterized fixture uses both an axial relationship and a radial published parameter without introducing new scalar functions.

## Native build123d / OCCT translation — repository implementation only

`scripts/brep/brep_driver.py` now:

- maps the locked U/V frame explicitly rather than reusing M4 extrusion planes;
- constructs a full build123d `revolve(..., revolution_arc=360.0)` around the selected canonical axis through the local origin;
- mirrors the bounded radial fail-closed checks;
- requires exactly one resulting solid;
- requires positive finite solid volume;
- feeds the accepted authoritative shape through the existing exact STEP path.

This section is **repository implementation evidence only**. It does not claim that the real pinned runtime has been executed for revolve yet.

## Rhino 8 / GHX translation — repository implementation only

`shared/brepGrasshopperRhinoScript.ts` now mirrors the same explicit profile frame in RhinoCommon.

The generated Python 3 carrier:

- constructs the profile plane with U/V equal to the locked axial/radial frame;
- resolves and checks radial values;
- builds the closed polyline in that plane;
- constructs the selected canonical axis through the local origin;
- uses RhinoCommon full revolution semantics through `RevSurface.Create(curve, axis)`;
- converts with `Brep.CreateFromRevSurface(...)`;
- requires a solid Brep.

Revolve remains an ordinary `single` result, so Grasshopper `Result` persists as **Item Access**, not List Access. The generated-GHX strict validator remains unchanged in authority: generated script/graph/wiring/result-access state is Brepia-owned and returned GHX remains parameter-only at the supported boundary.

This section is **repository compiler evidence only**. It does not claim an installed Rhino solve, parameter perturbation, save/reopen, or returned-file acceptance yet.

## Locked repository fixtures

Repository tests cover the previously locked targets:

1. stepped bushing/turned part that is not cylinder-equivalent;
2. radial + axial published parameter effectiveness;
3. valid axis-adjacent profile;
4. explicit axis-crossing invalid profile;
5. M4 rectangle/circle extrusion regression while the same centered profile families remain rejected for revolve;
6. X/Y/Z frame parity in native and Rhino compiler source;
7. Result Item Access and strict generated-GHX validation.

## Prepared native runtime harness — not evidence yet

A dedicated `scripts/brep/revolve-smoke.sh` harness is prepared as the next gate. It is intentionally separate from repository CI assertions and is designed to run against the real rootless pinned CAD image.

The harness covers:

- R1 stepped bushing geometry/bounds;
- R2 radial + axial parameter perturbation (`outerRadius 18 -> 22`, `length 40 -> 52`);
- R3 axis-adjacent profile;
- R4 fail-closed axis crossing;
- exact STEP generation;
- independent STEP re-import in the pinned image;
- exact-one-solid, positive-volume and expected-bound checks;
- pinned versions `build123d 0.11.1` and `cadquery-ocp-novtk 7.9.3.1.1`;
- rootless isolation flags including no network, read-only filesystem and dropped capabilities.

The harness must be actually executed before a native-runtime evidence document is created or native acceptance is claimed.

## Remaining acceptance gates

### Gate B — real pinned native runtime

Pending.

Required before closeout:

- execute the dedicated revolve smoke against the pinned rootless build123d/OCCT image;
- verify product-like bounds/cardinality;
- verify both radial and axial parameter perturbations affect authoritative geometry;
- verify invalid axis crossing fails closed;
- export exact STEP;
- independently re-import exact STEP in the pinned CAD runtime;
- record results in a separate native-runtime evidence document.

### Gate C — installed Rhino 8 / Grasshopper

Pending after Gate B.

Required before closeout:

- generate fresh GHX from the accepted repository checkpoint;
- solve in installed Rhino 8 / Grasshopper;
- verify intended turned geometry;
- perturb the same radial and axial parameters;
- verify recomputation;
- save -> close -> reopen;
- verify persisted solve/value state;
- run strict returned-GHX validation and confirm only published parameter values changed;
- record results in a separate Rhino evidence document.

## Preserved architecture

This repository implementation does not change:

- M0 parameter effectiveness;
- M1 depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- `single | instanceSet`;
- only `subtract.tools[]` may consume `instanceSet`;
- M3A-M3D semantics;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ rotation semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Current decision

Bounded full revolve is **repository-complete and CI-accepted** at `ed4e0312254ef42e051fb8ce850c92c9f091d919` before the dedicated runtime-harness/status checkpoint.

It is **not yet fully accepted** across all three evidence layers. The next active work is Gate B: execute and record the real pinned native runtime acceptance. Installed Rhino 8 / Grasshopper remains Gate C after native acceptance.
