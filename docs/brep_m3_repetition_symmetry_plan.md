# M3 — repetition and symmetry plan

Status: **M3A mirror repository/CI and native build123d/OCCT runtime accepted; installed Rhino 8 / Grasshopper acceptance active; M3B blocked**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

M2 is fully closed before this plan begins. Its repository, native build123d/OCCT and installed Rhino 8 / Grasshopper evidence is recorded in the M2 status/evidence documents.

Detailed current M3A status:

- `docs/brep_m3a_mirror_status.md`;
- `docs/brep_m3a_native_runtime_evidence_2026-09-11.md`.

## Goal

M3 should eliminate repeated literal transforms while preserving Brepia's bounded, kernel-neutral and fail-closed canonical model.

Target use cases include:

- mirrored mechanical features;
- repeated holes/cutters;
- repeated independent objects such as a row of cabinets;
- later rectangular repetition once the one-dimensional contract is proven.

M3 must not silently weaken M2's exact-one-body Boolean semantics and must not unlock non-zero canonical rotation.

## Reconciled current architecture

The current canonical DAG is shape-oriented:

- primitives create one shape;
- `transform`, `mirror` and `fillet` consume one input shape;
- `subtract` consumes one base plus one or more tool-node references;
- `union` / `intersect` consume ordered node references and require exactly one final Boolean body;
- `resultNodeId` points to one canonical node;
- project-object geometry roles point to canonical nodes;
- M0 reachability follows ordinary node dependencies.

The native evaluator currently memoizes one build123d shape per node. The external evaluation contract already has a bounded `bodies` array, but current native evaluation emits one primary evaluated body for `resultNodeId` and current server validation requires `bodies[0].id === resultNodeId`.

The active Rhino Python GHX compiler similarly treats each graph variable as one `Rhino.Geometry.Brep`; project placement currently duplicates and transforms one result Brep.

Therefore a true repeated multi-instance result is not merely another single-valued node. Treating it as a Boolean union would be wrong for separated instances and would directly contradict M2's fail-closed result-cardinality policy.

## M3A — mirror first

Status: **repository-complete, CI-accepted and native build123d/OCCT runtime-accepted; installed Rhino 8 / Grasshopper acceptance pending**.

Mirror is the bounded first step because it remains single-valued and does not require collection semantics.

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

Semantics:

- `normalAxis: 'x'` means a YZ mirror plane;
- `normalAxis: 'y'` means an XZ mirror plane;
- `normalAxis: 'z'` means an XY mirror plane;
- `offset` is the mirror-plane position in millimetres along that normal axis;
- mirror returns only the mirrored input, not `original + mirrored`;
- `offset` may use the existing bounded M1 scalar-expression contract;
- input remains an ordinary single-shape node reference;
- schema version remains `1`.

This axis+offset plane is intentionally narrower than an arbitrary plane/normal authoring surface. It is deterministic, easy to express in the structural editor and avoids introducing another free vector-frame contract during M3.

### Backend mapping

Native build123d 0.11.1 exposes `Shape.mirror(mirror_plane)` and mirrors the shape without duplicating the original. That matches the canonical node semantics.

The native axis mapping is orientation-aware:

```text
x -> Plane.YZ
y -> Plane.ZX
z -> Plane.XY
```

`Plane.ZX` is deliberately used for the canonical Y-normal plane because build123d's `Plane.XZ` has a `-Y` normal. This keeps positive canonical offset mapped to `Y = +offset` and matches the Rhino compiler.

RhinoCommon exposes `Rhino.Geometry.Transform.Mirror(Plane)` in the Rhino 8 API compatibility floor. The GHX compiler:

1. duplicates the input Brep;
2. constructs the canonical axis-normal mirror plane at `offset`;
3. applies `Transform.Mirror(...)`;
4. fails closed if plane construction or transformation fails.

The Rhino mapping is reconciled under `docs/references/rhino8_mcneel_sources.md`; installed Rhino 8 evidence remains required before M3A closeout.

### M3A repository acceptance

Completed:

- canonical normalization/reference/DAG coverage;
- M0 reachability and M1 scalar-reference coverage;
- finite/reference-free provider schema exposure;
- structural feature-editor support;
- native build123d mirror fixture with X/Y/Z oriented expected bounds;
- Rhino Python source-generation fixture;
- Native BRep agent instruction coverage;
- repository tests/typecheck/lint/build/diff check green;
- Grasshopper Build green.

Exact repository checkpoint:

```text
789188167bc48ad91a579b5aa4bb720ba8cfa8c0
Quality Gate #897       PASS
Grasshopper Build #469 PASS
```

### M3A native runtime acceptance

Completed via the real local constrained runtime:

```bash
./scripts/brep/smoke-test.sh
```

The X/Y/Z mirror fixtures reproduced their exact non-zero-offset expected bounds and retained one result body, exact STEP and 3DM output. Detailed evidence is recorded in:

```text
docs/brep_m3a_native_runtime_evidence_2026-09-11.md
```

Still required before M3A closeout:

- installed Rhino 8 / Grasshopper open/solve/parameter-change/save/reopen acceptance for a fresh current-branch mirror GHX.

## M3B — explicit instance-set foundation + linear pattern

Status: **blocked until M3A installed-host acceptance and explicit closeout**.

Do not implement linear pattern as an implicit Boolean union or as an opaque single Brep/solid.

A linear pattern of separated solids is semantically an ordered set of instances. M3B must introduce that distinction explicitly before exposing the node to AI or users.

Proposed first canonical node shape:

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

Initial bounds:

- `count` is a literal integer only in the first version;
- `2 <= count <= 32`;
- `spacing` uses the existing `mm` scalar-expression contract;
- spacing must resolve to a finite non-zero value;
- instance 0 is the original location;
- instance `i` is translated by `i * spacing` along the selected axis;
- order is deterministic and canonical.

A parameter-driven integer `count` is deliberately deferred until Brepia has an integer-safe published-parameter contract. Do not overload the current unconstrained numeric parameter type and round/truncate silently.

## Required value-kind distinction for M3B

Before linear pattern is accepted, shared validation/evaluation must distinguish at least:

```text
single shape
instance set
```

Existing nodes remain single-shape unless explicitly expanded later.

First bounded consumer policy proposed for M3B:

- `linearPattern.input` must be single-shape;
- `resultNodeId` may reference an instance set so independent repeated objects can be authoritative output;
- `subtract.tools` may reference an instance set and deterministically expand its members as cutters;
- `transform`, `fillet`, `mirror`, `subtract.base`, `union`, `intersect` and project-object geometry roles remain single-shape-only in the first collection version;
- unsupported collection-to-single consumers fail canonical validation rather than relying on backend accidents.

This gives immediate support for repeated holes and repeated independent objects without silently broadening every operation to list semantics.

Later M3 work may deliberately add collection-aware transforms or Boolean flattening after native/Rhino semantics are separately specified and tested.

## Evaluated-body identity requirement

The current evaluation contract allows multiple bodies but documents body IDs as feature IDs and requires the first body ID to equal `resultNodeId`.

M3B must define stable evaluated instance identity rather than inventing ad-hoc IDs in the native driver.

The contract analysis must decide and test:

- how instance index is represented;
- how `sourceNodeId` / pattern identity is retained;
- how body IDs remain stable across parameter-only changes;
- how the browser viewer keys/selects multiple result bodies;
- how aggregate project bounds are computed;
- how exact STEP and 3DM represent the repeated result;
- how project-object role restrictions remain unambiguous.

Do not implement a Compound-only shortcut that hides those semantics from the shared evaluation contract.

## Native M3B direction

build123d can represent multiple shapes explicitly and can group assemblies in a `Compound`. It also supports relative copied placement through `moved(Location(...))`.

The native evaluator should maintain explicit instance membership internally and only use a Compound where needed for aggregate tessellation/export. Repeated instances must remain distinguishable at the shared provider/result boundary.

For patterned subtract tools, expand ordered instances into ordinary Boolean tool operations; do not fuse the cutters first merely to make them fit the old single-shape node assumption.

## Rhino / Grasshopper M3B direction

The current GHX result path assumes one Brep and `brepia_place_brep(...)` handles one Brep. M3B must add an explicit list-aware placement/output path for instance-set results.

Linear repetition itself can be compiled from already accepted Rhino translation semantics by duplicating the source Brep and applying deterministic translation transforms for each instance. The new risk is collection/result semantics, not the translation API.

For patterned subtract tools, the compiler can iterate over each generated Brep tool in canonical order.

Installed Rhino 8 / Grasshopper acceptance must verify that an instance-set result:

- appears as all expected repeated Breps;
- responds to spacing changes;
- survives save/close/reopen;
- does not get collapsed into a Boolean union;
- preserves deterministic ordering/identity where observable through the Brepia return boundary.

## M3C candidates after M3B

Only after the instance-set contract is accepted:

- integer-safe published `count` parameters;
- rectangular/grid pattern built from the same explicit instance-set semantics;
- collection-aware transform/mirror if product need justifies it;
- deliberate collection flattening into union where exact-one-body Boolean semantics can still be proven.

These are not part of M3A.

## Permanent boundaries

M3 must preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revision authority;
- build123d/OCCT native geometry authority;
- schemaVersion `1` unless an explicit migration becomes unavoidable;
- canonical scalar depth `12` and expression-node limit `64`;
- provider expression depth `2` and finite/reference-free provider schema;
- M0 parameter-effectiveness/orphan analysis;
- M2 exact-one-body Boolean result policy;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD regressions;
- PR #36 remaining draft, stacked and unmerged.

## Execution order

1. Close M2 — complete.
2. M3A mirror canonical contract and repository implementation — complete / CI accepted.
3. M3A native runtime acceptance — complete.
4. M3A installed Rhino 8 acceptance and explicit closeout — active.
5. M3B instance-set contract analysis before implementation — blocked.
6. M3B linear pattern repository implementation.
7. M3B native + installed Rhino 8 acceptance.
8. Re-evaluate integer count and rectangular pattern as M3C rather than expanding scope implicitly.
