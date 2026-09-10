# C2.5-D — Rhino/native disjoint subtract parity

Status: **repository-complete and CI-accepted; installed Rhino 8 / Grasshopper disjoint-fixture acceptance pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Why this correction exists

The earlier representative Native BRep fixture exposed a bounded semantic mismatch between the two execution surfaces:

- native build123d/OCCT treats subtraction by a provably disjoint cutter as an unchanged/no-op result;
- the Rhino Python GHX compiler previously called `Rhino.Geometry.Brep.CreateBooleanDifference(...)` unconditionally and required exactly one returned Brep;
- a disjoint cutter could therefore be accepted by the authoritative native evaluator but fail later in installed Rhino 8 / Grasshopper.

The later C2.5-C room fixture no longer reproduced the bad door placement and solved successfully in installed Rhino 8, but that fixture did not exercise the known disjoint case. C2.5-D fixes only that parity edge and does not hide general Rhino boolean failures.

## Implemented rule

Generated Rhino Python now evaluates a deterministic, tolerance-aware world-axis-aligned bounding-box proof before each subtract tool:

```text
accurate base bounds
+ accurate cutter bounds
+ document absolute tolerance
-> proven disjoint?
```

The generated helper uses:

```text
GetBoundingBox(True)
```

for both Breps. Invalid bounds are **not** treated as disjoint.

A pair is considered proven disjoint only when one axis has a positive separation greater than the active Rhino document absolute tolerance. Merely touching bounds, overlapping bounds, or uncertain/invalid bounds do not qualify.

Behavior is therefore:

```text
proven disjoint
-> preserve the current accumulated base unchanged
-> explicit no-op subtraction

not proven disjoint
-> call Brep.CreateBooleanDifference(..., brepiaTolerance)
-> require exactly one Brep as before
-> fail closed otherwise
```

This intentionally does not convert arbitrary Rhino boolean failures into no-ops.

## Multi-tool ordering

For a subtract node with multiple cutters, each cutter is processed in canonical tool order.

The disjoint proof is recalculated against the **current accumulated result** before each cutter. If an earlier intersecting cutter changes the base, the next cutter therefore compares against that changed result rather than against the original input.

## Source and tests

Implementation:

```text
shared/brepGrasshopperRhinoScript.ts
```

Focused regression coverage:

```text
tests/brepGrasshopperRhinoDisjointSubtract.test.ts
```

Existing multi-cutter ordering coverage in:

```text
tests/brepGrasshopperComplexGraph.test.ts
```

was reconciled with the new guarded boolean structure without weakening its canonical ordering assertions.

Regression coverage proves that:

1. generated code uses accurate Rhino bounds and document tolerance;
2. invalid bounds fall through to the real boolean path;
3. the real Rhino boolean remains inside the non-disjoint branch;
4. the exactly-one-Brep failure remains fail-closed;
5. multiple cutters retain canonical order;
6. every later cutter is checked against the accumulated result.

## Repository acceptance

Implementation/test checkpoints:

```text
c8378ee09002c0b5e8565b565baed3520e317819  Align Rhino disjoint subtraction with native semantics
91a238cf61d589bd25e6d389e7a899a285449a98  Test bounded Rhino disjoint subtraction parity
253a1d2d909e0ac1e2a9b26f64c5fa3df98e386e  Reconcile complex subtract ordering test with disjoint guard
d23b68759987a20cacd484b56c4c651a20cb6949  Make Rhino parity tests identity-agnostic
3c8e06af8c856000a23b69a0ea82d1e2066883d1  Satisfy regex lint in Rhino parity tests
```

CI on `3c8e06af8c856000a23b69a0ea82d1e2066883d1`:

```text
Quality Gate #816       PASS
Grasshopper Build #388 PASS
```

Quality Gate included:

```text
833 / 833 tests PASS
typecheck PASS
lint PASS
build PASS
diff check PASS
```

## Installed-host acceptance still required

Repository CI cannot prove RhinoCommon runtime semantics. Installed Rhino 8 / Grasshopper remains the authority.

Preferred acceptance is deliberately cheap and does not require another long AI generation:

1. if the earlier persisted project whose door cutter was outside the wall is still available, pull this checkpoint and export a **fresh GHX** from that unchanged project;
2. open/solve the fresh GHX in installed Rhino 8 / Grasshopper;
3. confirm that the formerly disjoint subtraction is now an unchanged/no-op operation rather than a Python runtime error;
4. confirm the rest of the geometry still solves;
5. optionally change an intersecting cutter/parameter to verify the real boolean path continues to operate.

If the earlier project is no longer available, do not create an expensive new AI fixture solely for D. Keep installed-host acceptance pending until an equivalent deterministic disjoint fixture is available and continue the context/runtime track.

## Preserved boundaries

C2.5-D does not change:

- canonical BRep or immutable revision authority;
- build123d/OCCT as the authoritative native evaluator;
- M0/M1 integrity or scalar-expression limits;
- provider authoring schema or provider expression depth;
- `conversation.type = 'parametric'`;
- Native BRep source-kind routing;
- Settings/discovery model authority;
- GHX parameter-only import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- PR #36 merge state;
- M2 status.

## Next phase

After the cheap installed-host D check when available, continue with:

```text
C3 — BRep model-context projection
```

The representative C2.5 runtime evidence makes C3 especially important because llama.cpp reported 56,413 input tokens where the current byte estimator predicted only 36,419, leaving only about 2,467 tokens against the current conservative usable-input budget on a first turn with no historical BRep payloads.
