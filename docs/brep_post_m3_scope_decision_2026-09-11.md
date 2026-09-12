# Post-M3 modeling scope decision — 2026-09-11

Status: **DECIDED — proceed to M4 profile + extrusion foundation. M3C rectangular/grid pattern is deferred. No M4 implementation is part of this checkpoint.**

Decision basis checkpoint:

```text
dc2183f92fac4248fae2c6f3985ec572ea6d9728
Add post-M3 modeling handover
```

CI on that exact checkpoint was green before this decision was written:

```text
Quality Gate #945       PASS
Grasshopper Build #517 PASS
```

PR #36 remains draft, stacked and unmerged.

## Reconciliation result

The post-M3 documentation was reconciled against the actual implementation on the decision-basis checkpoint before choosing the next modeling scope.

### Canonical and provider surface

The canonical pipeline currently contains solid-producing primitives and solid operations only:

- `box`;
- `cylinder`;
- `transform`;
- `mirror`;
- `linearPattern`;
- `fillet`;
- `union`;
- `intersect`;
- `subtract`.

There is no profile or extrusion representation in the canonical schema or provider-facing authoring schema.

The provider schema remains finite and reference-free and retains provider expression depth 2. Canonical scalar expressions retain depth 12 and expression-node limit 64.

### Result cardinality

M3B intentionally introduced only:

```text
single | instanceSet
```

The implementation preserves the narrow M3B rules:

- final `linearPattern` may be an ordered `instanceSet`;
- stable instance body IDs are `<patternId>::<index>`;
- `subtract.tools[]` may flatten an instance set as ordered cutters;
- transform, mirror, fillet, another linear pattern, union/intersection, subtract base and project-object geometry roles remain single-only;
- no nested/general collection algebra exists;
- there is no implicit union of a pattern result.

### Native evaluator

The build123d/OCCT driver implements the same cardinality rules and exact multi-solid STEP behavior for `instanceSet`. It has no profile/extrude evaluator path.

### Rhino/GHX compiler

The Rhino interoperability compiler likewise implements M3B list results explicitly while preserving item results for single-body outputs. It has no profile/extrude compiler path.

Existing box and cylinder generation is centered around world origin. That gives M4 a compatible origin-centered convention without enabling non-zero rotation.

### M3B runtime state

M3B is no longer pending runtime acceptance. It is accepted at all required current boundaries:

- repository/CI;
- real rootless build123d/OCCT runtime;
- installed Rhino 8 / Grasshopper;
- final ordered list-result behavior;
- pattern-as-subtract-cutters behavior;
- save -> close -> reopen persistence in Rhino 8 / Grasshopper.

Evidence:

- `docs/brep_m3b_linear_pattern_status.md`;
- `docs/brep_m3b_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md`.

## M3C versus M4

| Criterion | M3C rectangular/grid pattern | M4 profile + extrusion |
| --- | --- | --- |
| New representational capability | Low to medium: extends repetition from one axis to a bounded grid | High: introduces a missing class of bounded prismatic geometry |
| Reuse of current semantics | High: can build on M3B `instanceSet` | Medium/high if extrusion remains single-body and profile data stays bounded |
| Pressure on collection algebra | Medium: requires new 2D ordering/body-ID semantics and care not to generalize nested sets | Low if each extrusion remains `single` |
| Product leverage | Mainly graph compression and 2D repetition | Plates, wall outlines and arbitrary bounded prismatic outlines become direct representations |
| Current blocker | No concrete accepted fixture is blocked by lack of grid repetition | Current `box`/`cylinder`-centric vocabulary cannot directly represent general 2D outlines extruded into solids |

M3C is therefore useful but not the highest-leverage next step. A grid pattern would make some repeated layouts more concise, but it would not materially broaden the kinds of base shapes the language can represent. Existing M3B already covers the accepted one-dimensional repetition cases.

M4 addresses a genuine representational gap. In particular, a bounded closed-polyline extrusion can represent prismatic shapes that cannot be expressed directly by the current primitive vocabulary without Boolean decomposition.

## Decision

Proceed next with **M4 profile + extrusion foundation**.

Defer **M3C rectangular/grid pattern** until either:

1. a concrete product/model fixture is materially blocked by two-dimensional repetition; or
2. M4 acceptance is complete and grid repetition is still the highest-value next modeling capability.

Deferral does not remove M3C from the roadmap and does not relax any M3B contract.

## M4 foundation contract for implementation planning

The first M4 slice should add one new **solid-producing `extrude` node** whose profile is bounded data owned by the node. Do not introduce a first-class pipeline profile result in the initial slice.

This is deliberate: a standalone profile node would require a new non-solid result kind and mixed graph-reference semantics. Keeping profile data inside `extrude` lets the existing pipeline continue to expose only `single | instanceSet` body cardinality.

Candidate canonical shape:

```ts
type BrepProfile =
  | {
      type: 'rectangle';
      width: BrepScalar;
      height: BrepScalar;
    }
  | {
      type: 'circle';
      radius: BrepScalar;
    }
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

This shape is a planning contract, not implementation in this checkpoint. Exact field names may only change during implementation if repository constraints require it; the semantic bounds below should remain authoritative.

### Coordinate and extrusion semantics

Use a canonical right-handed local profile frame with its origin at world origin:

- axis `x`: `u = y`, `v = z`, normal `+x`;
- axis `y`: `u = z`, `v = x`, normal `+y`;
- axis `z`: `u = x`, `v = y`, normal `+z`.

Extrusion depth is symmetric around the profile plane:

```text
-depth / 2 ... +depth / 2
```

along the selected canonical axis. This preserves the existing origin-centered primitive convention and does not depend on M6 rotation semantics.

Rectangle and circle profiles are centered on the local profile origin. Closed-polyline coordinates are explicit local `(u, v)` coordinates and closure is implicit.

### Initial bounds

Keep the first profile language deliberately narrow:

- rectangle width/height use existing millimetre scalar semantics and must evaluate strictly positive;
- circle radius uses existing millimetre scalar semantics and must evaluate strictly positive;
- extrusion depth uses existing millimetre scalar semantics and must evaluate strictly positive;
- closed polyline contains 3–32 boundary vertices;
- closed-polyline coordinates use existing millimetre scalar semantics;
- repeated terminal point is not required because closure is implicit;
- evaluated profiles must fail closed for duplicate/zero-length edges, zero area, self-intersection or other degeneracy that prevents a deterministic single solid;
- runtime parameter overrides must pass the same evaluated-profile validity checks as defaults.

The profile representation remains finite/reference-free. It must not contain executable source, arbitrary expressions outside the existing bounded `BrepScalar` AST, or references to Rhino/build123d topology.

### Result and consumer semantics

`extrude` produces exactly one `single` body.

Therefore an extrusion may participate anywhere an existing single body is accepted, without changing the M3B collection rules. M4 must not add another result cardinality, implicitly union instance sets, or make existing single-only consumers accept collections.

Canonical `schemaVersion` remains `1`; M4 is an additive extension.

### Explicitly out of scope for the first M4 slice

Do not add:

- arbitrary workplanes or arbitrary direction vectors;
- non-zero rotation or any M6 shortcut;
- open profiles;
- holes or multiple profile loops;
- sketch constraints;
- NURBS/splines/arcs beyond the explicit circle profile;
- first-class reusable profile graph nodes;
- topology references;
- nested/general collections;
- shell/wall/thickness semantics;
- M3C grid pattern.

## Required M4 acceptance boundary

Implementation should not be declared complete from unit tests alone. The eventual M4 closeout must include:

1. canonical normalization/DAG/M0 reachability integration;
2. finite/reference-free provider schema and AI instructions;
3. structural editor support that preserves expression ASTs;
4. native build123d/OCCT parity with exact STEP evidence;
5. Rhino/GHX compiler parity;
6. fresh installed Rhino 8 / Grasshopper acceptance;
7. parameter perturbation proving expression-backed profile/extrusion dimensions recompute geometry;
8. save -> close -> reopen acceptance in installed Rhino 8 / Grasshopper;
9. existing M0–M3 and OpenSCAD regressions remain green.

GHX return/import remains parameter-only. C4 remains deferred until real image-bearing evidence exists. PR #36 remains draft, stacked and unmerged.

## Next action

With this decision recorded, the next development checkpoint may begin **M4 implementation analysis against the exact canonical/provider/native/Rhino/editor/test surfaces**. Feature code was intentionally not changed while making this scope decision.
