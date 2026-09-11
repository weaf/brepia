# M3C — bounded rectangular pattern status

Status: **implementation analysis complete; feature implementation not yet started**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Selected scope

Post-M6 reconciliation selected M3C as the next modeling slice because two-dimensional repetition remains a real representational gap while M5 shell/thickness and M7 finishing/topology remain either unproven or topology-sensitive.

Decision record:

```text
docs/brep_post_m6_scope_decision_2026-09-11.md
```

The selected canonical planning shape is:

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

Bounds:

- input must be one existing `single` node;
- axes must be distinct;
- each count is a literal integer 2–32;
- total instances `countA * countB` must be <= 64;
- both spacings use existing M1 millimetre scalar/expression semantics;
- both spacings must resolve finite and non-zero for defaults and runtime overrides;
- `(0,0)` is the unshifted source;
- instance `(a,b)` translates by `a*spacingA` on axisA plus `b*spacingB` on axisB;
- order is row-major: axisA outer, axisB inner;
- flat index is `a * countB + b`;
- stable body ID remains `<nodeId>::<flatIndex>`;
- output kind is the existing `instanceSet`;
- only `subtract.tools[]` may consume the set;
- nested patterns remain unsupported.

No new result kind, nested collection model or implicit union is part of M3C.

## Reconciliation against current implementation

### Canonical contract — `shared/brepProject.ts`

Current M3B infrastructure already centralizes:

- `BREP_PROJECT_MAX_PATTERN_COUNT = 32`;
- `BrepNodeValueKind = 'single' | 'instanceSet'`;
- linear-pattern normalization;
- single-input value-kind enforcement;
- dependency/cycle traversal;
- runtime/default non-zero spacing validation.

M3C should add:

- `BREP_PROJECT_MAX_RECTANGULAR_PATTERN_INSTANCES = 64`;
- `BrepRectangularPatternNode` in `BrepNode`;
- normalization for distinct axes, counts and total instance cap;
- `brepNodeValueKind(rectangularPattern) -> instanceSet`;
- one input dependency;
- the same single-input compatibility rule as `linearPattern`;
- non-zero validation for both effective spacings.

The existing `schemaVersion: 1` remains unchanged.

### Scalar traversal — `shared/brepScalar.ts`

Current scalar traversal explicitly handles `linearPattern.spacing` in both complete-project validation and parameter-reference analysis.

M3C needs only the equivalent two entries:

```text
spacingA
spacingB
```

This preserves canonical expression depth 12 and node limit 64 without introducing any new expression semantics.

### Parameter effectiveness — `shared/brepProjectIntegrity.ts`

Current dependency traversal treats `linearPattern` as a single-input feature and obtains feature parameter references through `brepNodeScalarParameterReferences`.

M3C therefore only requires:

- `rectangularPattern -> [input]` in dependency traversal;
- scalar traversal support above.

No new M0 classification rule is needed.

### Evaluation request validation — `shared/brepProvider.ts`

Current request normalization already validates all scalar values and then calls the M3B non-zero spacing validator before native execution.

M3C should extend/generalize that boundary so both rectangular spacings are checked under the **effective runtime parameter values**, not just defaults.

The global evaluated-body cap is already:

```text
BREP_EVALUATION_MAX_BODY_COUNT = 64
```

The selected M3C total-instance cap intentionally matches that existing provider boundary.

### AI/provider schemas — `shared/brepAiTool.ts`

Current canonical-facing and finite/reference-free provider-facing schemas each define `linearPattern` explicitly.

M3C needs a corresponding rectangular-pattern schema in both unions using:

- literal integer counts;
- distinct-axis and total-count validation delegated to canonical normalization;
- provider scalar depth 2 for `spacingA` / `spacingB`;
- canonical normalization as final authority.

No `$ref`, recursive provider schema or new model-routing behavior is required.

### Project editing helpers — `shared/brepProjectEditing.ts`

Current helpers explicitly enumerate node dependencies and parameter usages.

M3C needs:

- one input dependency;
- parameter usage reporting for `spacingA` and `spacingB`.

All add/replace/delete/result helpers can continue to delegate to canonical normalization.

### Structural editor — `src/components/brep/BrepFeatureEditor.tsx`

Current UI has first-class Linear Pattern authoring and already filters single-shape input candidates through `brepNodeValueKind`.

M3C should add first-class Rectangular Pattern authoring with:

- single input selector;
- axis A and axis B selects;
- count A/count B numeric controls;
- spacing A/spacing B M1-preserving `ScalarField`s;
- visible max-64-total guidance;
- no option to select an existing `instanceSet` as input.

A safe default draft is:

```text
axisA = x
axisB = y
countA = 2
countB = 2
spacingA = 20
spacingB = 20
```

### Native build123d/OCCT — `scripts/brep/brep_driver.py`

M3B already has the correct abstraction boundary: a pattern instance set is produced as ordered moved copies of one single input, final instance sets use separate body payloads and exact multi-solid STEP uses `Compound` only as an export container.

M3C should reuse this path rather than introduce a second result representation.

Required native mapping:

```text
for a in range(countA):
  for b in range(countB):
    offset = axisVectorA * (a * spacingA) + axisVectorB * (b * spacingB)
    instance = input.moved(Location(offset))
```

The emitted list order is already the canonical flat index order. Final grid remains `instanceSet`; grid-as-subtract-tools expands in the same ordered cutter path as M3B.

### Rhino/GHX compiler — `shared/brepGrasshopperRhinoScript.ts`

M3B already emits an ordered Python list of duplicated/transformed Breps and the surrounding GHX pipeline derives Result Item/List access from canonical result kind.

M3C should emit the same representation using two nested bounded Python loops in canonical row-major order and one combined translation vector.

No new Grasshopper component, GHA dependency or output-access mechanism is required.

### GHX persistence / validator

Because M3C returns the existing `instanceSet`, the current access contract remains:

```text
single      -> Result Item Access
instanceSet -> Result List Access
```

The strict returned-GHX validator should require no new mutation class. It continues to allow only published parameter values to change and must still reject Result access changes, script changes, wiring changes, graph changes and unsupported library identity changes.

### Viewer / STEP / 3DM

Current evaluated-result handling already supports up to 64 ordered primary bodies with stable body IDs, aggregate bounds, per-body meshes, multi-solid STEP and separate 3DM instance objects.

M3C should reuse this generic instance-set path. No viewer-specific grid representation should be introduced.

## Repository acceptance fixtures

The first repository-complete M3C candidate should cover at minimum:

### Final rectangular pattern

A centered 10 x 10 x 10 source box with:

```text
axisA = x
axisB = y
countA = 3
countB = 2
spacingA = 20
spacingB = 30
```

Expected canonical order and centers:

```text
index 0 -> (a=0,b=0) -> [0,0,0]
index 1 -> (a=0,b=1) -> [0,30,0]
index 2 -> (a=1,b=0) -> [20,0,0]
index 3 -> (a=1,b=1) -> [20,30,0]
index 4 -> (a=2,b=0) -> [40,0,0]
index 5 -> (a=2,b=1) -> [40,30,0]
```

Expected aggregate bounds:

```text
[-5,-5,-5] -> [45,35,5]
```

Expected stable bodies:

```text
grid::0 ... grid::5
```

### Parameter/expression spacing

At least one spacing should be published and the other derived through an M1 expression so parameter effectiveness and effective runtime validation are exercised.

### Rectangular pattern as subtract tool

Use a bounded non-square grid as `subtract.tools[]` against a single plate/body. The pattern must expand in canonical order while final subtract remains exactly one `single` body / Result Item Access.

### Fail-closed cases

Repository tests must reject:

- equal axes;
- count below 2 or above 32;
- total instance count above 64;
- zero default spacing A or B;
- runtime override resolving spacing A or B to zero;
- rectangularPattern input referencing any `instanceSet`;
- linearPattern input referencing rectangularPattern;
- rectangularPattern input referencing linearPattern or another rectangularPattern;
- use as union/intersection input or subtract base;
- project-object role referencing rectangularPattern.

## External acceptance boundary

After repository/CI completion, native and installed-host acceptance remain separate.

Native must prove the 3 x 2 final grid, exact body order/IDs/bounds, exact multi-solid STEP and grid-as-subtract-tools while all M0–M6 smoke remains green.

Installed Rhino 8 / Grasshopper must prove the same final-grid List Access and grid-cutter Item Access paths, a spacing perturbation, save -> close -> reopen and strict returned-GHX validation.

## Preserved boundaries

M3C does not change:

- canonical `schemaVersion: 1`;
- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- M0 parameter-effectiveness policy;
- M1 scalar depth/node limits;
- provider expression depth 2;
- M2 exact-one-body Boolean semantics;
- M3B `single | instanceSet` result kinds;
- M4 profile/extrusion semantics;
- M6 Intrinsic-XYZ transform semantics;
- GHX parameter-only return/import boundary;
- OpenSCAD behavior;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
