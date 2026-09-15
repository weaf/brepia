# M3D native build123d / OCCT runtime evidence — 2026-09-12

Status: **accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Runtime-accepted implementation checkpoint:

```text
05c5c8d757ff9f039479983df5e0221aed0f30e6
Fix M3D pinned STEP verifier
```

The implementation tree at that checkpoint had already passed repository CI separately:

```text
Quality Gate #1066       PASS
Grasshopper Build #638  PASS
```

Repository CI is not treated as native runtime evidence. The acceptance below was performed separately through the real pinned local BRep runtime.

## Runtime stack

The smoke uses the pinned sandbox image:

```text
localhost/brepia-brep:build123d-0.11.1
```

The independent STEP verifier, executed inside that same pinned CAD image, reported:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
```

The verifier rejects any other values before importing the generated STEP artifact.

## Runtime command

The M3D smoke was run from the repository root through:

```bash
./scripts/brep/m3d-circular-pattern-smoke.sh
```

The script uses `set -euo pipefail`. The reported completed run therefore includes all explicit geometry, identity, export, STEP-import and fail-close assertions in the script.

## Observed output

```text
{"result":"pattern","resultKind":"instanceSet","count":6,"ids":["pattern::0","pattern::1","pattern::2","pattern::3","pattern::4","pattern::5"],"center":[5,-10],"rightHandStepDeg":60,"exactStep":true}
{"override":{"radius":40,"angleStepDeg":45},"seedCenterShift":[10,0],"instance1":[17.72792206135786,26.76955262170047],"exactStep":true}
{"patternTool":"cutters","count":6,"result":"cut","resultKind":"single","triangles":3060,"exactStep":true}
{'build123d': '0.11.1', 'cadqueryOcpNovtk': '7.9.3.1.1', 'exactStepSolids': 1, 'cylindricalHoleFaces': 6}
```

## Final circular-pattern acceptance

The final-result fixture proves the bounded canonical circular/polar-pattern contract in the real build123d / OCCT evaluator:

- `resultNodeId = pattern`;
- `resultKind = instanceSet`;
- exactly six independent result bodies;
- stable identities `pattern::0` through `pattern::5` in strict index order;
- each instance retains `nodeId = pattern`, the matching `instance.index`, and `instance.sourceNodeId = seedAt`;
- instance `0` is the unchanged source instance;
- positive `60 deg` steps use the right-hand direction about canonical +Z;
- the rotation center is deliberately non-origin at `[5, -10, 0]`;
- the asymmetric seed geometry is rigidly rotated so position and orientation travel together;
- all emitted bodies have non-empty viewer meshes;
- exact STEP export is available;
- a readable 3DM artifact is also required by the smoke before the result is accepted.

The position assertions are derived from the actual evaluated body bounds and compared against the right-hand rotation equation around the non-origin center rather than only checking planned parameter values.

## Runtime parameter perturbation

The second evaluation changes both bounded published controls:

```text
radius:       30 -> 40 mm
angleStepDeg: 60 -> 45 deg
```

The accepted output proves:

- the seed center moves by exactly `[10, 0]` from the radius change;
- circular instance `1` is recomputed at the +45 degree right-hand position;
- its observed center is `[17.72792206135786, 26.76955262170047]`;
- that position differs from the default +60 degree evaluation;
- all six instances remain present;
- exact STEP export remains available.

This exercises both a translational seed-radius parameter and the M3D `angleStepDeg` parameter through the real native evaluator.

## Circular pattern as subtract tools

The cutter fixture proves the intended existing `instanceSet` consumption boundary:

```text
subtract.tools = [cutters]
```

where `cutters` is a six-instance circular pattern around the deliberately non-origin center `[50, 50, 0]`.

The accepted runtime result confirms:

- the circular pattern expands through the native ordered cutter path;
- final `resultNodeId = cut`;
- final `resultKind = single`;
- exactly one final result body is emitted;
- the final viewer mesh contains 3060 triangles in this run;
- exact STEP export remains available.

No implicit union or generic collection algebra is introduced. The `instanceSet` remains consumable only through `subtract.tools[]`.

## Independent exact STEP import

The emitted cutter STEP artifact is then mounted read-only into the same pinned CAD image and imported independently with build123d `import_step`.

The verifier explicitly checks the runtime package versions before import and reported:

```text
exactStepSolids = 1
cylindricalHoleFaces = 6
```

This proves the exported exact STEP independently re-imports as one solid with six cylindrical hole faces. The assertion is geometric/topological and is not inferred from the viewer mesh.

## Fail-close boundary

The same completed smoke also exercises two invalid runtime overrides after the visible STEP-import output:

- `angleStepDeg = 0` must fail with `angleStepDeg must resolve to a non-zero degree value`;
- `angleStepDeg = 61` with `count = 6` must fail because `abs(angleStepDeg) * count = 366 > 360`.

The script treats either unexpected success, or failure to produce the expected bounded validation message, as a non-zero smoke failure. Completion therefore preserves the locked M3D contract:

```text
0 < abs(angleStepDeg) * count <= 360
```

with exact `360` still permitted and values beyond one turn rejected.

## Preserved authority and semantics

This runtime acceptance does not change:

- canonical `schemaVersion: 1`;
- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep plus immutable revision authority;
- build123d / OCCT as geometry authority;
- Rhino/GHX as interoperability compiler only;
- M0 parameter-effectiveness policy;
- M1 canonical scalar depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- M3 `single | instanceSet` result kinds;
- only `subtract.tools[]` may consume an `instanceSet`;
- no nested patterns, generic collection algebra or implicit union;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ rotation semantics `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import boundary;
- OpenSCAD behavior;
- C4 image projection deferral.

## Conclusion

M3D native build123d / OCCT runtime acceptance is **complete** for the bounded circular-pattern scope.

Installed Rhino 8 / Grasshopper acceptance remains a separate external evidence layer and is not claimed by this document. It must separately prove current-compiler final List behavior, circular cutters with final Item behavior, parameter perturbation, save -> close -> reopen persistence, and strict parameter-only returned-GHX validation.

Repository CI, native build123d / OCCT runtime evidence and installed Rhino 8 / Grasshopper host evidence remain deliberately separate.

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
