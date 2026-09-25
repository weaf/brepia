# Phase C5 — Template validation closeout

Date: 2026-09-25

Status: COMPLETE.

Branch: `feature/phase-c5-template-validation`

## Reconciled baseline

C5 started from verified `master`:

`f671073fd077e603eeedabc85ff8f45b6bc72bb8`

`Merge PR #57: Close Phase C4 create-from-template flow`

At C5 start:

- C1–C4 were complete;
- the repository-shipped built-in template catalog remained intentionally empty;
- canonical BRep remained the geometry authority;
- M0 integrity analysis already existed as a shared deterministic contract;
- native build123d/OCCT evaluation and exact STEP export already existed behind the isolated evaluator;
- no Phase D product template had been authorized yet.

C5 therefore adds a reusable validation contract and acceptance harness without prematurely adding Electrical Cabinet, Cable Tray, Cable Conduit or another product pack entry.

## Static built-in template validation

`shared/productTemplateValidation.ts` now validates one exact built-in template version after canonical normalization.

The static validation returns:

- the normalized immutable template;
- the canonical source SHA-256 digest;
- a deterministic normalized template-definition SHA-256 digest;
- the expected canonical `resultKind`;
- visible published control IDs;
- the existing deterministic M0 integrity analysis.

The definition digest is computed over the normalized full template definition, so equivalent property ordering produces the same identity while a template-version change changes the definition identity even when the canonical BRep source is unchanged.

This keeps template version identity separate from canonical BRep schema version and from source digest identity.

## M0 integrity gate

C5 reuses `analyzeBrepProjectIntegrity()`; it does not create a second graph/integrity implementation.

A built-in template fails closed when static analysis finds:

- orphan feature nodes;
- orphan-only published parameters;
- unused published parameters.

The accepted M0 semantics remain unchanged for ordinary/manual/imported projects.

## Effective published controls

C5 adds a stricter product-template presentation gate on top of M0.

Every **visible** control exposed through resolved template parameter presentation must be classified as `effective`, meaning it affects authoritative geometry.

A visible `semantic-only` parameter therefore fails built-in template validation.

A deliberately hidden semantic-only canonical parameter may remain valid because it is not presented as a user-facing product control and M0 already recognizes semantic-only use as intentional.

This avoids decorative or misleading customer-facing controls while preserving the existing canonical project semantics.

## Expected result kind

The expected template result kind is derived from the normalized canonical result node through the existing `brepNodeValueKind()` authority.

The static acceptance suite covers both:

- `single`;
- `instanceSet`.

No parallel result-kind rules are introduced.

## Native validation boundary

`src/server/productTemplateValidation.ts` adds the reusable native validation boundary for future repository-owned templates.

It:

1. runs the shared static C5 validation;
2. passes the normalized canonical BRep source to the existing `evaluateBrepProject()` isolated native evaluator;
3. requires a successful native result;
4. requires actual native `resultKind` to equal the statically expected result kind;
5. requires exact STEP availability and returned STEP bytes.

The validator reuses the accepted build123d/OCCT evaluator and STEP authority rather than duplicating kernel logic.

## Exact STEP re-import acceptance

`scripts/brep/c5-template-validation-smoke.sh` provides a real native C5 smoke fixture without adding a production product template.

The fixture contains one visible `width` control and evaluates with `width = 60 mm`.

Accepted native evidence on exact branch HEAD `af50edddb62d6a2de822eb6ccf391cffa91e6d0f`:

- Dquark run `36173730502` — PASS;
- native `resultKind = single`;
- evaluated bounds: `[-30, -10, -5] -> [30, 10, 5]`;
- exact STEP available;
- independent STEP re-import through pinned `build123d 0.11.1`;
- pinned `cadquery-ocp-novtk 7.9.3.1.1`;
- exactly one imported solid;
- imported volume `12000.0`;
- imported bounds exactly match the expected evaluated geometry.

The re-import runs in the same constrained isolated CAD image style already accepted elsewhere in the repository:

- no network;
- read-only container;
- capabilities dropped;
- bounded resources.

## Repository built-in catalog gate

`tests/builtinProductTemplateValidation.test.ts` now routes every future repository-shipped entry in `BUILTIN_PRODUCT_TEMPLATES` through the shared static C5 validator.

The catalog remains intentionally empty at C5 closeout.

This test is therefore primarily a forward gate for Phase D: once real built-in product versions are added, ordinary repository quality must prove their canonical normalization, M0 integrity, deterministic identity and effective visible-control contract.

Product-specific Phase D acceptance must still provide the relevant native/export evidence for the actual product geometry.

## Regression and quality evidence

C5 implementation was developed in bounded slices.

Accepted evidence includes:

- C5.1 static validation quality:
  - Dquark run `36167825034` — PASS;
- C5.2 native validation quality:
  - Dquark run `36168342711` — PASS;
- post-script full quality:
  - Dquark run `36173733026` — PASS;
- isolated native STEP smoke:
  - Dquark run `36173730502` — PASS;
- C5.3 effective-visible-control quality:
  - Dquark run `36176546035` — PASS.

The first attempted native smoke was intentionally rejected before execution because the persistent local Brepia worktree was on an older dirty branch and did not contain the new script. Dquark classified that attempt as a control-plane/worktree issue rather than a product failure.

The dirty local worktree was not modified, reset or overwritten. The accepted smoke was rerun through Dquark's isolated branch checkout.

## Permanent boundaries preserved

C5 does not change:

- canonical BRep model/geometry authority;
- immutable project/revision semantics;
- build123d/OCCT native geometry authority;
- STEP exact native CAD export authority;
- Rhino/GHX interoperability-only role;
- fail-closed unsupported geometry;
- M0 integrity semantics for ordinary project boundaries;
- scalar/expression semantics;
- auth/RLS;
- the prohibition on persisted raw kernel topology IDs.

C5 introduces no:

- new BRep modeling capability;
- marketplace;
- database-backed template CRUD;
- automatic template upgrades;
- user-created/shared template feature;
- product-pack definition;
- assembly semantics.

## Closeout and next phase

Phase C5 is complete.

Accepted roadmap state:

`C1–C5 COMPLETE; C6 DEFERRED; PHASE D NEXT`

C6 user-created/shared templates remain explicitly deferred.

The next productization phase is:

**Phase D — First Product Pack**

The roadmap currently lists:

- D1 — Electrical Cabinet;
- D2 — Cable Tray;
- D3 — Cable Conduit / Pipe.

Each real built-in product introduced in Phase D must use the accepted C1–C5 lifecycle and validation boundaries rather than bypassing them.
