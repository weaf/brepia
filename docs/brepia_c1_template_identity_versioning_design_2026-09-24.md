# C1 — Template identity and versioning design

Date: 2026-09-24

Status: DESIGN RECONCILED — NO IMPLEMENTATION YET

Repository: `weaf/brepia`

Design branch: `design/c1-template-identity-versioning`

Reconciled master baseline:

`bb97c1ec755a89710603aa1cbe3dd65f2eb6b115`

`Merge PR #52: Close Phase B Foundation Hardening`

## Purpose

Phase C introduces a product-template layer without creating a second geometry authority.

The fundamental lifecycle is:

```
Template
  -> instantiate once
  -> independent canonical BRep project
  -> ordinary immutable project/revision lineage
```

A later template change must never silently mutate an existing project.

This document resolves C1 identity/versioning decisions before persisted schema or UI implementation.

## Reconciliation findings

Current implementation already separates several concerns that C1 must preserve:

- `BrepProject` is the canonical geometry snapshot and currently has `schemaVersion: 1`.
- `BrepProject.id` is a canonical project identity inside the snapshot.
- the persisted BRep artifact envelope is separate from the canonical geometry snapshot;
- immutable BRep revisions are persisted as assistant-message artifacts in the existing message tree;
- `conversations.id` is the persistent product/conversation container identity;
- revision activation is controlled by `conversations.current_message_leaf_id`;
- ordinary parameter/source edits create new immutable BRep artifacts;
- repository-backed prompt profiles already demonstrate a useful pattern: immutable repository-owned definitions may coexist with later database-owned user definitions;
- `shared/brepSamples.ts` is test/sample data, not a product-template authority;
- the portable BRep package and BRep artifact normalizers deliberately discard unknown fields so derived/runtime data cannot become geometry authority.

The local Dquark worktree was not used as C1 authority because, during reconciliation, it was still on `hardening/foundation-b1` at `ebacf737...` with local modifications. The design therefore uses the verified remote `master` baseline above.

## C1 decisions

### 1. Template identity

A template has a stable logical id plus an immutable integer version.

Recommended contract:

```ts
type BrepTemplateRef = {
  id: string;
  version: number;
};
```

Example:

```ts
{ id: 'electrical-cabinet', version: 1 }
```

Rules:

- `id` is a stable repository-safe slug, independent from project ids;
- `version` is a positive monotonically increasing integer per template id;
- `(id, version)` is the immutable template-version key;
- changing an existing template definition in place is forbidden;
- a changed definition creates a new version.

An integer is preferred over semantic-version strings in the first foundation because C1 needs immutable content identity, not a public API compatibility promise. Canonical BRep compatibility remains expressed separately through BRep schema compatibility.

### 2. Template-definition schema

Introduce a template-layer schema independent from canonical BRep schema.

Conceptual shape:

```ts
type BrepTemplateDefinition = {
  templateSchemaVersion: 1;
  id: string;
  version: number;
  name: string;
  category: string;
  description: string;

  source: BrepProject;

  compatibility: {
    brepSchemaVersion: 1;
  };

  definitionDigest: string;
};
```

C1 should not yet add preview or rich parameter-presentation fields. Those belong to C2/C3, but the template contract should be extensible so they can later be added without changing geometry authority.

### 3. Deterministic immutable version identity

`(id, version)` alone is not enough to prevent an accidental repository edit of version 1.

Each built-in template version should therefore carry a deterministic `definitionDigest` computed from the normalized template definition excluding the digest field itself.

Validation must fail when:

- content changes but `version` is unchanged;
- the stored digest does not match normalized content;
- duplicate `(id, version)` entries exist.

The digest covers the versioned template definition, including canonical source and product metadata that belongs to that template version.

### 4. Canonical BRep source

`template.source` is a complete valid canonical `BrepProject`.

It is the source used to initialize a new product instance, but it does not remain authoritative after instantiation.

Instantiation performs a deep canonical clone, normalizes it, and assigns a fresh project identity.

Important distinction:

- template id/version identify the reusable definition;
- template-local `source.id` only makes the stored source a valid canonical project;
- the created project receives a new `BrepProject.id`;
- node ids and parameter ids may remain stable inside the cloned graph because they are scoped to the independent project snapshot.

This prevents two independently created projects from sharing canonical project identity merely because they came from the same template.

### 5. Project identity and lineage

Creating from a template must use the existing project/revision lifecycle.

Required behavior:

1. resolve exact immutable template `(id, version)`;
2. validate template;
3. clone the canonical BRep source;
4. assign a new canonical `BrepProject.id`;
5. normalize the project;
6. create a new conversation/project container with its own UUID;
7. create the normal immutable initial assistant-message BRep revision;
8. activate that revision through the existing leaf semantics;
9. continue all later edits through ordinary BRep revision behavior.

No template runtime lookup is required after successful creation.

A project created from scratch follows the same lineage but has no template provenance.

### 6. Provenance

Template provenance is metadata, not geometry authority.

Recommended first-class provenance shape:

```ts
type BrepTemplateProvenance = {
  kind: 'template';
  templateId: string;
  templateVersion: number;
  source: 'builtin';
  definitionDigest: string;
};
```

The authoritative provenance should be stored in the persisted BRep artifact envelope, outside `BrepProject`.

Reasoning:

- it keeps `schemaVersion: 1` unchanged;
- it cannot influence geometry evaluation;
- the artifact is already the immutable revision envelope;
- ordinary source/parameter revisions already rebuild artifacts from the previous artifact and can preserve provenance;
- provenance then travels with the revision lineage instead of depending on mutable current template state.

C1 should require all subsequent revisions of a template-created project to preserve the same creation provenance unchanged.

A conversation-level copy may later be introduced only as a derived indexing/discovery cache. It must not become the provenance authority.

### 7. Portable package provenance

The current project-package envelope is separate from canonical BRep geometry and deliberately strips unknown fields.

If C1 requires provenance to survive Brepia package export/import, provenance should be added explicitly to the package envelope, not to `BrepProject`.

This can remain optional for legacy packages.

Any package change must preserve the existing rule that imported canonical geometry is re-normalized and that runtime/derived data cannot enter project authority.

### 8. Built-in versus database-backed templates

C1 should begin with repository-owned built-in templates only.

Reasons:

- no database migration is required to prove the lifecycle;
- no new RLS surface is introduced;
- immutable versions are naturally reviewable in Git;
- CI can validate every shipped template;
- it avoids prematurely designing ownership/sharing/marketplace semantics;
- the same normalized template contract can later back database records.

Database-backed user/shared templates are explicitly deferred until the built-in lifecycle is proven.

A later database implementation should store immutable template versions and use the same logical template-definition contract; it must not introduce a different geometry representation.

### 9. Compatibility with canonical `schemaVersion: 1`

C1 does not change `BREP_PROJECT_SCHEMA_VERSION`.

Each template version declares the BRep schema version it targets.

For the first implementation:

```ts
compatibility: {
  brepSchemaVersion: 1
}
```

Template validation rejects a mismatch between compatibility metadata and the normalized canonical source.

Template schema version and BRep schema version are intentionally separate:

- template schema version governs template metadata/envelope evolution;
- BRep schema version governs canonical geometry semantics.

### 10. Upgrade and migration policy

There is no automatic template upgrade of existing projects.

When template v2 is added:

- projects created from v1 remain unchanged;
- they retain provenance pointing to v1;
- new projects may choose v2;
- deleting v1 from runtime resolution should be avoided while shipped/history compatibility requires it.

A future explicit migration feature may be designed separately, but it must be an observable user action that produces a new ordinary project revision or a new project. It may never silently follow a template pointer.

Canonical BRep schema migrations are a separate concern and must not be smuggled into template-version upgrades.

### 11. Geometry authority versus presentation metadata

Geometry authority remains exclusively the canonical BRep source copied into the project.

Template/product presentation metadata may later reference canonical parameter ids for:

- grouping;
- ordering;
- display labels/help;
- visibility;
- basic/advanced classification;
- formatting/UX hints.

Presentation metadata must never:

- contain an alternate geometry graph;
- override canonical parameter default values during evaluation;
- silently replace canonical min/max/unit semantics;
- define evaluator behavior;
- carry derived native/Rhino topology as authority.

For C2, preferred policy is to reference canonical parameter ids rather than duplicate authoritative parameter definitions. Any recommended UI range must be validated as a hint compatible with canonical constraints.

### 12. Avoiding a second hidden geometry authority

The following are forbidden:

- keeping a live template pointer that the project evaluates on every open;
- storing geometry-affecting overrides only in template metadata;
- reconstructing project geometry from current template state;
- making preview metadata executable geometry;
- storing a second independently editable template graph beside the cloned canonical project;
- treating Rhino/GHX or STEP as the project source.

Once instantiated, only the project's immutable canonical BRep revisions determine geometry.

## Validation contract

A built-in template-version validator should prove at least:

1. template envelope/schema is valid;
2. id/version pair is unique;
3. version is a positive integer;
4. deterministic definition digest matches;
5. canonical source normalizes successfully;
6. source BRep schema matches compatibility metadata;
7. M0 parameter integrity/effectiveness validation passes;
8. all canonical ids/references/cycles/result semantics pass existing fail-closed validation;
9. instantiation produces a fresh valid project id;
10. instantiated project source is independent of later registry/template objects.

C5 will broaden acceptance to native evaluation, expected result kind, parameter-effectiveness runtime evidence and relevant export/import smoke. C1 should design for that gate but should not pull all of C5 into the first identity slice.

## Repository layout recommendation

Keep the first foundation small and repository-owned.

Suggested shape:

```
shared/
  brepTemplate.ts            # contract + normalizer + identity/digest validation
  brepTemplates.ts           # built-in registry/resolution

tests/
  brepTemplate.test.ts
  brepTemplateInstantiation.test.ts
```

Product templates themselves should be introduced only when the relevant Product Pack phase begins. C1 tests may use dedicated fixtures rather than prematurely publishing an electrical-cabinet/cable-tray/conduit product template.

Do not turn `shared/brepSamples.ts` into the long-term product-template registry.

## Recommended C1 implementation slices

### C1.1 — Template contract and immutable registry

- add template envelope/types;
- add normalization;
- add `(id, version)` resolution;
- add deterministic digest validation;
- built-in repository registry only;
- test fixtures only;
- no UI;
- no database migration.

Exit: an immutable built-in template can be resolved and validated without creating a project.

### C1.2 — Independent instantiation

- implement pure instantiate function;
- deep-clone normalized canonical source;
- assign fresh `BrepProject.id`;
- preserve node/parameter identities within the clone;
- verify template objects cannot be mutated through the created project.

Exit: one template version deterministically creates independent canonical project snapshots.

### C1.3 — Revision provenance

- extend BRep artifact envelope with optional normalized template provenance;
- preserve provenance through source and parameter revisions;
- define from-scratch behavior as provenance absent;
- keep provenance outside canonical `BrepProject`.

Exit: every revision in a template-created project can identify its creation template without consulting the current template registry.

### C1.4 — Project creation integration

- create a new project/conversation through the existing baseline lifecycle;
- instantiate exact template ref first;
- persist the normal immutable initial revision;
- preserve current auth/RLS and current-leaf semantics;
- no template UI yet.

Exit: template creation uses ordinary project/revision infrastructure and no parallel persistence model.

### C1.5 — Package/provenance boundary decision

- explicitly decide whether C1 requires template provenance in portable Brepia packages;
- if yes, add optional package-envelope provenance with normalization/round-trip tests;
- if no, record it as a bounded later compatibility slice before user-facing template export claims.

### C1.6 — C1 closeout

- focused unit/service tests;
- full repository quality gate;
- branch-protection checks remain `quality` and `grasshopper-interoperability`;
- update current-operating documentation;
- no product pack and no new BRep capability.

## Explicit non-goals for C1

Do not implement during C1:

- cable tray;
- conduit/pipe;
- a new electrical cabinet template;
- marketplace/discovery UX;
- user-created/shared templates;
- database-backed template ownership;
- a general assembly model;
- new BRep operations;
- automatic project upgrade to later template versions;
- template-driven hidden geometry overrides.

## Architecture conclusion

The lowest-debt C1 architecture is a thin immutable product-template envelope around an existing valid canonical BRep snapshot.

The template is used exactly once to create a new independently identified canonical project. After creation, the established project/revision system remains the only geometry lineage.

That preserves the current geometry, native-runtime, Rhino/GHX, STEP, M0, scalar/expression, fail-closed and auth/RLS boundaries while providing a clean foundation for later product metadata, previews and product packs.
