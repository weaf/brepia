# Bounded multi-loop profile extrusion status

Status: **Fully accepted — Gate A repository/CI, Gate B pinned native runtime and Gate C installed Rhino 8 runtime complete**

Date: 2026-09-14

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

The accepted repository surface covers:

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

## Gate B — pinned native build123d / OCCT complete

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

The real local pinned build123d / OCCT runtime executed the harness successfully.

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

The imported STEP therefore preserves exactly one solid, exact perturbed outer bounds, positive volume and the analytical volume of the outer plate minus both inner holes:

```text
120*70*8 - pi*9^2*8 - 10*8*8
= 64524.24796047347 mm^3
```

Full native evidence:

```text
docs/brep_multiloop_native_runtime_evidence_2026-09-12.md
```

Canonical invalid-loop behavior remains separately repository/server accepted before native execution, including runtime overrides that make a hole touch the outer boundary.

## Gate C — installed Rhino 8 / Grasshopper complete

Multi-loop extrusion retains the existing built-in Rhino Python 3 Script carrier and strict GHX ownership boundary.

Legacy no-hole extrusions continue through the accepted `Extrusion.Create(...)` path unchanged.

For a profile with holes the compiler constructs canonical outer/inner curves and uses:

```text
Rhino.Geometry.Brep.CreatePlanarBreps(curves, tolerance)
```

It fails closed unless the planar operation yields exactly one Brep region, exactly one face and exactly `1 + holeCount` loops. That trimmed face is extruded along the existing centered M4 axis path with:

```text
BrepFace.CreateExtrusion(path, true)
```

and must produce one valid solid Brep. No Rhino BooleanDifference is used to encode canonical profile holes.

The strict GHX compiler/validator path is repository-accepted at:

```text
504bf244235569369f3fee6607ae21c21e27c118
Assert encoded multi-loop GHX boundary
Quality Gate #1103       PASS
Grasshopper Build #675   PASS
```

The installed-host acceptance fixture is:

```text
tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts
```

with repository acceptance at:

```text
5dbf60142d54651693ea7e9694c3228f4e791752
Add multi-loop Rhino acceptance fixture
Quality Gate #1105       PASS
Grasshopper Build #677   PASS
```

The Rhino host workflow exercised the locked edit:

```text
Plate width:        100 -> 120
Right-hole margin:   35 -> 40
Right-hole radius:    7 -> 9
```

The user explicitly confirmed that the edited model looked correct in installed Rhino 8 / Grasshopper, both holes were present, and the geometry remained correct after save -> close Rhino/Grasshopper -> reopen.

The returned host-saved GHX then passed strict parameter-only validation:

```text
v4.1.11 /home/thn/ai/pCAD

 ✓ tests/brepMultiLoopRhinoAcceptanceFixtures.test.ts (2 tests) 24ms
   ✓ bounded multi-loop installed Rhino 8 acceptance fixture (2)
     ✓ compiles and strictly validates a fresh multi-hole Item-access GHX fixture 18ms
     ✓ strictly validates a Rhino-saved parameter-only GHX when requested 4ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

The validator confirms persisted parameters exactly:

```text
width=120
margin=40
holeRadius=9
```

and preserves Result **Item Access** plus the existing Brepia-owned executable/graph boundary.

Full installed-host evidence:

```text
docs/brep_multiloop_rhino8_runtime_evidence_2026-09-14.md
```

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

## Final closeout state

Bounded multi-loop profile extrusion is fully accepted across all three required evidence layers:

```text
Gate A repository / CI                  COMPLETE
Gate B pinned native build123d / OCCT   COMPLETE
Gate C installed Rhino 8 / Grasshopper  COMPLETE
```

The slice is closed without broadening the locked canonical boundary.
