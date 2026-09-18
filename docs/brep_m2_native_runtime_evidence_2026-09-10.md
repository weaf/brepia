# M2 native runtime evidence — 2026-09-10

Status: **native build123d / OCCT runtime accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Acceptance checkpoint before runtime evidence:

```text
3120cb9987f8f570c186481ebc7ab9a4c7ce3465
```

GitHub CI on that checkpoint:

```text
Quality Gate #858       PASS
Grasshopper Build #430 PASS
```

## Real local native runtime execution

The real local rootless Native BRep runtime was rebuilt and the repository smoke suite was executed:

```bash
./scripts/brep/build-image.sh
./scripts/brep/smoke-test.sh
```

The smoke completed successfully and produced:

```text
{"result":"cut","triangles":732,"roles":["footprint","clearanceEnvelope","maintenanceEnvelope"],"point":{"id":"cableEntry","kind":"cable","position":[50,10,0],"direction":[0,0,1],"label":"Cable entry"},"artifacts":["model.step","brepia-footprint.step","brepia-clearance-envelope.step","brepia-maintenance-envelope.step","model.3dm"]}
{"boolean":"union","result":"booleanResult","triangles":12}
{"boolean":"intersect","result":"booleanResult","triangles":12}
```

The command exited successfully after the two success fixtures and the two fail-closed fixtures. The fail-closed checks are intentionally silent on success and would terminate the script if either unsupported fixture unexpectedly evaluated successfully or failed without the expected bounded error code.

## Evidence established

The native runtime evidence proves:

1. the pre-M2 primitive / transform / subtract / fillet regression still succeeds;
2. exact STEP and 3DM artifact generation remains intact;
3. project-object geometry roles and semantic point evaluation remain intact;
4. overlapping `union` evaluates successfully to exactly one body;
5. overlapping `intersect` evaluates successfully to exactly one body;
6. disjoint `union` fails closed with `unsupported_result_cardinality` rather than becoming a multi-solid compound;
7. disjoint `intersect` fails closed with `unsupported_result_cardinality` rather than becoming an empty successful result.

The successful Boolean fixtures each produced a valid tessellated single-body result with 12 triangles and the authoritative result node `booleanResult`.

## Acceptance conclusion

M2 is now **native build123d / OCCT runtime accepted**.

This does not yet establish Rhino 8 / Grasshopper parity. The remaining M2 gate is installed-host evidence using fresh current-branch GHX for representative `union` and `intersect` success cases plus at least one unsupported result-cardinality case.

M3 remains blocked until that installed-host evidence is reconciled and M2 is explicitly closed.

PR #36 remains draft, stacked and unmerged.
