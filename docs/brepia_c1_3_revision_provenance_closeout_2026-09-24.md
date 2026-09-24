# C1.3 — Revision provenance closeout

Date: 2026-09-24

Status: COMPLETE

Branch: `design/c1-template-identity-versioning`

Accepted implementation checkpoint:

`353345649e519f4a7ee2b6ff8e0690a8d827449b`

## Scope completed

C1.3 added immutable template creation provenance to the persisted BRep artifact envelope while keeping canonical geometry authority unchanged.

Implemented provenance fields:

- `kind: 'template'`
- exact `templateId`
- exact positive integer `templateVersion`
- `source: 'builtin'`
- immutable `definitionDigest`

Provenance is normalized fail-closed and remains outside `BrepProject`.

Preservation is covered across:

- direct source revisions;
- parameter revisions;
- historical restore;
- Grasshopper import revisions;
- AI follow-up revisions.

Scratch / AI-first creation continues without invented template provenance.

## Authority boundaries preserved

- canonical `BrepProject` remains the only geometry authority;
- BRep `schemaVersion` remains 1;
- provenance cannot change evaluator semantics;
- no database migration was introduced;
- no conversation-level provenance cache was introduced;
- no UI or product template was added.

## Verification evidence

Focused verification:

- Dquark run `36006707109` — `test` PASS, `typecheck` PASS.

Full quality closeout:

- Dquark run `36009588637` — PASS.

The full gate covers lint, typecheck, tests, build and `git diff --check`.

## Next slice

**C1.4 — Project creation integration**

The integration must use the existing BRep conversation lifecycle:

1. resolve one exact immutable template version;
2. instantiate an independent canonical project;
3. attach creation provenance to the initial BRep artifact;
4. create the normal conversation and immutable baseline message pair;
5. activate the assistant baseline through the existing current-leaf path.

Scratch/import creation must retain their current no-template-provenance behavior unless a later explicit package provenance slice says otherwise.

C1.4 must not add template UI, product definitions, database-backed templates, package provenance or a new persistence model.
