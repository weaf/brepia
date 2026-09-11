# M3A — mirror status

Status: **repository-complete and CI-accepted; native build123d / OCCT runtime and installed Rhino 8 / Grasshopper acceptance pending**

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
x -> Plane.YZ  -> +X normal
 y -> Plane.ZX -> +Y normal
z -> Plane.XY  -> +Z normal
```

The use of `Plane.ZX` rather than `Plane.XZ` for the Y-normal backend mapping is deliberate. build123d defines `Plane.XZ` with a `-Y` normal, so applying `offset(+d)` there would place the mirror plane at `Y = -d` and violate the canonical `Y = +offset` contract. This orientation issue was found during pre-runtime reconciliation and corrected before M3A repository acceptance.

The native smoke fixture covers all three axes with asymmetric translated geometry and numeric expected bounds at `offset = 5 mm`:

```text
x mirror -> X = -30 .. -10
 y mirror -> Y = -25 .. -15
z mirror -> Z = -23 .. -17
```

It also checks exact STEP signature and 3DM header for each mirror case while preserving the existing pre-M3 smoke coverage.

## Rhino 8 / Grasshopper mapping

The active Rhino Python 3 compiler:

1. duplicates the input Brep;
2. constructs an explicit local `Rhino.Geometry.Plane` from the canonical axis and offset;
3. applies `Rhino.Geometry.Transform.Mirror(Plane)`;
4. fails closed if the plane is invalid or the transform cannot be applied.

The version-specific RhinoCommon 8 API documents `Transform.Mirror(Plane)`, available since Rhino 5 and therefore within the Rhino 8 compatibility floor. The permanent upstream-source policy is updated in `docs/references/rhino8_mcneel_sources.md`.

Repository source-generation tests verify the explicit plane, positive-axis normal, duplicate-before-transform behavior and absence of an implicit Boolean union. Installed-host runtime parity remains pending.

## Structural editor

The BRep feature editor exposes `Mirror` as a feature type with:

- input node;
- mirror-plane normal axis;
- explicit axis labels (`X · YZ plane`, `Y · XZ plane`, `Z · XY plane`);
- scalar `Plane offset` in millimetres;
- a visible note that mirror returns only the reflected input.

Existing immutable revision, result-node and structural editing rules remain unchanged.

## Dedicated regression coverage

`tests/brepM3AMirror.test.ts` covers:

- canonical mirror normalization under schemaVersion 1;
- X/Y/Z normal axes;
- invalid-axis rejection;
- missing-reference and cycle rejection;
- millimetre-compatible offset validation;
- runtime parameter override resolution;
- M0 reachability and effective-parameter classification;
- canonical and finite provider schema acceptance;
- Rhino mirror source generation;
- native oriented-plane mapping;
- structural-editor exposure.

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

Quality Gate includes tests, typecheck, lint, production build and `git diff --check`.

The immediately preceding orientation-guard checkpoint also passed:

```text
6fde923a027ddd626cedf72df057788798890a9d
Quality Gate #896       PASS
Grasshopper Build #468 PASS
```

## Remaining runtime acceptance

M3A is not yet runtime-accepted.

Native acceptance next:

```bash
./scripts/brep/smoke-test.sh
```

The expected additional successful mirror lines should report X/Y/Z mirrors with the numeric bounds above.

Installed Rhino 8 / Grasshopper acceptance then requires a fresh current-branch GHX containing a parameter-backed mirror node and should verify:

```text
Brepia export
-> GHX open
-> solve without script/runtime error
-> one Result Brep
-> change mirror offset parameter
-> geometry reflects around the new plane position
-> save
-> close
-> reopen
-> still solves with the same parameter wiring
```

At least two axis/offset states should be visually or numerically distinguishable so a zero-plane-only success cannot hide an offset-sign mismatch.

M3B instance-set / linear-pattern work must not begin until M3A native and installed-host evidence is reconciled and M3A is explicitly closed.

## Preserved boundaries

M3A does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revision authority;
- build123d / OCCT native geometry authority;
- schemaVersion `1`;
- M0 graph/parameter integrity policy;
- M1 scalar depth/node bounds;
- provider expression depth `2` or finite/reference-free schema policy;
- M2 exact-one-body Boolean result semantics;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- deferred saved-model clone plan;
- PR #36 remaining draft, stacked and unmerged.
