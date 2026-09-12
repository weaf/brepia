# Bounded full revolve implementation plan

Status: **repository implementation complete and CI-accepted; pinned native runtime and installed Rhino 8 / Grasshopper acceptance remain pending**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 must remain open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Context

M3D bounded circular/polar pattern is complete across all three deliberately separate evidence layers:

1. repository implementation / CI;
2. real pinned build123d / OCCT runtime;
3. installed Rhino 8 / Grasshopper runtime.

The post-M3D scope decision selected **bounded full revolve** as the next modeling slice. Multi-loop profiles remain the runner-up. M5 shell/thickness and M7 topology-sensitive finishing remain deferred.

The revolve boundary is locked in:

```text
docs/brep_revolve_implementation_boundary_2026-09-12.md
```

Current implementation status is recorded in:

```text
docs/brep_revolve_status.md
```

Relevant prior records:

```text
docs/brep_m3d_circular_pattern_status.md
docs/brep_m3d_native_runtime_evidence_2026-09-12.md
docs/brep_m3d_rhino8_runtime_evidence_2026-09-12.md
docs/brep_post_m3d_scope_decision_2026-09-12.md
docs/brep_m4_profile_extrusion_status.md
docs/brep_m6_rotation_parity_status.md
```

## Objective

Add a bounded, deterministic, kernel-neutral full-revolve operation for ordinary axisymmetric solids such as stepped bushings, collars, pulleys, knobs and rotational housings.

The first slice stays narrower than a general CAD revolve feature and preserves the existing Brepia authority model.

## Phase 1 — implementation-boundary reconciliation — complete

The dedicated boundary record locks:

- the canonical `revolve` node shape;
- exact profile-frame semantics;
- exact X/Y/Z axis semantics;
- the relationship between the existing M4 inline profile coordinates and a revolve-compatible plane;
- exact single-solid cardinality rules;
- fail-closed cases;
- provider/AI authoring limits;
- structural-editor behavior;
- native build123d/OCCT translation;
- Rhino/GHX translation;
- server result-boundary expectations;
- returned-GHX invariants.

### Locked frame contract

M4 extrusion planes are **not** reused naively.

For revolve:

- profile `u` is axial;
- profile `v` is radial;
- X: U=+X, V=+Y, `(u,v) -> (u,v,0)`;
- Y: U=+Y, V=+Z, `(u,v) -> (0,u,v)`;
- Z: U=+Z, V=+X, `(u,v) -> (v,0,u)`.

Every frame is right-handed and the selected canonical axis passes through the local origin.

Resolved radial `v` must remain non-negative. Axis contact is accepted only through a non-zero-length profile boundary segment on `v=0`; isolated point contact and negative-radial axis crossing fail closed.

## Locked first-slice canonical shape

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The first slice reuses the existing M4 inline `BrepProfile` grammar rather than introducing reusable sketch/profile graph nodes.

Centered M4 rectangle/circle profiles are unchanged for extrusion but are rejected for the bounded first revolve slice because they cross `v=0`. `closedPolyline` is therefore the intended turned-part profile family until a separate future profile-placement/sketch decision is made.

## First-slice bounds — locked

- full 360 degree revolve only;
- no partial angle;
- no start angle;
- no arbitrary vector axis;
- no topology-attached axis;
- no open profiles;
- no new trigonometric or arbitrary functions in M1;
- canonical `schemaVersion: 1` remains additive;
- result kind remains `single`;
- exactly one positive-volume solid/Brep is required;
- zero-volume, self-intersecting, multi-solid or otherwise ambiguous output fails closed;
- unsupported profile/axis crossing fails closed;
- GHX return remains parameter-only;
- build123d/OCCT remains geometry authority;
- Rhino/GHX remains interoperability-only authority.

## Phase 2 — target fixtures — complete for repository design

The repository fixtures are locked before external-runtime acceptance:

1. **Stepped bushing / turned part**
   - asymmetric axial profile;
   - multiple radial/axial steps;
   - cannot collapse to one cylinder primitive.

2. **Parameterized turned part**
   - published radial `outerRadius`;
   - published axial `length`;
   - existing M1 arithmetic derives `-length/2` and `+length/2`;
   - both must affect authoritative geometry.

3. **Axis-adjacent valid profile**
   - exercises a real boundary segment on the rotation axis.

4. **Explicit invalid profile/axis arrangement**
   - simple closed profile crossing into negative radial `v`;
   - fails closed independently of generic closed-polyline validity.

5. **External-runtime acceptance fixture**
   - exact native STEP;
   - installed Rhino 8 / Grasshopper solve;
   - parameter perturbation;
   - save -> close -> reopen;
   - strict returned-GHX validation.

The dedicated native smoke harness is prepared at:

```text
scripts/brep/revolve-smoke.sh
```

Preparing that harness is repository work only and is not native runtime evidence until it is actually executed against the pinned environment.

## Phase 3 — repository implementation — complete

The repository surface is implemented across:

- `shared/brepProject.ts`
  - node type;
  - normalization;
  - default validation;
  - dependency/value-kind semantics;
  - bounded radial admissibility.

- M0/M1 integration
  - parameter reachability/effectiveness;
  - profile scalar traversal;
  - runtime-override validation;
  - no M1 grammar expansion.

- provider/AI
  - canonical and finite/reference-free authoring schemas;
  - bounded Native BRep instructions;
  - provider expression depth remains 2.

- structural editor
  - create/edit revolve;
  - expression-preserving profile fields;
  - explicit X/Y/Z axial/radial frame labels;
  - no free-form code/expression authoring.

- server result boundary
  - existing `single` exact-one-body contract is preserved;
  - no new collection semantics.

- native build123d/OCCT driver
  - explicit full revolve;
  - identical locked profile-frame mapping;
  - exact-one-positive-volume solid guard;
  - exact STEP path preserved.

- Rhino/GHX compiler
  - equivalent full-revolve semantics;
  - explicit locked profile frame;
  - Result Item Access;
  - generated source remains Brepia-owned interoperability state.

- returned-GHX validator
  - parameter-only mutation boundary remains unchanged;
  - generated script/graph/wiring/result-access semantics remain strict.

- regression coverage
  - M0-M6 and M3A-M3D semantics retained;
  - M4 centered rectangle/circle extrusion retained;
  - OpenSCAD regressions retained through the ordinary Quality Gate;
  - no broadening of `single | instanceSet` collection algebra.

## Phase 4 — repository acceptance — complete before runtime-harness checkpoint

Repository implementation checkpoint:

```text
ed4e0312254ef42e051fb8ce850c92c9f091d919
Add bounded revolve native translation and parity tests
Quality Gate #1077       PASS
Grasshopper Build #649   PASS
```

Earlier accepted authoring checkpoint:

```text
b59510fa0f874ede5e3bf724367761cc4eb21475
Add bounded revolve authoring surfaces
Quality Gate #1075       PASS
Grasshopper Build #647   PASS
```

The repository acceptance covers focused revolve tests plus the complete existing quality/build gates. It is repository evidence only and is not described as native or Rhino runtime evidence.

A later runtime-harness/status checkpoint may supersede the repository checkpoint once its own CI is green; that still remains repository evidence only.

## Phase 5 — real pinned native runtime acceptance — next active gate

Only after repository completion:

- run the dedicated rootless/pinned build123d/OCCT revolve smoke;
- verify actual geometry/bounds/cardinality from the runtime;
- perturb radial and axial parameters;
- verify fail-closed invalid profile/axis cases;
- export exact STEP;
- independently import STEP in the pinned CAD runtime;
- verify exactly one positive-volume solid and expected deterministic bounds.

Record this in a separate native-runtime evidence document. Repository tests or CI must not be substituted for this gate.

## Phase 6 — installed Rhino 8 / Grasshopper acceptance — pending after native gate

Only after native acceptance:

- generate fresh GHX from the accepted compiler;
- open and solve in installed Rhino 8 / Grasshopper;
- visually verify the intended turned geometry;
- perturb the same bounded radial/axial parameters;
- verify recomputation;
- save -> close -> reopen;
- verify persisted values and solve state;
- validate the host-saved returned GHX through the strict parameter-only validator.

Record this separately from repository and native evidence.

## Preserved architecture

Throughout revolve work preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project plus immutable revision authority;
- build123d / OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter effectiveness;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 and finite/reference-free provider schema;
- M2 exact-one-body Boolean semantics;
- M3 `single | instanceSet` discipline;
- only `subtract.tools[]` may consume an `instanceSet`;
- no nested/general pattern collection algebra;
- M3A-M3D semantics;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 finishing/topology deferral.

## Stop conditions

Stop and reconcile before broadening scope if the first slice would require any of:

- reusable sketch/profile graph values;
- topology-attached axes;
- raw face/edge identities;
- partial/angular sweep semantics;
- arbitrary vector axes;
- spline/NURBS profile authoring;
- general collection algebra;
- new M1 functions.

Those remain separate product decisions, not incidental revolve implementation details.

## Immediate next action

Complete CI for the prepared runtime-harness/status checkpoint, then execute `scripts/brep/revolve-smoke.sh` against the real pinned rootless build123d/OCCT environment. If and only if that succeeds, create the separate native-runtime evidence document and proceed to installed Rhino 8 / Grasshopper acceptance.