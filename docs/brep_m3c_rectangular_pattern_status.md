# M3C — bounded rectangular pattern status

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Accepted checkpoints and evidence

The clean repository-integration checkpoint is:

```text
c46a12c2d488a083e17c43ca97608b37a717767f
Complete M3C rectangular pattern repository integration
```

Its implementation tree passed:

```text
Quality Gate #1027       PASS
Grasshopper Build #599  PASS
```

Quality Gate #1027 included 966/966 tests plus typecheck, lint, build, diff-check and dependency audit. Grasshopper Build #599 passed the plugin build and Ubuntu/Windows packaging jobs.

The fresh installed-host fixtures were generated from:

```text
5c2d11c3b9bea97b2d6a6c50d296c9c371c25af0
Keep M3C Rhino cutter grid inside host fixture
```

That exact tree separately passed:

```text
Quality Gate #1034       PASS
Grasshopper Build #606  PASS
```

Repository CI is not native or Rhino runtime evidence. The two external acceptance layers are recorded independently in:

```text
docs/brep_m3c_native_runtime_evidence_2026-09-11.md
docs/brep_m3c_rhino8_runtime_evidence_2026-09-11.md
```

## Implemented canonical contract

M3C extends the existing canonical BRep graph with one bounded node type:

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

Canonical `schemaVersion: 1` remains unchanged.

Accepted bounds and semantics:

- input must resolve from exactly one existing `single` node;
- `axisA` and `axisB` must be different;
- `countA` and `countB` are literal integers from 2 through 32;
- `countA * countB <= 64`;
- `spacingA` and `spacingB` reuse the M1 scalar/expression model;
- both effective spacings must be finite and non-zero for defaults and runtime overrides;
- `(a=0,b=0)` keeps the source location;
- instance `(a,b)` moves by `a * spacingA` on axis A plus `b * spacingB` on axis B;
- canonical order is row-major: A outer, B inner;
- flat index is `a * countB + b`;
- stable body identity is `<patternId>::<index>`;
- result kind reuses M3B `instanceSet`;
- only `subtract.tools[]` may consume an `instanceSet`;
- nested/general collection algebra and implicit union remain unsupported.

## Repository implementation

The completed repository surface includes:

- canonical normalization and bounded product validation;
- axis-inequality enforcement;
- single-only input/value-kind enforcement;
- M0 effectiveness/integrity traversal;
- M1 scalar traversal for both spacings;
- default/runtime zero-spacing rejection;
- finite/reference-free provider-facing schema with provider expression depth 2;
- structural editor controls for axes, counts and spacings;
- native build123d / OCCT execution with ordered copies and stable instance identity;
- ordered `subtract.tools[]` expansion;
- multi-body viewer/result handling and exact multi-solid STEP/3DM behavior;
- Rhino 8 Python/GHX compilation;
- rectangular final Result as List Access;
- rectangular pattern used by subtract while the final subtract remains Item Access;
- strict returned-GHX validation rejecting Result-access, script, graph and wiring tampering.

The provider schema remains inside the existing `<180000` byte regression budget without raising that limit.

M3C-specific deterministic coverage includes:

```text
tests/brepM3CRectangularPatternContract.test.ts
tests/brepM3CNativePattern.test.ts
tests/brepM3CRhinoPattern.test.ts
tests/brepM3CRhinoAcceptanceTool.test.ts
```

plus the shared provider-schema and structural-UI suites and:

```text
scripts/brep/m3c-rectangular-pattern-smoke.sh
scripts/brep/m3c-rhino-acceptance.ts
scripts/brep/m3c-rhino-acceptance.sh
```

## Native runtime acceptance

The real pinned runtime reported:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
OCP=7.9.3.1
rhino3dm=8.32.1
```

Accepted observed output:

```text
{"result":"pattern","resultKind":"instanceSet","ids":["pattern::0","pattern::1","pattern::2","pattern::3","pattern::4","pattern::5"],"offsets":[[0,0],[0,30],[0,60],[20,0],[20,30],[20,60]],"exactStep":true}
{"result":"cut","resultKind":"single","orderedTools":["singleToolAt","cutters"],"exactStep":true}
```

This separately proves six ordered final bodies, stable flat identities, A-outer/B-inner placement, direct-parameter plus expression-backed spacing, exact STEP, ordered pattern-as-subtract consumption and an exact-one-body final subtract.

## Installed Rhino 8 / Grasshopper acceptance

Two fresh generated definitions were exercised in installed Rhino 8 / Grasshopper:

```text
m3c-final-rectangular-pattern.ghx
m3c-rectangular-pattern-cutters.ghx
```

Accepted host behavior:

- both definitions opened and solved successfully;
- the final rectangular pattern produced six separate Breps through Result List Access, with no implicit union;
- published spacing changes recomputed the repeated geometry;
- save -> close -> reopen preserved the changed definition and values;
- the pattern-as-cutters definition produced one final Brep with six cylindrical through-cuts through Result Item Access;
- cutter spacing changes recomputed the six-hole arrangement;
- both Rhino-saved returned GHX definitions passed the strict parameter-only returned validator.

A first validation run observed a persisted non-default `pitchA=36`; the failure at that point came only from an over-specific acceptance-wrapper expectation of `25`. The wrapper was corrected at `fd07d9ea885a6454c2bcef3f08e4bcd786febf47` to accept any bounded non-default perturbation. The strict structural validator was not weakened. Comparing `5c2d11c3...` to `fd07d9e...` shows changes only to the acceptance shell wrapper and its test, not the compiler, fixture generator or M3C semantics.

## Closeout

M3C now has all required acceptance layers:

- canonical/shared contract;
- provider/AI authoring contract;
- structural authoring UI;
- multi-body viewer;
- native build123d / OCCT execution;
- exact STEP/3DM behavior;
- Rhino 8 / Grasshopper compilation;
- Result Item/List persistence rules;
- repository CI;
- real native runtime;
- real installed Rhino 8 / Grasshopper runtime;
- parameter perturbation and save/close/reopen persistence;
- strict returned-GHX validation.

There is no remaining M3C acceptance boundary.

## Preserved boundaries

M3C does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep plus immutable revision authority;
- build123d / OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter effectiveness;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- M3B `single | instanceSet` result kinds;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 finishing/topology deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
