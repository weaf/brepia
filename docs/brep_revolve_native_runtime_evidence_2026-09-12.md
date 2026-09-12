# Bounded full revolve — pinned native runtime evidence

Status: **Gate B accepted — real pinned rootless build123d / OCCT runtime PASS**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Evidence boundary

This document records only the native-runtime acceptance layer for the bounded full-revolve slice.

It does not claim installed Rhino 8 / Grasshopper acceptance. Gate C remains separate and pending.

Repository implementation was already accepted before this runtime gate at:

```text
ed4e0312254ef42e051fb8ce850c92c9f091d919
Add bounded revolve native translation and parity tests
Quality Gate #1077       PASS
Grasshopper Build #649   PASS
```

The repository/runtime-harness/status checkpoint before Gate B was:

```text
cc9470c5e69e2cd972f65d8f13ac0a0a8882857e
Quality Gate #1079       PASS
Grasshopper Build #651   PASS
```

A temporary one-shot native runner was added only to execute the pinned rootless environment:

```text
82de6ec07713d5d0d429f7cad4ff303047c51b76
Add one-shot revolve native Gate B runner
```

The native execution itself is GitHub Actions run:

```text
Revolve Native Gate B #1
run id 34713678232
job: pinned rootless build123d/OCCT revolve
conclusion: success
```

## Runtime environment

The one-shot Gate B job ran on Ubuntu 24.04.5 and explicitly verified:

```text
podman version 4.9.3
rootless=true
```

The CAD image was built from the repository `scripts/brep/Containerfile` and the build log verified exact versions:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
OCP=7.9.3.1
rhino3dm=8.32.1
```

The resulting local image was:

```text
localhost/brepia-brep:build123d-0.11.1
image id: 8b121d1c05d0ecee862f38bf62e42d67541da32c61ce9857458c27bda0a478c1
```

Runtime evaluation used the existing constrained `pcad-brep-sandbox` boundary, including rootless Podman, no network, read-only container filesystem, `no-new-privileges`, dropped capabilities, bounded pids/memory/cpu, `userns=keep-id`, tmpfs and explicit read-only input/driver mounts.

## Executed acceptance harness

The exact harness executed was:

```text
scripts/brep/revolve-smoke.sh
```

The harness exercised the locked Gate B fixtures rather than a cylinder-equivalent smoke.

## R1 — stepped bushing / turned part

A full revolve around canonical X used the locked stepped closed-polyline profile with inner radius 8, end outer radius 16 and center outer radius 13.

Observed native result:

```json
{"fixture":"stepped-bushing","bounds":{"min":[-30,-16,-16],"max":[30,16,16]},"resultKind":"single","exactStep":true}
```

Acceptance:

- evaluation succeeded;
- `resultKind` was `single`;
- exactly one body was returned;
- bounds matched the expected turned geometry;
- exact STEP was available;
- 3DM generation also completed.

This fixture is not reducible to a single cylinder primitive.

## R2 — parameterized radial + axial dimensions

The parameterized Z-axis fixture used:

```text
outerRadius default 18 mm
length      default 40 mm
```

with existing M1 expressions deriving `-length/2` and `+length/2`.

The runtime override was:

```text
outerRadius 18 -> 22 mm
length      40 -> 52 mm
```

The default bounds were checked by the harness as:

```text
[-18,-18,-20] -> [18,18,20]
```

Observed override result:

```json
{"fixture":"parameterized","override":{"outerRadius":22,"length":52},"bounds":{"min":[-22,-22,-26],"max":[22,22,26]}}
```

Acceptance:

- radial perturbation changed X/Y radial extent from 18 to 22;
- axial perturbation changed Z half-length from 20 to 26;
- exactly one solid remained authoritative;
- exact STEP remained available.

This closes the Gate B requirement that both one published radial dimension and one published axial dimension affect authoritative native geometry.

## R3 — valid axis-adjacent profile

The Y-axis fixture contains a real non-zero boundary segment on `v=0` and otherwise remains in non-negative radial space.

Observed result:

```json
{"fixture":"axis-adjacent","bounds":{"min":[-12,-20,-12],"max":[12,20,12]}}
```

Acceptance:

- the bounded axis-contact case was accepted;
- one valid single result was produced;
- observed bounds match the locked Y-axis frame mapping.

## R4 — invalid axis crossing

The explicit invalid fixture contains negative radial values and therefore crosses the canonical rotation axis.

The harness required native execution to fail and then required stderr to contain:

```text
must keep radial v >= 0 and must not cross the rotation axis
```

The full smoke completed successfully, proving that the invalid fixture did fail closed as required. A successful geometry result for this fixture would have caused the Gate B run to fail.

## Exact STEP independent re-import

The exact STEP emitted by the parameterized override fixture was mounted read-only into a fresh invocation of the same pinned CAD image and imported independently with `build123d.import_step`.

Observed independent import evidence:

```text
build123d:             0.11.1
cadquery-ocp-novtk:    7.9.3.1.1
exactStepSolids:       1
volume:                68612.38355440038
bounds:                (-22.0, -22.0, -26.0, 22.0, 22.0, 26.0)
```

Acceptance:

- exactly one imported solid;
- positive volume;
- deterministic bounds equal to the authoritative runtime result;
- exact pinned CAD versions re-verified inside the independent import process.

## Gate B conclusion

Gate B is accepted.

The bounded full-revolve implementation is now complete across:

1. repository implementation / CI; and
2. real pinned rootless build123d / OCCT native runtime.

The native evidence confirms:

- the locked U/V-to-X/Y/Z frame semantics execute correctly for the tested product-like fixtures;
- full revolve returns one authoritative solid;
- radial and axial M1-backed parameters affect native geometry;
- supported axis contact succeeds;
- unsupported negative-radial axis crossing fails closed;
- exact STEP is generated and independently re-imports as one positive-volume solid with expected bounds.

This does **not** complete the revolve slice across all evidence layers.

## Next gate

Gate C remains pending and must be recorded separately:

- generate fresh current-compiler GHX;
- open/solve in installed Rhino 8 / Grasshopper;
- verify the stepped/turned geometry;
- perturb the bounded radial and axial parameters;
- verify recomputation;
- save -> close -> reopen;
- verify persisted values and solve state;
- validate the host-saved returned GHX through the strict parameter-only validator.

Only after Gate C succeeds may bounded full revolve be described as complete across repository, native runtime and installed Rhino 8 / Grasshopper runtime.
