# M4 profile + extrusion status

Status: **repository-complete / CI-accepted; native build123d/OCCT runtime and installed Rhino 8 / Grasshopper acceptance pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope decision

M4 profile + extrusion was selected as the next modeling-capability slice after M3B. Optional M3C rectangular/grid pattern remains deferred. The decision and bounded contract are recorded in:

```text
docs/brep_post_m3_scope_decision_2026-09-11.md
```

M4 deliberately keeps profile data inline in one solid-producing `extrude` node. It does not introduce a reusable non-solid profile node or broaden canonical result cardinality beyond the existing:

```text
single | instanceSet
```

`linearPattern` remains the only `instanceSet` producer.

## Canonical M4 surface

Canonical schema version remains `1`.

The new node is:

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

Profile coordinate frames are fixed and right-handed:

- X extrusion: U=Y, V=Z, normal +X;
- Y extrusion: U=Z, V=X, normal +Y;
- Z extrusion: U=X, V=Y, normal +Z.

Extrusion is symmetric around the canonical profile plane from `-depth/2` to `+depth/2`.

Rectangle and circle profiles are centered on the local profile origin. `closedPolyline` coordinates are explicit ordered U/V values and close implicitly from the final point to the first.

## Bounds and fail-closed validation

The initial M4 slice remains deliberately bounded:

- rectangle width and height must resolve positive;
- circle radius must resolve positive;
- extrusion depth must resolve positive;
- all profile dimensions/coordinates/depth use the existing millimetre-compatible bounded M1 scalar AST;
- closed polylines contain 3 through 32 ordered vertices;
- repeated terminal closure is unnecessary and a zero-length closing edge is rejected;
- zero-length edges are rejected;
- zero-area closed polylines are rejected;
- self-intersecting closed polylines are rejected;
- the same validity rules run again after effective runtime parameter overrides;
- native and Rhino translations additionally fail closed unless exactly one usable solid/Brep is produced.

No arbitrary workplanes, arbitrary extrusion vectors, open profiles, holes/multiple profile loops, sketch constraints, NURBS/spline profile language, first-class profile nodes or topology references were introduced.

## Canonical/provider/editor integration

Repository implementation now includes:

- canonical `BrepProfile` / `BrepExtrudeNode` normalization;
- profile/depth scalar validation and parameter reference tracking;
- M0 parameter-effectiveness integration;
- evaluation-request validation at effective parameter overrides;
- finite/reference-free provider authoring schema while retaining provider expression depth `2`;
- Native BRep tool instructions for profile/extrusion semantics;
- structural Add/Edit UI for rectangle, circle and closed-polyline profiles;
- expression-preserving scalar controls for all M4 profile fields and depth;
- bounded closed-polyline point add/remove controls;
- explicit canonical X/Y/Z profile-frame descriptions in the editor.

The global canonical M1 limits remain unchanged:

- scalar expression depth `12`;
- scalar expression node count `64`.

## Native build123d / OCCT translation

`scripts/brep/brep_driver.py` now maps:

- rectangle -> build123d `Rectangle`;
- circle -> build123d `Circle`;
- closed polyline -> build123d `Polygon`;
- X/Y/Z canonical frames -> `Plane.YZ` / `Plane.ZX` / `Plane.XY`;
- centered extrusion -> `extrude(..., amount=depth / 2, both=True)`.

The result must resolve to exactly one solid.

`scripts/brep/smoke-test.sh` now contains deterministic M4 fixtures covering:

- parameter-backed rectangle extrusion on X, Y and Z;
- exact centered bounds for all three canonical frames;
- circle profile extrusion;
- closed-polyline extrusion;
- `resultKind = single`;
- exact STEP availability.

Repository tests additionally lock the native translation source and smoke fixtures. **This is not yet real native runtime evidence.** The current smoke suite still needs to be executed against the real local pinned rootless build123d/OCCT runtime before native M4 acceptance can be claimed.

## Rhino 8 / Grasshopper translation

`shared/brepGrasshopperRhinoScript.ts` now compiles M4 profiles to the Rhino 8 Python 3 Script carrier using an explicit canonical `Rhino.Geometry.Plane` and `Rhino.Geometry.Extrusion.Create(curve, plane, height, cap)`.

The Rhino plane starts at `-depth/2` along the selected normal and the positive full depth is extruded from that plane, preserving the native centered result.

Profile mappings are:

- rectangle -> `Rectangle3d(...).ToNurbsCurve()`;
- circle -> `Circle(...).ToNurbsCurve()`;
- closed polyline -> ordered `Plane.PointAt(U,V)` values + explicit closure -> `PolylineCurve`;
- extrusion -> `Extrusion.Create(..., depth, true)` -> `ToBrep()`;
- the final result must be a solid Brep.

Repository tests lock all three profile kinds, all three axis frames, centered start-plane semantics, parameter wiring and ordinary Grasshopper Result **Item Access**. `linearPattern` remains the only path that changes the primary Result to List Access.

McNeel's RhinoCommon 8.0 change surface explicitly includes the `Extrusion.Create(Curve, Plane, double, bool)` overload. The Rhino upstream evidence boundary is documented in:

```text
docs/references/rhino8_mcneel_sources.md
```

This remains **repository translation support only** until fresh generated M4 GHX is accepted in installed Rhino 8 / Grasshopper.

## Repository acceptance checkpoint

The complete repository implementation before this status document is:

```text
6847795d188054080c10f8563059d18addb68e3a
Record Rhino 8 M4 extrusion API boundary
```

CI on that exact checkpoint:

```text
Quality Gate #964       PASS
Grasshopper Build #536 PASS
```

Quality Gate passed the complete test suite, TypeScript typecheck, lint, production build and diff check. Grasshopper Build passed on the same exact head.

An immediately preceding implementation checkpoint also passed both gates:

```text
742b6c98843be75bdfed8a35a882414ec9176d38
Quality Gate #962       PASS
Grasshopper Build #534 PASS
```

## Remaining acceptance sequence

M4 is not complete until both external runtime boundaries are accepted.

### 1. Native build123d / OCCT

Run the current branch smoke suite against the real local rootless BRep runtime:

```bash
./scripts/brep/smoke-test.sh
```

The M4-specific assertions must verify the three canonical axis bounds, rectangle parameter override, circle and closed-polyline execution, one `single` body and exact STEP availability while all prior M0-M3 smoke regressions remain green.

### 2. Installed Rhino 8 / Grasshopper

Use fresh GHX generated from the accepted current branch and verify at minimum:

1. rectangle extrusion opens and solves with parameter-backed profile dimension;
2. the relevant parameter changes the solved geometry;
3. canonical centered axis/frame behavior matches the native fixture;
4. circle and closed-polyline profile translations solve successfully;
5. Result remains Item Access / one Brep;
6. save -> close -> reopen preserves the definition and it solves again;
7. no M3B List Access or collection semantics are introduced for extrusion.

Record native and installed-host evidence in separate dated evidence documents, following the M3B precedent.

## Preserved boundaries

M4 does not broaden or alter:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- `single | instanceSet` result cardinality;
- M3B collection consumer rules;
- GHX parameter-only return/import;
- non-zero rotation fail-closed boundary until M6;
- OpenSCAD behavior/regressions;
- C4 image projection deferral;
- optional M3C grid-pattern deferral.

PR #36 remains intentionally draft, stacked and unmerged.
