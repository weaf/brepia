# M4 native build123d / OCCT runtime evidence — 2026-09-11

Status: **accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Runtime checkpoint:

```text
344f35c5725932982c19dd343b648c8f0f135688
Record M4 profile extrusion repository status
```

CI on that exact checkpoint was green before the local runtime evidence was recorded:

```text
Quality Gate #965       PASS
Grasshopper Build #537 PASS
```

The immediately preceding code-complete checkpoint was also green:

```text
6847795d188054080c10f8563059d18addb68e3a
Quality Gate #964       PASS
Grasshopper Build #536 PASS
```

## Runtime command

The current branch smoke suite was executed against the real local rootless Brepia native BRep runtime:

```bash
./scripts/brep/smoke-test.sh
```

The script uses `set -euo pipefail`, so completion of the run means all success assertions and all expected fail-closed assertions in the complete native smoke suite passed.

The native sandbox remains the pinned build123d / OCCT environment selected by the project:

```text
build123d 0.11.1 / OCCT 7.9.3.1
```

## Observed output

```text
{"result":"cut","triangles":732,"roles":["footprint","clearanceEnvelope","maintenanceEnvelope"],"point":{"id":"cableEntry","kind":"cable","position":[50,10,0],"direction":[0,0,1],"label":"Cable entry"},"artifacts":["model.step","brepia-footprint.step","brepia-clearance-envelope.step","brepia-maintenance-envelope.step","model.3dm"]}
{"boolean":"union","result":"booleanResult","triangles":12}
{"boolean":"intersect","result":"booleanResult","triangles":12}
{"mirror":"x","offset":5,"result":"mirrored","bounds":{"min":[-30,25,27],"max":[-10,35,33]},"triangles":12}
{"mirror":"y","offset":5,"result":"mirrored","bounds":{"min":[20,-25,27],"max":[40,-15,33]},"triangles":12}
{"mirror":"z","offset":5,"result":"mirrored","bounds":{"min":[20,25,-23],"max":[40,35,-17]},"triangles":12}
{"pattern":"pattern","resultKind":"instanceSet","bodies":[{"id":"pattern::0","index":0,"bounds":{"min":[-5,-5,-5],"max":[5,5,5]}},{"id":"pattern::1","index":1,"bounds":{"min":[15,-5,-5],"max":[25,5,5]}},{"id":"pattern::2","index":2,"bounds":{"min":[35,-5,-5],"max":[45,5,5]}}],"aggregateBounds":{"min":[-5,-5,-5],"max":[45,5,5]},"exactStep":true}
{"patternTool":"cutters","count":4,"result":"cut","resultKind":"single","triangles":2044,"exactStep":true}
{"extrude":"rectangle","axis":"x","profileWidth":60,"bounds":{"min":[-15,-30,-10],"max":[15,30,10]},"triangles":12,"exactStep":true}
{"extrude":"rectangle","axis":"y","profileWidth":60,"bounds":{"min":[-10,-15,-30],"max":[10,15,30]},"triangles":12,"exactStep":true}
{"extrude":"rectangle","axis":"z","profileWidth":60,"bounds":{"min":[-30,-10,-15],"max":[30,10,15]},"triangles":12,"exactStep":true}
{"extrudeProfiles":["circle","closedPolyline"],"exactStep":true}
```

## M4 rectangle acceptance

The parameter-backed rectangle extrusion fixture passed on all three canonical axes.

For the accepted runtime values:

- profile width resolved to `60 mm`;
- profile height resolved to `20 mm`;
- extrusion depth resolved to `30 mm`.

The resulting exact centered bounds were:

```text
axis X: [-15,-30,-10] -> [15,30,10]
axis Y: [-10,-15,-30] -> [10,15,30]
axis Z: [-30,-10,-15] -> [30,10,15]
```

These bounds confirm the intended fixed right-handed profile frames:

- X extrusion: U=Y, V=Z, normal +X;
- Y extrusion: U=Z, V=X, normal +Y;
- Z extrusion: U=X, V=Y, normal +Z.

They also confirm the centered extrusion rule `-depth/2 .. +depth/2` rather than a one-sided native extrusion.

Each rectangle fixture produced:

- one authoritative body;
- `resultKind = single`;
- a non-empty viewer mesh;
- exact STEP export available.

## M4 circle and closed-polyline acceptance

The same runtime run also executed both remaining bounded profile kinds successfully:

- `circle`;
- `closedPolyline`.

Both produced valid native exact STEP output under the same single-solid contract.

This confirms that the M4 canonical profile vocabulary is executable in the real build123d / OCCT runtime rather than existing only as TypeScript/provider/compiler state.

## Regression evidence

The successful run simultaneously revalidated the prior native modeling surface:

- primitive / transform / subtract / fillet execution;
- exact STEP / 3DM artifact generation;
- project-object geometry roles and semantic points;
- M2 union and intersection success;
- M2 unsupported/disjoint Boolean fail-closed behavior;
- M3A X/Y/Z mirror behavior;
- M3B final `instanceSet` behavior;
- M3B ordered pattern-as-subtract-tool behavior.

The M3B result still emitted stable `pattern::0..2` bodies with exact 20 mm spacing and aggregate bounds `[-5,-5,-5] -> [45,5,5]`, while the pattern cutter case still ended as one `single` result body. M4 therefore did not regress the established collection boundary.

## Conclusion

M4 native build123d / OCCT runtime acceptance is **complete**.

The remaining M4 acceptance boundary is now only installed Rhino 8 / Grasshopper using fresh GHX generated from the current accepted branch. That host run must verify rectangle parameter recomputation and the circle/closedPolyline paths, plus save -> close -> reopen persistence while keeping Result as Item Access / one Brep.

M4 must not be called fully complete until that installed-host boundary is accepted.
