# M3B — bounded linear pattern status

Status: **repository-complete, CI-accepted and native build123d / OCCT runtime accepted; installed Rhino 8 / Grasshopper runtime acceptance pending**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M3B adds one bounded multi-instance modeling operation:

- `linearPattern`.

It does not add rectangular patterns, nested instance sets, arbitrary collections, non-zero rotation, profile/extrusion, shell/thickness, broader finishing features or a general-purpose collection algebra.

Canonical `schemaVersion: 1` remains unchanged.

## Canonical contract

The additive node form is:

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

The bounded semantics are:

- `input` references exactly one existing single-shape node;
- `count` is a literal integer from 2 through 32;
- `spacing` is a millimetre-compatible canonical scalar and may use the existing bounded M1 expression AST;
- resolved spacing must be non-zero both at canonical defaults and effective runtime parameter values;
- instance `0` is the unshifted source;
- later instances are translated by `index * spacing` along the selected axis;
- canonical instance order is stable and significant.

M3B introduces an explicit value-kind distinction:

```text
ordinary node      -> single
linearPattern      -> instanceSet
```

An instance set is not silently fused into one solid.

## Value-kind boundary

Single-shape consumers remain single-shape:

- `transform.input`;
- `mirror.input`;
- `fillet.input`;
- `linearPattern.input`;
- `union.inputs[]`;
- `intersect.inputs[]`;
- `subtract.base`;
- project-object geometry roles.

`subtract.tools[]` is the intentionally supported exception. A linear-pattern tool expands into its individual instances in canonical index order and each instance is applied as a cutter.

A `linearPattern` may itself be the canonical `resultNodeId`. In that case the result is an `instanceSet` and every instance remains a separate result body.

Nested patterns and arbitrary instance-set consumption remain fail-closed.

## Evaluation/result contract

The BRep evaluation success contract now supports:

```text
resultKind = single | instanceSet
```

For a final linear pattern, `bodies[]` contains one body per canonical instance with stable identity:

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
- independent bounded viewer mesh.

Top-level result bounds are the aggregate bounds of all result bodies. The server validates body count, identity, instance ordering, source identity, mesh limits and aggregate bounds before accepting sandbox output.

## Native build123d / OCCT mapping

`scripts/brep/brep_driver.py` evaluates a linear pattern as ordered moved copies of the single source shape.

For a final pattern result:

- the primary result remains multiple independent shapes;
- viewer/result payload emits independent bodies;
- exact STEP export uses a build123d `Compound` containing the result instances, preserving multi-solid output rather than performing a Boolean fuse;
- 3DM interoperability writes every result instance separately with Brepia body/node/instance metadata and embeds the exact primary STEP artifact.

For `subtract.tools[]`, each pattern instance is applied as an individual cutter in canonical order and the final subtract result remains subject to the existing single-shape result contract.

`scripts/brep/smoke-test.sh` contains deterministic M3B runtime fixtures for:

1. a three-instance X-axis pattern as the final `resultNodeId`;
2. a four-instance pattern used as a subtract tool.

Those fixtures have now been run successfully against the real local rootless build123d/OCCT runtime. Native runtime evidence is recorded in:

```text
docs/brep_m3b_native_runtime_evidence_2026-09-11.md
```

The accepted final-pattern runtime result was an ordered three-body `instanceSet` with stable identities `pattern::0` through `pattern::2`, exact 20 mm X spacing, aggregate bounds `[-5,-5,-5] -> [45,5,5]` and exact STEP export available.

The accepted pattern-as-subtract-tool runtime result used four ordered cutter instances and returned exactly one `single` result body with a 2044-triangle viewer mesh and exact STEP export available.

## Viewer

Both BRep preview surfaces are multi-body aware.

Rendering aggregates only GPU buffer data from the complete `result.bodies[]` set. It does not merge canonical body identity or change the evaluation contract. If a required result body lacks viewer mesh data, the helper does not silently render a partial instance set.

The canonical body identities and instance metadata remain authoritative outside the Three.js render aggregation.

## Rhino 8 / Grasshopper compiler

The Rhino Python 3 compiler emits `linearPattern` as an ordered Python list of duplicated/transformed `Rhino.Geometry.Brep` objects.

A final pattern therefore produces a Grasshopper `Result` list instead of a synthetic Boolean union.

When a pattern is used as a subtract tool, the generated Rhino code iterates each Brep cutter in canonical pattern order.

The existing Rhino document tolerance, M1 scalar helpers, placement behavior, Boolean exact-one-Brep guards and non-zero-rotation fail-closed policy remain intact.

## GHX output-access contract

The portable Grasshopper contract derives the `Result` access from the canonical result kind:

```text
single result       -> Item access
instanceSet result  -> List access
```

The executable GHX persists this through the Rhino Python 3 Script parameter access field.

McNeel Grasshopper API documentation was reconciled before implementation:

```text
GH_ParamAccess.item = 0
GH_ParamAccess.list = 1
GH_ParamAccess.tree = 2
```

M3B changes only the `Result` output persistence. Existing accepted persistence for `Connections`, `Mounting`, `Cable` and the other script outputs is deliberately left unchanged.

The executable-GHX validator checks the expected `Result` access and fails closed with `script_output_access_changed` if a pattern Result is changed from List to Item or otherwise violates the canonical output contract.

Returned GHX remains parameter-only at the supported round-trip boundary; M3B does not authorize graph/source mutation through GHX import.

## AI/provider boundary

Both the full canonical AI tool schema and the finite/reference-free provider schema expose the same bounded linear-pattern surface.

Existing scalar limits remain unchanged:

```text
canonical expression depth: 12
canonical expression node limit: 64
provider expression depth: 2
```

The Native BRep instruction explicitly teaches:

- instance 0 / `index * spacing` semantics;
- count 2–32;
- non-zero millimetre spacing;
- final pattern as ordered multi-body output;
- pattern as ordered subtract cutters;
- all single-only consumer restrictions;
- no Boolean union as a disguise for requested repeated independent bodies;
- default-value spatial sanity for count and spacing.

No recursive/nested provider `$ref` baseline was introduced.

## Structural authoring UI

The feature editor exposes `Linear pattern` directly.

The editor provides:

- only single-shape candidates for the pattern input;
- X/Y/Z axis selection;
- literal integer count bounded 2–32;
- M1-compatible spacing authoring through the existing scalar field;
- explicit explanatory copy for index-ordered center-to-center spacing;
- instance-set marking in the feature list;
- instance-set marking for pattern entries offered as subtract tools.

The same value-kind filtering prevents pattern outputs from being selected accidentally by transform, mirror, fillet, union/intersection or subtract-base authoring.

## Repository acceptance checkpoint

Repository implementation candidate:

```text
94e1b0fca3b1d01b016faeee52bb9cdeb564f4b4
Extend native smoke coverage for M3B linear pattern
```

GitHub CI on that exact branch checkpoint:

```text
Quality Gate #937       PASS
Grasshopper Build #509 PASS
```

Quality Gate evidence on the exact candidate:

```text
141 test files PASS
907 tests PASS
typecheck PASS
lint PASS
production build PASS
git diff --check PASS
npm audit: 0 vulnerabilities
```

Dedicated/related M3B coverage includes:

- `tests/brepM3BLinearPatternContract.test.ts` — 17 tests PASS;
- `tests/brepM3BRhinoPattern.test.ts` — 5 tests PASS;
- `tests/brepProjectStructuralUi.test.ts` — 4 tests PASS;
- `tests/brepViewerGeometry.test.ts` — 2 tests PASS;
- M2 Boolean regression coverage remains PASS;
- M3A mirror regression coverage remains PASS.

Grasshopper Build #509 also passed the .NET build plus Ubuntu and Windows package builds.

The later documentation/acceptance checkpoint before the real local native runtime run was:

```text
a6f030f5752a3c1eb2fb53d9d188d132ec8ff302
Quality Gate #939       PASS
Grasshopper Build #511 PASS
```

## Native runtime acceptance

Native build123d / OCCT runtime acceptance is complete.

The real local rootless smoke run on 2026-09-11 verified:

- existing primitive/transform/subtract/fillet regression behavior;
- exact STEP and 3DM artifacts;
- project-object roles and semantic point placement;
- M2 union/intersection success and disjoint fail-closed behavior;
- M3A mirror parity for X/Y/Z;
- final M3B pattern as three separate ordered bodies with stable identity and aggregate bounds;
- exact 20 mm parameter-driven spacing in the accepted fixture;
- exact STEP availability for the multi-body final pattern;
- four-instance pattern expansion as ordered subtract cutters;
- final pattern-tool subtract result remaining exactly one `single` body;
- exact STEP availability after pattern-driven subtraction.

Evidence:

```text
docs/brep_m3b_native_runtime_evidence_2026-09-11.md
```

## Remaining acceptance gate

M3B is not installed-host complete yet.

The only remaining M3B gate is fresh current-branch installed Rhino 8 / Grasshopper acceptance:

1. generate fresh current-branch GHX fixtures;
2. open and solve them in installed Rhino 8 / Grasshopper;
3. confirm that a final pattern exposes `Result` as a list of separate Breps;
4. confirm parameter-driven spacing recomputes correctly;
5. save/close/reopen and confirm the List output persists;
6. confirm the pattern-as-subtract-tool host path produces the intended single Brep and responds to spacing changes;
7. record installed-host evidence before declaring M3B complete.

M3B must remain open if installed-host behavior diverges from the repository/native contract.

## Preserved boundaries

M3B does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` and immutable revision authority;
- build123d/OCCT native geometry authority;
- canonical `schemaVersion: 1`;
- M0 parameter/graph integrity policy;
- M1 canonical scalar depth 12 or expression-node limit 64;
- provider expression depth 2 or finite/reference-free schema policy;
- M2 exact-one-body Boolean semantics;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- C4 deferral until image-bearing evidence exists;
- PR #36 draft/stacked/unmerged state.
