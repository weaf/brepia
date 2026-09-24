# Phase C1 — Template identity and versioning design

Status: DESIGN ONLY — no implementation authorized by this document.

Repository: `weaf/brepia`

Design branch: `design/phase-c1-template-identity-versioning`

Reconciled master baseline:

`bb97c1ec755a89710603aa1cbe3dd65f2eb6b115`

`Merge PR #52: Close Phase B Foundation Hardening`

## Purpose

Define the minimum stable architecture for reusable, versioned product templates without weakening the existing canonical BRep authority or immutable revision model.

Required creation semantics:

`Template -> create project -> independent project/revision lineage`

A project created from a template receives a complete canonical source snapshot at creation time. It must never depend on future reads of that template version to remain valid, and later template changes must never silently mutate existing projects.

## Reconciled current architecture

The current BRep source authority is already explicit:

- `BrepProject` is the kernel-neutral canonical source model.
- `BrepProject.schemaVersion` is currently exactly `1`.
- `normalizeBrepProject()` is the canonical validation/normalization boundary.
- `ParametricProjectSource { kind: 'brep', source: BrepProject }` is the persisted source wrapper.
- a BRep project revision is persisted as a complete `data-brep-project` artifact snapshot on an immutable assistant message.
- `conversations.current_message_leaf_id` selects the active revision.
- new source/parameter edits create new message snapshots; existing revision nodes are not mutated.
- native build123d/OCCT evaluation and STEP remain downstream derived/runtime authorities, not persisted competing source models.
- Rhino/GHX remains an interoperability path rather than canonical geometry authority.

Current project creation in `src/services/brepProjectService.ts` creates a new conversation UUID and inserts a complete BRep baseline artifact. This is the correct seam for future template-based project creation.

The existing reusable/sample/profile surfaces are not template authority:

- `shared/brepSamples.ts` contains representative reusable/test project objects.
- prompt profiles and bundled instruction packages version AI instructions, not product geometry.
- `shared/parametricParts.ts` is OpenSCAD/message parsing support.
- the artifact field `version: 'v1'` is an artifact compatibility/version label and is not a product-template version.

These concepts must remain separate.

## Core design decision

C1 should begin with **repository-built-in templates only**.

Do not add database-backed, user-created, shared or marketplace templates in the first implementation slice.

Built-in templates provide the smallest architecture that can prove:

- stable template identity;
- immutable template versions;
- canonical BRep source validation;
- safe creation of an independent project snapshot;
- provenance persistence;
- future-compatible catalog abstraction.

A database schema should be introduced only when a real persisted-template capability is selected later. Designing a DB table now would add migration and RLS surface before it is needed.

## Identity model

### Template identity

Use one stable namespaced string ID per logical product family.

Recommended shape:

`builtin:<slug>`

Examples for future product packs:

- `builtin:electrical-cabinet`
- `builtin:cable-tray`
- `builtin:cable-conduit`

The ID identifies the logical template family, not one version.

Rules:

- globally unique within the Brepia template catalog;
- lowercase ASCII;
- stable for the lifetime of the family;
- never derived from display name;
- never reused for a different product family.

### Template version

Use a positive monotonically increasing integer:

`version: 1, 2, 3, ...`

Identity of an immutable template release is the pair:

`(templateId, version)`

Do not use semantic versioning initially. Template versions do not currently need independent major/minor/patch compatibility promises, and semver would imply upgrade semantics C1 does not provide.

Do not overload any existing version field:

- `BrepProject.schemaVersion` = canonical BRep language/schema compatibility.
- `BrepProjectArtifactData.version` = existing artifact compatibility label.
- template `version` = immutable product-definition revision.

They are independent dimensions.

## Recommended built-in template definition

Conceptual TypeScript shape:

```ts
type BuiltinProductTemplate = {
  id: string
  version: number
  name: string
  category: string
  description?: string

  source: Extract<ParametricProjectSource, { kind: 'brep' }>

  presentation?: {
    parameterOrder?: string[]
    groups?: Array<{
      id: string
      label: string
      parameterIds: string[]
    }>
    preview?: {
      kind: 'bundled'
      assetId: string
    }
  }
}
```

The exact presentation fields may be narrower in the first implementation. They are shown here only to define the authority boundary.

## Geometry authority versus presentation metadata

The template's `source` is the only geometry-defining payload.

Geometry-affecting values belong in the canonical BRep source, including:

- nodes and references;
- result node;
- placement;
- parameter defaults;
- parameter min/max/step where they form part of the canonical parameter contract;
- scalar expressions;
- project-object semantic geometry roles.

Template-level presentation metadata may describe only product/UI concerns such as:

- display name;
- category;
- description;
- ordering/grouping of existing published parameters;
- preview asset references;
- future product-specific help text.

Presentation metadata must not:

- define alternative node graphs;
- override a canonical parameter value used by geometry;
- contain kernel/Rhino topology IDs;
- contain derived meshes or STEP as source;
- silently patch the canonical source at runtime.

This prevents a second hidden geometry authority.

## Project instance identity

A created project keeps its existing persistence identity:

- the conversation UUID is the durable project/product-instance identity;
- the immutable message tree is its revision lineage.

Do not overload `BrepProject.id` as the database/project-instance identifier.

`BrepProject.id` is part of the canonical source document and may legitimately be the same in many independently created projects copied from one template. Persistence identity and source-local model identity are separate concerns.

## Creation semantics

Creating from a template should perform the following bounded sequence:

1. Resolve one exact immutable template by `(templateId, version)`.
2. Validate it through the normal template validator.
3. Normalize the template source through `normalizeParametricProjectSource` / `normalizeBrepProject`.
4. Create a fresh conversation UUID.
5. Persist a complete copied BRep artifact snapshot as the baseline revision.
6. Persist non-authoritative template provenance.
7. From that point onward, all project edits use the normal independent immutable revision lineage.

No later project operation may require the original template to be present.

No later template publication may update the created project's source automatically.

## Provenance

Template provenance is descriptive/audit metadata, never live source authority.

Recommended project-level provenance in `conversations.settings`:

```json
{
  "projectOrigin": {
    "kind": "template",
    "catalog": "builtin",
    "templateId": "builtin:electrical-cabinet",
    "templateVersion": 1,
    "sourceDigest": "<sha256>"
  }
}
```

Recommended baseline-revision provenance in the initial assistant message `metadata`:

```json
{
  "projectCreation": {
    "kind": "template",
    "catalog": "builtin",
    "templateId": "builtin:electrical-cabinet",
    "templateVersion": 1,
    "sourceDigest": "<sha256>"
  }
}
```

The same normalized provenance shape should be used in both locations.

Rationale:

- conversation settings answer “where was this project originally created from?”;
- baseline revision metadata records the same fact on the immutable creation node;
- later revisions inherit ancestry through the existing message lineage and do not need the template payload duplicated into every revision;
- a project remains fully operable if the originating template is unavailable.

`sourceDigest` is recommended as a SHA-256 of the normalized canonical source serialization. It proves which exact source snapshot was used without becoming an authority or lookup dependency.

For projects created from scratch, use:

```json
{ "kind": "scratch" }
```

No nullable/template-guessing behavior should be required.

## Immutable template versions

Published built-in versions are append-only.

Rules:

- never change the source or product metadata for an existing `(id, version)` pair;
- a changed template definition requires a new integer version;
- registry validation must reject duplicate pairs;
- a “latest” resolver may select the highest version for new-project UX, but persisted provenance always records the exact numeric version;
- old projects never resolve “latest”.

Repository history is not sufficient as the runtime versioning model. Multiple immutable versions that remain selectable/reproducible should coexist explicitly in the built-in catalog while supported.

## Built-in versus database-backed templates

C1 first implementation:

- one repository-backed catalog abstraction;
- immutable built-in definitions;
- no template DB tables;
- no template RLS;
- no user-owned template mutations.

Future database-backed design should preserve the same external identity contract and naturally map to:

- stable template identity row;
- immutable template-version rows;
- one complete canonical source snapshot per version;
- separate mutable catalog/listing metadata only where safe.

A future DB implementation must not require rewriting project provenance or project source semantics.

## Compatibility with canonical `schemaVersion: 1`

Template versioning does not require a new BRep schema version.

A C1 template may carry only a canonical source currently accepted by `normalizeBrepProject`, which means `schemaVersion: 1` today.

If a future BRep schema version is introduced:

- template versions explicitly carry whatever canonical source version they were authored against;
- the normal BRep source parser/normalizer remains the compatibility authority;
- template version numbers are not mapped to BRep schema versions.

A template containing an unsupported canonical source schema must fail closed.

## Template upgrade and migration policy

There is **no automatic template upgrade** in C1.

Publishing template version 2 affects only projects newly created from version 2.

Existing projects created from version 1 remain independent and unchanged.

Any future “upgrade project from template” feature must be a separately designed explicit user action. It would create a new project revision through a validated transform/diff process and must never mutate historical revisions or silently rebase the project.

Template migration and BRep schema migration are separate problems.

## Validation contract

A built-in template must fail closed before it can enter the catalog.

Minimum validation:

1. template object is structurally valid;
2. ID satisfies the catalog ID grammar;
3. version is a positive safe integer;
4. name/category/description obey bounded text limits;
5. `source.kind === 'brep'`;
6. source passes `normalizeParametricProjectSource`;
7. BRep source therefore passes all existing `normalizeBrepProject` graph, parameter, scalar-expression and geometry-boundary validation;
8. duplicate `(id, version)` pairs are rejected;
9. presentation parameter references, if present, must reference existing published parameter IDs;
10. presentation metadata cannot inject geometry;
11. source digest is computed from the normalized source, never trusted from authored input.

The validator should return a normalized immutable definition suitable for registry use.

## Relationship to current artifact version

`BrepProjectArtifactData.version` is currently populated as `"v1"`.

C1 should not reinterpret this field as template version. Doing so would couple artifact persistence format to product-template lifecycle and create ambiguity for projects created from scratch.

If the artifact version needs a clearer name later, that should be a separate compatibility migration.

## Recommended implementation slices after design acceptance

### C1.1 — template domain contract and validator

- add template types;
- add ID/version validation;
- normalize canonical BRep source;
- add duplicate-pair/catalog validation;
- add focused unit tests.

No UI, no database, no product pack.

### C1.2 — repository built-in catalog

- add a small catalog/registry abstraction;
- support exact `(id, version)` lookup;
- support explicit latest-version lookup for creation UX only;
- use either a deliberately minimal foundation fixture or an already accepted canonical sample while product-pack work remains deferred.

Do not introduce cable tray/conduit/new cabinet product work here.

### C1.3 — project creation from template

- add one creation service that resolves an exact immutable template;
- copy the complete normalized source into a fresh project conversation;
- persist project-level and baseline-revision provenance;
- preserve existing BRep creation/revision semantics;
- add tests proving later catalog/template changes cannot alter an existing project snapshot.

### C1.4 — provenance read path

- expose typed provenance parsing for product UI/API use;
- fail safely on malformed historical settings/metadata;
- no template dereference required to open/edit an existing project.

### C1.5 — integration/acceptance closeout

Verify at minimum:

- create-from-template gives fresh conversation identity;
- baseline source is byte/semantic equivalent to the normalized template source at creation;
- two projects from the same template are independent;
- modifying one project creates only its own revision;
- adding a newer template version leaves old projects unchanged;
- unsupported/invalid template source fails closed;
- template presentation metadata cannot alter geometry;
- existing scratch-project creation remains compatible;
- existing BRep `schemaVersion: 1`, native evaluation, STEP and Rhino/GHX boundaries remain unchanged.

Only after this closeout should Phase C move to broader template/product UX.

## Explicit non-goals for C1

Do not implement in C1:

- cable tray;
- cable conduit/pipe;
- a new electrical cabinet template/product;
- marketplace;
- user-created templates;
- shared templates;
- template editing;
- database-backed template CRUD;
- automatic project upgrades;
- BRep schema version 2;
- a new canonical BRep operation;
- assembly semantics;
- Rhino/GHX as template source authority.

## Preserved boundaries

C1 must preserve unchanged:

- canonical BRep project as geometry authority;
- immutable revision snapshots;
- build123d/OCCT native authority;
- STEP authority;
- Rhino/GHX interoperability-only role;
- M0 parameter integrity;
- current scalar/expression semantics;
- fail-closed geometry validation;
- existing auth/RLS ownership boundaries.

## Reconciliation note: local Dquark worktree

During this design pass, Dquark `local-status` showed the workstation Brepia checkout still on:

`hardening/foundation-b1`

with local modifications in five files.

Therefore the local worktree was deliberately not synced, checked out or modified. This design branch was created directly from the accepted remote `master` baseline above.

## Decision summary

The recommended C1 architecture is:

```text
repository built-in template catalog
  stable templateId
  + immutable integer version
  + product metadata
  + one complete validated canonical BRep source
  + optional geometry-neutral presentation metadata
        |
        | create
        v
fresh conversation/project UUID
  + copied canonical BRep baseline revision
  + immutable creation provenance
        |
        v
independent existing message/revision lineage
```

The template catalog is a creation source, not a continuing project dependency.

That is the central invariant for Phase C1.
