# Bounded multi-loop profile extrusion status

Status: **Gate A repository/CI and Gate B native runtime accepted; Gate C installed Rhino 8 runtime prepared but not yet accepted**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Scope

This is the compatibility-first post-revolve extension of existing M4 extrusion selected in:

```text
docs/brep_post_revolve_scope_decision_2026-09-12.md
```

The locked implementation boundary is:

```text
docs/brep_multiloop_profile_extrusion_implementation_boundary_2026-09-12.md
```

The slice adds bounded inner holes to an existing inline M4 profile. It does not introduce a reusable sketch graph or change result cardinality.

## Canonical contract

Canonical `schemaVersion` remains `1`.

Existing single-loop profile payloads remain valid and normalize identically. Multi-loop extrusion adds optional ordered holes:

```ts
type BrepProfileHole = {
  loop: BrepProfileLoop;
  offsetU: BrepScalar;
  offsetV: BrepScalar;
};
```

The outer loop keeps the existing rectangle/circle/closedPolyline syntax and may carry:

```ts
holes?: BrepProfileHole[];
```

Locked bounds and semantics:

- zero through 8 holes;
- rectangle, circle or closedPolyline loops only;
- at most 32 vertices per closedPolyline;
- at most 128 explicit closedPolyline vertices across outer + holes;
- hole offsets are ordinary millimetre M1 scalars;
- holes are non-recursive;
- holes are extrusion-only;
- every hole must be strictly inside the outer loop;
- touching, intersection, sibling overlap and nesting fail closed;
- loop winding is not canonical semantics;
- result kind remains `single`;
- exactly one positive-volume solid/Brep is required.

Explicit empty `holes: []` canonicalizes back to the legacy single-loop shape.

## Gate A — repository / CI complete

Primary Gate-A completion checkpoint:

```text
f7e372ba34cb54f9cd94dedde1f5937b4a40b22c
Lock multi-loop server evaluation boundary
Quality Gate #1106       PASS
Grasshopper Build #678   PASS
```

The accepted repository surface now covers:

- canonical additive hole grammar;
- bounded hole/point counts;
- strict planar loop containment/separation validation;
- default-value and runtime-override revalidation;
- M0 parameter-effectiveness traversal through hole loops and offsets;
- M1 scalar/expression preservation;
- finite non-recursive provider/AI schema;
- Native BRep AI guidance for ordinary constant-section through-holes;
- structural add/remove/reorder/edit UI;
- expression-preserving hole dimensions and offsets;
- server request normalization before native execution;
- build123d/OCCT translation;
- Rhino 8 / Grasshopper compiler translation;
- strict executable GHX validation;
- legacy single-loop M4 regression coverage;
- revolve-hole fail-closed behavior.

Representative focused tests include:

```text
tests/brepMultiLoopProfileGeometry.test.ts
tests/brepMultiLoopProfileContract.test.ts
tests/brepMultiLoopAiEditing.test.ts
tests/brepMultiLoopProfileUi.test.ts
tests/brepMultiLoopNativeExtrude.test.ts
tests/brepMultiLoopRhinoExtrude.test.ts
tests/brepMultiLoopServerBoundary.test.ts
tests/brepMultiLoopSmokeHarness.test.ts
tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

## Native build123d / OCCT translation

`scripts/brep/brep_driver.py` preserves the legacy single-loop M4 path unchanged.

For a profile with holes it constructs:

1. the existing outer sketch/wire;
2. one translated inner wire per canonical hole;
3. one planar build123d `Face(outer_wire, hole_wires)`;
4. one symmetric extrusion in the existing M4 X/Y/Z frame;
5. exactly one positive-volume solid.

No hidden 3D cutter Boolean is used to represent canonical profile holes.

The Gate-B harness is:

```text
scripts/brep/multiloop-extrude-smoke.sh
```

Repository coverage for the harness is accepted at:

```text
665747a4fcbcc6a80181dee87473dd737e7958b6
Add multi-loop native acceptance harness
Quality Gate #1104       PASS
Grasshopper Build #676   PASS
```

The harness locks:

- one rectangle outer loop;
- one circular hole;
- one non-circular closedPolyline hole;
- expression-backed placement `width / 2 - margin`;
- effective parameter perturbation;
- exact STEP output;
- independent exact STEP re-import in the pinned CAD image;
- exactly one imported solid;
- positive volume;
- exact outer bounds;
- analytic volume including both holes;
- build123d `0.11.1`;
- `cadquery-ocp-novtk 7.9.3.1.1`;
- rootless/offline/read-only/capability-dropped verification constraints.

### Gate B — pinned native runtime complete

The real local pinned build123d / OCCT runtime executed the Gate-B harness successfully.

Default fixture:

```text
{"fixture":"multi-loop-default","bounds":{"min":[-50,-35,-4],"max":[50,35,4]},"resultKind":"single","exactStep":true}
```

Parameterized override:

```text
{"fixture":"multi-loop-override","override":{"width":120,"margin":40,"holeRadius":9},"bounds":{"min":[-60,-35,-4],"max":[60,35,4]}}
```

Independent exact STEP re-import in the pinned CAD image:

```text
{'build123d': '0.11.1', 'cadqueryOcpNovtk': '7.9.3.1.1', 'exactStepSolids': 1, 'volume': 64524.24796047347, 'bounds': (-60.0, -35.0, -4.0, 60.0, 35.0, 4.0)}
```

The imported STEP therefore preserves:

- exactly one solid;
- exact perturbed outer bounds;
- positive volume;
- the analytical volume of the outer plate minus both inner holes.

The accepted volume is:

```text
120*70*8 - pi*9^2*8 - 10*8*8
= 64524.24796047347 mm^3
```

That volume check proves the hole geometry survived exact STEP export/re-import rather than merely preserving the same outer envelope.

Full native evidence:

```text
docs/brep_multiloop_native_runtime_evidence_2026-09-12.md
```

Canonical invalid-loop behavior remains separately repository/server accepted before native execution, including runtime overrides that make a hole touch the outer boundary.

## Rhino 8 / Grasshopper translation

Multi-loop extrusion retains the existing built-in Rhino Python 3 Script carrier and strict GHX ownership boundary.

Legacy no-hole extrusions continue through the accepted `Extrusion.Create(...)` path unchanged.

For a profile with holes the compiler constructs canonical outer/inner curves and then uses:

```text
Rhino.Geometry.Brep.CreatePlanarBreps(curves, tolerance)
```

It fails closed unless the planar operation yields:

- exactly one Brep region;
- exactly one face;
- exactly `1 + holeCount` loops.

That trimmed face is extruded along the existing centered M4 axis path with:

```text
BrepFace.CreateExtrusion(path, true)
```

and must produce one valid solid Brep.

No Rhino BooleanDifference is used to encode canonical profile holes.

The strict GHX compiler/validator path is repository-accepted at:

```text
504bf244235569369f3fee6607ae21c21e27c118
Assert encoded multi-loop GHX boundary
Quality Gate #1103       PASS
Grasshopper Build #675   PASS
```

## Installed Rhino 8 acceptance fixture

The Gate-C fixture generator is:

```text
tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

Repository acceptance for the fixture generator:

```text
5dbf60142d54651693ea7e9694c3228f4e791752
Add multi-loop Rhino acceptance fixture
Quality Gate #1105       PASS
Grasshopper Build #677   PASS
```

Generate the fresh current-compiler fixture with:

```bash
BREPIA_WRITE_MULTILOOP_RHINO_FIXTURES=1 \
  npx vitest run tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

Default output:

```text
test-results/multiloop-rhino-acceptance/
```

The fixture requires installed Rhino 8 / Grasshopper acceptance of:

1. fresh GHX open without repair prompts;
2. successful solve to exactly one solid Result Item;
3. both the circular and non-circular inner holes visibly present;
4. `Plate width` 100 -> 120;
5. `Right-hole margin` 35 -> 40;
6. `Right-hole radius` 7 -> 9;
7. visible recomputation including expression-backed circular-hole movement;
8. save;
9. close Rhino/Grasshopper;
10. reopen the saved GHX;
11. solve again;
12. strict returned-GHX parameter-only validation.

The host-saved file must be named:

```text
multiloop-extrude-plate-host-saved.ghx
```

Then validate it with:

```bash
BREPIA_MULTILOOP_RHINO_SAVED_DIR=<directory-containing-host-saved-ghx> \
  npx vitest run tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

Expected persisted parameters are exactly:

```text
width=120
margin=40
holeRadius=9
```

Result access remains ordinary Grasshopper **Item Access**.

### Gate C status

**Pending installed Rhino 8 / Grasshopper execution.**

The repository test proves that the fresh fixture compiles and passes generated-GHX strict validation and that a returned host file, when supplied, must obey the existing parameter-only mutation boundary. It is not installed-host evidence.

## Preserved boundaries

This slice does not change:

- canonical `schemaVersion: 1`;
- immutable BRep project/revision authority;
- build123d/OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- GHX parameter-only return/import;
- `single | instanceSet` value-kind discipline;
- M2 Boolean semantics;
- M3 pattern semantics;
- accepted M4 single-loop extrusion behavior;
- accepted bounded revolve behavior;
- M6 Intrinsic XYZ rotation behavior;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Current closeout state

Repository implementation and native runtime acceptance are complete.

Only the installed-host gate remains:

```text
Gate A repository / CI                  COMPLETE
Gate B pinned native build123d / OCCT   COMPLETE
Gate C installed Rhino 8 / Grasshopper  PENDING RUNTIME
```

Do not mark bounded multi-loop profile extrusion fully complete until Gate C has separate recorded installed-host runtime evidence.
