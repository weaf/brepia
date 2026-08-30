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

## Phase 1 — remove `/cadam` URL requirement

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

### Implementation

- [x] move Vite/TanStack/Nitro application base to `/`;
- [x] move the application router basepath to `/`;
- [x] update OpenSCAD WASM development serving to the root-based path;
- [x] keep `/cadam` and `/cadam/...` as HTTP 308 compatibility redirects to the corresponding root path in both Vite dev and preview servers;
- [ ] run typecheck/lint/build;
- [ ] smoke-test stable runtime at `http://<host>:3000/` without `/cadam`;
- [ ] verify an old `/cadam` bookmark redirects to `/`;
- [ ] verify a nested old URL such as `/cadam/signin` redirects to `/signin`;
- [ ] verify auth, API, Supabase proxy, OpenSCAD WASM and stable-runtime behavior remain functional.

## Phase 2 — internal build/runtime naming

Inventory before changing:

- [ ] `dist/cadam` build output directory;
- [ ] other runtime filesystem paths containing `cadam`;
- [ ] Sentry/external integration identifiers where inherited Adam/CADAM naming may be account configuration rather than local product naming;
- [ ] scripts and developer commands that still assume CADAM-specific paths.

Preferred outcome: use neutral/Brepia names for purely local implementation artifacts without forcing external account/data migrations.

## Phase 3 — Supabase project identity and persistent data

Current local Supabase project id is `cadam`, producing `supabase_*_cadam` containers.

Treat this as migration-sensitive because changing the project id can affect container/volume identity and local persisted development data.

Before any change:

- [ ] determine exactly which volumes/containers are keyed by project id;
- [ ] identify whether changing `project_id` creates a parallel empty stack;
- [ ] define backup/export/rollback steps;
- [ ] decide whether renaming the local Supabase project provides enough value to justify migration risk.

Do not change this in the same commit as the URL-base cleanup.

## Phase 4 — source/config naming inventory

Classify remaining `cadam`, `CADAM`, `adamcad`, and `PCAD_*` occurrences into:

1. safe product/runtime cleanup;
2. compatibility-sensitive identifiers;
3. external-service account identifiers;
4. intentional historical/upstream attribution;
5. prompt/profile lineage that must remain stable.

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

Run the Phase 1 automated and browser gate on the current branch. If green, mark the root-path migration complete before beginning internal `dist/cadam` or persistent Supabase identity cleanup.
