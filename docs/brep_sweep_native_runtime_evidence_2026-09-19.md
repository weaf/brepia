# Bounded planar 90-degree circular sweep — pinned native runtime evidence

Date: 2026-09-19

Repository: `weaf/brepia`

Branch: `feature/brep-planar-elbow-sweep`

Implementation checkpoint under test:

```text
246ec56224f96dcdf285769d27a2f00267436336
Implement bounded planar elbow sweep
```

## Evidence separation

This document records **Gate B only**: execution in the pinned native build123d / OCCT runtime plus independent exact STEP re-import.

It does not claim installed Rhino 8 / Grasshopper acceptance and does not claim authenticated AI product-path acceptance.

## Gate A prerequisite

The exact implementation checkpoint above passed the repository Quality Gate before this native evidence was accepted.

```text
Quality Gate run: 35458862909
job:              105938961033
head SHA:         246ec56224f96dcdf285769d27a2f00267436336
result:           SUCCESS
```

The local pre-push Gate A on the same source also passed:

- `npm test`: 241 files / 1371 tests;
- typecheck;
- lint;
- production build;
- browser smoke: 3/3;
- `git diff --check`.

## Runtime

The bounded smoke used the existing sandbox runner:

```text
scripts/brep/sweep-smoke.sh
```

Pinned CAD runtime:

```text
build123d          0.11.1
cadquery-ocp-novtk 7.9.3.1.1
OCCT                pinned through the repository image
image               localhost/brepia-brep:build123d-0.11.1
```

The smoke runs through the normal constrained BRep driver. It does not execute user Python as editable model state.

## Nominal target-E-equivalent fixture

Canonical sweep inputs:

```text
profile: circle
tube diameter:      40 mm
profile radius:     tubeDiameter / 2 = 20 mm
plane normal:       Z
first straight leg: 1000 mm
second straight leg: 700 mm
bend radius:        150 mm
bend angle:         fixed +90 degrees
```

Expected centerline length:

```text
1000 + pi/2 * 150 + 700
= 1935.6194490192345 mm
```

Native execution produced one positive-volume `single` body and exact STEP.

## X / Y / Z parity

The same canonical dimensions were evaluated with each allowed `planeNormalAxis`.

Captured native bounds:

```text
X normal:
min [-20.0000001, 0,           -20.0000001]
max [ 20.0000001, 1170.0000001, 850]

Y normal:
min [-20.0000001, -20.0000001, 0]
max [850,            20.0000001, 1170.0000001]

Z normal:
min [0,           -20.0000001, -20.0000001]
max [1170.0000001, 850,          20.0000001]
```

These are the expected cyclic rotations of the same local U/V/N path and circular section, within kernel export precision.

## Parameter perturbation

### Bend radius

```text
bendRadius: 150 -> 180 mm
```

Result remained one valid solid.

Z-normal bounds changed to:

```text
min [0, -20.0000001, -20.0000001]
max [1200.0000001, 880, 20.0000001]
```

The two straight leg lengths remain unchanged; the larger centerline bend changes the elbow extents as required.

### Tube diameter

```text
tubeDiameter: 40 -> 50 mm
profile radius: 20 -> 25 mm
```

Result remained one valid solid.

Z-normal bounds changed to:

```text
min [0, -25.0000001, -25.0000001]
max [1175.0000001, 850, 25.0000001]
```

The centerline dimensions remain unchanged while the constant circular section grows.

## Fail-closed evidence

The same bounded smoke verifies that native evaluation rejects:

1. `profile.radius >= bendRadius`;
2. a zero `firstLegLength`.

Both cases fail instead of returning repaired, clamped or approximated geometry.

## Exact STEP and independent re-import

The nominal Z-normal exact STEP artifact was independently imported in the pinned build123d/OCP image.

Re-import evidence:

```text
exact STEP solids: 1
centerline length: 1935.6194490192345 mm
volume:            2432371.1364749004 mm^3
bounds:
  min (0.0, -20.0, -20.0000001)
  max (1170.0, 850.0, 20.0000001)
```

Analytic expected volume:

```text
pi * 20^2 * 1935.6194490192345
= approximately 2432371.13647374 mm^3
```

The small difference is ordinary kernel/export floating-point precision. The imported STEP contains exactly one positive-volume solid with the expected bounds.

## Gate B decision

**PASS.**

The locked first-slice sweep contract executes faithfully in the pinned native runtime:

- correct tangent line + quarter-circle + line path;
- constant circular section;
- X/Y/Z parity;
- independent effective bend-radius and section-radius parameters;
- fail-closed invalid dimensions;
- exactly one positive-volume body;
- exact STEP survives independent re-import.

Gate C installed Rhino 8 / Grasshopper acceptance remains separate and pending.
