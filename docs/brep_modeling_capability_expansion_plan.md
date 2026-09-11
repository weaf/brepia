# BRep modeling capability expansion plan

Status: **M0, M1, M2, M3A, M3B and M4 profile + extrusion are complete across repository/CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper runtime. Optional M3C rectangular/grid pattern remains deferred. The next step is a bounded post-M4 decision on whether M5 wall/shell/thickness semantics are justified before M6 rotation parity.** This track remains intentionally separate from Phase 9 GHX installed-host acceptance.

Detailed current status:

- `docs/brep_m2_boolean_composition_status.md`;
- `docs/brep_m2_native_runtime_evidence_2026-09-10.md`;
- `docs/brep_m2_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3a_mirror_status.md`;
- `docs/brep_m3a_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3a_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_linear_pattern_status.md`;
- `docs/brep_m3b_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md`;
- `docs/brep_post_m3_scope_decision_2026-09-11.md`;
- `docs/brep_m4_profile_extrusion_status.md`;
- `docs/brep_m4_native_runtime_evidence_2026-09-11.md`;
- `docs/brep_m4_rhino8_runtime_evidence_2026-09-11.md`.

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
      { "parameter": "overallWidth" },
      {
        "op": "mul",
        "args": [
          { "parameter": "wallThickness" },
          2
        ]
      }
    ]
  }
}
```

This represents `innerWidth = overallWidth - 2 * wallThickness` without publishing a synthetic `innerWidth` slider.

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

Status: **M3A mirror and M3B bounded linear pattern complete across repository/CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper runtime. Optional M3C rectangular/grid pattern is deferred.**

M3A added bounded single-shape mirror semantics and is complete across canonical/provider/editor implementation, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper runtime. Its closeout and runtime evidence are recorded in the dedicated M3A documents listed above.

M3B adds the first bounded multi-instance result form:

```ts
{
  id: string;
  type: 'linearPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  count: number;
  spacing: BrepScalar;
}
```

The M3B contract is intentionally narrow:

- pattern input must be an existing single-shape node;
- `count` is literal integer 2–32;
- `spacing` uses the existing M1 millimetre scalar/expression contract and must resolve non-zero;
- instance 0 is the unshifted source; later instances are `index * spacing` along the selected axis;
- a final pattern is an ordered `instanceSet`, not a fused Boolean body;
- `subtract.tools[]` may consume an instance set and applies its instances as ordered cutters;
- transform, mirror, fillet, another pattern, union/intersection, subtract base and project-object geometry roles remain single-only;
- nested/general collection algebra is not introduced.

The evaluation contract therefore distinguishes `single` from `instanceSet`. A final pattern emits stable bodies named `<patternId>::<index>` with explicit instance index/source identity, per-body bounds/mesh and aggregate result bounds.

Viewer rendering consumes all result bodies while preserving their semantic identity. Native exact STEP uses a multi-solid build123d Compound rather than a fuse. 3DM retains separate instance objects and identity metadata. Rhino/GHX emits a Python list of separate Breps; the Grasshopper `Result` port persists as List Access only for instance-set results. Single results retain Item Access and the existing non-Result output persistence is unchanged.

Repository acceptance checkpoint:

```text
94e1b0fca3b1d01b016faeee52bb9cdeb564f4b4
Quality Gate #937       PASS
Grasshopper Build #509 PASS
```

Quality Gate #937 records 141 passing test files / 907 passing tests plus typecheck, lint, production build and `git diff --check` PASS. Subsequent real-runtime acceptance closed the remaining boundary: the rootless native smoke verified both the final three-body pattern and four-instance pattern-as-subtract-tool fixtures, and fresh current-branch GHX files were accepted in installed Rhino 8 / Grasshopper.

Detailed M3B status and runtime evidence:

```text
docs/brep_m3b_linear_pattern_status.md
docs/brep_m3b_native_runtime_evidence_2026-09-11.md
docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md
```

Native runtime verified the final pattern as an ordered `instanceSet` with three separate bodies, exact 20 mm X-spacing, aggregate bounds `[-5,-5,-5] -> [45,5,5]`, exact multi-solid STEP, and four ordered pattern instances consumed as `subtract.tools[]` while the final subtract remained one `single` body. Installed Rhino 8 / Grasshopper accepted both a final list-result pattern and a pattern-as-subtract-cutters GHX, including save -> close -> reopen persistence.

The M3B runtime boundary is closed. Rectangular/grid pattern remains optional future M3C work, but `docs/brep_post_m3_scope_decision_2026-09-11.md` deferred it in favor of the now-complete M4 profile/extrude slice because profile/extrude filled the larger representational gap.

M3 continues to preserve the M0–M2 invariants, keep non-zero rotation fail-closed and remain additive to canonical schema version 1.

## M4 — profile + extrusion foundation

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**.

M4 adds a bounded inline 2D profile plus solid extrusion surface without introducing a reusable non-solid sketch authority:

```ts
type BrepProfile =
  | { type: 'rectangle'; width: BrepScalar; height: BrepScalar }
  | { type: 'circle'; radius: BrepScalar }
  | { type: 'closedPolyline'; points: Array<{ u: BrepScalar; v: BrepScalar }> };

type BrepExtrudeNode = {
  id: string;
  type: 'extrude';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
  depth: BrepScalar;
};
```

The canonical frames are fixed and right-handed:

- X: U=Y, V=Z, normal +X;
- Y: U=Z, V=X, normal +Y;
- Z: U=X, V=Y, normal +Z.

Extrusion is centered from `-depth/2` to `+depth/2`. Rectangle/circle profiles are centered; closedPolyline uses 3–32 ordered expression-capable U/V points and rejects zero-length edges, zero area and self-intersection. Width, height, radius and depth must resolve positive. The same validity rules run against effective runtime overrides.

M4 remains additive to canonical `schemaVersion: 1`, produces exactly one `single`, and does not broaden the M3B collection policy. Arbitrary workplanes/vectors, open profiles, holes/multiple loops, sketch constraints, NURBS/splines, reusable profile nodes and topology references remain outside the slice.

Native build123d / OCCT maps rectangle/circle/polyline to `Rectangle` / `Circle` / `Polygon`, canonical frames to `Plane.YZ` / `Plane.ZX` / `Plane.XY`, and centered extrusion to `extrude(..., amount=depth/2, both=True)`. Real native smoke accepted X/Y/Z rectangle bounds, circle, closedPolyline, parameter overrides and exact STEP while keeping prior M0–M3 regressions green.

Rhino 8 / Grasshopper compiles the same surface through the built-in Python 3 Script carrier using explicit `Rhino.Geometry.Plane`, profile curves and `Extrusion.Create(...).ToBrep()`. Three fresh installed-host fixtures covered rectangle/Z, circle/X and closedPolyline/Y, parameter perturbations and ordinary Result Item Access. Their Rhino-saved definitions subsequently passed the strict returned-GHX gate with exactly the expected parameter values.

The installed-host run also exposed a bounded Rhino save normalization: Rhino may omit explicit RhinoCodePluginGH `Lib`/library metadata when persisting the built-in Python 3 component. Generated mode continues to require the explicit library identity; returned mode accepts only the observed omission while preserving strict component GUID, script source, instance identity, wiring, type hints, graph shape and Item/List access. Foreign explicit library identities remain rejected.

Detailed M4 status and evidence:

```text
docs/brep_m4_profile_extrusion_status.md
docs/brep_m4_native_runtime_evidence_2026-09-11.md
docs/brep_m4_rhino8_runtime_evidence_2026-09-11.md
```

The M4 repository, native and installed-host boundaries are closed.

## M5 — wall/shell/thickness semantics only after profile acceptance

M4 acceptance now satisfies the prerequisite for evaluating this milestone, but does not by itself prove that a dedicated wall/shell/thickness operation is needed.

Do not add a domain-specific `wall` node merely because earlier room examples were Boolean-heavy. First test whether the accepted combination of M1 expressions + M2 Boolean composition + M3 repetition/symmetry + M4 profile/extrusion already represents the target room/plate cases cleanly.

If a dedicated thickness/shell operation is still needed, analyze topology stability separately. Shelling/offsetting can be kernel-sensitive and must not be added until native and Rhino behavior is bounded by deterministic fixtures. Any selected M5 contract must remain kernel-neutral and must not persist raw face/edge indices as topology authority.

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
4. **M3A mirror** — complete across repository, native runtime and installed Rhino 8 / Grasshopper acceptance.
5. **M3B linear pattern** — complete across repository/CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper acceptance.
6. **M4 profile/extrude** — complete across repository/CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper acceptance.
7. **Post-M4 decision** — evaluate target cases using M1–M4 before deciding whether M5 shell/thickness is justified; optional M3C grid pattern remains deferred.
8. **M6 rotation** — if M5 is not justified as the immediate gap, close the existing non-zero-rotation parity boundary next.
9. **M7 finishing/topology** — only under separate native/Rhino topology-stability acceptance.

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
