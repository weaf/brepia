# Bounded full revolve implementation plan

Status: **planned — implementation not started**

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

The first slice must stay narrower than a general CAD revolve feature and must preserve the existing Brepia authority model.

## Phase 1 — implementation-boundary reconciliation

Do not write revolve implementation code before this phase is complete.

Create a dedicated implementation-boundary record that locks:

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

### Critical frame question

Do **not** reuse the M4 extrusion frame naively.

A useful revolve profile must lie in a plane that contains the rotation axis, whereas the existing M4 extrusion profile plane is normal to its extrusion axis. The implementation-boundary document must define a deterministic right-handed mapping from the inline profile's `(u, v)` coordinates to a plane containing the selected canonical X/Y/Z rotation axis.

The mapping must be identical in canonical validation, native execution and Rhino compilation.

## Proposed first-slice canonical shape

Subject to the implementation-boundary review:

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The first slice should reuse the existing M4 inline `BrepProfile` families rather than introducing reusable sketch/profile graph nodes.

## First-slice bounds

Lock these unless the implementation-boundary review finds a concrete incompatibility:

- full 360 degree revolve only;
- no partial angle;
- no start angle;
- no arbitrary vector axis;
- no topology-attached axis;
- no open profiles;
- no new trigonometric or arbitrary functions in M1;
- canonical `schemaVersion: 1` remains additive;
- result kind remains `single`;
- exactly one resulting solid/Brep is required;
- zero-volume, self-intersecting, multi-solid or otherwise ambiguous output fails closed;
- profile/axis arrangements that create unsupported axis crossing fail closed;
- GHX return remains parameter-only;
- build123d/OCCT remains geometry authority;
- Rhino/GHX remains interoperability-only authority.

## Phase 2 — lock target fixtures before implementation

Use product-like fixtures rather than a cylinder-equivalent smoke only.

At minimum lock:

1. **Stepped bushing / turned part**
   - asymmetric axial profile;
   - multiple radial/axial steps;
   - cannot collapse to one cylinder primitive.

2. **Parameterized turned part**
   - at least one published radial dimension;
   - at least one published axial dimension;
   - both must affect the authoritative result through M0/M1 semantics.

3. **Axis-adjacent valid profile**
   - exercises the boundary close to the rotation axis without producing an invalid solid.

4. **Explicit invalid profile/axis arrangement**
   - must fail closed deterministically in canonical/default and runtime/native/Rhino paths.

5. **External-runtime acceptance fixture**
   - exact native STEP;
   - installed Rhino 8 / Grasshopper solve;
   - parameter perturbation;
   - save -> close -> reopen;
   - strict returned-GHX validation.

## Phase 3 — repository implementation

After the boundary and fixtures are locked, implement the complete repository surface:

- `shared/brepProject.ts`
  - node type;
  - normalization;
  - validation;
  - dependency/value-kind semantics.

- M0/M1 integration
  - parameter reachability/effectiveness;
  - scalar traversal;
  - runtime-override validation.

- provider/AI
  - canonical authoring schema;
  - finite/reference-free provider schema;
  - bounded AI instructions;
  - preserve provider expression depth 2.

- structural editor
  - create/edit revolve;
  - expression-preserving profile fields;
  - no free-form code/expression authoring.

- server result boundary
  - exactly one final body for revolve;
  - no new collection semantics.

- native build123d/OCCT driver
  - exact full revolve;
  - identical profile-frame mapping;
  - fail closed on unsupported cardinality/geometry.

- Rhino/GHX compiler
  - equivalent full revolve semantics;
  - Result Item Access;
  - no compiler-specific geometry authority.

- returned-GHX validator
  - parameter-only mutation boundary preserved;
  - script/graph/wiring/result-access tampering remains rejected.

- regression coverage
  - preserve M0-M6 and M3D behavior;
  - preserve OpenSCAD regressions;
  - no broadening of `single | instanceSet` collection algebra.

## Phase 4 — repository acceptance

Require one exact repository checkpoint with:

- focused revolve tests PASS;
- complete existing test suite PASS;
- typecheck PASS;
- lint PASS;
- production build PASS;
- diff check PASS;
- dependency audit PASS;
- Grasshopper Build PASS including plugin and Ubuntu/Windows packaging.

Repository CI is repository evidence only and must not be described as native or Rhino runtime evidence.

## Phase 5 — real pinned native runtime acceptance

Only after repository completion:

- run a dedicated rootless/pinned build123d/OCCT revolve smoke;
- verify actual geometry/bounds/cardinality from the runtime;
- perturb radial and axial parameters;
- verify fail-closed invalid profile/axis cases;
- export exact STEP;
- independently import STEP in the pinned CAD runtime;
- verify expected solid/cardinality/topology characteristics where deterministic.

Record this in a separate native-runtime evidence document.

## Phase 6 — installed Rhino 8 / Grasshopper acceptance

Only after native acceptance:

- generate fresh GHX from the current compiler;
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

Those are separate product decisions, not incidental revolve implementation details.

## Immediate next action

Start the next work session by reconciling the current branch implementation against this plan and `docs/brep_post_m3d_scope_decision_2026-09-12.md`, then produce the dedicated bounded-revolve implementation-boundary document before modifying code.
