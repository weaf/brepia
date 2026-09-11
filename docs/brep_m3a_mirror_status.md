# M3A — mirror status

Status: **repository-complete, CI-accepted, native build123d / OCCT runtime-accepted, and installed Rhino 8 / Grasshopper open/solve + parameter-motion accepted; save/close/reopen pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M3A adds only bounded single-shape mirror symmetry. It does not start linear pattern, instance-set semantics, rectangular pattern, non-zero rotation, profile/extrusion or broader finishing work.

Canonical `schemaVersion: 1` remains unchanged.

## Canonical contract

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

- `normalAxis: 'x'` means the YZ mirror plane at `X = offset`;
- `normalAxis: 'y'` means the XZ mirror plane at `Y = offset`;
- `normalAxis: 'z'` means the XY mirror plane at `Z = offset`;
- `offset` uses the existing bounded M1 millimetre scalar contract;
- mirror consumes exactly one ordinary single-shape node reference;
- mirror returns only the reflected input shape;
- it does not implicitly retain the original, form a Boolean union, or create an instance collection.

Ordinary canonical reference and DAG-cycle validation apply to `input`.

## M0 / M1 integration

M0 reachability follows `mirror.input`, so a mirror node participates in authoritative graph analysis exactly like the other single-input feature nodes.

M1 scalar traversal includes `mirror.offset`. A parameter used by an authoritative mirror offset is therefore classified as effective, and runtime override validation uses the same bounded scalar evaluator as other millimetre geometry fields.

The permanent scalar limits remain unchanged:

```text
canonical expression depth: 12
canonical expression node limit: 64
provider expression depth: 2
```

## Provider and AI authoring boundary

Both the full canonical Zod schema and the finite/reference-free provider authoring schema expose the same mirror node. Provider-facing `offset` uses the existing depth-2 scalar surface while canonical persistence retains the full M1 bounds.

The Native BRep tool instruction explicitly states that mirror returns only the reflected shape. Requests for `original + mirrored` must use explicit branches and only a supported composition whose semantics are correct; mirror itself is not a pattern or collection primitive.

## Native build123d / OCCT mapping

The constrained native evaluator maps mirror to build123d `Shape.mirror(Plane)`.

Canonical axis mapping is orientation-aware so a positive canonical offset means a positive global coordinate along the named normal axis:

```text
x -> Plane.YZ -> +X normal
y -> Plane.ZX -> +Y normal
z -> Plane.XY -> +Z normal
```

The use of `Plane.ZX` rather than `Plane.XZ` for the Y-normal backend mapping is deliberate. build123d defines `Plane.XZ` with a `-Y` normal, so applying `offset(+d)` there would place the mirror plane at `Y = -d` and violate the canonical `Y = +offset` contract.

Real native runtime acceptance reproduced all three expected bounds exactly while retaining one result body and successful exact STEP / 3DM artifact checks. Evidence is recorded in:

```text
docs/brep_m3a_native_runtime_evidence_2026-09-11.md
```

## Rhino 8 / Grasshopper mapping

The active Rhino Python 3 compiler duplicates the input Brep, constructs an explicit canonical mirror plane, applies `Rhino.Geometry.Transform.Mirror(Plane)`, and fails closed if the transform cannot be applied.

Installed-host testing has now accepted the orientation-sensitive Y-normal case:

- a fresh generated GHX opened in installed Rhino 8 / Grasshopper;
- the definition solved without script/runtime error;
- `MirrorOffset` remained connected to the generated Brepia component;
- moving the slider across clearly distinct values, including `-20` and `20`, visibly moved the reflected Result Brep along Y;
- the observed direction/change confirms non-zero mirror-offset wiring in the real host.

Partial installed-host evidence is recorded in:

```text
docs/brep_m3a_rhino8_runtime_evidence_2026-09-11.md
```

Only save/close/reopen persistence remains before full M3A closeout.

## Structural editor

The BRep feature editor exposes `Mirror` with input node, normal axis, scalar plane offset and an explicit note that mirror returns only the reflected input.

## Repository acceptance

Repository candidate:

```text
789188167bc48ad91a579b5aa4bb720ba8cfa8c0
Smoke-test all M3A mirror axis offsets
```

GitHub CI on that exact checkpoint:

```text
Quality Gate #897       PASS
Grasshopper Build #469 PASS
```

## Native runtime acceptance

Native build123d / OCCT runtime acceptance is complete. The real local smoke run preserved the complete pre-M3 regression set and produced exact X/Y/Z reflected bounds at non-zero offset.

## Remaining installed-host persistence check

The same accepted GHX must now verify:

```text
save
-> close
-> reopen
-> still solves
-> MirrorOffset remains wired and continues to move the reflected Result Brep
```

M3B instance-set / linear-pattern work must not begin until that persistence check is reconciled and M3A is explicitly closed.

## Preserved boundaries

M3A does not change `conversation.type = 'parametric'`, `parametricSourceKind = 'brep'`, canonical immutable revision authority, build123d / OCCT geometry authority, schemaVersion `1`, M0/M1/M2 invariants, provider expression depth `2`, GHX parameter-only return/import, non-zero rotation fail-closed behavior, OpenSCAD behavior, the deferred saved-model clone plan, or PR #36's draft/stacked/unmerged state.
