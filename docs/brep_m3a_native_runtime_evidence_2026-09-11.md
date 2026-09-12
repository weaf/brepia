# M3A native runtime evidence — 2026-09-11

Status: **accepted — real build123d / OCCT native runtime**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Repository implementation checkpoint:

```text
789188167bc48ad91a579b5aa4bb720ba8cfa8c0
Smoke-test all M3A mirror axis offsets
```

Repository CI on that exact checkpoint:

```text
Quality Gate #897       PASS
Grasshopper Build #469 PASS
```

## Runtime command

The user executed the real local native smoke suite on the current M3A branch:

```bash
./scripts/brep/smoke-test.sh
```

The run completed successfully and emitted:

```text
{"result":"cut","triangles":732,"roles":["footprint","clearanceEnvelope","maintenanceEnvelope"],"point":{"id":"cableEntry","kind":"cable","position":[50,10,0],"direction":[0,0,1],"label":"Cable entry"},"artifacts":["model.step","brepia-footprint.step","brepia-clearance-envelope.step","brepia-maintenance-envelope.step","model.3dm"]}
{"boolean":"union","result":"booleanResult","triangles":12}
{"boolean":"intersect","result":"booleanResult","triangles":12}
{"mirror":"x","offset":5,"result":"mirrored","bounds":{"min":[-30,25,27],"max":[-10,35,33]},"triangles":12}
{"mirror":"y","offset":5,"result":"mirrored","bounds":{"min":[20,-25,27],"max":[40,-15,33]},"triangles":12}
{"mirror":"z","offset":5,"result":"mirrored","bounds":{"min":[20,25,-23],"max":[40,35,-17]},"triangles":12}
```

## Interpretation

This accepts the M3A native mapping in the real constrained build123d / OCCT runtime.

The pre-M3 regressions remain green:

- primitive / transform / subtract / fillet evaluation;
- project-object roles and semantic point handling;
- exact STEP export;
- 3DM export;
- M2 union / intersect success paths;
- M2 fail-closed disjoint Boolean paths, which remain silent on success in the smoke script.

The mirror fixtures prove more than successful API invocation. They use asymmetric translated geometry and verify the expected reflected bounds numerically at a non-zero `offset = 5 mm`:

```text
normalAxis x: X 20..40 -> -30..-10 around X=5
normalAxis y: Y 25..35 -> -25..-15 around Y=5
normalAxis z: Z 27..33 -> -23..-17 around Z=5
```

This specifically confirms that the orientation-aware native mapping preserves the canonical positive-offset contract on every axis. In particular, `normalAxis: 'y'` correctly uses build123d `Plane.ZX` rather than `Plane.XZ`, avoiding the latter plane's `-Y` normal and an offset-sign mismatch against Rhino.

Each mirror case also retained exactly one result body with non-empty tessellation and passed the smoke suite's exact STEP / 3DM artifact checks.

## Remaining gate

M3A is **not yet fully closed**. The final required evidence is a fresh current-branch GHX opened in the installed Rhino 8 / Grasshopper host with a parameter-backed mirror offset.

Installed-host acceptance must verify:

```text
Brepia export
-> GHX open/solve
-> exactly one Result Brep
-> change mirror offset parameter
-> visible/numerical reflected position changes consistently
-> save
-> close
-> reopen
-> still solves with the same parameter wiring
```

Use at least two distinguishable non-identical offset states so a zero-plane-only success cannot hide an offset-sign mismatch.

M3B instance-set / linear-pattern work remains blocked until that installed-host evidence is reconciled and M3A is explicitly closed.
