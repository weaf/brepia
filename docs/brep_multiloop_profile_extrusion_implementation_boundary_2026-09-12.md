# Bounded multi-loop profile extrusion implementation boundary — 2026-09-12

Status: **LOCKED FOR IMPLEMENTATION — bounded additive M4 extension only**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Purpose

Add explicit through-holes to constant-section profile extrusion without creating a general sketch system and without migrating accepted M4 single-loop payloads.

## Canonical representation

Existing outer profile syntax remains authoritative and unchanged:

```ts
type BrepProfileLoop =
  | { type: 'rectangle'; width: BrepScalar; height: BrepScalar }
  | { type: 'circle'; radius: BrepScalar }
  | {
      type: 'closedPolyline';
      points: Array<{ u: BrepScalar; v: BrepScalar }>;
    };

type BrepProfileHole = {
  loop: BrepProfileLoop;
  offsetU: BrepScalar;
  offsetV: BrepScalar;
};
```

`BrepProfile` is the existing outer loop plus optional holes. The implementation may express this as three explicit extended union members to keep TypeScript discriminants precise.

Required semantics:

- `holes` omitted => exactly existing M4 behavior;
- `holes: []` normalizes away or behaves identically to omitted holes;
- holes cannot contain holes;
- hole loop families are rectangle, circle and closedPolyline;
- every hole has explicit local `offsetU` / `offsetV` in millimetres;
- rectangle/circle hole geometry is centered at its translated local offset;
- closedPolyline hole point coordinates are translated by the hole offset;
- profile plane/frame is exactly existing M4: X => U=Y,V=Z; Y => U=Z,V=X; Z => U=X,V=Y;
- extrusion remains centered from `-depth/2` to `+depth/2`;
- canonical `schemaVersion` remains `1`.

No separate outer wrapper is introduced because that would unnecessarily migrate all accepted M4 payloads.

## Bounds

Lock the first slice to:

```text
max holes per profile                    8
max points per closedPolyline           32 (existing M4 limit)
max explicit polyline points total     128 across outer + holes
```

The total-point bound counts only explicit `closedPolyline.points`; rectangle/circle loops do not synthesize canonical points.

## Operation boundary

Multi-loop profiles are supported only by `extrude` in this slice.

- `extrude` may contain zero or more bounded holes;
- `revolve` with no holes keeps accepted revolve behavior;
- `revolve` with any non-empty `holes` fails canonical normalization/validation;
- no other node gains profile-loop semantics.

Result cardinality remains `single`.

## M1 scalar semantics

All new scalar-bearing fields reuse existing M1 semantics:

- hole rectangle width/height;
- hole circle radius;
- hole closedPolyline U/V coordinates;
- hole `offsetU`;
- hole `offsetV`.

Preserve:

```text
canonical scalar depth       12
canonical scalar node limit  64
provider expression depth     2
existing unit algebra
```

No new scalar functions or operators are introduced.

## M0 parameter effectiveness

Parameter/dependency traversal must include every hole scalar transitively.

A published parameter referenced only by a hole's size, points or U/V offset is effective if the owning extrusion is effective. Such parameters must not be classified as unused/orphan.

Project editing/dependency traversal must preserve the same scalar AST rather than resolving expressions to literals.

## Geometry validity

Validation runs against effective scalar values both:

1. at normalized project defaults;
2. after runtime parameter overrides before kernel execution.

### Individual loop validity

Existing M4 rules remain:

- rectangle width/height > 0;
- circle radius > 0;
- closedPolyline has 3..32 points;
- no zero-length closedPolyline edge;
- non-zero area;
- no self-intersection.

Winding/orientation is not canonical meaning. Explicit outer/hole role determines semantics.

### Multi-loop validity

For every resolved hole:

- it must be strictly inside the resolved outer boundary;
- it must not touch or cross the outer boundary;
- it must not be coincident with the outer boundary;
- it must not intersect or touch another hole;
- it must not contain another hole;
- it must not be contained by another hole;
- duplicate/coincident hole loops fail closed.

These predicates must be kernel-neutral and must not depend on Rhino or OCCT face/edge identities.

Tangency counts as touching and fails closed in the first slice.

## Kernel-neutral geometry predicate strategy

`shared/brepProfileGeometry.ts` should own deterministic resolved 2D loop checks.

The implementation should evaluate exact analytic predicates for the accepted loop families where practical:

- rectangle/rectangle;
- circle/circle;
- rectangle/circle;
- closedPolyline against rectangle/circle/closedPolyline using segment/containment checks.

Do not approximate canonical circles with a persisted polygon or make acceptance depend on tessellation quality.

The validation contract is semantic rather than topology-based: strict containment and strict pairwise separation must agree before either backend is asked to build geometry.

## Extrusion semantics

Authoritative meaning:

```text
outer loop - union(inner hole loops)
               |
             extrude
               |
     exactly one positive-volume solid
```

If native or Rhino execution yields:

- no result;
- zero solids/Breps;
- more than one solid/Brep;
- non-solid output;
- zero/non-positive volume;
- otherwise ambiguous output;

then evaluation fails closed.

No adapter may choose the first result silently.

## Provider / AI boundary

Provider schema must remain finite and bounded:

- optional `holes` array, max 8;
- each hole contains a finite non-recursive `loop` discriminated union;
- `offsetU` and `offsetV` are provider-safe M1 scalars;
- existing closedPolyline max 32 points;
- provider expression depth remains 2;
- no source strings;
- no executable sketch logic;
- no topology references;
- no reusable profile references.

Native BRep AI guidance should prefer one multi-loop extrusion when the user's intended part is a constant-section plate/flange/gasket/panel with through-openings. Existing cutter + subtract composition remains valid and should still be used when geometry is not a single constant-section multi-loop profile.

## Structural editor boundary

Add bounded profile-hole editing only:

- list existing holes in deterministic array order;
- add hole (rectangle/circle/closedPolyline);
- remove hole;
- edit loop scalar values;
- edit `offsetU` / `offsetV`;
- optionally reorder holes deterministically if current editor architecture already has a safe bounded reorder pattern.

The editor must preserve expression AST values. It must not materialize expression-backed scalars to literals during unrelated edits.

Do not add a freeform sketch canvas, constraints, arbitrary workplanes, reusable profile objects or topology picking.

## Native build123d / OCCT translation

build123d/OCCT remains geometry authority.

The native adapter must construct one planar face/profile with outer boundary plus inner boundaries and perform the same centered extrusion as M4.

Preferred implementation shape:

1. resolve/validate canonical loops in kernel-neutral code/server path;
2. create native outer wire/face in the existing canonical plane;
3. create translated inner wires;
4. form one face with holes using build123d/OCP-supported planar face semantics;
5. centered extrude `both=True`;
6. require exactly one positive-volume solid;
7. preserve exact STEP export.

Do not implement holes by silently creating cutter solids and Boolean-subtracting them in the native adapter; the canonical operation is one multi-loop profile extrusion.

## Rhino 8 / GHX translation

Rhino/GHX remains interoperability-only.

For multi-loop extrusion, the generated Rhino Python 3 component should:

1. construct the same explicit M4 profile plane/frame;
2. construct outer and translated inner closed curves;
3. create one planar Brep/region representing outer minus holes using RhinoCommon's planar-Brep APIs and active document tolerance;
4. extrude that planar region symmetrically using a RhinoCommon path that preserves holes;
5. require exactly one closed positive-volume Brep;
6. apply existing Brepia placement;
7. emit Result Item.

The previous single-curve `Extrusion.Create(curve, plane, depth, cap)` path may remain for single-loop profiles if that preserves accepted M4 behavior. Multi-loop must use a region/Brep extrusion path that preserves inner loops.

Installed Rhino 8 host evidence is required before runtime parity is claimed.

## Generated/returned GHX boundary

No GHX trust expansion is allowed.

Strict validation continues to own:

- expected Brepia component identity;
- script source;
- graph/object count and ordering;
- wiring;
- port identifiers/type hints/runtime settings;
- published parameter controls;
- Result Item/List access;
- bounded Rhino host-save normalization already accepted.

Returned GHX remains parameter-only. Multi-loop support does not permit graph, script, wiring or hole-structure mutation to be imported from Grasshopper.

## Server / evaluation boundary

Runtime override validation must re-resolve and re-check:

- all outer loop scalars;
- all hole loop scalars;
- all hole offsets;
- depth;
- all multi-loop containment/separation predicates.

Invalid runtime parameter combinations must fail before or during authoritative kernel execution and must not produce a stale accepted geometry result.

## Required repository fixtures

Gate A coverage must include at least:

A. rectangle outer + centered circle hole with published hole radius/diameter;

B. rectangle outer + at least two separated holes;

C. expression-backed hole placement, e.g. `width / 2 - margin`, without synthetic published helper parameters;

D. at least one non-circular closedPolyline hole;

E. hole partly/fully outside outer => fail closed;

F. intersecting/touching holes => fail closed;

G. hole touching outer => fail closed;

H. nested holes => fail closed;

I. runtime override that turns a valid profile invalid => fail closed;

J. existing single-loop M4 fixtures remain byte/semantic compatible where applicable;

K. revolve with non-empty holes => fail closed.

## Gate B target

Real pinned native runtime must verify:

- valid multi-hole execution;
- parameter perturbation;
- expression-backed offset;
- invalid arrangement failures;
- exactly one positive-volume solid;
- exact STEP;
- independent STEP re-import with hole topology/volume preserved.

## Gate C target

Fresh current-compiler GHX in installed Rhino 8 / Grasshopper must verify:

- open/solve;
- visible holes;
- parameter-driven hole size/placement update;
- recomputation;
- save -> close -> reopen;
- persisted controls;
- strict returned-GHX validation;
- Result Item.

## Explicitly out of scope

This slice does not add:

- reusable sketch/profile graph nodes;
- arbitrary sketch planes;
- sketch constraints;
- islands/nested loop hierarchies;
- holes-inside-holes semantics;
- open profiles;
- splines/NURBS authoring;
- shell/thickness;
- chamfer or topology-sensitive finishing;
- raw topology IDs;
- partial/arbitrary-axis revolve;
- general collection algebra;
- pattern nesting;
- new M1 functions;
- C4 image projection.

## Implementation order

Implement in small checkpoints:

1. canonical types + normalization + bounds;
2. M0/M1 traversal and resolved kernel-neutral validity;
3. provider/AI + structural editor;
4. native translation + focused tests;
5. Rhino/GHX translation + strict validation tests;
6. full Gate A repository acceptance;
7. separate Gate B evidence;
8. separate Gate C evidence.

No step may broaden the scope beyond this document without a separate decision.
