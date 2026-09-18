# Post-M6 modeling scope decision — 2026-09-11

Status: **DECIDED — M6 is complete; proceed next with bounded M3C rectangular pattern. M5 shell/thickness and M7 topology/finishing remain deferred.**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Accepted basis

M6 non-zero canonical transform rotation parity is complete across all required boundaries:

- repository/CI;
- real pinned build123d 0.11.1 / OCCT native runtime;
- installed Rhino 8 / Grasshopper;
- parameter perturbation;
- bounded expression-backed degree values;
- save -> close -> reopen;
- strict parameter-only returned-GHX validation.

Evidence:

```text
docs/brep_m6_rotation_parity_status.md
docs/brep_m6_native_runtime_evidence_2026-09-11.md
docs/brep_m6_rhino8_runtime_evidence_2026-09-11.md
```

M0, M1, M2, M3A, M3B, M4 and M6 are therefore closed.

## Remaining candidates

The modeling roadmap still contains three meaningful future directions:

1. M5 wall/shell/thickness semantics;
2. optional M3C rectangular/grid repetition;
3. M7 finishing/topology expansion such as chamfer and broader semantic edge selection.

## Why M5 remains deferred

Nothing in the accepted M1–M4 + M6 surface demonstrates a material inability to build ordinary plates, walls, hollows or openings. Those remain expressible through:

- M1 derived dimensions and offsets;
- M4 explicit closed profiles/extrusions;
- M2 Boolean subtraction/union/intersection;
- M6 full bounded transform placement.

A shell/thickness operation would currently compress graphs more than broaden the representable model class. It also introduces face/region selection and offset behavior that can diverge significantly between OCCT and Rhino.

The existing invariant remains: do not add M5 until a concrete target fixture proves that the accepted language is materially inadequate rather than merely verbose.

## Why M7 remains deferred

M7 broadens topology-sensitive finishing. Fillet already demonstrated the care required even for one narrow semantic selector. Chamfer and broader edge/face selectors require a separate topology-stability design and native/Rhino acceptance strategy.

M7 is valuable, but it should not be the next slice while a topology-neutral representational gap remains.

## Why M3C is now the strongest next slice

M3B provides one-dimensional ordered repetition only:

```text
single input -> linearPattern -> ordered instanceSet
```

and deliberately prohibits:

```text
linearPattern(instanceSet)
```

because nested/general collection algebra is not part of canonical v1.

That means a true two-dimensional repeated layout cannot currently be represented as one bounded parametric repetition operation. The alternatives are materially worse:

- manually author every transform instance, causing node-count expansion and duplicated placement expressions;
- manually author rows/columns without parameterized count semantics;
- relax the M3B nested-instance-set prohibition, which would introduce a much broader collection algebra than needed.

A dedicated bounded rectangular pattern therefore closes a real representational gap while reusing the already-accepted `instanceSet` result model.

It is also substantially lower risk than M5/M7 because it requires no topology selection and no new geometry kernel primitive: both native and Rhino mappings are ordered translations of one accepted `single` input.

## Selected M3C contract

The first M3C slice should add one node family:

```ts
type BrepRectangularPatternNode = {
  id: string;
  type: 'rectangularPattern';
  input: string;
  axisA: 'x' | 'y' | 'z';
  axisB: 'x' | 'y' | 'z';
  countA: number;
  countB: number;
  spacingA: BrepScalar;
  spacingB: BrepScalar;
};
```

### Bounded semantics

- `input` must reference one existing `single` node;
- `axisA` and `axisB` must be distinct canonical axes;
- each count is a literal integer 2–32;
- total instance count must be bounded independently to at most **64**;
- each spacing uses the existing M1 millimetre scalar/expression contract;
- each spacing must resolve finite and non-zero for defaults and runtime overrides;
- instance `(0,0)` is the unshifted source;
- instance `(a,b)` translates by:

```text
a * spacingA along axisA
+
b * spacingB along axisB
```

- canonical ordering is row-major with `axisA` as the outer index and `axisB` as the inner index:

```text
for a = 0 .. countA-1
  for b = 0 .. countB-1
```

- flat canonical instance index is:

```text
index = a * countB + b
```

- stable body IDs remain compatible with the M3B shape:

```text
<patternNodeId>::<index>
```

The flat index is authoritative for body identity/order. M3C does not require a new nested instance metadata model.

### Result/consumer semantics

`rectangularPattern` produces the existing:

```text
instanceSet
```

It does not introduce another result kind.

The existing narrow collection policy remains:

- a final rectangular pattern may be `resultNodeId` and therefore emits Result List Access;
- `subtract.tools[]` may consume its ordered member shapes as cutters;
- transform, mirror, fillet, linearPattern, rectangularPattern, union, intersect, subtract base and project-object geometry roles remain single-only;
- nested patterns remain unsupported;
- there is no implicit union/fuse of the grid.

### Explicitly out of scope

Do not add in M3C:

- three-axis/volumetric patterns;
- arbitrary pattern vectors;
- polar/circular patterns;
- staggered grids;
- skipped/masked instances;
- nested patterns or general collection algebra;
- pattern-level rotation;
- implicit Boolean union;
- topology references;
- M5 shell/thickness;
- M7 finishing expansion.

Canonical `schemaVersion` remains `1`.

## Required implementation surfaces

Before M3C can be called repository-complete, reconcile and update the same surfaces established by M3B:

1. canonical types/normalization/value-kind/dependency/cardinality checks;
2. M1 scalar traversal and runtime effective-value validation;
3. M0 parameter-effectiveness/reachability analysis;
4. finite/reference-free provider/AI schemas;
5. Native BRep instruction;
6. structural feature editor;
7. native build123d/OCCT evaluator;
8. viewer/result body validation and exact multi-solid STEP/3DM behavior;
9. Rhino Python/GHX compiler;
10. Result Item/List persistence and strict validator behavior;
11. final-grid and grid-as-subtract-tool regression fixtures.

M3C should reuse existing M3B instance-set infrastructure wherever possible rather than duplicating a second collection implementation.

## Required external acceptance

Repository CI is not sufficient for closeout.

Native acceptance must prove at minimum:

- a non-square grid such as 3 x 2 with unequal spacings;
- deterministic row-major body order and stable flat IDs;
- exact aggregate bounds;
- parameter/expression-backed spacing recomputation;
- exact multi-solid STEP;
- rectangular pattern consumed as ordered subtract tools while the final result remains `single`;
- all M0–M6 native regressions remain green.

Installed Rhino 8 / Grasshopper acceptance must prove:

- the same non-square final grid as Result List Access;
- the same grid consumed as subtract cutters with final Item Access;
- a published spacing perturbation recomputes the expected axis;
- save -> close -> reopen remains valid;
- Rhino-saved GHX passes the strict parameter-only returned validator.

## Preserved architecture

M3C must preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter-effectiveness policy;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 / finite reference-free schema;
- M2 exact-one-body Boolean semantics;
- M3B `single | instanceSet` result cardinality;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ transform semantics;
- GHX parameter-only return/import boundary;
- OpenSCAD regressions;
- C4 image-projection deferral.

## Next action

Begin M3C implementation analysis against the actual M3B canonical/provider/native/Rhino/editor/result-validation surfaces. Do not broaden the collection model beyond the bounded rectangular pattern contract above.
