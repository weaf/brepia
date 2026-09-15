# Post-M3C modeling scope decision — 2026-09-11

Status: **DECIDED — first close the M3C server-result reconciliation defect, then select a bounded circular/polar pattern as the next modeling slice. M5 shell/thickness and M7 finishing/topology remain deferred. Circular-pattern implementation has not started in this decision.**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Reconciled basis

The accepted modeling vocabulary is M0, M1, M2, M3A, M3B, M3C, M4 and M6:

- primitives: `box`, `cylinder`;
- bounded inline profiles: rectangle, circle and closed polyline;
- centered profile extrusion on canonical X/Y/Z frames;
- transforms with M6 Intrinsic XYZ rotation;
- subtract, union and intersection with exact-one-body Boolean semantics;
- mirror;
- bounded linear and rectangular `instanceSet` patterns;
- bounded semantic fillet selection through `parallelToAxis`;
- M1 scalar expressions and M0 parameter-effectiveness/integrity analysis.

The existing fixture corpus covers centered derived solids, a mounting plate with holes/fillet, Boolean composition, patterned holes, a cabinet row, a non-square rectangular grid, a room/door construction, expression-heavy graphs and asymmetric rotation. Those fixtures demonstrate that ordinary orthogonal mechanical/architectural construction is no longer blocked by the original box/transform/subtract-only limitations.

Repository CI remains distinct from native build123d/OCCT and installed Rhino 8 / Grasshopper runtime evidence.

## M3C reconciliation defect found by this review

The post-M3C review found one repository integration mismatch that was not exercised by the M3C driver-level tests:

- canonical `brepNodeValueKind()` correctly classifies both `linearPattern` and `rectangularPattern` as `instanceSet`;
- the native driver correctly emits a final rectangular pattern as `countA * countB` ordered bodies;
- the Rhino/GHX compiler correctly handles a rectangular final Result as List Access;
- but `src/server/brepEvaluation.ts` accepted only `linearPattern` when validating a returned top-level `instanceSet`.

Therefore a valid final rectangular-pattern result could be produced by the native sandbox and then rejected by the server result boundary as `output_invalid`.

This is a repository boundary defect, not new canonical geometry semantics. The repair is intentionally narrow:

```text
linearPattern      -> expected body count = count
rectangularPattern -> expected body count = countA * countB
```

Stable `<patternId>::<index>` identity and source-node checks remain unchanged. A dedicated server-boundary regression test now exercises a 2 x 3 rectangular result through `evaluateBrepProject()`.

This repair does not invalidate the separately recorded native or Rhino host evidence because it does not change the native driver, canonical M3C semantics or the GHX compiler. The repaired repository checkpoint still requires its own repository CI before the reconciliation is closed.

## Product-gap method

The next slice was selected from concrete model families rather than roadmap numbering. A candidate had to provide material capability beyond M1–M4 + M6 + M3C without requiring raw kernel topology identity, general collection algebra or an open-ended CAD language.

The comparison focuses on fixtures that matter for Brepia's current mechanical/architectural direction: mounting plates, enclosures/cabinets, repeated openings, equipment layouts and ordinary fabricated/turned parts.

## Candidate comparison

### 1. M5 shell/thickness

**Product benefit:** medium to high for enclosures, hollow housings and thin-wall parts.

**Is it a real current representational gap?** Not yet for the accepted target corpus. Plates, walls, hollow boxes and openings can already be expressed using M1-derived dimensions, profile/extrusion and subtract. For current fixtures shell would mostly reduce graph verbosity.

**Canonical impact:** medium. A useful shell primitive needs a precise offset direction, thickness convention and usually some notion of retained/removed faces.

**Native risk:** high relative to the benefit. OCCT offset/shell behavior is geometry-sensitive.

**Rhino parity risk:** high. The exact failure/cardinality semantics need explicit parity work.

**Topology stability:** high risk if opening/removal faces are selectable. Raw face indices remain forbidden.

**AI/context complexity:** medium; compact when it works, but difficult to author safely without a semantic face-selection vocabulary.

**Smallest bounded slice:** a topology-free closed offset shell could be investigated later, but it still needs deterministic offset semantics and does not close a demonstrated current fixture gap.

**Decision:** defer.

### 2. M7 chamfer / richer semantic edge selection

**Product benefit:** medium. Chamfers and selective finishing are valuable for manufacturing-quality models.

**Is it a real current representational gap?** Chamfer itself is missing, but the current corpus is not blocked by it. Fillet already exists with `parallelToAxis` selection.

**Canonical impact:** medium to high because the durable problem is selector semantics, not merely a `chamfer` opcode.

**Native risk:** medium to high.

**Rhino parity risk:** medium to high.

**Topology stability:** highest risk among the near-term candidates. Persisted raw edge/face indices are explicitly unacceptable.

**AI/context complexity:** medium to high once selectors become combinatorial.

**Smallest bounded slice:** one new topology-neutral selector plus chamfer only after a fixture proves the selector is stable on both kernels.

**Decision:** defer.

### 3. Bounded circular/polar pattern

**Product benefit:** high for bolt circles, flange/mounting holes, circular vents/fan openings, repeated radial fasteners and other common mechanical layouts.

**Is it a real current representational gap?** Yes. M3B/M3C repeat only by translation. M6 can rotate individual solids, but a radial array currently requires manually expanding one transform per instance and baking angular/positional relationships. M1 deliberately has no trigonometric functions, so a parameterized radial layout cannot be represented compactly through derived X/Y translations either.

**Canonical impact:** low to medium. It can reuse the existing `instanceSet` discipline rather than introduce a new value kind.

**Native risk:** low to medium. The operation is rigid-copy placement; it does not require topology selection or offsetting.

**Rhino parity risk:** low to medium. Rhino already has deterministic rigid rotation transforms around an axis through a point.

**Topology stability:** low. No edge/face identity is needed.

**AI/context complexity:** low. One bounded node replaces many transforms and duplicated literals.

**Smallest bounded slice:** a principal-axis circular pattern around an explicit center, single-shape input, literal bounded count and M1 degree step:

```ts
type BrepCircularPatternNode = {
  id: string;
  type: 'circularPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  center: BrepVector3;
  count: number;
  angleStepDeg: BrepScalar;
};
```

Proposed first-slice semantics:

- input must be `single`;
- count remains literal and bounded consistently with the existing pattern limits;
- `center` uses bounded M1 millimetre scalars;
- `angleStepDeg` uses bounded M1 degree semantics and must resolve non-zero;
- instance 0 is the unchanged source;
- instance `i` is the source rotated by `i * angleStepDeg` around the selected principal axis through `center`;
- stable body IDs remain `<patternId>::<index>`;
- result kind remains `instanceSet`;
- only `subtract.tools[]` may consume the set;
- final pattern remains Result List Access;
- no nested patterns, implicit union or general collection algebra.

Before implementation, the exact anti-duplicate/full-circle bound should be specified so one slice cannot silently place coincident instances.

**Decision:** selected as the next modeling slice after the M3C server-boundary repair is repository-green.

### 4. Richer profile semantics: holes / multiple loops

**Product benefit:** high for plates, panels, gaskets and arbitrary cutout profiles.

**Is it a real current representational gap?** Partly. A profile with holes is not first-class, but the resulting solids are already representable using an outer extrusion plus one or more extruded/cylindrical subtract tools. Repeated ordinary holes are better compressed by the selected pattern work.

**Canonical impact:** medium. Multiple loops require deterministic containment, orientation/normalization and self/inter-loop intersection rules.

**Native risk:** medium.

**Rhino parity risk:** medium.

**Topology stability:** low to medium; no persisted BRep topology is required, but planar-loop classification must match.

**AI/context complexity:** medium; one node can be compact, but authoring nested loop coordinates is expensive and error-prone.

**Smallest bounded slice:** one outer closed loop plus a bounded list of non-intersecting inner closed loops, all in the same existing canonical profile frame.

**Decision:** strong later candidate, but behind circular pattern because current Boolean/profile composition already covers its geometry and because radial repetition is not equivalently derivable with M1.

### 5. Reusable profile / sketch-like representation

**Product benefit:** potentially high for repeated sections and future sketch workflows.

**Is it a real current representational gap?** Mostly an authoring/reuse gap. Inline profiles can be duplicated today.

**Canonical impact:** high. It introduces a non-solid graph value and therefore broadens the type/value system beyond the current `single | instanceSet` solid discipline.

**Native risk:** medium.

**Rhino parity risk:** medium.

**Topology stability:** low by itself, but downstream sketch/reference evolution tends to pull toward topology references.

**AI/context complexity:** high because the model must reason about another graph namespace/value kind and dependencies.

**Smallest bounded slice:** immutable reusable profile definitions referenced only by extrude, with no constraints or face attachment. Even that is not justified before repeated-profile fixtures show material benefit.

**Decision:** defer.

### 6. Arbitrary/reference planes or more flexible placement

**Product benefit:** medium for oblique features and local-coordinate authoring.

**Is it a real current representational gap?** Mostly no for geometry. M4 can create the profile/extrusion in a canonical frame and M6 can rigidly rotate/translate the resulting solid. Project-level placement already supports explicit origin/X/Y axes. What is missing is mainly more direct authoring, not basic solid expressiveness.

**Canonical impact:** low to medium for an explicit plane; high if a plane attaches to a generated face.

**Native risk:** low for explicit vectors, high for face references.

**Rhino parity risk:** low for explicit vectors, high for topology-attached references.

**Topology stability:** low only while planes are fully explicit and topology-independent.

**AI/context complexity:** medium; explicit orthonormal frames add more correlated numeric state than transform-after-extrude.

**Smallest bounded slice:** explicit topology-free origin/X/Y frame on extrusion only, if a target later proves transform-after-extrude inadequate.

**Decision:** defer.

### 7. Other identified gap: bounded revolve

**Product benefit:** high for turned parts, tapered/conical forms, bushings and axisymmetric profiles. The current constant-section extrude vocabulary cannot directly produce every such shape.

**Is it a real representational gap?** Yes; this is more than graph verbosity for some tapered/curved rotational solids.

**Canonical impact:** medium. It could reuse bounded profile data but needs explicit axis/frame and angular semantics.

**Native risk:** medium due to axis crossing, self-intersection and result-cardinality cases.

**Rhino parity risk:** medium for the same reasons.

**Topology stability:** low; no persisted edge/face identity is inherently required.

**AI/context complexity:** medium.

**Smallest bounded slice:** full 360-degree revolve of one bounded closed-polyline profile around one canonical in-plane axis, exactly one resulting solid, with no partial revolve or arbitrary spline profile.

**Decision:** genuine runner-up representational gap. Keep it ahead of shell/chamfer for future evaluation, but select circular pattern first because it reuses already-proven M3 `instanceSet` and M6 rigid-rotation semantics with substantially lower schema/runtime risk.

## Decision

The next modeling work is therefore ordered as follows:

1. **M3C repository-boundary reconciliation** — close the discovered final-rectangular-result validator defect and make repository CI green. This is repair work, not a new modeling slice.
2. **Bounded circular/polar pattern** — next selected modeling slice, but do not start it until step 1 has a clean checkpoint.
3. Re-evaluate **bounded revolve** and **multi-loop profiles** after circular pattern against new target fixtures.
4. Keep **M5 shell/thickness**, **M7 topology/finishing**, reusable sketches and topology-attached planes deferred.

The first circular-pattern target fixtures should be deliberately product-like rather than synthetic only:

- a mounting/flange plate with a radial bolt-hole cutter pattern and a single final Boolean body;
- a final radial set of separate fastener/feature bodies to exercise Result List semantics;
- parameter perturbation of center/radius-producing source placement and angular step while preserving deterministic instance identity.

The slice should reuse M3B/M3C collection rules and M6 transform order rather than introducing trigonometric scalar functions, general arrays, pattern nesting or arbitrary-axis topology references.

## Preserved architecture

This decision preserves:

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
- C4 image projection deferral.

## Acceptance boundary for the next slice

Repository implementation and CI will not be described as native or Rhino evidence. If bounded circular pattern is implemented, it must first complete canonical/provider/editor/native-source/GHX compiler tests and repository CI. Only then should the separately bounded native build123d/OCCT runtime fixture and installed Rhino 8 / Grasshopper fixture be requested and recorded.
