# Bounded multi-loop profile extrusion — native runtime evidence

Status: **Gate B accepted — real pinned build123d / OCCT runtime and independent exact STEP re-import passed**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Scope

This document records Gate B only for the bounded multi-loop profile extrusion slice defined by:

```text
docs/brep_multiloop_profile_extrusion_implementation_boundary_2026-09-12.md
```

Repository / CI Gate A was already accepted separately. Installed Rhino 8 / Grasshopper Gate C remains separate and is not implied by this native result.

## Runtime harness

The accepted run used the repository harness:

```bash
bash scripts/brep/multiloop-extrude-smoke.sh
```

The harness exercises one ordinary `extrude` result with:

- one rectangle outer loop;
- one circular inner hole;
- one non-circular closedPolyline inner hole;
- expression-backed local hole placement;
- effective parameter perturbation;
- exact STEP emission;
- independent STEP re-import inside the pinned CAD image.

Canonical invalid-loop and runtime-override fail-closed behavior remains covered separately at the shared/server boundary before native execution.

## Default runtime result

The real pinned runtime produced:

```text
{"fixture":"multi-loop-default","bounds":{"min":[-50,-35,-4],"max":[50,35,4]},"resultKind":"single","exactStep":true}
```

Accepted observations:

- result kind is exactly `single`;
- outer bounds are exactly `[-50,-35,-4] -> [50,35,4]`;
- exact STEP is available;
- the multi-loop profile therefore executes through the native build123d / OCCT path without expanding result cardinality.

## Parameter perturbation

The runtime override was:

```text
width=120
margin=40
holeRadius=9
```

The resulting native output was:

```text
{"fixture":"multi-loop-override","override":{"width":120,"margin":40,"holeRadius":9},"bounds":{"min":[-60,-35,-4],"max":[60,35,4]}}
```

This verifies that the effective runtime values propagate through:

- the outer profile width;
- the expression-backed circular-hole placement;
- the circular-hole radius;
- the same bounded single-solid extrusion path.

The expected outer bounds change from X `[-50,50]` to `[-60,60]` while Y/Z remain unchanged.

## Independent exact STEP verification

The emitted exact STEP was re-imported independently in the pinned CAD image. The verifier reported:

```text
{'build123d': '0.11.1', 'cadqueryOcpNovtk': '7.9.3.1.1', 'exactStepSolids': 1, 'volume': 64524.24796047347, 'bounds': (-60.0, -35.0, -4.0, 60.0, 35.0, 4.0)}
```

The accepted kernel/runtime identity is therefore:

```text
build123d             0.11.1
cadquery-ocp-novtk    7.9.3.1.1
exact STEP solids     1
```

The independently imported STEP bounds exactly match the perturbed native result:

```text
(-60,-35,-4) -> (60,35,4)
```

The imported volume is positive and matches the analytical multi-loop volume locked by the harness:

```text
outer plate:        120 * 70 * 8
circle hole:        pi * 9^2 * 8
polyline hole:      10 * 8 * 8

expected volume = 120*70*8 - pi*9^2*8 - 10*8*8
                = 64524.24796047347 mm^3
```

This is materially stronger than checking outer bounds alone: the exact imported volume proves that both inner openings are present in the exported BRep instead of being silently lost while preserving the same envelope.

## Gate B acceptance

Gate B requirements are satisfied:

- real pinned build123d / OCCT execution — **PASS**;
- valid multi-hole geometry — **PASS**;
- expression-backed placement — **PASS**;
- parameter perturbation — **PASS**;
- result cardinality exactly one solid — **PASS**;
- positive imported volume — **PASS**;
- exact STEP output — **PASS**;
- independent STEP re-import — **PASS**;
- exact imported bounds — **PASS**;
- analytical hole-preserving volume — **PASS**;
- pinned runtime versions — **PASS**.

## Evidence boundary

This evidence closes only the native Gate B layer.

It does not claim installed Rhino 8 / Grasshopper acceptance. Gate C still requires:

1. fresh current-compiler GHX open/solve;
2. visible circular and non-circular holes;
3. parameter perturbation including expression-backed hole movement;
4. save -> close -> reopen;
5. successful re-solve;
6. strict returned-GHX parameter-only validation.

The status document must therefore remain:

```text
Gate A repository / CI                  COMPLETE
Gate B pinned native build123d / OCCT   COMPLETE
Gate C installed Rhino 8 / Grasshopper  PENDING RUNTIME
```
