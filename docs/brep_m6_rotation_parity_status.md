# M6 non-zero transform rotation parity status

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M6 closes the existing cross-runtime mismatch for the already-present canonical transform field:

```ts
type BrepTransformNode = {
  id: string;
  type: 'transform';
  input: string;
  translate?: BrepVector3;
  rotateDeg?: BrepVector3;
};
```

No new node family or schema version was introduced. M5 shell/thickness and optional M3C rectangular/grid pattern remain deferred pending a new post-M6 scope decision.

## Canonical rotation convention

`rotateDeg = [rx, ry, rz]` uses the existing bounded M1 degree-scalar contract. Components may be literals, published degree-parameter references or bounded degree-compatible M1 expressions.

The canonical/native convention is pinned to build123d 0.11.1 / OCCT `Location(translation, rotation)` behavior:

```text
Intrinsic XYZ
R = Rx * Ry * Rz
p' = R * p + T
```

Geometry rotates around the canonical local origin first and is translated afterward. Positive X/Y/Z angles follow the right-hand convention.

## RhinoCommon parity

The Rhino 8 Python 3 compiler emits origin-centered axis rotations and composes:

```text
Rotation  = RotationX * RotationY * RotationZ
Transform = Translation * Rotation
```

RhinoCommon transform multiplication applies the right-hand operand first, preserving the native `p' = R*p + T` semantics.

Zero rotation uses the same composed path; translation-only nodes are no longer a separate compiler special case.

## Cardinality and authority preserved

M6 does not broaden collection semantics:

- transform input remains single-shape only;
- transform output remains `single`;
- `instanceSet` input remains unsupported;
- M3B final pattern List Access remains unchanged;
- M6 Result remains ordinary Grasshopper Item Access.

Canonical BRep + immutable revisions remain authoritative. build123d/OCCT remains the native geometry authority. Rhino/GHX remains an interoperability compiler and the returned GHX boundary remains parameter-only.

## AI/provider/editor behavior

No provider schema or editor node family was added because `rotateDeg` already existed in the canonical authoring surface.

The Native BRep instruction now teaches the exact M6 contract:

```text
Intrinsic XYZ
right-hand positive angles
rotate local geometry first
then translate
p' = R_intrinsicXYZ * p + T
```

Axis-angle, quaternion, free-form matrix and alternate yaw/pitch/roll representations remain outside the canonical contract.

## Repository / CI acceptance

Dedicated repository coverage includes:

```text
tests/brepM6RotationParity.test.ts
tests/brepM6NativeRotation.test.ts
tests/brepM6RhinoAcceptanceFixtures.test.ts
```

Coverage includes:

- +90 degree X/Y/Z rotations;
- asymmetric `[30,20,10]` Intrinsic XYZ rotation;
- translation `[7,11,13]` composed after rotation;
- direct degree parameters;
- bounded expression-backed degree values;
- zero rotation through the same transform path;
- executable GHX validation;
- Result Item Access;
- strict returned-GHX validation for Rhino-saved fixtures.

The first complete M6 code candidate was:

```text
3fd9c38910baac956e1a67b710bcc41f31b3b0e0
Lock native M6 rotation smoke contract
```

with:

```text
Quality Gate #990       PASS
Grasshopper Build #562 PASS
```

The subsequent repository-status checkpoint used for native runtime acceptance was:

```text
ecfd9fea3209281e00ab9d31752087d3315bfea3
Record M6 rotation parity repository status
```

with:

```text
Quality Gate #991       PASS
Grasshopper Build #563 PASS
```

The M6 Rhino acceptance fixture checkpoint:

```text
b69e2723308055a736442494d9b2b823c711bf20
```

passed:

```text
Quality Gate #994       PASS
Grasshopper Build #566 PASS
```

## Native runtime acceptance

The full native smoke suite was executed against the real pinned local runtime:

```text
localhost/brepia-brep:build123d-0.11.1
```

using:

```bash
./scripts/brep/smoke-test.sh
```

The complete suite was reported green.

Accepted single-axis bounds:

```text
X 90: [-5,-15,-10] -> [5,15,10]
Y 90: [-15,-10,-5] -> [15,10,5]
Z 90: [-10,-5,-15] -> [10,5,15]
```

Accepted order-sensitive dynamic fixture:

```text
rx = 30
ry = ryBase + 5 = 20
rz = 10
T  = [7,11,13]

min [-4.38914415,-5.87340299,-5.66971729]
max [18.38914415,27.87340299,31.66971729]
```

The result remained one `single` body and exact STEP remained available. Because M6 runs inside the normal full smoke suite, the same run preserved existing M0-M4 native regressions.

Detailed native evidence:

```text
docs/brep_m6_native_runtime_evidence_2026-09-11.md
```

## Installed Rhino 8 / Grasshopper acceptance

Fresh current-compiler GHX fixtures covered:

```text
m6-rotate-x90.ghx
m6-rotate-y90.ghx
m6-rotate-z90.ghx
m6-intrinsic-xyz.ghx
```

The first three cover positive 90-degree rotation around each canonical axis using an asymmetric 10 x 20 x 30 source box.

The asymmetric multi-axis fixture uses:

```text
rx = 30
ry = ryBase + 5 = 20
rz = 10
T  = [7,11,13]
```

and the host acceptance edit changes only:

```text
Rotate X: 30 -> 60
```

while `Rotate Y base` remains 15, proving the Y angle continues to be driven by the bounded expression `ryBase + 5`.

The four Rhino-saved files were then checked through the strict returned-GHX validator:

```bash
BREPIA_M6_RHINO_SAVED_DIR=test-results/m6-rhino-acceptance \
  npx vitest run tests/brepM6RhinoAcceptanceFixtures.test.ts
```

Observed result:

```text
✓ tests/brepM6RhinoAcceptanceFixtures.test.ts (2 tests) 30ms
  ✓ compiles and strictly validates fresh Item-access GHX fixtures 24ms
  ✓ strictly validates Rhino-saved parameter-only acceptance files when requested 6ms

Test Files  1 passed (1)
Tests       2 passed (2)
```

Returned-mode recovery is constrained to:

```text
m6-rotate-x90:    {}
m6-rotate-y90:    {}
m6-rotate-z90:    {}
m6-intrinsic-xyz: { rx: 60, ryBase: 15 }
```

while preserving the built-in Rhino Python 3 identity, Python source, component/port identities, type hints, graph/wiring, Result Item Access and the previously bounded Rhino host-save library-metadata normalization.

Detailed installed-host evidence:

```text
docs/brep_m6_rhino8_runtime_evidence_2026-09-11.md
```

## Closeout

M6 is complete across all required boundaries:

- canonical/runtime semantics locked;
- repository regression coverage green;
- full Quality Gate green;
- Grasshopper build/package gate green;
- real build123d/OCCT native runtime accepted;
- installed Rhino 8 / Grasshopper runtime accepted;
- parameter and bounded-expression behavior exercised;
- save/close/reopen + strict returned-GHX path accepted;
- Result remains `single` / Item Access.

No M5, M3C or broader collection/topology scope was introduced by M6.

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
- M3B `single | instanceSet` cardinality and collection consumers;
- M4 profile/extrusion semantics;
- GHX parameter-only return/import boundary;
- OpenSCAD behavior;
- C4 image projection deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
