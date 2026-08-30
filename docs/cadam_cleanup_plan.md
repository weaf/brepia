# CADAM cleanup plan

Status: **ACTIVE on `feature/cadam-cleanup`**

Base: `master` after merge commit `3511046a6439cc6796571ef63a5c3c70d184b599`.

## Goal

Remove inherited CADAM naming where it is now an unnecessary product/runtime constraint, starting with the user-visible requirement to access Brepia under `/cadam`.

This is a staged compatibility cleanup, not a blind global rename.

## Preserve deliberately

Do not rename or rewrite these merely for cosmetic consistency:

- `CADAM Original` built-in prompt/profile lineage;
- historical revision directories and fingerprints that intentionally preserve CADAM lineage;
- upstream attribution to Adam-CAD/CADAM;
- historical closeout/architecture documents except where a short correction note prevents future confusion;
- database/storage/local-state identifiers until a migration and rollback path exists.

## Phase 1 — remove `/cadam` URL requirement — COMPLETE

### Audit

The actual user-visible base-path dependency was found in two active runtime locations:

- `vite.config.ts`
  - Vite `base`;
  - TanStack Start router basepath;
  - SPA mask path;
  - Nitro base URL;
  - OpenSCAD WASM development path derived from the old base.
- `src/router.tsx`
  - TanStack client/server router `basepath: '/cadam'`.

The root application route already exists as the `_layout` index route, so the file-route structure itself does not require a `/cadam` route segment.

### Implementation and verification

- [x] move Vite/TanStack/Nitro application base to `/`;
- [x] move the application router basepath to `/`;
- [x] update OpenSCAD WASM development serving to the root-based path;
- [x] keep `/cadam` and `/cadam/...` as HTTP 308 compatibility redirects to the corresponding root path in both Vite dev and preview servers;
- [x] `npm run typecheck` passed after the Phase 1 URL-base change — user verified 2026-08-30;
- [x] `npm run lint` passed after the Phase 1 URL-base change — user verified 2026-08-30;
- [x] `npm run build` passed after the Phase 1 URL-base change — user verified 2026-08-30;
- [x] smoke-test stable runtime at `http://<host>:3000/` without `/cadam` — user verified 2026-08-30;
- [x] old `/cadam` URL redirects to `/` — user verified 2026-08-30;
- [x] nested old `/cadam/signin` URL redirects to `/signin` — user verified 2026-08-30.

The broad auth/API/Supabase/OpenSCAD/stable-runtime regression smoke remains part of the final branch gate rather than blocking the already-verified root-path migration.

## Phase 2 — internal build/runtime naming — COMPLETE

Safe local implementation names were separated from compatibility-sensitive identifiers before any rename.

Completed:

- [x] `dist/cadam` identified as a purely local build-output name and renamed to `dist/brepia`;
- [x] internal generated OpenSCAD helper module `__cadam_dxf_source__` identified as non-persisted/non-external and renamed to `__brepia_dxf_source__`;
- [x] no other active code path identified as depending on `dist/cadam`;
- [x] Sentry `org: 'adamcad'` / `project: 'adamcad'` classified as an external-service account identifier and deliberately left unchanged;
- [x] `PCAD_*` environment variables classified as public/operator configuration contracts and deferred to a separate compatibility/deprecation plan;
- [x] accidental unrelated DXF-parser changes introduced during the helper rename were detected and reverted, leaving only the intended internal helper rename;
- [x] `npm run typecheck` passed after Phase 2 — user verified 2026-08-30;
- [x] `npm run lint` passed after Phase 2 — user verified 2026-08-30;
- [x] `npm run build` passed after Phase 2 — user verified 2026-08-30;
- [x] normal `./start.sh` stable startup passed after Phase 2 — user verified 2026-08-30.

## Phase 3 — Supabase project identity and persistent data — INVENTORY ACTIVE

Current local Supabase project id is `cadam`, producing `supabase_*_cadam` containers.

Treat this as migration-sensitive because changing the project id can affect container/volume/network identity and local persisted development data.

Before any change:

- [ ] determine exactly which volumes/containers/networks are keyed by project id;
- [ ] identify whether changing `project_id` creates a parallel empty stack;
- [ ] define backup/export/rollback steps;
- [ ] decide whether renaming the local Supabase project provides enough value to justify migration risk.

A read-only workstation inventory is available:

```bash
bash scripts/inspect-supabase-project-identity.sh
```

It reports the current project id, matching Supabase containers, their mounts, candidate Podman volumes/networks and repository-local Supabase state filenames. It does not start, stop, rename, export, import or delete anything.

Do not rename the Supabase project until those items are resolved.

## Phase 4 — source/config naming inventory — ACTIVE

Remaining `cadam`, `CADAM`, `adamcad`, `Adam` and `PCAD_*` occurrences are classified into:

1. safe product/runtime cleanup;
2. compatibility-sensitive identifiers;
3. external-service account identifiers;
4. intentional historical/upstream attribution;
5. prompt/profile lineage that must remain stable.

Current classification:

- [x] `/cadam` in `vite.config.ts` is now only the intentional legacy compatibility redirect; retain during the transition period;
- [x] `CADAM Original` and related profile/revision references are intentional lineage; preserve;
- [x] README/upstream Adam-CAD/CADAM attribution and historical remake/closeout documents are intentional historical records; preserve;
- [x] Sentry `adamcad` org/project values are external-service identifiers; do not rename without corresponding Sentry configuration;
- [x] `PCAD_*` variables are operator/API compatibility contracts; do not mass-rename;
- [x] `pcad.invalid` and `pcad_*` auth/bootstrap/database identifiers are compatibility-sensitive and require a separate auth/database migration decision;
- [x] active contributor/branding guidance was updated to point at this staged cleanup and no longer describes `/cadam` as the canonical deployment path;
- [x] `public/` was inspected on the cleanup branch and already contains only current Brepia branding assets plus generic runtime assets; there are no legacy CADAM/Adam public files to delete;
- [x] `scripts/load-prod-snapshot.mjs` is an unreferenced one-off historical migration utility; its `/tmp/cadam_load` and original contributor paths are not active application/runtime dependencies, so it is left as historical tooling rather than rewritten silently;
- [ ] local seed identity `test@adamcad.com` should be changed to a Brepia synthetic address; connector write is currently blocked because the seed file contains a literal local test password, so this remains a small manual/tooling follow-up;
- [ ] inspect internal `adam-*` CSS/Tailwind token names separately; rename only if a complete mechanical replacement can be proven behavior-neutral.

Only category 1 should be renamed automatically. Categories 2–5 require an explicit decision.

## Phase 5 — final regression gate

After each compatibility-sensitive phase:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Final manual smoke should include:

- root URL startup and reload;
- old `/cadam` redirect compatibility;
- authentication/password flows;
- Parametric and Creative conversation creation/continuation;
- Supabase persistence and storage access;
- OpenSCAD WASM rendering;
- stable runtime/mobile background behavior;
- exported/shared links.

## Current next step

Run the read-only Supabase project-identity inventory on the workstation. Use that evidence to decide whether `project_id = "cadam"` should be migrated to a Brepia identity or retained as an internal compatibility name. Continue to preserve the working `/cadam` redirect, `CADAM Original`, external Sentry identity and `PCAD_*` contracts unless separate migrations are approved.
