# Phase C1 — Template identity and versioning closeout

Date: 2026-09-24

Status: COMPLETE

Branch: `feature/phase-c1-template-foundation`

Accepted implementation checkpoint before closeout documentation:

`ecee2a2aa5053e1054fda3c63b5b4f1360d76e29`

## Scope completed

Phase C1 established the product-template foundation without adding a product pack, database-backed template storage, new BRep capability, or a second geometry authority.

Implemented slices:

### C1.1 — template domain contract and validator

- stable namespaced built-in template identity;
- positive immutable integer template version;
- bounded product metadata;
- canonical BRep source only;
- fail-closed validation through the existing canonical source normalizer;
- presentation references restricted to existing published parameter IDs;
- duplicate `(templateId, version)` rejection;
- normalized template definitions frozen for runtime immutability.

### C1.2 — repository built-in catalog

- exact `(templateId, version)` lookup;
- explicit latest-version lookup for creation/discovery use only;
- ordered version enumeration;
- immutable normalized catalog entries;
- shipped built-in catalog deliberately remains empty until a later product-pack phase explicitly adds products.

No cable tray, conduit, new cabinet, marketplace, user-created template or shared-template capability was introduced.

### C1.3 — independent project creation and provenance

- template materialization creates a fresh normalized canonical BRep snapshot;
- SHA-256 source digest records the exact normalized canonical source used at creation;
- template provenance is persisted in:
  - `conversations.settings.projectOrigin`;
  - baseline assistant-message `metadata.projectCreation`;
- exact template-version lookup fails closed before persistence;
- direct existing BRep creation is marked explicitly as `scratch`;
- existing import semantics were left unchanged rather than being misclassified as scratch;
- project operation after creation does not require template/catalog dereference.

The project/conversation UUID remains the durable persisted project-instance identity. `BrepProject.id` remains source-local canonical model identity and is not overloaded as a database instance identifier.

### C1.4 — typed provenance read path

- untrusted/historical JSONB provenance has a typed parser;
- malformed or unsupported provenance degrades safely to unknown rather than making a valid project unreadable;
- conversation-level origin and baseline-message creation provenance have typed readers;
- unknown metadata fields are discarded;
- provenance reading does not consult the current template catalog.

### C1.5 — integration/acceptance

Acceptance coverage proves:

- multiple projects materialized from one template are independent canonical snapshots;
- editing one project does not mutate another project created from the same template;
- publishing a later template version does not mutate an existing project;
- template presentation metadata cannot alter canonical geometry or its source digest;
- template version remains separate from canonical `BrepProject.schemaVersion`;
- scratch provenance remains compatible;
- unsupported canonical source versions fail closed before project materialization.

## Versioning decisions

Three distinct version dimensions remain separate:

1. template `version` — immutable product-definition version;
2. `BrepProject.schemaVersion` — canonical BRep language/schema version, currently `1`;
3. existing BRep artifact `version: "v1"` — artifact compatibility label.

C1 does not reinterpret or couple these fields.

Template versions use positive monotonically increasing integers. A published `(templateId, version)` pair is append-only and must not be silently mutated.

## Authority model preserved

The accepted authority chain remains:

```text
built-in template
  -> complete canonical BRep snapshot at creation
  -> independent project/revision lineage
  -> build123d / OCCT native evaluation
  -> STEP derived/export authority
```

Rhino/GHX remains interoperability-only and is not template or geometry authority.

Template presentation metadata is geometry-neutral. Geometry-affecting defaults, expressions, nodes, placements, result-node selection and canonical parameter definitions remain in the canonical BRep source.

## Upgrade policy

C1 intentionally implements no automatic template upgrade.

A project created from template version N remains unchanged when N+1 is published.

Any future template-to-project upgrade feature must be separately designed as an explicit user action that creates a new validated project revision. It must not mutate historical revisions or silently rebase existing projects.

Template migration and canonical BRep schema migration remain separate concerns.

## Persistence decision

C1 starts with repository-built-in templates only.

No template database tables, CRUD endpoints or template-specific RLS were added.

This avoids premature persistence/RLS surface while preserving a catalog abstraction that can later support database-backed immutable template versions without changing project provenance semantics.

## Verification evidence

Final C1.5 verification:

- Dquark `diff-check` — PASS
  - run `36047163092`
- Dquark `typecheck + test` — PASS
  - run `36047171289`
- Vitest:
  - 251 test files passed
  - 1407 tests passed

Earlier C1 slices were independently verified before proceeding:

- C1.1: 246 files / 1387 tests PASS
- C1.2: 247 files / 1392 tests PASS
- C1.3: 249 files / 1398 tests PASS
- C1.4: 250 files / 1402 tests PASS

## Local workstation note

The mapped Dquark Brepia worktree was previously found on `hardening/foundation-b1` with local modifications.

C1 implementation and verification therefore used remote feature-branch / isolated Dquark paths and did not reset, checkout, sync or overwrite that local worktree.

## Deferred / explicitly not part of C1

Still deferred:

- real product template definitions;
- cable tray;
- cable conduit/pipe;
- another electrical cabinet product;
- database-backed templates;
- user-created/shared templates;
- marketplace;
- automatic template upgrades;
- new BRep operations;
- general assembly semantics.

## Next phase

Proceed to:

**C2 — parameter presentation metadata**

C2 should build on the geometry-neutral presentation boundary established in C1 and must continue to preserve M0 parameter integrity and canonical BRep geometry authority.
