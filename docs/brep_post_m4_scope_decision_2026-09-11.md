# Post-M4 modeling scope decision

Status: **decision accepted — defer M5 shell/thickness; select M6 rotation parity next**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Decision

After M4 profile + extrusion reached repository/CI, native build123d / OCCT and installed Rhino 8 / Grasshopper acceptance, the next focused modeling-capability slice is:

```text
M6 — non-zero transform rotation parity
```

M5 wall/shell/thickness remains deferred. Optional M3C rectangular/grid pattern also remains deferred.

This decision is intentionally about sequencing. It does not remove M5 or M3C from the roadmap.

## Why M5 is not the immediate gap

The accepted M1–M4 surface can already express the main constructions that originally motivated wall/plate/thickness discussion without a new topology-sensitive primitive:

- M1 bounded scalar expressions provide derived offsets and thickness relationships;
- M2 subtract/union/intersect provides deterministic solid composition;
- M3A/M3B provide symmetry and bounded repetition;
- M4 closed rectangle/circle/polyline profiles plus centered extrusion provide explicit plates, wall outlines and non-box planar forms.

A hollow wall/plate-style solid can therefore be represented by explicit outer/inner extrusions and M2 subtraction. Holes and openings can be represented by explicit extruded cutters. That may be less concise than a shell primitive, but it is already canonical, deterministic and accepted in both native and Rhino runtimes.

Adding shell/thickness now would primarily reduce graph verbosity. It would also immediately create a harder topology-selection problem: shell/offset operations generally require identifying faces or regions robustly across kernels. The project invariant still prohibits persisted raw Rhino/build123d face or edge indices as canonical topology authority.

M5 should be reconsidered only when a concrete target fixture demonstrates that the accepted M1–M4 language is materially inadequate, not merely verbose.

## Why M6 is the stronger next slice

Rotation is already part of canonical v1:

```ts
type BrepTransformNode = {
  id: string;
  type: 'transform';
  input: string;
  translate?: BrepVector3;
  rotateDeg?: BrepVector3;
};
```

The native build123d / OCCT evaluator already evaluates both translation and rotation through:

```text
Location(translation, rotation)
```

The active Rhino/GHX compiler, however, intentionally fails closed for every non-zero `rotateDeg` value and emits translation only.

That creates a real cross-runtime capability mismatch:

```text
canonical/native: non-zero rotation represented and executable
Rhino/GHX:         non-zero rotation rejected
```

Closing this mismatch increases the usable modeling space immediately and removes an existing intentionally deferred feature boundary instead of inventing a new topology-sensitive abstraction.

## M6 analysis lock

No implementation should begin until the rotation convention is reconciled explicitly.

The M6 analysis must determine and document:

1. the exact build123d 0.11.1 `Location(translation, rotation)` rotation convention;
2. axis meaning for canonical `[rx, ry, rz]` degrees;
3. Euler/composition order and whether rotations are world- or local-axis ordered;
4. translation-vs-rotation operation order;
5. the equivalent RhinoCommon `Transform` construction and multiplication order;
6. behavior for expression-backed degree scalars under M1 limits;
7. deterministic parity fixtures that make incorrect order visibly and numerically detectable;
8. installed Rhino 8 / Grasshopper acceptance with parameter perturbation and save/close/reopen.

Until that contract is written, the current Rhino fail-closed guard for non-zero rotation remains correct and must not be weakened.

## Initial bounded M6 target

The preferred first M6 surface is not a new node. It is parity for the existing canonical `transform.rotateDeg` field.

Keep the existing vector shape:

```text
rotateDeg = [rx, ry, rz]
```

and retain the existing M1 degree-scalar rules. Do not add arbitrary axis-angle, quaternion, matrix or free-form transform representations in the first slice.

The first implementation should support the full existing three-component canonical field only after one deterministic convention is established. Avoid a temporary special case such as “Z rotation only” unless upstream semantics make full parity impossible to define safely.

## Required acceptance shape

Repository acceptance should include at minimum:

- single-axis X/Y/Z rotation fixtures;
- a deliberately asymmetric multi-axis fixture that detects Euler-order mistakes;
- translation + rotation together to detect transform-order mistakes;
- expression-backed / parameter-backed degree values;
- zero-rotation regression preserving current behavior;
- native build123d bounds/point probes;
- equivalent Rhino compiler assertions;
- existing M0–M4 regression suite green.

External runtime acceptance remains two separate boundaries:

1. real local pinned build123d / OCCT runtime;
2. installed Rhino 8 / Grasshopper with fresh current-branch GHX, parameter perturbation and save -> close -> reopen.

## Deferred work

This decision does not start or broaden:

- M5 shell/thickness;
- domain-specific `wall` nodes;
- M3C rectangular/grid pattern;
- M7 topology/finishing expansion;
- arbitrary workplanes;
- free-form matrices/quaternions/axis-angle transforms;
- reusable sketch/profile authority;
- open profiles or holes/multiple loops inside one M4 profile;
- general collection algebra.

## Preserved architecture

M6 must preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d / OCCT native geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter-effectiveness and reachability rules;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 / finite reference-free schema;
- M2 exact-one-body Boolean semantics;
- M3B `single | instanceSet` cardinality and collection consumer rules;
- M4 profile/extrusion semantics;
- GHX parameter-only return/import boundary;
- OpenSCAD regressions;
- C4 image-projection deferral.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
