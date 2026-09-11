# M4 profile + extrusion status

Status: **repository/CI complete and native build123d/OCCT runtime accepted; installed Rhino 8 / Grasshopper acceptance pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope decision

M4 profile + extrusion is the selected post-M3 modeling slice. Optional M3C rectangular/grid pattern remains deferred.

Decision record:

```text
docs/brep_post_m3_scope_decision_2026-09-11.md
```

M4 deliberately keeps profile data inline in one solid-producing `extrude` node. It does not add a reusable non-solid profile node and does not broaden result cardinality beyond:

```text
single | instanceSet
```

`linearPattern` remains the only `instanceSet` producer.

## Canonical M4 surface

Canonical `schemaVersion` remains `1`.

```ts
type BrepProfile =
  | { type: 'rectangle'; width: BrepScalar; height: BrepScalar }
  | { type: 'circle'; radius: BrepScalar }
  | {
      type: 'closedPolyline';
      points: Array<{ u: BrepScalar; v: BrepScalar }>;
    };

type BrepExtrudeNode = {
  id: string;
  type: 'extrude';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
  depth: BrepScalar;
};
```

Fixed right-handed profile frames:

- X extrusion: U=Y, V=Z, normal +X;
- Y extrusion: U=Z, V=X, normal +Y;
- Z extrusion: U=X, V=Y, normal +Z.

Extrusion is symmetric around the profile plane from `-depth/2` through `+depth/2`.

Rectangle and circle profiles are centered at the local profile origin. Closed-polyline points are ordered explicit U/V coordinates and closure is implicit.

## Bounded validation

The first M4 surface remains deliberately narrow:

- rectangle width/height must resolve positive;
- circle radius must resolve positive;
- extrusion depth must resolve positive;
- dimensions, point coordinates and depth use the existing millimetre-compatible M1 scalar AST;
- closed polylines contain 3 through 32 vertices;
- zero-length edges fail closed;
- zero-area profiles fail closed;
- self-intersecting profiles fail closed;
- the same checks run again against effective runtime parameter overrides;
- native and Rhino translations require exactly one usable solid/Brep.

The global M1 limits remain unchanged:

```text
canonical scalar depth      12
canonical scalar node limit 64
provider expression depth    2
```

No arbitrary workplanes/vectors, open profiles, holes/multiple loops, sketch constraints, NURBS/splines, first-class profile nodes or persisted topology references were introduced.

## Repository integration

M4 is integrated through the complete authoring/evaluation path:

- canonical normalization and validation;
- profile/depth scalar traversal;
- M0 parameter-effectiveness analysis;
- effective runtime override validation;
- finite/reference-free provider schema;
- Native BRep AI instruction;
- structural Add/Edit UI;
- expression-preserving scalar controls;
- bounded closed-polyline point editing;
- native build123d / OCCT translation;
- Rhino 8 Python 3 Script translation;
- deterministic GHX Result Item persistence;
- dedicated canonical, UI, native-source, Rhino-compiler and host-fixture tests.

Primary code-complete repository checkpoint:

```text
6847795d188054080c10f8563059d18addb68e3a
Record Rhino 8 M4 extrusion API boundary
Quality Gate #964       PASS
Grasshopper Build #536 PASS
```

The subsequent status checkpoint was also green:

```text
344f35c5725932982c19dd343b648c8f0f135688
Record M4 profile extrusion repository status
Quality Gate #965       PASS
Grasshopper Build #537 PASS
```

## Native build123d / OCCT translation

`scripts/brep/brep_driver.py` maps:

- rectangle -> build123d `Rectangle`;
- circle -> build123d `Circle`;
- closed polyline -> build123d `Polygon`;
- canonical X/Y/Z frames -> `Plane.YZ` / `Plane.ZX` / `Plane.XY`;
- centered extrusion -> `extrude(..., amount=depth / 2, both=True)`.

The resulting value must contain exactly one solid.

## Native runtime acceptance — complete

The full current smoke suite was executed successfully against the real local pinned rootless build123d / OCCT runtime on checkpoint:

```text
344f35c5725932982c19dd343b648c8f0f135688
```

M4 rectangle runtime results:

```text
axis X, profile width 60:
[-15,-30,-10] -> [15,30,10]

axis Y, profile width 60:
[-10,-15,-30] -> [10,15,30]

axis Z, profile width 60:
[-30,-10,-15] -> [30,10,15]
```

All three emitted one body with exact STEP available. Circle and closedPolyline also executed successfully with exact STEP available.

The same run kept all prior M0-M3 native regression fixtures green, including M2 Boolean behavior, M3A mirrors and M3B final/pattern-cutter collection semantics.

Full evidence:

```text
docs/brep_m4_native_runtime_evidence_2026-09-11.md
```

M4 native build123d / OCCT acceptance is therefore **closed**.

## Rhino 8 / Grasshopper translation

`shared/brepGrasshopperRhinoScript.ts` maps M4 to the built-in Rhino 8 Python 3 Script carrier.

The compiler uses an explicit canonical `Rhino.Geometry.Plane` and Rhino 8's `Rhino.Geometry.Extrusion.Create(curve, plane, height, cap)` overload. The plane origin is shifted to `-depth/2` along the selected normal and the full positive depth is extruded from there, matching the centered native result.

Profile mappings:

- rectangle -> `Rectangle3d(...).ToNurbsCurve()`;
- circle -> `Circle(...).ToNurbsCurve()`;
- closed polyline -> ordered `Plane.PointAt(U,V)` values and `PolylineCurve`;
- extrusion -> `Extrusion.Create(..., depth, true)` then `ToBrep()`;
- final result must be one solid Brep.

Repository tests lock all three profile types, all three canonical frames, centered plane semantics, parameter wiring and ordinary Result **Item Access**. M4 does not introduce the M3B List Access path.

The version boundary is documented in:

```text
docs/references/rhino8_mcneel_sources.md
```

Installed-host evidence is still required before this translation is runtime-accepted.

## Reproducible installed-host fixtures

`tests/brepM4RhinoAcceptanceFixtures.test.ts` now defines and strictly validates three deterministic current-compiler host fixtures:

```text
m4-rectangle-z.ghx   rectangle / Z / Item
m4-circle-x.ghx      circle / X / Item
m4-polyline-y.ghx    closedPolyline / Y / Item
```

Together they cover all M4 profile kinds and all three canonical profile frames.

Materialize fresh host files with:

```bash
BREPIA_WRITE_M4_RHINO_FIXTURES=1 npx vitest run tests/brepM4RhinoAcceptanceFixtures.test.ts
```

Output is intentionally written under the ignored local acceptance directory:

```text
test-results/m4-rhino-acceptance/
```

The same test can subsequently validate Rhino-saved files in strict `returned` mode. This checks that Rhino persistence changed only allowed published parameter values and did not mutate the Brepia-owned script, wiring, output access or graph shape.

Detailed host procedure:

```text
docs/brep_m4_rhino8_acceptance_plan.md
```

## Remaining acceptance boundary

Only installed Rhino 8 / Grasshopper remains open for M4.

Required host evidence:

1. fresh rectangle/Z GHX opens and solves;
2. `Profile width 60 -> 80` and `Extrusion depth 30 -> 40` recompute the one-Brep result;
3. centered Z bounds/orientation remain correct;
4. fresh circle/X GHX opens, solves and recomputes `Radius 12 -> 16`;
5. fresh asymmetric closedPolyline/Y GHX opens, solves and recomputes `Profile reach 30 -> 40`, extending in +X as required by U=Z/V=X;
6. Result remains Item Access / one Brep for every fixture;
7. all three survive save -> close -> reopen;
8. the strict returned-GHX validator accepts all three Rhino-saved files and recovers exactly the intended parameter values.

M4 is not fully complete until that installed-host sequence is accepted.

## Preserved boundaries

M4 does not alter:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- `single | instanceSet` cardinality;
- M3B collection consumer rules;
- GHX parameter-only return/import;
- non-zero rotation fail-closed until M6;
- OpenSCAD regressions;
- C4 image projection deferral;
- M3C grid-pattern deferral.

PR #36 remains intentionally draft, stacked and unmerged.
