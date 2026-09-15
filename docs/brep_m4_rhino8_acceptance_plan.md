# M4 installed Rhino 8 / Grasshopper acceptance procedure

Status: **ready for host execution**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Purpose

This procedure closes the remaining M4 profile + extrusion acceptance boundary in the real target host. Repository CI and the real local build123d / OCCT runtime are already accepted; this run is specifically for installed Rhino 8 / Grasshopper parity and persistence.

The host run uses three fresh GHX definitions generated deterministically from current canonical `BrepProject` fixtures:

1. rectangle profile extruded on canonical Z;
2. circle profile extruded on canonical X;
3. asymmetric closed-polyline profile extruded on canonical Y.

Together they cover all three M4 profile families and all three fixed canonical profile frames without introducing arbitrary workplanes or M6 rotation.

## 1. Materialize fresh GHX fixtures

From the repository root on the exact branch to be accepted:

```bash
git fetch origin
git switch feature/brep-grasshopper-gh-packaging
git pull --ff-only origin feature/brep-grasshopper-gh-packaging
git rev-parse HEAD
BREPIA_WRITE_M4_RHINO_FIXTURES=1 npx vitest run tests/brepM4RhinoAcceptanceFixtures.test.ts
```

The generator first compiles each definition through the current executable GHX compiler and validates it with the strict generated-GHX gate. It then writes the fixtures under:

```text
test-results/m4-rhino-acceptance/
```

Expected files include:

```text
m4-rectangle-z.ghx
m4-circle-x.ghx
m4-polyline-y.ghx
m4-rectangle-z.brepia-grasshopper.json
m4-circle-x.brepia-grasshopper.json
m4-polyline-y.brepia-grasshopper.json
manifest.json
```

The generated GHX files must all retain Grasshopper Result **Item Access**, not List Access.

## 2. Rectangle / Z acceptance

Open:

```text
m4-rectangle-z.ghx
```

Default canonical values:

```text
Profile width   = 60 mm
Profile height  = 20 mm
Extrusion depth = 30 mm
Axis            = Z
```

Expected default local bounds:

```text
min [-30,-10,-15]
max [ 30, 10, 15]
```

This corresponds to dimensions `60 x 20 x 30 mm`, centered on the local origin.

Acceptance edit:

```text
Profile width:   60 -> 80
Extrusion depth: 30 -> 40
```

Expected edited local bounds:

```text
min [-40,-10,-20]
max [ 40, 10, 20]
```

Confirm:

- definition opens without GH_IO error;
- Python 3 Script solves without runtime error;
- one Brep appears on Result;
- changing either published control recomputes the geometry;
- the result stays centered rather than growing only in +Z;
- Result remains Item semantics.

Save the edited Grasshopper definition as:

```text
m4-rectangle-z-host-saved.ghx
```

Close the Grasshopper document completely, reopen the saved file, and confirm it solves again with values `80` and `40` preserved.

## 3. Circle / X acceptance

Open:

```text
m4-circle-x.ghx
```

Default canonical values:

```text
Radius          = 12 mm
Extrusion depth = 24 mm
Axis            = X
```

Expected default local bounds:

```text
min [-12,-12,-12]
max [ 12, 12, 12]
```

Acceptance edit:

```text
Radius: 12 -> 16
```

Expected edited local bounds:

```text
X [-12,12]
Y [-16,16]
Z [-16,16]
```

Confirm one centered solid Brep, then save as:

```text
m4-circle-x-host-saved.ghx
```

Close and reopen the saved definition and confirm Radius `16` persists and the definition solves again.

## 4. Closed polyline / Y acceptance

Open:

```text
m4-polyline-y.ghx
```

This fixture uses an intentionally asymmetric L-like closed profile so U/V orientation errors are visible.

Canonical mapping for Y extrusion is:

```text
U = Z
V = X
normal = +Y
```

Default values:

```text
Profile reach   = 30 mm
Extrusion depth = 30 mm
Axis            = Y
```

Expected default local bounds:

```text
min [-10,-15,-20]
max [ 30, 15, 20]
```

Acceptance edit:

```text
Profile reach: 30 -> 40
```

Expected edited local bounds:

```text
min [-10,-15,-20]
max [ 40, 15, 20]
```

The profile must extend in +X while the extrusion remains centered on Y. If it extends in Z instead, the canonical Y profile frame is wrong.

Save as:

```text
m4-polyline-y-host-saved.ghx
```

Close and reopen the saved definition and confirm Profile reach `40` persists and the definition solves again.

## 5. Strictly validate Rhino-saved files

Place/copy the three `*-host-saved.ghx` files in one directory. If they are saved directly next to the generated files, run:

```bash
BREPIA_M4_RHINO_SAVED_DIR=test-results/m4-rhino-acceptance npx vitest run tests/brepM4RhinoAcceptanceFixtures.test.ts
```

The returned-mode gate must accept all three files and recover exactly:

```text
m4-rectangle-z-host-saved.ghx -> profileWidth=80, extrudeDepth=40
m4-circle-x-host-saved.ghx    -> radius=16
m4-polyline-y-host-saved.ghx  -> reach=40
```

That validation also proves the Rhino-saved files did not mutate Brepia-owned Python source, input wiring, output access, graph object set or other protected GHX structure.

## Acceptance boundary

M4 installed-host acceptance is complete only when all of the following are true:

- all three fresh GHX definitions open in installed Rhino 8 / Grasshopper;
- all three solve to one Brep with no runtime errors;
- rectangle parameter edits recompute width/depth correctly;
- circle radius edit recomputes correctly;
- asymmetric polyline edit confirms the canonical Y U/V frame;
- extrusion remains centered on its canonical axis;
- every Result remains Item Access / single-Brep semantics;
- all three files survive save -> close -> reopen;
- the strict returned-GHX validator accepts the host-saved files and recovers only the intended parameter changes.

Repository CI alone must not be used as a substitute for this installed-host evidence.

## Preserved boundaries

This host acceptance does not enable or broaden:

- M3C rectangular/grid pattern;
- first-class reusable profile nodes;
- arbitrary profile planes or extrusion vectors;
- holes/multiple loops/open profiles;
- non-zero rotation / M6;
- general collection algebra beyond `single | instanceSet`;
- GHX graph/source edits on return;
- canonical schemaVersion beyond `1`.

PR #36 remains draft, stacked and unmerged.
