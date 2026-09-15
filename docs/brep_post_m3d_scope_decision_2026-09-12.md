# Post-M3D modeling scope decision — 2026-09-12

Status: **DECIDED — M3D bounded circular/polar pattern is complete across repository/CI, native build123d/OCCT and installed Rhino 8 / Grasshopper. The next modeling slice should be a bounded full-revolve capability, but implementation must not start until the M3D closeout checkpoint is repository-green. Multi-loop profiles remain the runner-up; M5 shell/thickness and M7 topology/finishing remain deferred.**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Reconciled accepted modeling surface

The accepted modeling vocabulary now includes:

- M0 parameter effectiveness / graph integrity;
- M1 bounded scalar-expression AST;
- M2 union/intersection with exact-one-body semantics;
- M3A mirror;
- M3B bounded linear pattern;
- M3C bounded rectangular pattern;
- M3D bounded circular/polar pattern;
- M4 inline rectangle/circle/closed-polyline profiles plus centered extrusion;
- M6 non-zero Intrinsic XYZ rotation parity.

M3D closes the previously identified radial-layout gap without broadening M1 with trigonometric functions or introducing general collection algebra. It reuses the existing `single | instanceSet` model, keeps pattern nesting forbidden and preserves the rule that only `subtract.tools[]` may consume an `instanceSet`.

Repository CI, native build123d/OCCT evidence and installed Rhino 8 / Grasshopper evidence remain deliberately separate acceptance layers.

## Product-gap reassessment after M3D

The post-M3C decision identified two strongest later candidates after circular pattern:

1. bounded revolve;
2. richer/multi-loop profile semantics.

With M3D now accepted, the comparison changes as follows.

### Bounded full revolve

**Representational value:** high.

A full revolve produces ordinary axisymmetric solids that are not naturally equivalent to the current constant-section extrusion vocabulary: tapered/turned bodies, bushings, collars, pulleys, knobs, rotational housings and similar parts.

**Why this is more than graph compression:** unlike holes-in-profile, many rotational forms cannot be represented faithfully by a small existing graph without approximating the shape through unrelated primitives or many Boolean operations.

**Canonical impact:** medium and bounded if the first slice reuses the existing inline M4 profile model rather than creating a reusable sketch graph.

**Kernel risk:** medium. The implementation must fail closed for profile/axis crossings, self-intersection and non-single-solid outcomes.

**Rhino parity risk:** medium. Both native and Rhino translations have direct revolve primitives, but their exact failure/cardinality semantics must be aligned.

**Topology stability:** low. No persisted face/edge indices are required.

**AI/context impact:** medium and substantially smaller than introducing reusable sketch entities or topology references.

**Decision:** selected as the next modeling slice after M3D closeout CI is green.

### Multi-loop profiles / holes

**Representational value:** medium to high.

A single profile with one outer loop plus inner loops is compact and useful for plates, gaskets and panels. However, much of that geometry is already representable through M4 outer extrusion plus cylindrical/profile extrude cutters and M2/M3 subtract composition. M3D further reduces verbosity for radial holes.

**Canonical impact:** medium. Deterministic containment, winding/orientation, inter-loop intersection and nested-loop rejection must be specified across both kernels.

**Decision:** keep as runner-up after bounded revolve.

### M5 shell/thickness

Still deferred. Current enclosure/wall/hollow-box targets can be modeled through derived dimensions and subtract. Shelling introduces substantially higher kernel sensitivity and quickly becomes entangled with face-selection semantics.

### M7 chamfer / richer finishing selectors

Still deferred. The durable problem is semantic topology selection rather than merely adding another opcode. Raw edge/face indices remain unacceptable persisted authority.

### Reusable profile/sketch graph

Still deferred. It would introduce a new non-solid graph value and materially broaden dependency/type semantics beyond the current bounded solid graph.

## Selected next slice — bounded full revolve

The intended first slice should remain narrower than a general CAD revolve feature.

Proposed shape, subject to a dedicated implementation-boundary review before code changes:

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The first implementation should investigate and lock the following constraints before coding:

- reuse the existing M4 inline `BrepProfile` families rather than introducing reusable profile nodes;
- full `360 deg` revolve only;
- no partial/swept angle parameter in the first slice;
- no arbitrary vector or topology-attached axis;
- no open profiles;
- exactly one resulting solid/Brep required;
- profile/axis configurations that create zero-volume, self-intersecting or multi-solid output fail closed;
- M1 scalar semantics remain unchanged;
- canonical `schemaVersion: 1` remains additive if the contract can be expressed safely;
- result kind remains `single`;
- GHX remains parameter-only on return;
- native build123d/OCCT remains geometry authority;
- Rhino/GHX remains an interoperability compiler only.

A dedicated implementation-boundary document must reconcile the exact M4 profile frame against the selected revolve axis. In particular, the profile cannot be naively placed in a plane normal to the revolve axis, because a useful revolve profile must lie in a plane containing that axis. The frame/axis contract therefore needs an explicit deterministic mapping before implementation.

## Required target fixtures for the next slice

Do not validate revolve with a synthetic primitive equivalent only. At minimum, use:

1. an asymmetric stepped/bushed rotational profile that cannot be reduced to one cylinder;
2. a parameterized turned part where a published radial/axial dimension changes the authoritative result;
3. a fixture that exercises the axis-adjacent boundary without crossing into an invalid self-intersecting result;
4. one explicit fail-closed invalid profile/axis arrangement;
5. exact native STEP plus installed Rhino 8 / Grasshopper acceptance after repository completion.

The first slice does not need partial revolve, arbitrary axes, spline profiles, reusable sketches, shelling, topology selection or general profile holes.

## Acceptance sequence

Before revolve implementation begins:

1. M3D status/evidence/decision docs must have exact repository CI green;
2. create a bounded revolve implementation-boundary document;
3. reconcile M4 profile-frame semantics against a revolve-compatible frame;
4. lock canonical/provider/editor/server/native/Rhino contracts and fail-closed cases;
5. only then implement repository code and tests;
6. repository CI remains separate from real pinned native runtime evidence;
7. installed Rhino 8 / Grasshopper acceptance remains a third separate evidence layer.

## Preserved architecture

This decision does not change:

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
- M3 `single | instanceSet` discipline and narrow subtract-tool collection consumption;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 finishing/topology deferral.

## Decision

M3D is closed. No additional M3 pattern work is active.

The next modeling slice is **bounded full revolve**, but only after this closeout checkpoint is green and after a dedicated implementation-boundary reconciliation. Multi-loop profiles remain the next candidate after revolve. Shell/thickness and topology-sensitive finishing remain deferred.
