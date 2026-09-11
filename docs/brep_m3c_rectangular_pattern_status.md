# M3C — bounded rectangular pattern status

Status: **repository-complete and native-runtime accepted; installed Rhino 8 / Grasshopper acceptance pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Current accepted checkpoint

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

Quality Gate #1027 included 966/966 tests plus typecheck, lint, build and diff-check. Grasshopper Build #599 passed the plugin build and both Ubuntu and Windows packaging jobs.

Repository CI is not native or Rhino runtime evidence.

Native runtime evidence is recorded separately in:

```text
docs/brep_m3c_native_runtime_evidence_2026-09-11.md
```

and is accepted against:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
OCP=7.9.3.1
rhino3dm=8.32.1
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

The existing `schemaVersion: 1` remains unchanged.

Accepted bounds and semantics:

- input must resolve from exactly one existing `single` node;
- `axisA` and `axisB` must be different;
- `countA` and `countB` are literal integers from 2 through 32;
- `countA * countB <= 64`;
- `spacingA` and `spacingB` use the existing M1 scalar/expression model;
- both effective spacings must be finite and non-zero under defaults and runtime overrides;
- `(a=0,b=0)` keeps the source location;
- instance `(a,b)` moves by `a * spacingA` on axis A plus `b * spacingB` on axis B;
- order is row-major: A outer, B inner;
- flat index is `a * countB + b`;
- stable body identity is `<patternId>::<index>`;
- result kind reuses M3B `instanceSet`;
- only `subtract.tools[]` may consume an `instanceSet`;
- no nested/general collection algebra or implicit union is introduced.

## Repository implementation

The implemented repository surface now includes:

- canonical normalization and bounded product validation;
- axis-inequality enforcement;
- single-only input/value-kind enforcement;
- M0 effectiveness/integrity traversal;
- M1 scalar traversal for both spacings;
- default and runtime zero-spacing rejection;
- finite/reference-free provider-facing schema with provider expression depth 2;
- structural editor creation/editing controls for axis A/B, count A/B and spacing A/B;
- single-only structural input selector;
- native build123d / OCCT execution;
- row-major ordered copies;
- stable instance/body identity;
- ordered `subtract.tools[]` expansion;
- final rectangular pattern as `instanceSet`;
- Rhino 8 Python/GHX compilation;
- rectangular final Result as List Access;
- rectangular pattern used by subtract while the final subtract remains Item Access;
- returned-GHX validation rejecting Result-access tampering.

The provider schema remained inside the existing `<180000` byte regression budget without raising that limit. The provider remains finite and reference-free.

## Deterministic repository coverage

Current M3C-specific coverage includes:

```text
tests/brepM3CRectangularPatternContract.test.ts
tests/brepM3CNativePattern.test.ts
tests/brepM3CRhinoPattern.test.ts
```

plus extensions to the shared provider-schema and structural-UI suites.

The tests cover at minimum:

- normalization and count bounds;
- distinct axes;
- total instance cap 64;
- single-only input;
- rejection of linear/rectangular `instanceSet` inputs;
- M0 parameter effectiveness;
- M1 scalar expressions;
- default/runtime zero-spacing rejection;
- row-major ordering;
- stable body identity;
- ordered subtract tools;
- finite/reference-free provider schema;
- Rhino/GHX Result List Access;
- returned Result List -> Item tampering rejection.

## Native runtime acceptance

The real pinned local runtime completed:

```bash
scripts/brep/m3c-rectangular-pattern-smoke.sh
```

Accepted observed output:

```text
{"result":"pattern","resultKind":"instanceSet","ids":["pattern::0","pattern::1","pattern::2","pattern::3","pattern::4","pattern::5"],"offsets":[[0,0],[0,30],[0,60],[20,0],[20,30],[20,60]],"exactStep":true}
{"result":"cut","resultKind":"single","orderedTools":["singleToolAt","cutters"],"exactStep":true}
```

This proves in the real build123d / OCCT authority:

- six ordered final bodies;
- stable `pattern::0..5` identity;
- A-outer/B-inner row-major placement;
- direct parameter plus derived-expression spacing paths;
- exact STEP availability;
- rectangular instance-set consumption through ordered `subtract.tools[]`;
- final subtract remaining exactly one `single` body.

## Installed Rhino 8 / Grasshopper acceptance tooling

The branch now contains a dedicated current-source fixture/validation utility:

```text
scripts/brep/m3c-rhino-acceptance.ts
```

It generates two fresh GHX definitions from the actual current compiler:

```text
m3c-final-rectangular-pattern.ghx
m3c-rectangular-pattern-cutters.ghx
```

The first exposes the rectangular `instanceSet` through Result List Access. The second uses the rectangular pattern through `subtract.tools[]` and exposes the final Boolean result through Result Item Access.

Both use published parameters:

```text
pitchA       default 20 mm
pitchBaseB   default 25 mm
spacingB     = pitchBaseB + 5 mm
```

The utility can also validate a Grasshopper-saved returned GHX against the original deterministic contract and report the returned published parameter values. Any script, graph, wiring, Result access or unsupported structural mutation remains rejected by the existing strict validator.

## Remaining acceptance boundary

Only installed Rhino 8 / Grasshopper runtime acceptance remains before M3C closeout.

The host run must prove:

1. both freshly generated GHX files open and solve in installed Rhino 8 / Grasshopper;
2. final rectangular pattern produces six separate Breps through Result List Access in row-major placement;
3. changing `pitchA` and `pitchBaseB` recomputes geometry correctly;
4. save -> close -> reopen preserves the generated definition and changed published values;
5. the rectangular-pattern-cutters definition produces one final Brep through Result Item Access;
6. both saved returned GHX files pass strict returned-GHX validation with only the published values changed.

After that run, create/update the installed-host evidence document and mark M3C complete.

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
- Result Item/List access semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 finishing/topology deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
