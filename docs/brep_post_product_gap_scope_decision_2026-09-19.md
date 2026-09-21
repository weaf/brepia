# Post-product-gap modeling scope decision — 2026-09-19

Status: **HISTORICAL SCOPE DECISION — the selected bounded planar 90-degree circular sweep was subsequently implemented and accepted; no further slice is selected.**

Repository: `weaf/brepia`

Planning branch: `plan/brep-sweep-boundary`

Reconciled parent checkpoint:

```text
6d15a723a270022ada536219ec65f7fa0f7af0cf
Merge pull request #48 from weaf/fix/product-gap-login-readiness
```

Decision evidence:

```text
docs/brep_product_gap_audit_status_2026-09-19.md
```

## Purpose

The post-Phase-9 decision required a real product-gap audit before any new canonical geometry operation could be selected. That audit is now complete for targets A–E.

This decision converts the audit evidence into one bounded next-slice candidate. It does not authorize general sweep/path modeling and does not add production code.

The burden of proof remains capability-driven: only the minimum geometry needed to close the demonstrated target-E failure is selected.

## Reconciled audit findings

The five product targets separate representation gaps from authoring failures:

- A — enclosure: the generated graph fails exact-one-body union semantics, but the evidence does not prove shell/thickness is required.
- B — turned part: the generated revolve profile violates the already accepted axial/radial frame; this is AI authoring correctness, not a missing revolve capability.
- C — flange: the accepted multi-loop extrusion + circular-pattern + Boolean surface represents the target reasonably.
- D — cabinet: the generated graph misplaces/disconnects parts and ignores the existing pattern operation; this is authoring correctness, not a new geometry requirement.
- E — bent handrail: the accepted graph substitutes two boxes and one straight cylinder for a constant circular section following a true tangent 90-degree bend. The current canonical language has no faithful path/sweep representation for that requirement.

Only target E establishes a concrete missing representation.

## Selected next slice

The next candidate slice is:

**bounded planar 90-degree circular sweep**

The slice exists specifically to represent one constant circular section following:

1. one straight first leg;
2. one tangent 90-degree circular bend;
3. one straight second leg.

The path is planar and canonical. Arbitrary orientation remains available through the existing transform/project-placement layers.

The detailed locked contract is defined separately in:

```text
docs/brep_sweep_implementation_boundary_2026-09-19.md
```

## Why the first slice is deliberately narrow

The audit does not demonstrate a need for a general 3D path language, arbitrary-angle elbows, multiple bends, variable sections or non-circular profiles.

A circular section also removes one major ambiguity from the first slice: rotation of the profile around the path tangent is not observable geometry. Therefore no canonical twist, rail-frame or guide-rail setting is needed yet.

The first slice may reuse the existing bounded scalar AST for:

- first straight-leg length;
- second straight-leg length;
- bend centerline radius;
- circular profile radius.

No new scalar functions or unit rules are selected.

## Explicit deferrals

This decision does **not** select:

- general open polyline or spline paths;
- multiple path bends;
- arbitrary bend angles;
- non-planar paths;
- closed paths;
- rectangle/closedPolyline sweep profiles;
- profile holes during sweep;
- variable or multi-section sweep;
- twist, Frenet, roadlike or guide-rail authoring;
- arbitrary/reference planes;
- reusable path/sketch graph values;
- shell/thickness;
- partial/arbitrary-axis revolve;
- chamfer or broader topology selectors;
- raw topology identities;
- general collection algebra.

Those require separate product evidence and a separate decision.

## Preserved architecture

The selected candidate must preserve:

- canonical `schemaVersion: 1`;
- immutable BRep project revisions;
- M0 parameter effectiveness and graph-integrity rules;
- M1 scalar depth/node limits and unit algebra;
- M2 exact-one-body Boolean semantics;
- `single | instanceSet` value-kind discipline;
- accepted M3 pattern/mirror behavior;
- accepted M4 extrusion/multi-loop behavior;
- accepted full-revolve behavior;
- accepted M6 Intrinsic XYZ rotation behavior;
- build123d/OCCT as authoritative geometry runtime;
- Rhino/GHX as interoperability compiler and installed-host evidence surface;
- strict parameter-only returned-GHX acceptance;
- exact STEP as native CAD export authority.

## Evidence model

Implementation, when authorized, must close four separate evidence layers:

1. **Gate A — repository / CI:** canonical contract, provider/editor integration, native/Rhino translation tests and full quality gates.
2. **Gate B — pinned native build123d / OCCT:** real sweep execution, parameter perturbation, invalid-boundary failures, exact STEP and independent re-import.
3. **Gate C — installed Rhino 8 / Grasshopper:** fresh GHX open/solve, perturbation, save/close/reopen and strict returned-GHX validation.
4. **Gate D — authenticated product path:** rerun the target-E product request through the normal Native BRep AI flow and prove that the canonical result uses the new sweep representation rather than primitive approximation.

Gate D is required because the selected capability came from a product-path failure. Geometry backend parity alone does not prove that the user-facing authoring path closes that gap.

## Decision

The A–E audit is closed. The only selected next candidate is the bounded planar 90-degree circular sweep defined by the separate implementation boundary.

No production implementation should begin until the boundary and plan are reviewed and committed. Any discovery requiring a broader path grammar must return to scope decision rather than broadening the slice implicitly.


## Post-implementation closeout

The bounded sweep selected by this decision was later implemented and accepted across repository/CI, pinned native runtime, installed Rhino 8 / Grasshopper and authenticated product-path gates.

Current closeout authority:

```text
docs/brep_sweep_status_2026-09-21.md
docs/brep_post_sweep_pause_decision_2026-09-21.md
```

The project is intentionally paused after sweep closeout. This historical scope decision must not be read as authorization to select another modeling slice automatically.
