# CADAM cleanup plan

Status: **COMPLETE / MERGE-READY on `feature/cadam-cleanup`**

Base: `master` after merge commit `3511046a6439cc6796571ef63a5c3c70d184b599`.

Final reconciliation on 2026-08-30: branch was 40 commits ahead of `master` and 0 behind before this documentation closeout commit. No master reconciliation was required.

## Goal

Remove inherited CADAM naming where it is now an unnecessary product/runtime constraint, starting with the user-visible requirement to access Brepia under `/cadam`.

This was executed as a staged compatibility cleanup, not a blind global rename.

## Preserve deliberately

Do not rename or rewrite these merely for cosmetic consistency:

- `CADAM Original` built-in prompt/profile lineage;
- historical revision directories and fingerprints that intentionally preserve CADAM lineage;
- upstream attribution to Adam-CAD/CADAM;
- historical closeout/architecture documents except where a short correction note prevents future confusion;
- compatibility-sensitive external/account identifiers unless their migration path is explicit.

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

## Phase 3 — Supabase project identity and persistent data — COMPLETE

Local Supabase now uses `project_id = "brepia"`. Workstation inspection and migration on 2026-08-30 established and preserved the actual persistent data coupling:

- [x] original service containers used `supabase_*_cadam` with project labels keyed to `cadam`;
- [x] original PostgreSQL data lived in `supabase_db_cadam` at `/var/lib/postgresql/data`;
- [x] original Storage object data lived in `supabase_storage_cadam` at `/mnt`;
- [x] other service containers reported no persistent project-id-keyed mounts relevant to application data;
- [x] Edge Runtime used a repository bind mount under `supabase/.temp/start-secrets/...` rather than its separately listed legacy volume;
- [x] project networking included recreateable `supabase_network_cadam` runtime infrastructure;
- [x] the generic `supabase_db-config` volume and `supabase_default` network were not keyed to the old project id;
- [x] repository-local Supabase CLI 2.114.0 detected the original stack successfully;
- [x] pre-migration fingerprint was `auth.users=1`, `conversations=7`, `messages=39`, `storage.objects=40`, `storage.buckets=3`;
- [x] approximate original persistent sizes were DB 275 MB and Storage 252 MB.

### Migration result

The first implementation attempted `podman volume rename`, which is unavailable on the workstation Podman version. That attempt failed before changing project identity and automatic rollback successfully restored the original `cadam` stack.

The final migration used copy/import instead:

1. fingerprint the running `cadam` database;
2. stop `cadam` and verify no project container remains running;
3. archive `supabase_db_cadam` and `supabase_storage_cadam` with SHA-256 manifests;
4. create `supabase_db_brepia` and `supabase_storage_brepia` with project-scoped labels rewritten to `brepia`;
5. import the compressed archives into those new volumes;
6. keep the original `cadam` volumes completely untouched as rollback copies during the regression window;
7. change local `supabase/config.toml` to `project_id = "brepia"`;
8. start the `brepia` stack and verify exact DB/Storage mounts;
9. verify the post-migration fingerprint is exactly equal to the pre-migration fingerprint.

Verified workstation result:

- [x] `supabase_db_brepia` mounted as the active database volume;
- [x] `supabase_storage_brepia` mounted as the active Storage volume;
- [x] copied DB size remains approximately 275 MB;
- [x] copied Storage size remains approximately 252 MB;
- [x] post-migration fingerprint remained exactly `auth.users=1`, `conversations=7`, `messages=39`, `storage.objects=40`, `storage.buckets=3`;
- [x] `brepia` Supabase stack started healthy after migration;
- [x] repository `supabase/config.toml` commits `project_id = "brepia"`;
- [x] migrated conversations remained present in the application — user verified 2026-08-30;
- [x] existing Storage-backed content remained accessible — user verified 2026-08-30;
- [x] new Parametric conversation/generation works against the migrated stack — user verified 2026-08-30;
- [x] Creative conversation/generation works against the migrated stack — user verified 2026-08-30;
- [x] OpenSCAD WASM rendering works in stable runtime after the root-path regression fix — user verified 2026-08-30;
- [x] normal stable application smoke passed against the migrated `brepia` stack — user verified 2026-08-30;
- [x] full automated gate (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) passed after migration/root-path fixes — user verified 2026-08-30;
- [x] guarded legacy cleanup removed the old `supabase_db_cadam`, `supabase_storage_cadam` and stale `supabase_edge_runtime_cadam` volumes after verifying that no container mounted them;
- [x] post-cleanup inspection showed only active `brepia` Supabase resources and no remaining `cadam` volumes;
- [x] migration backup archives were retained under `supabase/.temp/project-id-migration-backups/` as an independent recovery copy.

### Root-path OpenSCAD regression found during migration smoke

The migrated data was intact, but the application smoke exposed a separate `/cadam` → `/` runtime regression in the OpenSCAD viewer. Emscripten's generated OpenSCAD module resolved `openscad.wasm` relative to the built worker layout, which became unreliable after the application base moved to `/`. The failure first surfaced as `Failed to fetch` and then as the normal 20-second worker timeout while diagnostics were narrowed.

The repair keeps the generated Emscripten file untouched:

- Vite serves the vendored `openscad.wasm` in both dev and preview/stable mode with `Content-Type: application/wasm`;
- a small runtime wrapper provides an explicit `locateFile` implementation for `openscad.wasm`;
- the deterministic WASM URL is `${import.meta.env.BASE_URL}assets/openscad.wasm`, which is `/assets/openscad.wasm` at the root deployment;
- other OpenSCAD/public viewer asset URLs were normalized so `BASE_URL='/'` no longer produces protocol-relative `//...` URLs;
- the viewer surfaces the underlying compile/worker error text instead of only the generic compilation error.

External and localhost HTTP checks returned `200` with `application/wasm`, and user smoke-testing confirmed rendering works again on 2026-08-30.

Prepared tooling remains available for audit/recovery/cleanup:

- `scripts/inspect-supabase-project-identity.sh` — read-only identity/mount inventory;
- `scripts/migrate-supabase-project-id.sh` — guarded migration tool using stop/archive/create/import/config/start with fingerprint verification and rollback to untouched original volumes;
- `scripts/cleanup-cadam-supabase-resources.sh` — dry-run-by-default cleanup that refuses to act unless the `brepia` DB/Storage stack is active and no legacy volume is mounted.

## Phase 4 — source/config naming inventory — COMPLETE

Remaining `cadam`, `CADAM`, `adamcad`, `Adam` and `PCAD_*` occurrences were classified rather than globally renamed.

Completed classification and cleanup:

- [x] `/cadam` in `vite.config.ts` is now only the intentional legacy compatibility redirect; retain during the transition period;
- [x] the active Creative mesh-tool request path was corrected from `/cadam/api/mesh` to `/api/mesh`;
- [x] `CADAM Original` and related profile/revision references are intentional lineage; preserve;
- [x] README/upstream Adam-CAD/CADAM attribution and historical remake/closeout documents are intentional historical records; preserve;
- [x] Sentry `adamcad` org/project values are external-service identifiers; do not rename without corresponding Sentry configuration;
- [x] `PCAD_*` variables are operator/API compatibility contracts; do not mass-rename;
- [x] `pcad.invalid` and `pcad_*` auth/bootstrap/database identifiers are compatibility-sensitive and require a separate auth/database migration decision;
- [x] active contributor/branding guidance points at this staged cleanup and no longer describes `/cadam` as the canonical deployment path;
- [x] local seed identity was changed from `test@adamcad.com` to the synthetic Brepia address `test@brepia.invalid`;
- [x] `scripts/load-prod-snapshot.mjs` is an unreferenced historical one-off production snapshot loader; preserve as historical migration tooling rather than editing its workstation-specific source paths or `/tmp/cadam_load` scratch directory;
- [x] `public/` contains only Brepia/current generic assets (`brepia-*`, Geist, HDR, libraries, manifest); no legacy Adam/CADAM public asset remains to delete;
- [x] internal `adam-*` Tailwind/CSS names were inspected and classified as a broad compatibility token layer already mapped primarily to `--brepia-*` design variables. A mass rename would create disproportionate cosmetic regression risk and is intentionally deferred to a future dedicated Tailwind/design-token migration.

Only genuinely active category-1 runtime remnants were changed. Compatibility contracts, external service identities, historical attribution and prompt/profile lineage remain intentionally stable.

## Phase 5 — final regression gate — COMPLETE

Automated gate, user verified 2026-08-30 after the final runtime/seed cleanup:

- [x] `npm test`;
- [x] `npm run typecheck`;
- [x] `npm run lint`;
- [x] `npm run build`.

Manual smoke verified for the cleanup state:

- [x] root URL startup and reload;
- [x] old `/cadam` redirect compatibility;
- [x] existing authentication/session behavior sufficient to access migrated data;
- [x] Parametric conversation creation/continuation;
- [x] Creative conversation creation/continuation;
- [x] Supabase persistence and Storage access;
- [x] OpenSCAD WASM rendering;
- [x] stable runtime operation during the tested workflow.

Exported/shared-link behavior and deeper auth/password-flow permutations remain normal release-regression items, but no current CADAM cleanup blocker is known from them.

## Merge readiness

`feature/cadam-cleanup` is ready to merge to `master` based on the verified cleanup scope and regression evidence above.

Before this documentation closeout commit, GitHub reconciliation showed:

- base/merge-base: `3511046a6439cc6796571ef63a5c3c70d184b599`;
- branch head: `ee5d0356ee64f0141fa967abd02caa17a12a71a7`;
- ahead of `master`: 40 commits;
- behind `master`: 0 commits;
- no unexpected files outside the documented cleanup, migration tooling, root-path fixes and OpenSCAD regression repair.

No further broad CADAM/Adam rename should be added before merge. In particular, preserve `CADAM Original`, Sentry `adamcad`, `PCAD_*`, compatibility-sensitive `pcad_*`/`pcad.invalid` identifiers and the `adam-*` design-token compatibility layer unless they receive their own explicit migration plan.