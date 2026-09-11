# M6 non-zero transform rotation parity status

Status: **repository-complete / CI-accepted / native-runtime-accepted; installed Rhino 8 / Grasshopper acceptance pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope decision

M6 was selected as the next modeling slice after M4 closeout because non-zero rotation is an existing cross-runtime parity gap rather than a new modeling abstraction.

Decision record:

```text
docs/brep_post_m4_scope_decision_2026-09-11.md
```

M5 shell/thickness and optional M3C rectangular/grid pattern remain deferred.

M6 does not add a new canonical node or change `schemaVersion: 1`. It completes Rhino/GHX support for the already-existing canonical transform field:

```ts
type BrepTransformNode = {
  id: string;
  type: 'transform';
  input: string;
  translate?: BrepVector3;
  rotateDeg?: BrepVector3;
};
```

## Canonical rotation convention

`rotateDeg = [rx, ry, rz]` retains the existing bounded M1 degree-scalar vector. Each component may be:

- a finite degree literal;
- a direct published degree-parameter reference;
- a bounded M1 scalar expression with degree-compatible unit algebra.

The rotation convention is pinned to the native build123d 0.11.1 / OCCT behavior already used by `scripts/brep/brep_driver.py`:

```text
Location(translation, rotation)
```

The orientation tuple is interpreted as **Intrinsic XYZ**. In matrix form for local column-vector geometry:

```text
R = Rx * Ry * Rz
p' = R * p + T
```

The geometry is therefore rotated around the canonical local origin first and translated afterward.

Positive X/Y/Z angles use the normal right-hand axis-rotation convention. M6 does not introduce axis-angle, quaternion, free-form matrix or arbitrary transform representations.

## RhinoCommon parity mapping

The active Rhino 8 Python 3 compiler now emits three origin-centered axis rotations:

```text
RotationX = Transform.Rotation(rx, XAxis, Origin)
RotationY = Transform.Rotation(ry, YAxis, Origin)
RotationZ = Transform.Rotation(rz, ZAxis, Origin)
```

and composes them as:

```text
Rotation   = RotationX * RotationY * RotationZ
Translation = Transform.Translation(...)
Transform  = Translation * Rotation
```

RhinoCommon transform multiplication applies the right-hand operand first, so `Translation * Rotation` preserves the native `p' = R*p + T` behavior.

The same path is used for zero rotation. Translation-only transform nodes therefore no longer use a separate special-case translation implementation in the Rhino compiler.

## Existing canonical boundaries preserved

M6 does not broaden transform result cardinality:

- transform input remains single-shape only;
- transform output remains `single`;
- `instanceSet` input remains unsupported;
- M3B Result List Access behavior is unchanged;
- M6 Result remains ordinary Grasshopper Item Access.

Project placement still runs as the already-accepted outer project placement transform after canonical graph evaluation. M6 concerns the local canonical transform-node semantics only.

## AI/provider/editor behavior

No provider schema or editor node family was added because `rotateDeg` already existed throughout the canonical authoring surface.

The Native BRep agent instruction was updated to stop treating non-zero rotation as forbidden and instead teach the exact M6 contract:

```text
Intrinsic XYZ
right-hand positive angles
rotate local geometry first
then translate
p' = R_intrinsicXYZ * p + T
```

It also explicitly prohibits inventing extrinsic/yaw-pitch-roll strings, axis-angle, quaternion or matrix representations.

Existing UI scalar fields continue to preserve literal, parameter-backed and expression-backed degree values.

## Repository tests

Dedicated M6 repository coverage includes:

```text
tests/brepM6RotationParity.test.ts
tests/brepM6NativeRotation.test.ts
```

The Rhino parity test covers:

- 90-degree X rotation;
- 90-degree Y rotation;
- 90-degree Z rotation;
- asymmetric multi-axis `[30,20,10]` rotation;
- translation `[7,11,13]` combined with that rotation;
- direct degree parameters;
- bounded M1 expression-backed degree values;
- zero rotation through the same composed path;
- generated executable GHX validation;
- ordinary Result Item Access.

Existing Grasshopper tests were reconciled so they continue to prove their original invariants under the unified transform path:

- complex graph / subtract cutter ordering;
- product GHX export;
- Rhino Python source shape;
- rotation-expression boundary behavior, now positive M6 parity rather than legacy rejection.

The stale tests were not removed or weakened into generic smoke assertions. Cutter identity/order, generated-GHX validation, script transform composition and expression preservation remain explicit.

## Native runtime acceptance

The full native smoke suite was executed locally on the exact branch checkpoint:

```text
ecfd9fea3209281e00ab9d31752087d3315bfea3
Record M6 rotation parity repository status
```

against the pinned runtime:

```text
localhost/brepia-brep:build123d-0.11.1
```

using:

```bash
./scripts/brep/smoke-test.sh
```

The complete suite was reported green.

Accepted M6 runtime assertions include:

```text
X 90:
[-5,-15,-10] -> [5,15,10]

Y 90:
[-15,-10,-5] -> [15,10,5]

Z 90:
[-10,-5,-15] -> [10,5,15]
```

and the order-sensitive dynamic fixture:

```text
rx = 30
ry = ryBase + 5 = 20
rz = 10
T  = [7,11,13]

min [-4.38914415,-5.87340299,-5.66971729]
max [18.38914415,27.87340299,31.66971729]
```

The result remained one `single` body and exact STEP remained available. Because M6 runs inside the normal full smoke suite, the same accepted run also preserved the existing M0-M4 native regressions.

Detailed evidence:

```text
docs/brep_m6_native_runtime_evidence_2026-09-11.md
```

This closes the authoritative native side of M6. Installed Rhino 8 / Grasshopper parity remains a separate required acceptance boundary.

## Repository acceptance checkpoint

The first complete M6 repository candidate with the Rhino compiler, AI semantics, stale-regression reconciliation, native smoke and native source lock is:

```text
3fd9c38910baac956e1a67b710bcc41f31b3b0e0
Lock native M6 rotation smoke contract
```

CI on that exact checkpoint:

```text
Quality Gate #990       PASS
Grasshopper Build #562 PASS
```

The subsequent documentation checkpoint actually used for the accepted native smoke is:

```text
ecfd9fea3209281e00ab9d31752087d3315bfea3
Record M6 rotation parity repository status
```

and it also passed:

```text
Quality Gate #991       PASS
Grasshopper Build #563 PASS
```

Scope diff from the M6-active baseline `7e1890765f1532ade047b9cb39bef98d84fab463` was 13 commits ahead / 0 behind at the code-complete checkpoint and contained only:

- M6 Rhino transform translation;
- M6 AI instruction semantics;
- M6 native smoke;
- M6 dedicated tests;
- reconciliation of tests whose expectations encoded the old translation-only / non-zero-rotation-rejected behavior.

No M5, M3C, canonical schema or collection-policy scope was introduced.

## Remaining acceptance sequence

Only the installed Rhino 8 / Grasshopper boundary remains before M6 can be called complete.

Generate fresh current-branch GHX and verify at minimum:

1. X/Y/Z single-axis rotation coverage;
2. the asymmetric multi-axis rotation with translation;
3. a published degree parameter changes solved geometry;
4. a bounded expression-backed angle remains correctly driven by its published inputs;
5. Result remains one Brep / Item Access;
6. save -> close -> reopen preserves the solved definition;
7. the Rhino-saved file passes the strict parameter-only returned-GHX validator, including the already-accepted bounded Rhino Python-library metadata normalization.

Record installed-host evidence separately, following the M3/M4 precedent.

## Preserved boundaries

M6 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter/graph integrity;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 / finite reference-free schema;
- M2 exact-one-body Boolean semantics;
- M3B `single | instanceSet` cardinality or collection consumers;
- M4 profile/extrusion semantics;
- GHX parameter-only return/import boundary;
- OpenSCAD behavior;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M3C rectangular/grid-pattern deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
