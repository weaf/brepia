# M3B — explicit instance-set foundation and linear pattern plan

Status: **analysis / contract definition complete; implementation may begin after this plan checkpoint is CI-green**

Date: 2026-09-11

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

M3A mirror is fully accepted across repository CI, native build123d/OCCT runtime and installed Rhino 8 / Grasshopper, including parameter recompute and save/close/reopen persistence.

## Goal

M3B adds a bounded one-dimensional `linearPattern` without pretending that separated repeated solids are one Boolean body.

Primary use cases:

- repeated independent objects as the authoritative result, such as a row of cabinets;
- repeated cutters consumed by `subtract`, such as mounting holes or slots.

The central architectural requirement is an explicit distinction between a **single shape** and an **instance set**.

## Reconciled current constraints

The current canonical DAG is single-shape-oriented. Every existing node evaluates to one shape. The native evaluator memoizes one build123d shape per node and the Rhino compiler maps each node to one `Rhino.Geometry.Brep` variable.

The shared evaluation result already exposes bounded `bodies[]` with `BREP_EVALUATION_MAX_BODY_COUNT = 64`, but the current server validator requires `bodies[0].id === resultNodeId`, and both current BRep viewer paths consume only `bodies[0].viewerMesh`. Therefore the array exists structurally but multi-body result semantics are not yet implemented.

The Grasshopper contract already has `BrepGrasshopperAccess = 'item' | 'list'`, but the primary Result Brep output is currently hard-coded as `access: 'item'`. The executable Python-component GHX also persists every output with `ScriptParamAccess = 0` and the strict validator does not currently compare output access against the generated plan.

Official McNeel Rhino 8 scripting documentation defines Grasshopper Parameter Access as Item, List and Tree. The official Rhino 8 Python 3 component GHX persistence sample contains `ScriptParamAccess` values for those modes. M3B will use Item for ordinary single-shape Result output and List for an instance-set Result; Tree is out of scope.

The native exact STEP exporter accepts a build123d `Shape`/assembly. build123d's `Compound(children=[...])` is therefore suitable as an **artifact aggregation container**, but it must never replace the explicit per-instance semantics in the shared result contract.

## Canonical node

```ts
type BrepLinearPatternNode = {
  id: string;
  type: 'linearPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  count: number;
  spacing: BrepScalar;
};
```

Semantics:

- `input` must resolve to a single-shape node;
- `count` is a literal integer in the first version;
- `2 <= count <= 32`;
- `spacing` is a bounded M1 millimetre scalar;
- resolved spacing must be finite and non-zero;
- negative spacing is valid and reverses the repetition direction;
- instance `0` is the original position;
- instance `i` is translated by `i * spacing` along `axis`;
- ordering is canonical and deterministic from index `0` through `count - 1`;
- the node returns an `instanceSet`, not a Boolean union and not one opaque compound;
- schemaVersion remains `1` if implementation reconciles cleanly.

A parameter-driven integer `count` remains deferred until Brepia has an integer-safe published-parameter contract. Numeric parameters must not be rounded or truncated into counts.

## Shared node value kinds

Introduce the bounded shared value kind:

```ts
type BrepNodeValueKind = 'single' | 'instanceSet';
```

Initial node mapping:

```text
box            -> single
cylinder       -> single
transform      -> single
mirror         -> single
fillet         -> single
subtract       -> single
union          -> single
intersect      -> single
linearPattern  -> instanceSet
```

This is a canonical semantic property, not a backend heuristic.

## Initial consumer compatibility matrix

M3B deliberately allows only the combinations needed for the first two use cases.

```text
linearPattern.input       single only
transform.input           single only
mirror.input              single only
fillet.input              single only
subtract.base             single only
subtract.tools            single OR instanceSet
union.inputs              single only
intersect.inputs          single only
projectObject geometry    single only
resultNodeId              single OR instanceSet
```

Consequences:

- nested `linearPattern(linearPattern(...))` is rejected in M3B;
- pattern -> transform/mirror/fillet is rejected;
- pattern -> union/intersect is rejected;
- an instance set cannot be assigned to footprint/clearance/maintenance roles;
- a linear pattern may be the final Result;
- a linear pattern may be used directly as a subtract tool, where its instances are expanded in deterministic order.

Unsupported collection-to-single flows fail during canonical validation rather than relying on native or Rhino accidents.

## Spacing validation

Canonical/default validation must reject a linear pattern whose resolved default spacing is zero.

Runtime request validation must re-evaluate the same constraint under effective parameter overrides and reject a state where spacing resolves to zero.

Negative spacing remains valid. The AI authoring instruction should avoid published spacing ranges that include zero when a bounded non-zero range can be represented cleanly, but runtime validation remains authoritative.

## Evaluated body identity

The current comment that `BrepEvaluatedBody.id` is always the canonical feature ID is insufficient once one node yields multiple bodies.

M3B should make body identity explicit:

```ts
type BrepEvaluatedBody = {
  /** Stable evaluated-body identity. */
  id: string;
  /** Canonical node whose value owns this body. */
  nodeId: string;
  /** Present only for an instance-set member. */
  instance?: {
    index: number;
    sourceNodeId: string;
  };
  bounds: BrepBounds;
  viewerMesh?: BrepViewerMesh;
};
```

Stable IDs:

```text
single result:       id = <nodeId>
pattern instance 0:  id = <patternNodeId>::0
pattern instance 1:  id = <patternNodeId>::1
...
```

`:` is not admitted by canonical feature IDs, so the evaluated-body namespace cannot collide with a canonical node ID.

For a pattern member:

- `nodeId` is the `linearPattern` node ID;
- `instance.index` is the deterministic zero-based index;
- `instance.sourceNodeId` is the pattern's canonical `input` node ID.

Add to successful evaluation:

```ts
resultKind: 'single' | 'instanceSet';
```

For a single result, `bodies.length === 1` and the existing ID remains unchanged. For an instance-set result, `bodies.length === count` and body order must match canonical instance order.

`result.bounds` becomes the aggregate axis-aligned bounds across every primary result body.

## Server validation

`src/server/brepEvaluation.ts` must stop using the historical `bodies[0].id === resultNodeId` shortcut as the universal result rule.

Validation should derive the expected result kind from the canonical project and enforce:

### single

- `resultKind === 'single'`;
- exactly one body;
- `body.id === resultNodeId`;
- `body.nodeId === resultNodeId`;
- no instance metadata.

### instanceSet

- `resultKind === 'instanceSet'`;
- body count exactly equals the canonical pattern count;
- every body has `nodeId === resultNodeId`;
- IDs exactly match `<resultNodeId>::<index>`;
- instance indices are contiguous, unique and ordered `0..count-1`;
- `sourceNodeId` matches the canonical pattern input;
- aggregate bounds contain all bodies;
- total body/mesh resource limits remain enforced.

Project-object geometry remains single-body and retains its existing node-ID identity.

## Native build123d / OCCT evaluator

Keep ordinary single-shape evaluation as intact as possible rather than rewriting every operation into list semantics.

Recommended internal split:

- `evaluate_node(nodeId)` -> one shape, valid only for single-valued nodes;
- `evaluate_node_instances(nodeId)` -> ordered shape list; ordinary single nodes return a one-element list, `linearPattern` returns `count` moved copies.

`linearPattern` implementation:

1. evaluate its single input;
2. resolve and reject zero spacing;
3. create `count` independent moved shapes using the canonical axis and `i * spacing`;
4. cache the ordered instance list.

`subtract.tools` expands `evaluate_node_instances(toolId)` and applies every tool instance in canonical order. The base remains one shape and the subtract result remains one shape.

When `resultNodeId` is an instance set:

- emit one `BrepEvaluatedBody` per instance;
- compute aggregate bounds;
- keep the explicit body list authoritative;
- construct `Compound(children=instances)` only for aggregate STEP/3DM artifact generation.

The Compound is an export container, not canonical identity and not a replacement for `bodies[]`.

## Exact STEP and 3DM

### STEP

For a single result, existing exact STEP behavior is unchanged.

For an instance-set result, `model.step` should contain the full ordered repeated result via an aggregate build123d Compound/assembly. Native acceptance must independently re-open the STEP and verify the expected solid count; a signature-only check is not sufficient for the new multi-solid case.

### 3DM

The 3DM writer must not collapse an instance-set Result to one tessellated object.

Each primary result instance should be written as a separate mesh object carrying stable Brepia user strings including at least:

```text
brepia.bodyId
brepia.nodeId
brepia.instanceIndex
brepia.sourceNodeId
brepia.roles = ["result"]
```

The embedded primary STEP remains the exact aggregate CAD artifact.

Auxiliary project-object geometry roles stay single-shape-only in M3B and retain existing behavior.

## Browser viewer

Both current BRep viewer paths build Three.js geometry from only `result.bodies[0]`. M3B must remove that single-body assumption.

Do not merge all viewer meshes into one BufferGeometry, because that would discard the body identity just introduced by the evaluation contract.

Create one Three.js mesh per evaluated body and preserve body identity in mesh/userData. Render the meshes as one centered model group while retaining their independent IDs. Single-body projects should remain visually unchanged.

The existing `ThreeScene` group path may be generalized/reused, but the BRep code should not depend semantically on the OpenSCAD-specific `coloredGroup` name.

## Grasshopper contract

The canonical source determines primary Result access:

```text
single result       -> Result access: item
instanceSet result  -> Result access: list
```

Footprint, Clearance and Maintenance remain item outputs because M3B forbids instance-set project-object roles.

Semantic point outputs remain list outputs as before.

The contract interface remains derived from canonical source and is not a second authority.

## Rhino Python / executable GHX

The Rhino compiler needs the same shared node-kind model.

`linearPattern` should compile to an ordered Python list of duplicated Breps, each translated by `i * spacing` along the selected axis. It must not call Boolean union.

For a patterned subtract tool, the generated code iterates over each Brep in the ordered list and applies the existing fail-closed Boolean-difference rule.

For an instance-set Result, project placement must be applied to every Brep and `Result` assigned the resulting list.

Extend `BrepGrasshopperRhinoScriptOutput` with access metadata and serialize the primary Result output with Grasshopper list access when canonical result kind is `instanceSet`. The executable GHX strict validator must compare persisted `ScriptParamAccess` against the deterministic expected output access.

Official Rhino 8 Python-component documentation/sample persistence is the upstream reference for Item/List/Tree parameter access. Installed Rhino 8 remains the final runtime authority.

## GHX return boundary

The existing Grasshopper return/import boundary remains parameter-only.

M3B does **not** allow Grasshopper to mutate:

- linear-pattern count;
- axis;
- spacing expression structure;
- instance identities;
- output access;
- graph wiring;
- script source.

A returned GHX may change only the already-supported published parameter values. Strict validation must reject output-access or script mutations.

## Structural editor

After the shared value-kind helper exists, structural authoring must become compatibility-aware rather than listing every node in every reference selector.

- `Linear pattern` exposes single input, axis, literal integer count and scalar spacing;
- input choices are single-valued nodes only;
- transform/mirror/fillet/union/intersect/subtract-base selectors likewise exclude instance-set nodes;
- subtract-tool selection allows both single nodes and linear patterns;
- Result selection allows either kind;
- project-object role selectors allow single nodes only;
- the UI states that a pattern result is an ordered set of bodies, not a Boolean union.

## AI authoring contract

Teach the Native BRep agent:

- use `linearPattern` for genuine repetition rather than repeated literal transform nodes;
- `count` is literal integer 2..32 in M3B;
- spacing is a non-zero millimetre scalar/expression;
- instance 0 is the original location;
- negative spacing is permitted;
- use pattern directly as `resultNodeId` for independent repeated objects;
- use pattern as a subtract tool for repeated holes/cutters;
- do not feed instance sets into transform/mirror/fillet/union/intersect or project-object geometry roles;
- never Boolean-union intentionally separated instances merely to satisfy the old single-body path.

## M0/M1 integration

`linearPattern.input` participates in ordinary DAG/reachability traversal.

`linearPattern.spacing` participates in scalar-reference traversal. A spacing parameter is effective when the pattern is authoritative directly or through an allowed consumer such as subtract.

M0 and M1 limits remain unchanged.

## Repository acceptance sequence

M3B implementation should be staged in this order:

1. shared value-kind helper + canonical compatibility validation;
2. `linearPattern` normalization and default/runtime non-zero spacing validation;
3. provider schema + M0/M1 traversal;
4. evaluation-result identity/resultKind contract + server validation;
5. native evaluator instance sets, patterned subtract tools, aggregate STEP/3DM;
6. multi-body BRep viewer;
7. Grasshopper Result item/list contract;
8. Rhino compiler + executable GHX output-access persistence/strict validation;
9. structural editor + AI instruction;
10. dedicated contract tests and native smoke fixtures;
11. full tests/typecheck/lint/build/diff check and Grasshopper Build.

## Runtime acceptance sequence

Native runtime must verify at least:

### Independent result

```text
one box
-> linearPattern count 4, spacing parameter
-> four explicit result bodies
-> stable IDs pattern::0 .. pattern::3
-> aggregate bounds change with spacing
-> exact STEP independently re-opens with four solids
-> 3DM contains four result objects with instance metadata
```

### Patterned subtract tool

```text
one base plate
+ one cutter
-> linearPattern cutter count >= 3
-> subtract uses pattern as tool
-> one final result body
-> all repeated cuts are present
```

Installed Rhino 8 / Grasshopper must verify:

```text
fresh GHX
-> Result is a list of all expected Breps for an instance-set result
-> spacing change recomputes every instance
-> no Boolean-union collapse
-> save/close/reopen preserves list Result and parameter wiring
```

A patterned-subtract GHX should also be tested before M3B closeout so collection consumption is proven in the installed host, not only list output.

## Deferred beyond M3B

Not part of this implementation:

- parameter-driven integer count;
- rectangular/grid pattern;
- nested patterns;
- collection-aware transform;
- collection-aware mirror;
- collection-aware fillet;
- union/intersection flattening of instance sets;
- instance-set project-object geometry roles;
- non-zero rotation;
- saved-model clone implementation.

## Preserved boundaries

M3B must preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` + immutable revisions;
- build123d/OCCT native geometry authority;
- schemaVersion `1` unless an explicit migration becomes unavoidable;
- canonical scalar depth `12` and node limit `64`;
- provider expression depth `2` and finite/reference-free provider schema;
- M0 parameter-effectiveness/orphan rules;
- M2 exact-one-body semantics for actual Boolean nodes;
- M3A mirror behavior;
- GHX parameter-only return/import;
- non-zero rotation fail-closed behavior;
- OpenSCAD regressions;
- deferred saved-model clone plan;
- PR #36 remaining open, draft, stacked and unmerged.
