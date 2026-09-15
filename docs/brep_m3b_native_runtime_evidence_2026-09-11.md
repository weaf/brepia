# M3B native build123d / OCCT runtime evidence — 2026-09-11

Status: **accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Repository checkpoint before runtime evidence:

```text
a6f030f5752a3c1eb2fb53d9d188d132ec8ff302
Advance M3 roadmap to linear pattern runtime acceptance
```

The exact checkpoint was CI-green before the local runtime run:

```text
Quality Gate #939       PASS
Grasshopper Build #511 PASS
```

## Runtime environment and command

The current branch smoke suite was run against the real local Brepia rootless native BRep runtime using the repository command:

```bash
./scripts/brep/smoke-test.sh
```

The script completed successfully with `set -euo pipefail`, so every explicit success assertion and every silent fail-closed assertion in the script passed.

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
```

## M3B final-pattern acceptance

The final-result fixture verified the intended ordered instance-set semantics:

- `resultNodeId = pattern`;
- `resultKind = instanceSet`;
- exactly three independent result bodies;
- stable canonical body identities `pattern::0`, `pattern::1`, `pattern::2`;
- stable instance indices `0`, `1`, `2`;
- X-axis center-to-center spacing of exactly 20 mm between consecutive bodies;
- instance 0 remains at the source location;
- Y/Z bounds remain unchanged across instances;
- aggregate bounds are `[-5,-5,-5] -> [45,5,5]`;
- exact STEP export is available.

This confirms that the native evaluator does not silently Boolean-fuse a requested linear pattern into one solid and does not discard canonical instance identity.

## M3B pattern-as-subtract-tool acceptance

The subtract-tool fixture verified the intentionally supported instance-set consumer boundary:

- the pattern contains four ordered cutter instances;
- `subtract.tools[]` expands and applies those cutters in canonical instance order;
- the final subtract result remains `resultKind = single`;
- exactly one result body is emitted;
- the resulting viewer mesh contains 2044 triangles;
- exact STEP export remains available.

This confirms the deliberate exception that `subtract.tools[]` may consume an `instanceSet` while `subtract.base` and the other single-shape consumers remain single-only.

## Regression evidence

The same successful run also revalidated the existing native regression surface:

- ordinary primitive / transform / subtract / fillet execution;
- exact STEP and 3DM artifacts;
- project-object geometry roles and semantic point placement;
- M2 overlapping union and intersection success;
- M2 disjoint union and intersection fail-closed behavior;
- M3A X/Y/Z mirror behavior and bounds.

Because the script completed, the expected-failure Boolean fixtures also matched their required `unsupported_result_cardinality` error contract.

## Conclusion

M3B native build123d / OCCT runtime acceptance is **complete**.

The remaining M3B acceptance boundary is installed Rhino 8 / Grasshopper using fresh current-branch GHX. That host run must verify both:

1. a final linear pattern exposing `Result` as a List of separate Breps with parameter-driven spacing and save/close/reopen persistence; and
2. a linear pattern used as a subtract tool producing the intended single Brep and recomputing correctly when spacing changes.

M3B must remain open until that installed-host evidence is accepted. Rectangular pattern or M4 work must not bypass this boundary.
