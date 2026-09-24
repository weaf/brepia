# C1.4 — Project creation integration closeout

Date: 2026-09-24

Status: COMPLETE

Branch: `design/c1-template-identity-versioning`

Accepted implementation checkpoint:

`3ddae9e1f67af416c0069e6992ec26dfbccaea20`

## Scope completed

C1.4 integrates exact template creation into the existing BRep conversation lifecycle.

Implemented:

- resolve exact immutable template `(id, version)`;
- instantiate an independent canonical project snapshot;
- assign a fresh canonical `BrepProject.id`;
- derive provenance from the exact resolved template definition;
- create the normal BRep artifact baseline;
- insert the existing user + assistant baseline message pair;
- activate the assistant baseline through the existing current-leaf update;
- preserve the existing scratch/import creation behavior with no invented template provenance.

No parallel template persistence model was introduced.

## Verification evidence

Focused verification:

- Dquark run `36010814856` — `test` PASS, `typecheck` PASS.

Full quality closeout:

- Dquark run `36034904774` — PASS.

The full gate covers lint, typecheck, tests, build and `git diff --check`.

## Next slice

**C1.5 — Package/provenance boundary**

Decision target:

Template creation provenance should survive a Brepia project-package export/import round trip when present, but remain optional for legacy/scratch packages and remain outside canonical `BrepProject`.

C1.5 must not change package geometry authority, add executable metadata, or introduce database-backed templates.
