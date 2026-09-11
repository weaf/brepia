# BRep modeling capability expansion plan

Status: **M0, M1 and M2 complete; M3 repetition and symmetry is the next active modeling phase**. This track remains intentionally separate from Phase 9 GHX installed-host acceptance.

Detailed M2 closeout status:

- `docs/brep_m2_boolean_composition_status.md`;
- `docs/brep_m2_native_runtime_evidence_2026-09-10.md`;
- `docs/brep_m2_rhino8_runtime_evidence_2026-09-11.md`.

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

M0 is repository-complete and recorded separately in `docs/brep_m0_parameter_integrity_closeout.md`.

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
  | { op: 'add' | 'sub' | 'mul' | 'div'; args: [BrepScalar, BrepScalar] }
  | { op: 'neg'; args: [BrepScalar] };
```

The extension remains additive to canonical `schemaVersion: 1`; existing literal scalars and direct parameter references remain valid without migration.

### Requirements

- deterministic shared semantics across canonical validation, native build123d execution and Rhino compilation;
- unit-aware validation (`mm`, `deg`, `none`);
- no arbitrary functions, variables, source strings or executable expressions;
- no cyclic expression references;
- GHX returns only published input values, never edits the canonical expression graph;
- deterministic serialization for export/import identity.

### M1 implementation contract

M1 is deliberately bounded rather than a general expression language.

Canonical operators and arity:

- `add`, `sub`, `mul`, `div`: exactly two scalar arguments;
- `neg`: exactly one scalar argument;
- leaves: finite numeric literals or `{ parameter: '<id>' }` references only.

Safety bounds:

- maximum absolute scalar/intermediate value: `1e9`;
- maximum expression depth: `12`;
- maximum expression-node count: `64`;
- every intermediate result must remain finite and within bounds;
- division by zero fails closed both for defaults and runtime parameter overrides.

Unit algebra:

- numeric literals are contextually typable as `mm`, `deg` or `none`;
- `add`/`sub` require compatible equal dimensions;
- `mul` permits only dimensionless scaling (`none * X` or `X * none`);
- `div` permits `X / none -> X` and same-dimension `X / X -> none`;
- implicit derived dimensions such as `mm * mm` or `deg * mm` are rejected.

Editor behavior for M1 is expression-preserving, not a free-form expression authoring surface:

- literals remain editable as literals;
- direct parameter references remain selectable from published parameters;
- an existing AST is rendered as a derived expression and preserved byte-for-byte semantically unless the user deliberately replaces it with a literal or published parameter;
- the UI must never flatten an AST into a literal merely by opening/saving a field.

Runtime parity requirements:

1. canonical normalization validates expression shape, units and default evaluation;
2. request normalization validates the full project expression set again against the effective runtime parameter values before native execution;
3. the native build123d driver evaluates the same bounded operator set;
4. the Rhino/GHX compiler emits only bounded helper calls for the same operator set;
5. expression-backed `rotateDeg` does not unlock rotation: only the already-supported literal zero remains accepted until M6.

AI contract:

- generated derived geometry relationships should use the AST instead of adding fake/duplicate published parameters;
- only user-facing independent inputs should become published parameters;
- AI must not emit source strings, `eval`, arbitrary functions, undeclared variables or unbounded expression trees.

Example:

```json
{
  "width": {
    "op": "sub",
    "args": [
      { "parameter": "overall_width" },
      {
        "op": "mul",
        "args": [
          { "parameter": "wall_thickness" },
          2
        ]
      }
    ]
  }
}
```

This represents `inner_width = overall_width - 2 * wall_thickness` without publishing a synthetic `inner_width` slider.

### M1 acceptance sequence

Repository closeout requires one exact checkpoint with:

1. expression-preserving placement, feature and project-object editors;
2. canonical/default and runtime-override validation parity;
3. native driver and Rhino compiler regression coverage for nested arithmetic, unary negation, division by zero, overflow and unit failures;
4. M0 parameter-effectiveness analysis following parameter references through nested ASTs;
5. AI schema/instruction coverage for the bounded AST;
6. full tests, typecheck, lint, build and diff checks green;
7. Grasshopper Build green on the same checkpoint.

Installed Rhino 8 acceptance remains a separate host-evidence boundary. Repository completion may be recorded from deterministic compiler/runtime tests, but full host acceptance should additionally exercise a real derived relation such as:

`InnerWidth = Width - 2 * WallThickness`

and confirm that changing the published `Width`/`WallThickness` controls updates the solved Rhino geometry while the GHX round trip still changes only published parameter values.

M1 must not start M2 Boolean expansion, new modeling-node families or non-zero rotation work.

### Immediate product benefit

This alone fixes much of the observed broken-parametric behavior without inventing domain-specific wall/cabinet nodes. Boxes and transforms become genuinely relational instead of partially baked.

## M2 — additive Boolean composition

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**.

Canonical v1 includes the two bounded kernel-neutral operations selected for M2:

- `union`;
- `intersect`.

Both use an ordered `inputs` array containing 2–32 unique existing node references. They participate in the ordinary canonical reference/DAG checks and M0 reachability analysis. The extension remains additive to canonical `schemaVersion: 1`.

The geometry contract remains single-body and fail-closed. Native build123d/OCCT uses `fuse` / `intersect` and rejects zero- or multi-solid final cardinality. The Rhino 8 GHX compiler uses `Brep.CreateBooleanUnion` / `Brep.CreateBooleanIntersection` with explicit tolerance and requires exactly one final Brep. Disjoint union, empty intersection and other unsupported result cardinalities are not silently converted to compounds or arbitrary selected bodies.

The finite/reference-free provider authoring schema, Native BRep tool instruction and structural feature editor expose the same bounded surface. The editor preserves the canonical input order with explicit add/remove/reorder controls rather than degrading Boolean inputs to an unordered checkbox set.

Repository acceptance checkpoint before status documentation:

```text
d48d3b5861f9be468afa9f93a502fae823efa9f7
Quality Gate #856       PASS
Grasshopper Build #428 PASS
```

Native runtime acceptance is recorded in:

```text
docs/brep_m2_native_runtime_evidence_2026-09-10.md
```

Installed Rhino 8 / Grasshopper acceptance is recorded in:

```text
docs/brep_m2_rhino8_runtime_evidence_2026-09-11.md
```

The installed-host run verified supported union/intersection solves, parameter-driven recomputation, fail-closed empty intersection and disjoint union, plus save/close/reopen persistence of the generated GHX files. M2 is explicitly closed and no longer blocks M3.

## M3 — repetition and symmetry

Status: **active — analysis and contract definition next**.

Add modeling operations that eliminate repeated literal transforms:

- linear pattern / array;
- mirror;
- optionally rectangular pattern after the 1D form is stable.

The canonical operation should reference one input node plus bounded count/spacing/axis semantics. Counts need a separate integer-safe parameter contract or a deliberately literal-only first version.

This is the natural representation for four cabinets, repeated holes and mounting features.

M3 must preserve the M0–M2 invariants, keep non-zero rotation fail-closed, remain additive to canonical schema version 1 if feasible, and obtain native plus installed Rhino 8 parity evidence before closeout.

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

1. **M0 parameter effectiveness + orphan analysis** — complete.
2. **M1 expression AST** — complete.
3. **M2 union/intersection** — complete across repository, native runtime and installed Rhino 8 / Grasshopper acceptance.
4. **M3 pattern/mirror** — active; begin with bounded contract analysis before implementation.
5. **M4 profile/extrude** — broadens geometry vocabulary significantly.
6. Re-evaluate need for dedicated wall/plate/shell semantics.
7. **M6 rotation** and **M7 finishing** under their own Rhino/native parity acceptance.

## Regression fixtures to keep

Build a small canonical corpus that runs through both the native evaluator and GHX compiler:

- centered box with derived dimensions;
- mounting plate with two holes and authoritative fillet result;
- union/intersection single-body fixtures plus unsupported-cardinality fail-closed cases;
- four-hole patterned plate;
- four-cabinet row using pattern rather than manually placed voids;
- rectangular room with explicit wall/floor construction, doorway and parameter-driven offsets;
- expression-heavy fixture where every published parameter is proven to reach authoritative output.

For each fixture, test parameter perturbations and confirm the expected canonical dependency changes before relying on visual browser inspection.

## Product acceptance principle

A parameter existing in the Parameters panel is a product promise. New generation must not expose a parameter unless Brepia can prove, from the canonical dependency graph, that changing it affects an authoritative geometry or explicitly supported semantic output.
