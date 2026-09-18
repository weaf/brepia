# M3A — mirror status

Status: **complete — repository/CI, native build123d / OCCT runtime, and installed Rhino 8 / Grasshopper runtime accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M3A adds only bounded single-shape mirror symmetry. It does not include linear pattern, instance-set semantics, rectangular pattern, non-zero rotation, profile/extrusion or broader finishing work.

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

M0 reachability follows `mirror.input`. M1 scalar traversal includes `mirror.offset`, so an authoritative mirror-offset parameter is classified as effective and uses the same bounded runtime scalar validation as other millimetre geometry fields.

Permanent scalar limits remain unchanged:

```text
canonical expression depth: 12
canonical expression node limit: 64
provider expression depth: 2
```

## Provider and AI authoring boundary

Both the full canonical Zod schema and the finite/reference-free provider authoring schema expose the same mirror node. Provider-facing `offset` uses the existing depth-2 scalar surface while canonical persistence retains the full M1 bounds.

The Native BRep tool instruction states explicitly that mirror returns only the reflected shape. Requests for `original + mirrored` must use explicit supported composition rather than overloading mirror with collection semantics.

## Native build123d / OCCT mapping

The constrained native evaluator maps mirror to build123d `Shape.mirror(Plane)`.

Canonical axis mapping is orientation-aware:

```text
x -> Plane.YZ -> +X normal
y -> Plane.ZX -> +Y normal
z -> Plane.XY -> +Z normal
```

`Plane.ZX` is deliberately used for canonical Y-normal because build123d's `Plane.XZ` has a `-Y` normal. This preserves the contract that positive canonical offset means positive global coordinate along the named normal axis.

Real native runtime acceptance reproduced the expected non-zero-offset bounds exactly for X/Y/Z while preserving one result body, exact STEP and 3DM artifacts.

Evidence:

```text
docs/brep_m3a_native_runtime_evidence_2026-09-11.md
```

## Rhino 8 / Grasshopper mapping

The active Rhino Python 3 compiler duplicates the input Brep, constructs an explicit canonical mirror plane, applies `Rhino.Geometry.Transform.Mirror(Plane)`, and fails closed if the transform cannot be applied.

Installed-host acceptance verified the orientation-sensitive Y-normal case with a fresh current-branch GHX:

- GHX opened and solved without script/runtime error;
- one reflected Result Brep was produced;
- `MirrorOffset` remained connected to the generated component;
- changing the slider across clearly different values moved the result in Y;
- save -> close -> reopen succeeded;
- after reopening the definition still solved and `MirrorOffset` continued controlling the reflected result.

Evidence:

```text
docs/brep_m3a_rhino8_runtime_evidence_2026-09-11.md
```

## Structural editor

The BRep feature editor exposes `Mirror` with input node, mirror-plane normal axis, scalar plane offset and an explicit note that mirror returns only the reflected input.

## Repository acceptance

Repository candidate:

```text
789188167bc48ad91a579b5aa4bb720ba8cfa8c0
Smoke-test all M3A mirror axis offsets
```

CI on that exact checkpoint:

```text
Quality Gate #897       PASS
Grasshopper Build #469 PASS
```

Quality Gate includes tests, typecheck, lint, production build and `git diff --check`.

## Closeout conclusion

M3A is fully accepted across:

```text
canonical/project validation
-> provider schema / AI authoring
-> structural editor
-> native build123d / OCCT
-> exact STEP / 3DM regression
-> Rhino 8 / Grasshopper open/solve
-> parameter recompute
-> GHX save/close/reopen
```

M3B instance-set / linear-pattern contract analysis is now authorized. M3A itself requires no further implementation work unless a regression is discovered.

## Preserved boundaries

M3A does not change `conversation.type = 'parametric'`, `parametricSourceKind = 'brep'`, canonical immutable revision authority, build123d / OCCT geometry authority, schemaVersion `1`, M0/M1/M2 invariants, provider expression depth `2`, GHX parameter-only return/import, non-zero rotation fail-closed behavior, OpenSCAD behavior, the deferred saved-model clone plan, or PR #36's draft/stacked/unmerged state.
