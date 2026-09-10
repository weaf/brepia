# M2 — additive Boolean composition status

Status: **repository-complete and CI-accepted; native runtime and installed Rhino 8 / Grasshopper evidence pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

M2 adds only the bounded additive Boolean operations selected by the modeling-capability roadmap:

- `union`;
- `intersect`.

It does not start repetition/pattern, profile/extrusion, shell/thickness, non-zero rotation or broader finishing work.

Canonical `schemaVersion: 1` remains unchanged.

## Canonical contract

The two new canonical node forms are:

```ts
{
  id: string;
  type: 'union';
  inputs: string[];
}

{
  id: string;
  type: 'intersect';
  inputs: string[];
}
```

Their `inputs` arrays are:

- ordered;
- limited to 2–32 references;
- required to contain unique node IDs;
- validated through the existing canonical reference and DAG cycle checks.

The order is retained deterministically even though ordinary Boolean union/intersection are mathematically commutative. This avoids introducing hidden evaluator reordering into the canonical model contract.

## Result-cardinality policy

M2 remains a single-body canonical modeling surface.

A `union` or `intersect` is accepted by a geometry backend only when the final operation resolves to exactly one solid/Brep.

Unsupported result cardinality fails closed:

- disjoint union that remains multiple solids is not silently converted into a compound/multi-body canonical result;
- empty intersection is not treated as a successful empty body;
- a Boolean producing multiple final solids/Breps is rejected rather than arbitrarily selecting one.

This rule is mirrored by the native build123d/OCCT evaluator and Rhino 8 compiler.

## Native build123d / OCCT mapping

`scripts/brep/brep_driver.py` maps:

```text
union      -> Shape.fuse(*inputs)
intersect  -> Shape.intersect(*inputs)
```

The result is normalized through an exact-one-solid guard. Any result containing zero or more than one solid raises the bounded error class:

```text
unsupported_result_cardinality
```

The existing `subtract` behavior is unchanged.

`scripts/brep/smoke-test.sh` now includes deterministic M2 fixtures for:

1. overlapping/nested union success;
2. overlapping/nested intersection success;
3. disjoint union fail-closed;
4. disjoint intersection fail-closed.

The original primitive/transform/subtract/fillet and exact STEP/3DM smoke remains in the same script.

## Rhino 8 / Grasshopper mapping

The active Rhino Python 3 GHX compiler maps:

```text
union      -> Rhino.Geometry.Brep.CreateBooleanUnion(..., tolerance)
intersect  -> Rhino.Geometry.Brep.CreateBooleanIntersection(..., tolerance)
```

Union requires exactly one returned Brep.

N-ary intersection is evaluated deterministically from the ordered input list and requires a non-empty intermediate result plus exactly one final Brep.

The compiler continues to use the document absolute tolerance and continues to fail closed on non-zero canonical rotation.

The mapping was reconciled against the repository's pinned Rhino 8 reference policy and the pinned McNeel `rhino-developer-samples` branch-8 reference.

Repository compiler tests verify the emitted RhinoCommon Boolean calls and exact-one-Brep guards. This is compiler evidence only; installed-host acceptance remains pending.

## AI/provider boundary

Both the full canonical tool-validation schema and finite/reference-free provider authoring schema expose `union` and `intersect` with the same bounded 2–32 input surface.

The existing scalar contracts remain unchanged:

```text
canonical expression depth: 12
canonical expression node limit: 64
provider expression depth: 2
```

No recursive/nested `$ref` provider baseline was introduced.

The Native BRep tool instruction now tells the model that:

- Boolean inputs are ordered and unique;
- a successful Boolean must resolve to exactly one solid/Brep;
- `union` must not be used as a disguise for an intentionally disjoint multi-body assembly;
- `intersect` must not be used when the intended result is empty;
- default-value spatial sanity must include connected/single-body union intent and non-empty common intersection.

## Structural editor

The existing feature editor now exposes both M2 node types.

Boolean inputs use an ordered editor rather than the existing subtract-tool checkbox set. The user can:

- add an input up to the canonical 32-reference maximum;
- change an input while duplicate choices remain excluded;
- move inputs up/down;
- remove inputs while preserving the minimum arity of two.

Existing node IDs, immutable revision semantics and result-selection authority remain unchanged.

## Integrity analysis

M0 reachability analysis now follows `union.inputs` and `intersect.inputs`, so nodes and parameters behind Boolean composition remain part of authoritative reachability when the Boolean node reaches `resultNodeId` or a project-object geometry role.

No weakening of orphan/effectiveness diagnostics was introduced.

## Repository implementation checkpoints

```text
52d80e8454c390b50d11ad1f8f668c650df4268d  Add canonical M2 boolean composition nodes
82302b991bca4caa9b18aa562056fe45c2e16935  Expose M2 booleans through provider schema
301cc85f73700f81f0b90e3dc1bbc37d15804fcf  Teach structural editing about M2 booleans
c5407d90df4495da843520ea7d1275dbac8be497  Evaluate M2 booleans in native OCCT runtime
720f38735475dc7d3ec2e70a15f010fa12693cd8  Compile M2 booleans for Rhino 8
6d64e2b4eb88efce643565ac078384eabd071287  Preserve Rhino Python source newlines
b5e8739b05c97db2de58a09cb530f3f1c6923601  Include M2 booleans in integrity reachability
96e75477a59516e2ab01732febb20acd63e0752a  Add M2 booleans to structural feature editor
b6c15f9541bbcd67856617bfcf87830d31286d59  Teach Native BRep agent M2 boolean contract
34bd13e2aa2dbfe90808a4f0736b925538703e88  Test M2 Boolean composition contract
d48d3b5861f9be468afa9f93a502fae823efa9f7  Extend native smoke coverage for M2 booleans
```

During implementation an intermediate TypeScript gate correctly found two exhaustiveness gaps after adding the new discriminants. Those consumers were updated before the final candidate. An unrelated accidental generated-Python newline representation change was also detected from the commit diff and corrected before final acceptance.

## Repository acceptance

Final implementation checkpoint before this status document:

```text
d48d3b5861f9be468afa9f93a502fae823efa9f7
```

GitHub CI on that exact checkpoint:

```text
Quality Gate #856       PASS
Grasshopper Build #428 PASS
```

Quality Gate evidence includes:

```text
135 test files PASS
862 tests PASS
typecheck PASS
lint PASS
production build PASS
git diff --check PASS
```

The dedicated M2 suite contributes 12 passing tests covering canonical normalization, arity/uniqueness, missing references, cycles, canonical/provider schema acceptance, Rhino source generation, native result-cardinality guards and structural-editor exposure.

## Required runtime acceptance next

Repository CI does not prove real kernel or installed-host behavior for the newly translated Boolean operations.

Before M2 can be declared runtime-accepted, collect both evidence classes below.

### 1. Native build123d / OCCT

On the real local Native BRep runtime, rebuild the pinned image if required and run:

```bash
scripts/brep/build-image.sh
scripts/brep/smoke-test.sh
```

The smoke must prove:

- existing box/cylinder/transform/subtract/fillet regression remains green;
- union success produces one body plus valid STEP;
- intersection success produces one body plus valid STEP;
- disjoint union rejects with `unsupported_result_cardinality`;
- disjoint intersection rejects with `unsupported_result_cardinality`.

### 2. Installed Rhino 8 / Grasshopper

Use fresh GHX compiled from the current branch for deterministic representative union and intersection models.

For each supported success case verify in installed Rhino 8 / Grasshopper:

```text
Brepia export
-> GHX open
-> solve without script/runtime error
-> exactly one Result Brep
-> change a published parameter when the fixture provides one
-> recompute correctly
-> save/reopen
-> still solves
```

Also exercise at least one unsupported result-cardinality fixture and verify it fails closed rather than silently returning an arbitrary Brep or multi-body result.

Installed-host evidence is required by the permanent Rhino 8 translation policy before claiming parity for the new operations.

## Preserved boundaries

M2 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BrepProject and immutable revision authority;
- build123d/OCCT native geometry authority;
- M0 parameter/graph integrity policy;
- M1 canonical scalar depth 12 or expression-node limit 64;
- provider expression depth 2 or finite/reference-free schema policy;
- Settings/discovery model authority;
- GHX parameter-only return/import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- PR #36 draft/stacked/unmerged state.

M3 must not begin until the M2 runtime/host evidence above has been reconciled and M2 is explicitly closed.
