# Phase C3 — Template preview and discovery

Date: 2026-09-25

Status: COMPLETE.

Branch: `feature/phase-c3-template-discovery`

## Reconciled baseline

C3 starts from verified master:

`b798e6acc2db2c3e886eac13a4191ae5efe0b9aa`

C1 established immutable template identity/versioning and independent project creation.
C2 established geometry-neutral parameter presentation metadata.

The shipped built-in template catalog remains intentionally empty until a real product pack is accepted.

## C3.1 — discovery foundation

The first discovery slice keeps the existing `/brep` model library as the product surface instead of creating a parallel template portal.

A discovery view model now exposes, for the latest version of each built-in template family:

- template id and exact latest version;
- name;
- category;
- short description;
- preview asset availability;
- up to four important visible parameters.

Important parameters are derived from the C2 presentation contract:

1. visible basic parameters in C2 order;
2. then visible advanced parameters;
3. maximum four items.

Hidden parameters never appear in discovery.

This keeps discovery downstream of canonical template/presentation metadata rather than creating another product-definition authority.

## UI boundary

The existing BRep Models page now has two distinct sections:

1. Product templates
2. Saved models

The template section is discovery-only in C3.

It deliberately does not create a project or mutate template/project state. The create-from-template action remains Phase C4.

Because no product pack is shipped yet, the accepted empty state explains that the discovery foundation is ready and product templates will appear when their canonical definitions are accepted.

## C3.2 — preview asset contract and supported use

C3.2 completes the roadmap discovery metadata without broadening template authority.

Template metadata now supports bounded `supportedUse` copy for discovery.

Bundled preview assets are fail-closed and must match:

`templates/<safe path>.<png|jpg|jpeg|webp|avif|svg>`

The contract rejects:

- external URLs;
- absolute paths;
- path traversal;
- unsupported extensions.

The discovery view model exposes the validated preview as a relative public URL. UI code therefore does not interpret arbitrary template resource locations.

Template cards render:

- preview thumbnail when available;
- neutral placeholder otherwise;
- category;
- version;
- name;
- short description;
- supported use;
- important parameters.

The card remains non-interactive for template creation. Project creation stays in Phase C4.

## Preserved authorities

C3 does not change:

- canonical BRep geometry authority;
- C2 parameter-value authority;
- template identity/version semantics;
- project creation semantics;
- immutable revision lineage;
- database/RLS;
- build123d/OCCT;
- STEP;
- Rhino/GHX.

No real product template is introduced by C3.

## Verification evidence

C3.1:

- Dquark `diff-check` — PASS
  - run `36099517952`
- Dquark `typecheck + test` — PASS
  - run `36099519873`
- 253 test files / 1421 tests PASS

C3.2:

- Dquark `diff-check` — PASS
  - run `36099649168`
- Dquark `typecheck + test` — PASS
  - run `36099651833`
- 253 test files / 1428 tests PASS
- `git diff --check` — PASS

## Closeout

Phase C3 is complete.

The shipped built-in template catalog remains empty by design. C3 proves the preview/discovery infrastructure without prematurely introducing a product definition.

Next:

**C4 — create-from-template flow**

C4 may add the action that turns one exact discovered template version into an independent project/revision lineage, using the C1 creation semantics already established.
