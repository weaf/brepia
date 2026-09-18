# M6 installed Rhino 8 / Grasshopper acceptance procedure

Status: **ready for installed-host execution**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Purpose

This procedure is the remaining external acceptance boundary for M6 non-zero canonical transform rotation parity.

Repository/CI and real native build123d / OCCT runtime acceptance are already complete. The installed Rhino 8 / Grasshopper host must now prove that the active executable GHX compiler reproduces the same bounded transform semantics and that Rhino-saved definitions still satisfy Brepia's strict parameter-only returned-GHX boundary.

## Generate fresh fixtures

From the current branch checkout:

```bash
BREPIA_WRITE_M6_RHINO_FIXTURES=1 \
  npx vitest run tests/brepM6RhinoAcceptanceFixtures.test.ts
```

Output directory:

```text
test-results/m6-rhino-acceptance/
```

The generated host files are:

```text
m6-rotate-x90.ghx
m6-rotate-y90.ghx
m6-rotate-z90.ghx
m6-intrinsic-xyz.ghx
```

The same directory also contains each canonical `.brepia-grasshopper.json` contract plus `manifest.json`.

Generated-mode validation must pass before host use. All Result outputs are ordinary Item Access.

## Host fixtures

All fixtures use the same centered asymmetric source box:

```text
width  = 10
 depth  = 20
height = 30
```

This avoids rotational ambiguity from a symmetric cube.

### X 90

Open:

```text
m6-rotate-x90.ghx
```

Expected canonical/native bounds:

```text
[-5,-15,-10] -> [5,15,10]
```

Required host observations:

- definition opens without Grasshopper IO errors;
- Python 3 Script component solves without runtime error;
- one Brep is produced on Result;
- orientation is +90 degrees about local X;
- Result remains Item Access.

Save the host-owned file as:

```text
m6-rotate-x90-host-saved.ghx
```

### Y 90

Open:

```text
m6-rotate-y90.ghx
```

Expected canonical/native bounds:

```text
[-15,-10,-5] -> [15,10,5]
```

Required host observations are the same, with +90 degrees about local Y.

Save as:

```text
m6-rotate-y90-host-saved.ghx
```

### Z 90

Open:

```text
m6-rotate-z90.ghx
```

Expected canonical/native bounds:

```text
[-10,-5,-15] -> [10,5,15]
```

Required host observations are the same, with +90 degrees about local Z.

Save as:

```text
m6-rotate-z90-host-saved.ghx
```

### Intrinsic XYZ + translation

Open:

```text
m6-intrinsic-xyz.ghx
```

Default published values:

```text
Rotate X      = 30
Rotate Y base = 15
```

The canonical transform evaluates:

```text
rx = 30
ry = Rotate Y base + 5 = 20
rz = 10
T  = [7,11,13]
```

with native accepted bounds:

```text
min [-4.38914415,-5.87340299,-5.66971729]
max [18.38914415,27.87340299,31.66971729]
```

Change only:

```text
Rotate X: 30 -> 60
```

Leave:

```text
Rotate Y base = 15
```

The effective edited rotation becomes:

```text
[60,20,10]
```

with translation still:

```text
[7,11,13]
```

Expected edited parity bounds:

```text
min [-4.38914415,-7.50927286,-2.96347740]
max [18.38914415,29.50927286,28.96347740]
```

Required host observations:

- default definition solves as one Brep;
- changing Rotate X from 30 to 60 visibly recomputes the geometry;
- the Y component remains driven by the bounded expression `ryBase + 5` rather than becoming an independent control;
- Result remains Item Access;
- no extra Brepia-owned graph/script/wiring mutation is needed.

Save as:

```text
m6-intrinsic-xyz-host-saved.ghx
```

## Persistence check

After saving the four host files:

1. close the Grasshopper definitions;
2. reopen the host-saved definitions in Rhino 8 / Grasshopper;
3. confirm they solve again without Python/runtime errors;
4. confirm `m6-intrinsic-xyz-host-saved.ghx` reopens with `Rotate X = 60` and `Rotate Y base = 15`.

The exact Rhino save shape is evidence. Do not manually edit the GHX XML.

## Strict returned-GHX validation

Place the four `*-host-saved.ghx` files in:

```text
test-results/m6-rhino-acceptance/
```

Then run:

```bash
BREPIA_M6_RHINO_SAVED_DIR=test-results/m6-rhino-acceptance \
  npx vitest run tests/brepM6RhinoAcceptanceFixtures.test.ts
```

Acceptance requires both tests to pass.

The returned-mode validator must recover exactly:

```text
m6-rotate-x90:     {}
m6-rotate-y90:     {}
m6-rotate-z90:     {}
m6-intrinsic-xyz:  { rx: 60, ryBase: 15 }
```

while retaining:

- the supported built-in Rhino 8 Python 3 component identity;
- the bounded accepted Rhino host-save library-metadata normalization only;
- the original Python source and executable graph boundary;
- original inputs/outputs and type hints;
- Result Item Access;
- parameter-only mutable return semantics.

## Acceptance boundary

M6 may be closed only after:

- X/Y/Z single-axis fixtures solve in installed Rhino 8 / Grasshopper;
- the asymmetric Intrinsic-XYZ + translation fixture solves;
- the degree parameter edit recomputes geometry;
- the expression-backed Y angle remains driven by its published base parameter;
- host save -> close -> reopen succeeds;
- all four host-saved files pass strict returned-GHX validation.

Repository CI is not a substitute for this host evidence.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
