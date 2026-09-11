# M3B — bounded linear pattern status

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M3B adds one bounded multi-instance modeling operation:

- `linearPattern`.

It does not add rectangular patterns, nested instance sets, arbitrary collection algebra, non-zero rotation, profile/extrusion, shell/thickness or broader finishing features.

Canonical `schemaVersion: 1` remains unchanged.

## Canonical contract

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

Bounded semantics:

- `input` references one existing `single` node;
- `count` is a literal integer 2–32;
- `spacing` uses the existing M1 millimetre scalar/expression contract;
- resolved spacing must be finite and non-zero for defaults and runtime overrides;
- instance `0` is the unshifted source;
- instance `i` is translated by `i * spacing` along the selected canonical axis;
- instance order is stable and significant.

M3B introduces the explicit value-kind distinction:

```text
ordinary node  -> single
linearPattern  -> instanceSet
```

An `instanceSet` is never silently fused merely to fit the old single-body model.

## Value-kind boundary

The first collection policy is deliberately narrow.

Single-only consumers remain:

- `transform.input`;
- `mirror.input`;
- `fillet.input`;
- `linearPattern.input`;
- `union.inputs[]`;
- `intersect.inputs[]`;
- `subtract.base`;
- project-object geometry roles.

`subtract.tools[]` is the supported exception: a pattern tool expands to its member Breps/shapes in canonical index order.

A `linearPattern` may itself be `resultNodeId`; then the authoritative result is an ordered `instanceSet`.

Nested patterns and general collection algebra remain fail-closed.

## Evaluation/result contract

Evaluation now distinguishes:

```text
resultKind = single | instanceSet
```

A final pattern returns one body per canonical instance with stable IDs:

```text
<patternNodeId>::0
<patternNodeId>::1
...
```

Each body carries:

- `nodeId` equal to the pattern node ID;
- `instance.index`;
- `instance.sourceNodeId`;
- independent bounds;
- independent viewer mesh.

Top-level bounds are aggregate bounds over all result bodies. Server validation checks body count, identity/order, source identity, mesh limits and aggregate bounds.

## Native build123d / OCCT mapping

`scripts/brep/brep_driver.py` evaluates linear patterns as ordered moved copies of the single input shape.

For final instance-set output:

- result bodies remain independent;
- viewer payload keeps one body per instance;
- exact STEP export uses a build123d `Compound` only as a multi-solid export container, never as canonical/result identity;
- 3DM writes result instances separately with Brepia node/instance metadata and embeds the exact primary STEP artifact.

For `subtract.tools[]`, pattern members are expanded into ordinary ordered cutter operations and the final subtract result remains `single`.

## Viewer

Both BRep preview surfaces render all `result.bodies[]` entries. GPU buffers may be aggregated for rendering, but semantic body identity is not merged. A partial instance set is not silently rendered when required body mesh data is missing.

## Rhino 8 / Grasshopper compiler

The Rhino Python 3 compiler emits `linearPattern` as an ordered Python list of duplicated/transformed `Rhino.Geometry.Brep` values.

- final pattern -> Grasshopper `Result` list;
- pattern used as subtract tool -> each Brep cutter is applied in canonical order;
- no implicit Boolean union is inserted to disguise repeated independent bodies.

Existing Rhino tolerance, M1 scalar helpers, placement semantics, exact-one-Brep Boolean guards and non-zero-rotation fail-closed policy remain intact.

## GHX output-access contract

Portable GHX derives `Result` access from the canonical result kind:

```text
single       -> Item access
instanceSet  -> List access
```

The executable GHX persists this through Rhino Python 3 Script parameter access. McNeel's Grasshopper API values used by the implementation are:

```text
GH_ParamAccess.item = 0
GH_ParamAccess.list = 1
GH_ParamAccess.tree = 2
```

M3B changes only `Result` persistence. Existing accepted persistence of other outputs is unchanged.

The validator fails closed with `script_output_access_changed` if a returned pattern GHX changes Result from List to Item or otherwise violates the canonical interface. Returned GHX remains parameter-only at the supported round-trip boundary.

## AI/provider and structural authoring

The canonical AI schema and the finite/reference-free provider schema expose the same bounded linear-pattern surface while preserving:

```text
canonical expression depth: 12
canonical expression node limit: 64
provider expression depth: 2
```

The Native BRep instruction teaches count 2–32, non-zero spacing, `index * spacing`, instance-set result semantics, pattern-as-subtract-tool behavior and the single-only consumer restrictions.

The feature editor exposes Linear Pattern with:

- single-shape input candidates only;
- X/Y/Z axis;
- count 2–32;
- M1-compatible spacing;
- instance-set markings;
- pattern entries allowed as subtract tools while remaining excluded from single-only selectors.

## Repository acceptance

Primary repository candidate:

```text
94e1b0fca3b1d01b016faeee52bb9cdeb564f4b4
Quality Gate #937       PASS
Grasshopper Build #509  PASS
```

Quality Gate #937 recorded 141 passing test files / 907 tests plus typecheck, lint, production build, `git diff --check` and dependency audit PASS.

Later acceptance/docs checkpoint before native runtime:

```text
a6f030f5752a3c1eb2fb53d9d188d132ec8ff302
Quality Gate #939       PASS
Grasshopper Build #511  PASS
```

Dedicated M3B coverage includes:

- `tests/brepM3BLinearPatternContract.test.ts`;
- `tests/brepM3BRhinoPattern.test.ts`;
- `tests/brepProjectStructuralUi.test.ts`;
- `tests/brepViewerGeometry.test.ts`;
- native smoke fixtures for final pattern and pattern-as-subtract-tool.

## Native runtime acceptance

Accepted in the real local rootless build123d / OCCT runtime on 2026-09-11.

The final-pattern fixture produced:

- `resultKind: instanceSet`;
- three ordered bodies `pattern::0`, `pattern::1`, `pattern::2`;
- exact 20 mm X spacing;
- aggregate bounds `[-5,-5,-5] -> [45,5,5]`;
- exact STEP available.

The pattern-as-subtract-tool fixture expanded four cutters and produced exactly one `single` result body with exact STEP available.

Evidence:

```text
docs/brep_m3b_native_runtime_evidence_2026-09-11.md
```

## Installed Rhino 8 / Grasshopper acceptance

Accepted in installed Rhino 8 / Grasshopper on 2026-09-11 using two fresh current-branch GHX files:

1. final `linearPattern` instance-set Result;
2. `linearPattern` used as a subtract tool.

Both files opened and solved successfully. The host behavior matched the intended list-aware final-pattern path and single-result pattern-cutter path. Both definitions were then saved, closed and reopened successfully and continued to solve with their parameter wiring intact.

Evidence:

```text
docs/brep_m3b_rhino8_runtime_evidence_2026-09-11.md
```

## Closeout

M3B is complete across:

- canonical/shared semantics;
- provider/AI authoring;
- structural editor;
- viewer;
- native build123d/OCCT execution;
- STEP/3DM output;
- Rhino 8 compiler;
- GHX Item/List persistence and validation;
- repository CI;
- native runtime;
- installed Rhino 8 / Grasshopper runtime;
- save/close/reopen persistence.

Rectangular/grid pattern remains optional future work and was not pulled into M3B implicitly.

## Preserved boundaries

M3B does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` and immutable revision authority;
- build123d/OCCT native geometry authority;
- canonical `schemaVersion: 1`;
- M0 parameter/graph integrity policy;
- M1 scalar depth 12 / node limit 64;
- provider expression depth 2 / finite reference-free schema policy;
- M2 exact-one-body Boolean semantics;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- C4 deferral until image-bearing evidence exists;
- PR #36 draft/stacked/unmerged state.
