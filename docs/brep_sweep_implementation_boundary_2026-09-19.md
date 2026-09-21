# Bounded planar 90-degree circular sweep implementation boundary — 2026-09-19

Status: **IMPLEMENTED AND ACCEPTED — Gates A/B/C/D complete; boundary remains locked with no scope broadening**

Repository: `weaf/brepia`

Planning branch: `plan/brep-sweep-boundary` (historical)\n\nImplementation branch: `feature/brep-planar-elbow-sweep`

Parent authority:

```text
6d15a723a270022ada536219ec65f7fa0f7af0cf
Merge pull request #48 from weaf/fix/product-gap-login-readiness
```

Scope decision:

```text
docs/brep_post_product_gap_scope_decision_2026-09-19.md
```

## Purpose

Close the concrete target-E representation gap with the smallest kernel-neutral sweep contract that can model a constant circular-section handrail/pipe with two perpendicular straight legs and one smooth tangent 90-degree bend.

This is not a general sweep feature. The first slice deliberately constrains both the profile and path so canonical semantics can be made deterministic across build123d/OCCT and Rhino 8.

`schemaVersion: 1` remains unchanged.

## Locked canonical contract

The first slice adds exactly one additive solid node:

```ts
export type BrepPlanarElbow90Path = {
  type: 'planarElbow90';
  planeNormalAxis: BrepAxis;
  firstLegLength: BrepScalar;
  secondLegLength: BrepScalar;
  bendRadius: BrepScalar;
};

export type BrepSweepNode = {
  id: string;
  type: 'sweep';
  profile: BrepCircleProfile;
  path: BrepPlanarElbow90Path;
};
```

No upstream geometry input is added. Like `box`, `cylinder`, `extrude` and `revolve`, the sweep node creates one local canonical solid directly.

`profile` is intentionally limited to the existing circle profile shape:

```ts
{ type: 'circle', radius: BrepScalar }
```

A sweep profile with holes, rectangle or closedPolyline is outside this slice and must fail canonical/provider validation rather than being approximated.

`brepNodeValueKind(sweep)` is always `single`.

## Locked path frame

The path lives in one canonical local plane. Its `planeNormalAxis` reuses the accepted M4 cyclic frame convention:

| `planeNormalAxis` | local path U | local path V | plane normal N = U x V |
| ----------------- | ------------ | ------------ | ---------------------- |
| `x`               | +Y           | +Z           | +X                     |
| `y`               | +Z           | +X           | +Y                     |
| `z`               | +X           | +Y           | +Z                     |

The local path starts at the canonical local origin. Let:

- `L1 = firstLegLength`;
- `L2 = secondLegLength`;
- `R = bendRadius`.

In local U/V coordinates the centerline is exactly:

```text
P0 = (0, 0)
P1 = (L1, 0)
C  = (L1, R)
P2 = (L1 + R, R)
P3 = (L1 + R, R + L2)
```

The centerline consists of:

1. line P0 -> P1;
2. +90 degree tangent circular arc P1 -> P2 centered at C;
3. line P2 -> P3.

The first tangent is +U and the second tangent is +V. The turn direction is fixed by the right-handed U/V/N frame.

No `turn`, arbitrary angle, vertex list, path normal vector or curve source is canonical state in this slice. Existing downstream transform/mirror/project-placement semantics provide orientation without widening the path grammar.

## Section frame and twist semantics

At P0 the centerline tangent is +U. The circular section is centered on P0 in the plane perpendicular to +U.

For deterministic adapter construction, use:

```text
section X = +V
section Y = +N
section normal = +U
```

because `V x N = U`.

The canonical section is circular, so roll around the path tangent is not observable geometry. Therefore the first slice has:

- no twist angle;
- no Frenet/roadlike authoring option;
- no guide rail/binormal;
- no section rotation parameter;
- no multi-section interpolation.

Native and Rhino adapters may use backend-specific frame machinery internally only if it preserves the exact canonical centerline and constant circular radius. Backend frame flags are not persisted canonical state.

A later non-circular sweep would require a new explicit frame/twist decision and cannot reuse this omission silently.

## Scalar and parameter semantics

All four geometric dimensions are ordinary existing M1 millimetre scalars:

- `profile.radius`;
- `path.firstLegLength`;
- `path.secondLegLength`;
- `path.bendRadius`.

Preserve existing canonical scalar depth/node limits, provider expression depth and unit algebra. No trigonometric or new scalar function is introduced because the only bend angle is the fixed 90 degrees.

Parameter effectiveness/integrity traversal must include all four fields transitively.

## Fail-closed geometry validity

Validation applies both at normalized defaults and after runtime parameter overrides.

Resolved values must satisfy:

```text
firstLegLength  > 0
secondLegLength > 0
bendRadius      > 0
profile.radius  > 0
profile.radius  < bendRadius
```

The strict `profile.radius < bendRadius` rule keeps the circular section smaller than the minimum centerline curvature radius and excludes the horn/spindle-style degeneracy region from the first slice.

The centerline itself cannot self-intersect under the fixed line + quarter-circle + line grammar with positive lengths/radius. No general path self-intersection algorithm is introduced.

If native or Rhino execution nevertheless produces:

- no body;
- more than one body;
- an invalid/non-solid body;
- non-positive volume;
- an ambiguous or backend-specific self-overlap;

the operation fails closed. No adapter may select the first result or repair dimensions.

## Result and graph algebra

Sweep is intrinsically `single`.

This boundary does not change:

- exact-one-body Boolean semantics;
- `single | instanceSet`;
- the existing narrow collection-consumer rules;
- pattern nesting restrictions;
- project-object role semantics.

A sweep node has no feature-node dependency. Downstream transform, mirror, Boolean and currently accepted pattern operations may consume its single result under their existing rules.

## Pinned native build123d / OCCT boundary

The current image is pinned to build123d 0.11.1 / OCCT 7.9.3.1. Before locking this boundary, the actual image was introspected and exercised.

The pinned `build123d.sweep` API accepts a section plus path. A local XY line + tangent arc + line was prototyped with:

```text
L1 = 1000 mm
L2 = 700 mm
R  = 150 mm
section radius = 20 mm
```

The correct tangent arc primitive is `JernArc(start, tangent, radius, 90)`. A naïve `RadiusArc(start, end, radius)` produced the opposite endpoint tangent ordering for this elbow construction and must not be used as the semantic implementation shortcut.

The verified local path is:

```text
Line((0,0), (1000,0))
JernArc((1000,0), tangent=(1,0), radius=150, arc_size=90)
Line((1150,150), (1150,850))
```

Its length is `1935.6194490192345 mm`. Sweeping a 20 mm radius circle produced exactly one valid solid with volume `2432371.1364737414 mm^3`, matching `pi * 20^2 * pathLength`.

Mapping the same local path/section through `Plane.XY`, `Plane.YZ` and `Plane.ZX` produced the same volume and one solid on all three canonical planes.

Implementation should construct the path in the local XY frame, transform path and section through the locked canonical plane mapping, sweep once, and require one positive-volume solid. Exact STEP export remains unchanged.

## Rhino 8 / Grasshopper boundary

Rhino/GHX remains interoperability-only. Installed Rhino 8 is the runtime authority for host acceptance, not for redefining canonical geometry.

The reviewed McNeel branch-8 references include:

- `rhinocommon/cs/SampleCsCommands/SampleCsSweep1.cs`, which uses `Brep.CreateFromSweep(rail, shape, ..., doc.ModelAbsoluteTolerance)`;
- `rhinocommon/snippets/py/sweep-surfaces-with-sweep1.py`, which demonstrates the Rhino 8 one-rail sweep surface and document tolerances.

The version-specific RhinoCommon API exposes `Brep.CreateFromSweep(...)` and `Brep.CapPlanarHoles(tolerance)` within the Rhino 8 compatibility floor.

The Brepia compiler must:

1. construct the exact canonical line + 90-degree tangent arc + line rail in the locked U/V plane;
2. construct one circle at P0 in the locked V/N section plane;
3. sweep the section along the rail using RhinoCommon;
4. cap the open planar ends when required by the chosen RhinoCommon sweep overload;
5. require exactly one closed solid Brep;
6. fail closed on null, zero/multiple results or non-solid output;
7. preserve current Brepia project placement and Result Item semantics.

The exact RhinoCommon overload/temporary curve representation is adapter detail. It may not add canonical frame, tolerance, rebuild or twist controls.

Installed-host evidence is required before Rhino parity is claimed.

## Provider / AI authoring boundary

The provider-facing schema adds only the finite bounded `sweep` variant above.

Authoring guidance must make the constraints explicit:

- use sweep only for one constant circular section;
- use exactly one planar 90-degree elbow path;
- first/second leg lengths are straight portions, excluding the curved bend;
- bend radius is the centerline radius;
- the circle radius is the physical section radius;
- the fixed canonical turn is +U to +V; use ordinary transforms/mirror for other orientation;
- do not approximate a requested smooth bend with boxes, cylinders or faceted primitives;
- do not invent arbitrary points, path source strings, guide rails or twist settings.

For unsupported multi-bend, non-planar, non-circular or variable-section requests, the model must state the limitation rather than fabricate unsupported canonical geometry.

Provider expression depth remains unchanged.

## Structural-editor boundary

The structural editor may expose:

- path plane normal axis: X / Y / Z;
- first leg length;
- second leg length;
- bend radius;
- circular profile radius.

Expression-backed values must remain expression-backed during unrelated edits. The editor must surface canonical validation errors rather than clamp or silently alter invalid radii.

No visual path sketcher, arbitrary point editor, twist widget, guide-rail picker or topology picker is added in this slice.

## Locked repository fixtures

### S1 — target-E nominal elbow

Use:

```text
planeNormalAxis = z
firstLegLength  = 1000 mm
secondLegLength = 700 mm
bendRadius      = 150 mm
tubeDiameter    = 40 mm
profile.radius  = tubeDiameter / 2
```

Expected centerline length:

```text
1000 + (pi/2 * 150) + 700 = 1935.6194490192345 mm
```

Expected native volume for a 20 mm radius section:

```text
pi * 20^2 * 1935.6194490192345
= 2432371.13647374 mm^3
```

This fixture must visibly and structurally be one circular tube/rod following the tangent elbow; primitive approximation is not acceptable.

### S2 — bend-radius effectiveness

Perturb `bendRadius: 150 -> 180`.

The centerline bend remains 90 degrees, both straight-leg lengths remain unchanged, and authoritative geometry/volume/bounds must change.

### S3 — section-radius effectiveness

Perturb a published Tube Diameter so `profile.radius` changes through an existing scalar expression. Geometry must keep the same centerline while section diameter and volume change.

### S4 — X/Y/Z frame parity

Run the same dimensions with `planeNormalAxis = x | y | z`.

All three must preserve path length, volume and topology while bounds rotate according to the locked cyclic U/V/N mapping.

### S5 — curvature-radius fail closed

A default or runtime override with:

```text
profile.radius >= bendRadius
```

must fail canonical/runtime validation before an authoritative geometry result is accepted.

Also cover zero/negative leg length, bend radius and section radius.

### S6 — unsupported schema breadth

Repository/provider tests must reject attempts to use:

- rectangle or closedPolyline sweep profiles;
- profile holes;
- arbitrary path points;
- arbitrary bend angle;
- multiple bends;
- non-planar path data;
- twist/frame/guide-rail fields.

### S7 — native artifact acceptance

After Gate A, the pinned native runtime must verify nominal + perturbed fixtures, one positive-volume solid, exact STEP and independent STEP re-import.

### S8 — installed Rhino acceptance

Fresh generated GHX must open/solve in installed Rhino 8, recompute after Bend Radius and Tube Diameter perturbation, save/close/reopen, and pass strict returned-GHX validation.

### S9 — product-path closeout

Rerun the original target-E product request through the authenticated Native BRep flow. The exported canonical project must contain `sweep` and must not satisfy the request through boxes/cylinders pretending to be the bend.

## Expected implementation touch points

Implementation is expected to remain bounded to:

- `shared/brepProject.ts` — additive node/path types, normalization and default validation;
- `shared/brepScalar.ts` — traversal/effectiveness for the four sweep scalars;
- `shared/brepProjectIntegrity.ts` — sweep remains a source `single` node;
- `shared/brepProjectEditing.ts` — editing/parameter-usage integration;
- `shared/brepAiTool.ts` and AI guidance — bounded provider variant only;
- structural editor UI — the five bounded fields only;
- `scripts/brep/brep_driver.py` — local line/JernArc/line path, circle section, sweep and exact-one-solid validation;
- `shared/brepGrasshopperRhinoScript*.ts` — equivalent Rhino 8 sweep translation;
- GHX compiler/strict-return tests — Result Item and parameter-only return remain invariant;
- focused canonical/native/Rhino fixtures and acceptance harnesses.

If implementation requires a reusable curve/path graph, a new value kind, arbitrary 3D vectors, profile twist semantics or another canonical concept, stop and reconcile this boundary before proceeding.

## Evidence gates

### Gate A — repository / CI

Require focused contract tests plus the full repository quality gate. Existing geometry regressions must remain green.

### Gate B — pinned native runtime

Require real build123d/OCCT execution, parameter perturbations, fail-closed invalid dimensions, exact STEP and independent STEP re-import.

### Gate C — installed Rhino 8 / Grasshopper

Require fresh GHX, one solid Brep, parameter perturbation, save/close/reopen and strict returned-GHX validation.

### Gate D — authenticated Native BRep product path

Require the original path-based target to produce semantically faithful sweep geometry through the normal AI/product route.

No gate is evidence for another.

## Decision

The first sweep implementation boundary is one canonical `sweep` node with a circle profile and one `planarElbow90` path.

The path is two positive straight portions joined by one positive-radius tangent +90-degree bend in a canonical X/Y/Z-aligned plane. The section is circular, constant and smaller than the bend radius. Result kind is `single` and every backend must produce exactly one positive-volume solid.

General paths, multiple bends, arbitrary angles, non-circular sections and twist/frame authoring remain explicitly deferred.

This boundary was accepted, implemented and verified without broadening. Closeout evidence is recorded in `docs/brep_sweep_status_2026-09-21.md`; post-sweep work is paused by `docs/brep_post_sweep_pause_decision_2026-09-21.md`.
