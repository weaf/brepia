# BRep modeling capability expansion plan

Status: proposed next product/modeling track after the current Rhino 8 host-acceptance slice is reconciled. This plan is intentionally separate from Phase 9 GHX installed-host acceptance.

## Why this track exists

Two real Brepia-generated projects that successfully opened in Rhino 8 / Grasshopper exposed a product-level limitation that is not primarily a Rhino/GHX problem:

- published parameters can exist without affecting the authoritative result;
- intended relationships are frequently baked into literals;
- repeated objects are approximated with manual Boolean voids;
- the current canonical node vocabulary pushes the model toward `box` + `transform` + `subtract` graphs;
- finishing features can exist on an orphan branch instead of becoming the authoritative `resultNodeId`.

The goal is not to make the canonical format a general-purpose scripting language. The goal is a bounded, deterministic, kernel-neutral parametric modeling language that can represent ordinary mechanical/architectural forms without baking derived dimensions or relying on fragile raw topology IDs.

## Invariants

Preserve throughout this work:

- `conversation.type = 'parametric'`;
- explicit Native BRep routing through `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d/OCCT remains the authoritative native evaluator;
- Rhino/GHX remains an interoperability compiler, not canonical authority;
- returned GHX stays parameter-only at the supported round-trip boundary;
- no arbitrary Python/expression/code execution in the canonical schema;
- no raw Rhino/build123d edge/face indices as persisted topology authority;
- every newly translated operation is fail-closed until native parity tests and real Rhino 8 host evidence exist.

## M0 — parameter effectiveness and graph integrity

Do this before broadening the geometry language.

### Problems to catch

1. published parameter never referenced anywhere;
2. parameter referenced only by an orphan branch that cannot reach `resultNodeId` or an explicit project-object geometry role;
3. canonical feature branch exists but is unreachable from all authoritative outputs;
4. finishing feature exists but the project accidentally leaves the unfinished predecessor as `resultNodeId`;
5. AI exposes duplicate/contradictory controls such as diameter and radius while only one is actually wired.

### Proposed implementation

Add a shared deterministic analysis layer, not kernel heuristics:

- compute graph reachability from `resultNodeId` and project-object geometry roles;
- compute parameter references transitively within authoritative reachable nodes;
- separately track parameter references from placement and semantic project-object points;
- classify parameters as `effective`, `semantic-only`, `orphan-only` or `unused`;
- classify nodes as authoritative-reachable, role-reachable or orphan.

For AI-created/AI-edited BRep snapshots, reject or repair `unused`/`orphan-only` published geometry parameters and unintended orphan feature branches before persistence. Manual/imported legacy projects may initially surface diagnostics rather than becoming globally invalid schema.

### Acceptance

A generated project may not present a geometry parameter slider that cannot affect an authoritative geometry output. A finishing node intended by the model must not silently remain outside the authoritative result chain.

## M1 — safe scalar expression graph

The current scalar form is only a literal or direct parameter reference. That cannot express ordinary relationships such as:

- half room height;
- wall offset = outer dimension / 2 - thickness / 2;
- cabinet bank width = count * cabinet width + gaps;
- centered opening position;
- cutter height = plate thickness + clearance.

### Proposed canonical form

Extend scalar semantics with a bounded expression AST rather than strings or executable code. Example shape:

```ts
type BrepScalar =
  | number
  | { parameter: string }
  | { op: 'add' | 'sub' | 'mul' | 'div' | 'neg'; args: BrepScalar[] };
```

The final schema should use tighter arity per operator, finite-value checks, unit checking, depth/node-count limits and explicit divide-by-zero validation.

### Requirements

- deterministic shared evaluator used by native build123d and Rhino compiler;
- unit-aware validation (`mm`, `deg`, `none`);
- no arbitrary functions, variables or source strings;
- no cyclic expression references;
- GHX returns only published input values, never edits the canonical expression graph;
- deterministic serialization for export/import identity.

### Immediate product benefit

This alone fixes much of the observed broken-parametric behavior without inventing domain-specific wall/cabinet nodes. Boxes and transforms become genuinely relational instead of partially baked.

## M2 — additive Boolean composition

Canonical v1 currently has subtract only. Add kernel-neutral operations only where both native evaluator and Rhino 8 mapping can be proven:

- `union`;
- `intersect`.

Use ordered node references, deterministic result-cardinality rules and fail-closed behavior when an operation yields an unsupported multi-body ambiguity.

This enables explicit wall/panel/cabinet solids to be composed rather than representing most structure as voids cut from one master block.

## M3 — repetition and symmetry

Add modeling operations that eliminate repeated literal transforms:

- linear pattern / array;
- mirror;
- optionally rectangular pattern after the 1D form is stable.

The canonical operation should reference one input node plus bounded count/spacing/axis semantics. Counts need a separate integer-safe parameter contract or a deliberately literal-only first version.

This is the natural representation for four cabinets, repeated holes and mounting features.

## M4 — profile + extrusion foundation

Introduce a bounded 2D profile abstraction and extrusion so ordinary plates, walls and outlines do not need to be reverse-engineered from subtractive 3D boxes.

Candidate minimum surface:

- rectangle profile;
- closed polyline profile with expression-backed 2D points;
- circle profile;
- extrude along a canonical axis/direction.

Do not start with arbitrary NURBS/sketch constraints. The first profile layer should remain deterministic and easily portable between build123d and RhinoCommon.

This supports explicit plates and wall segments while keeping the canonical language kernel-neutral.

## M5 — wall/shell/thickness semantics only after profile acceptance

Do not immediately add a domain-specific `wall` node merely because the current room example is Boolean-heavy. First determine whether profile + extrusion + expressions + pattern already represents rooms cleanly.

If a dedicated thickness/shell operation is still needed, analyze topology stability separately. Shelling/offsetting can be kernel-sensitive and must not be added until native and Rhino behavior is bounded by deterministic fixtures.

## M6 — rotation parity

Rotation already exists in canonical `transform.rotateDeg`, but the active GHX path intentionally fail-closes on non-zero rotation.

Before enabling it:

1. inspect the relevant McNeel Rhino 8 branch-8 transform/rotation references;
2. reconcile build123d `Location(translation, rotation)` convention and operation order;
3. define canonical Euler/order semantics explicitly;
4. add native-vs-Rhino deterministic fixtures;
5. obtain installed Rhino 8 acceptance.

Do not let modeling expansion accidentally make rotation permissive before this analysis.

## M7 — finishing/topology operations

Fillet has the first semantic selector (`parallelToAxis`). Broaden finishing only after the parameter/result integrity work above.

Potential future work:

- stronger semantic edge selectors;
- chamfer;
- additional fillet selection forms.

Each must avoid persisted raw topology indices and needs separate topology-stability analysis.

## Suggested implementation order

1. **M0 parameter effectiveness + orphan analysis** — highest immediate correctness gain, low schema risk.
2. **M1 expression AST** — fixes baked relationships and makes existing primitives genuinely parametric.
3. **M2 union/intersection** — enables additive construction.
4. **M3 pattern/mirror** — enables repeated components cleanly.
5. **M4 profile/extrude** — broadens geometry vocabulary significantly.
6. Re-evaluate need for dedicated wall/plate/shell semantics.
7. **M6 rotation** and **M7 finishing** under their own Rhino/native parity acceptance.

## Regression fixtures to keep

Build a small canonical corpus that runs through both the native evaluator and GHX compiler:

- centered box with derived dimensions;
- mounting plate with two holes and authoritative fillet result;
- four-hole patterned plate;
- four-cabinet row using pattern rather than manually placed voids;
- rectangular room with explicit wall/floor construction, doorway and parameter-driven offsets;
- expression-heavy fixture where every published parameter is proven to reach authoritative output.

For each fixture, test parameter perturbations and confirm the expected canonical dependency changes before relying on visual browser inspection.

## Product acceptance principle

A parameter existing in the Parameters panel is a product promise. New generation must not expose a parameter unless Brepia can prove, from the canonical dependency graph, that changing it affects an authoritative geometry or explicitly supported semantic output.
