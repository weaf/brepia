# M3 — repetition and symmetry plan

Status: **complete — M3A mirror and M3B bounded linear pattern accepted across repository/CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper runtime**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

M2 was fully closed before M3 began. M3 is now also closed.

Detailed accepted evidence:

- `docs/brep_m3a_mirror_status.md`;
- `docs/brep_m3a_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3a_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_linear_pattern_status.md`;
- `docs/brep_m3b_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md`.

## Goal and result

M3 eliminated two major gaps in the bounded Native BRep vocabulary without weakening existing Boolean or collection semantics:

- symmetry through a single-body canonical mirror operation;
- one-dimensional repetition through an explicit ordered instance-set model.

The implementation remains kernel-neutral and additive to canonical `schemaVersion: 1`.

## M3A — mirror

Canonical node:

```ts
type BrepMirrorNode = {
  id: string;
  type: 'mirror';
  input: string;
  normalAxis: 'x' | 'y' | 'z';
  offset: BrepScalar;
};
```

Accepted semantics:

- `x` -> YZ mirror plane;
- `y` -> XZ mirror plane;
- `z` -> XY mirror plane;
- `offset` is the plane position in mm along the selected normal;
- output contains only the mirrored body, not original + mirrored;
- input remains single-body;
- M1 scalar expressions may drive offset.

Native build123d uses orientation-aware plane mapping:

```text
x -> Plane.YZ
y -> Plane.ZX
z -> Plane.XY
```

`Plane.ZX` is intentional because build123d's `Plane.XZ` uses a `-Y` normal; this preserves canonical positive Y-offset parity with Rhino.

Rhino 8 uses `Transform.Mirror(Plane)` on a duplicated Brep.

Accepted runtime evidence includes parameter-driven Y-axis mirror motion and save/close/reopen persistence in installed Grasshopper.

## M3B — explicit instance set + bounded linear pattern

Canonical node:

```ts
type BrepLinearPatternNode = {
  id: string;
  type: 'linearPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  count: number;
  spacing: BrepScalar;
};
```

Accepted bounds:

- input must be an existing `single` node;
- `count` is literal integer 2–32;
- `spacing` uses the M1 millimetre scalar contract;
- resolved spacing must be finite and non-zero at defaults and runtime overrides;
- instance 0 is the unshifted source;
- instance `i` is translated by `i * spacing` along the selected axis;
- ordering is deterministic and canonical.

M3B introduced the explicit value-kind distinction:

```text
single
instanceSet
```

This distinction is part of the shared canonical/evaluation contract rather than a backend-specific Compound shortcut.

## Collection consumer policy

The first collection boundary remains intentionally narrow.

Single-only consumers:

- `transform.input`;
- `mirror.input`;
- `fillet.input`;
- `linearPattern.input`;
- `union.inputs[]`;
- `intersect.inputs[]`;
- `subtract.base`;
- project-object geometry roles.

Supported collection consumer:

- `subtract.tools[]` may consume an `instanceSet` and expands its members as ordered cutters.

A `linearPattern` may itself be `resultNodeId`, producing an authoritative ordered multi-body result.

Nested patterns and general collection algebra remain fail-closed.

## Evaluation and export contract

Evaluation now exposes:

```text
resultKind = single | instanceSet
```

Final pattern bodies use stable identities:

```text
<patternNodeId>::0
<patternNodeId>::1
...
```

Each result body retains pattern node ID, instance index, source node ID, independent bounds and viewer mesh. Top-level bounds are aggregate bounds over the set.

Native exact STEP may use a build123d `Compound` as an export container only; this does not collapse canonical instance identity or imply Boolean union.

3DM retains separate result instances with Brepia node/instance metadata.

## Rhino / Grasshopper contract

The Rhino Python 3 compiler emits a final pattern as an ordered Python list of separate `Rhino.Geometry.Brep` values.

Grasshopper output persistence is explicit:

```text
single Result       -> Item Access
instanceSet Result  -> List Access
```

Only the `Result` port changes access based on result kind. Other historically accepted output persistence is unchanged.

Returned GHX remains parameter-only. The validator fails closed if the Result access contract is changed.

Pattern-as-subtract-tool iterates individual Brep cutters in canonical order and returns the ordinary single Boolean result.

Installed Rhino 8 / Grasshopper acceptance verified both a final list-result pattern and a pattern-driven subtract model, including save/close/reopen persistence.

## Repository and runtime acceptance

M3A repository checkpoint:

```text
789188167bc48ad91a579b5aa4bb720ba8cfa8c0
Quality Gate #897       PASS
Grasshopper Build #469  PASS
```

M3B primary repository checkpoint:

```text
94e1b0fca3b1d01b016faeee52bb9cdeb564f4b4
Quality Gate #937       PASS
Grasshopper Build #509  PASS
```

Later M3B docs/runtime-preparation checkpoint:

```text
a6f030f5752a3c1eb2fb53d9d188d132ec8ff302
Quality Gate #939       PASS
Grasshopper Build #511  PASS
```

Native runtime then passed the expanded smoke corpus, including:

- M2 union/intersection regressions;
- M3A mirror X/Y/Z parity;
- three-body final linear pattern with stable identities and aggregate bounds;
- exact multi-solid STEP;
- four pattern instances used as ordered subtract cutters;
- final subtract remaining exactly one `single` body.

Installed Rhino 8 / Grasshopper subsequently accepted both fresh M3B GHX fixtures and save/close/reopen persistence.

## M3C candidates — deferred, not implied next scope

M3C is optional future work rather than an automatic continuation of M3B.

Potential candidates:

- integer-safe published `count` parameters;
- rectangular/grid pattern built on the accepted `instanceSet` foundation;
- collection-aware transform/mirror;
- explicitly specified collection flattening where M2 exact-one-body semantics can still be proven.

None of these should be added merely because the instance-set substrate now exists.

The next roadmap decision should compare product value of rectangular/grid pattern against M4 profile + extrusion. The preferred default is to move to M4 unless a concrete near-term model requires 2D repetition strongly enough to justify M3C first.

## Permanent boundaries

M3 closeout preserves:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revision authority;
- build123d/OCCT native geometry authority;
- canonical `schemaVersion: 1`;
- canonical scalar depth 12 and expression-node limit 64;
- provider expression depth 2 and finite/reference-free provider schema;
- M0 parameter-effectiveness/orphan analysis;
- M2 exact-one-body Boolean result policy;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD regressions;
- C4 deferred until image-bearing evidence exists;
- PR #36 remaining draft, stacked and unmerged.

## Next entry point

Start the next modeling chat with analysis/reconciliation only. Read this closeout plus the high-level modeling roadmap and decide explicitly between:

1. optional M3C rectangular/grid pattern; or
2. M4 bounded profile + extrusion foundation.

Do not begin implementation until that scope decision has been reconciled against the actual current branch.
