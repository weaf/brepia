# Phase C3 — Template preview and discovery

Date: 2026-09-25

Status: IN PROGRESS — C3.1 discovery foundation implemented; verification pending.

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

## Preview boundary

C3.1 carries the existing bundled preview `assetId` into the discovery view model but does not yet render arbitrary asset paths.

A later C3 slice should lock preview-asset path semantics before image rendering is enabled.

This avoids turning loosely validated asset metadata into a navigation/resource-loading boundary.

## Preserved authorities

C3.1 does not change:

- canonical BRep geometry authority;
- C2 parameter-value authority;
- template identity/version semantics;
- project creation semantics;
- immutable revision lineage;
- database/RLS;
- build123d/OCCT;
- STEP;
- Rhino/GHX.

No real product template is introduced by C3.1.
