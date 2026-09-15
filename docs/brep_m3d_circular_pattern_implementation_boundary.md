# M3D bounded circular pattern implementation boundary

Date: 2026-09-12

Status: implementation boundary locked after reconciliation; repository implementation not yet implied by this document.

## Reconciled baseline

This boundary is based on the accepted branch checkpoint `5924e40174a56382cf155ad15fefafe787124fc1` (`Reconcile M3C server boundary closeout`). At that checkpoint repository CI was green (Quality Gate #1045 and Grasshopper Build #617). Those workflow results are repository evidence only; they are not native build123d/OCCT or installed Rhino 8 / Grasshopper runtime evidence.

The existing modeling/value-kind contract remains authoritative:

- `schemaVersion: 1`;
- canonical BRep and immutable revisions are authoritative;
- build123d / OCCT remains native geometry authority;
- Rhino/GHX remains an interoperability compiler;
- node values are `single | instanceSet`;
- pattern inputs must resolve to `single`;
- only `subtract.tools[]` may consume `instanceSet`;
- final pattern results use Grasshopper Result **List** Access;
- no nested patterns, pattern-of-pattern, generic collection algebra, or implicit pattern union;
- M1 scalar limits and provider-schema bounds remain unchanged;
- M6 transform convention remains Intrinsic XYZ, `R = Rx * Ry * Rz`, `p' = R*p + T`;
- returned GHX remains a strict parameter-only boundary.

M3B and M3C establish stable instance identity and deterministic list ordering. M3D extends those semantics to radial repetition instead of introducing another collection model.

## Why circular pattern is the next slice

A radial fixture cannot currently be represented compactly with parameter-backed canonical geometry. M6 can rotate one object, but M1 deliberately has no trigonometric functions. Bolt circles, radial holes, fan blades and similar fixtures therefore require expanded nodes with baked X/Y coordinates and repeated rotations.

That is a representational gap rather than only graph verbosity.

## Locked first-slice canonical node

```ts
type BrepCircularPatternNode = {
  id: string;
  type: 'circularPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  center: BrepVector3;
  count: number;
  angleStepDeg: BrepScalar;
};
```

No `startAngleDeg`, `totalAngleDeg`, radius, orientation mode, arbitrary axis vector, reference plane, or trigonometric canonical expression is added in M3D.

### Why `angleStepDeg`

`angleStepDeg` gives the same bounded `index * step` model already used by linear pattern spacing:

- instance `0` is exactly the source;
- instance `i` uses `i * angleStepDeg`;
- there is no inclusive/exclusive ambiguity around a total-angle endpoint;
- phase and radius remain properties of the upstream seed geometry;
- a parameter can change angular spacing without adding `sin/cos` to M1.

`totalAngleDeg` is therefore deferred. `startAngleDeg` is also deferred because an upstream M6 transform already expresses seed phase without duplicating rotation semantics inside the pattern node.

## Cardinality and value-kind rules

- `input` must resolve to `single`.
- output is the existing `instanceSet`.
- `count` is a literal integer from `2` through `32`, reusing the existing bounded pattern-count limit.
- final `circularPattern` output contains exactly `count` primary bodies.
- `subtract.tools[]` may consume those bodies one-by-one in canonical order.
- all other single-input consumers continue to reject an `instanceSet`.

No separate circular-pattern instance cap is required for the first slice because a single count is already capped at 32. M3C retains its independent two-dimensional total cap of 64.

## Geometric semantics

For a pattern node `P` with source shape `S`:

1. The rotation axis is the positive canonical X, Y or Z axis selected by `axis`, passing through `center`.
2. `center` is a three-component M1 scalar vector in millimetres.
3. Instance `i` for `0 <= i < count` is a rigid rotation of the complete source shape around that axis by `i * angleStepDeg` degrees.
4. Positive angles follow the ordinary right-hand rule around the positive selected canonical axis. Negative angles rotate in the opposite direction.
5. The rigid transform changes both location and orientation. There is no separate "keep orientation" mode.
6. Instance `0` applies a zero-degree rotation and therefore preserves the source geometry exactly.

The pattern transform operates in canonical project-local coordinates. Project placement remains a later, orthogonal placement step; the circular center/axis must not be interpreted a second time in world coordinates. This matches the current Rhino compiler structure, where feature geometry is produced first and `brepiaTransform` project placement is applied to the final result afterward.

## Effective-angle fail-close boundary

The canonical shape may contain an M1 scalar expression, so the following rule must be checked both against parameter defaults and against runtime parameter overrides:

```text
0 < abs(angleStepDeg) * count <= 360
```

Consequences:

- zero effective angle is rejected;
- `6 * 60deg` and `8 * 45deg` are accepted;
- negative equivalents are accepted;
- a pattern whose effective step/count span exceeds one complete turn is rejected;
- the endpoint at 360 degrees is not generated because the highest generated index is `count - 1`, so `count * abs(step) == 360` still yields unique generated angular positions.

This intentionally rejects some mathematically unique sequences whose accumulated step is greater than 360 degrees. The first slice prefers a simple, auditable bounded contract over modular-angle reasoning.

Runtime validation must use the same normalized finite-scalar discipline as M1. The rule is a circular-pattern semantic constraint, not a relaxation of scalar limits.

## Stable identity and ordering

Ordering is strictly ascending index:

```text
0, 1, 2, ... count - 1
```

Primary body identity remains:

```text
<circularPatternId>::<index>
```

Each body carries the existing instance metadata:

```json
{
  "nodeId": "<circularPatternId>",
  "instance": {
    "index": 0,
    "sourceNodeId": "<inputNodeId>"
  }
}
```

No angle-derived or kernel-derived identifier is introduced.

## Server evaluation boundary

`src/server/brepEvaluation.ts` must classify `circularPattern` as `instanceSet` and, when it is the top-level result, validate:

- primary body count equals `count`;
- body IDs equal `<patternId>::<index>` in canonical order;
- `nodeId` equals the pattern node id;
- `instance.index` equals the body index;
- `instance.sourceNodeId` equals `input`.

The M3C server-boundary regression demonstrated why canonical value-kind classification alone is insufficient; top-level server cardinality validation must be updated in the same repository slice.

## Native build123d / OCCT strategy

The native evaluator should extend the existing `evaluate_node_instances()` path rather than create a new result container.

For each index it should duplicate/move the source by an exact rigid rotation around the canonical axis line through `center`. The exact build123d/OCCT API choice must preserve this semantic transform; it must not approximate the radial positions with baked trigonometric translations.

Existing output behavior is retained:

- ordinary `instanceSet` primary-body payloads;
- `Compound` only as the export carrier for a final multi-body result, not as canonical implicit union;
- exact multi-solid STEP export;
- existing 3DM packaging and body metadata;
- subtract iterates the pattern bodies independently.

Pinned native runtime acceptance is separate from repository tests/CI.

## Rhino 8 / Grasshopper compiler strategy

The Rhino compiler should generate the same rigid rotation with RhinoCommon, conceptually:

```python
rg.Transform.Rotation(
    math.radians(index * angle_step_deg),
    canonical_axis_vector,
    rg.Point3d(center_x, center_y, center_z),
)
```

Each instance duplicates the source Brep, applies that transform, and appends it in ascending index order.

Required interoperability behavior:

- final circular pattern -> Result **List** Access;
- circular pattern in `subtract.tools[]` -> iterate every cutter in canonical order;
- project placement is applied only after local feature evaluation, as for the existing M3/M6 path;
- returned GHX remains parameter-only and undergoes the same strict current-compiler validation;
- no returned topology, node graph, pattern structure or executable script becomes authoritative.

Installed Rhino 8 / Grasshopper acceptance must use fresh current-compiler fixtures and is separate evidence from repository CI and native runtime.

## Provider/context boundary

The provider-facing schema adds one finite/reference-free circular-pattern alternative with:

- literal `axis` enum;
- bounded literal integer `count`;
- three bounded M1-provider scalar components for `center` using the existing provider expression-depth limit;
- one bounded M1-provider scalar for `angleStepDeg` using degree-compatible parameter references.

The addition must not increase provider expression recursion or add trigonometric operators. AI context/project projection needs only enough vocabulary to describe the new node and its bounded semantics.

## Structural editor boundary

The existing structural editor is graph-preserving and must learn the new node anywhere it switches exhaustively over node kinds. It must not gain a special collection editor or a second pattern model.

Edits to parameters referenced by `center` or `angleStepDeg` continue through the existing parameter-edit path and immutable-revision flow.

## Target fixtures

### Fixture A — final asymmetric bolt-circle pattern

Use an asymmetric seed so orientation and direction are observable, for example a translated non-square extrusion rather than only a rotationally symmetric cylinder.

Minimum assertions:

- six distinct output bodies;
- index `0` equals the seed;
- deterministic index ordering and stable IDs;
- right-hand direction visible in body bounds/placement;
- center offset visible;
- parameter perturbation of seed radius and/or angular spacing recomputes deterministically;
- final Grasshopper output is List Access;
- save -> close -> reopen retains the result.

### Fixture B — circular pattern subtract cutters

Use a plate/flange and an offset cutter seed with six or eight circularly repeated cutters.

Minimum assertions:

- pattern is accepted only in `subtract.tools[]`;
- every cutter is consumed independently in canonical order;
- final result is exactly one `single` body;
- no implicit union/fuse of cutter instances occurs;
- native exact STEP and Rhino geometry agree on hole count/placement after parameter perturbation.

At least one fixture must use a non-origin center or otherwise asymmetric geometry so incorrect center, direction, indexing, orientation, project placement or Item/List semantics cannot accidentally pass.

## Required repository implementation surface

The M3D repository slice must reconcile and, where required, update:

1. canonical node types, normalization, dependency/value-kind rules and default/runtime validation;
2. provider finite schema and AI project/context projection;
3. project integrity and structural-editor exhaustive switches;
4. native build123d/OCCT evaluator and exact export path;
5. server primary-body/cardinality validation;
6. Rhino script compiler and subtract consumption;
7. GHX executable/result-access compilation and strict validation;
8. focused canonical/provider/server/native-compiler/Rhino-compiler tests;
9. modeling/status documentation.

No shell, chamfer/topology, richer-profile, reusable-sketch, arbitrary-plane or revolve work belongs to this slice.

## Evidence sequence

Acceptance is intentionally staged:

1. focused repository tests;
2. full repository Quality Gate + Grasshopper Build;
3. fresh pinned build123d/OCCT native runtime evidence;
4. fresh installed Rhino 8 / Grasshopper runtime evidence.

Passing an earlier stage must never be described as evidence for a later stage.

## Merge boundary

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component`, and unmerged. M3D work does not change that boundary. Nothing is merged without a new explicit decision.
