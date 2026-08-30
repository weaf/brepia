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

## Phase 3 — Supabase project identity and persistent data — MIGRATION PREPARED

Current local Supabase project id is `cadam`. Workstation inspection on 2026-08-30 established the actual identity coupling:

- [x] all running Supabase service containers are named `supabase_*_cadam` and carry both `com.supabase.cli.project=cadam` and `com.docker.compose.project=cadam`;
- [x] the active PostgreSQL data mount is the named volume `supabase_db_cadam` at `/var/lib/postgresql/data`;
- [x] the active Storage object mount is the named volume `supabase_storage_cadam` at `/mnt`;
- [x] other service containers reported no persistent project-id-keyed mounts relevant to application data;
- [x] Edge Runtime currently uses a repository bind mount under `supabase/.temp/start-secrets/...`, so the separately listed `supabase_edge_runtime_cadam` volume is not mounted by the active Edge Runtime container;
- [x] project networking includes `supabase_network_cadam`; it is recreateable runtime infrastructure rather than application data;
- [x] the generic `supabase_db-config` volume and `supabase_default` network are not keyed to the current project id;
- [x] repository-local Supabase CLI 2.114.0 detects the current stack successfully;
- [x] workstation fingerprint before migration is `auth.users=1`, `conversations=7`, `messages=39`, `storage.objects=40`, `storage.buckets=3`;
- [x] approximate persistent sizes are DB 275 MB and Storage 252 MB.

Current Supabase documentation confirms that `project_id` distinguishes local projects on the same host, `supabase stop` preserves local data unless `--no-backup` is used, and config changes require a stop/start cycle. This supports a controlled local identity migration rather than recreating the database from seed.

### Migration strategy

The first implementation attempted to use `podman volume rename`. The workstation Podman version does not expose that subcommand. The attempt failed before changing `project_id` and automatic rollback successfully restarted the original `cadam` stack. Backup archives from that attempt were retained.

The migration now uses a copy/import strategy supported by the installed Podman generation:

1. ensure `cadam` is running and record the database fingerprint;
2. stop `cadam`, verify no project container is still running, then remove only stopped container objects;
3. export compressed archives of `supabase_db_cadam` and `supabase_storage_cadam` and record SHA-256 checksums;
4. create `supabase_db_brepia` and `supabase_storage_brepia`, preserving volume labels while rewriting project-scoped labels to `brepia`;
5. import the archives into the new `brepia` volumes;
6. leave the original `cadam` volumes completely untouched as an additional rollback copy;
7. change `supabase/config.toml` to `project_id = "brepia"`;
8. start the `brepia` stack and verify exact DB/Storage mounts plus the pre/post database fingerprint;
9. if a later step fails, remove only newly-created `brepia` container/volume copies, restore `project_id = "cadam"`, and restart from the untouched original volumes;
10. keep both original `cadam` volumes and compressed archives until the application regression gate is green.

Prepared tooling:

- [x] `scripts/inspect-supabase-project-identity.sh` — read-only identity/mount inventory;
- [x] `scripts/migrate-supabase-project-id.sh` — dry-run by default; `--execute` performs stop/archive/create/import/config/start with automatic rollback from untouched original volumes;
- [x] stop handling is resilient to a non-zero Supabase CLI stop return only when Podman independently confirms all project containers are stopped;
- [x] migration fingerprints DB row/object counts before and after the identity move;
- [ ] run the revised copy/import migration on the workstation;
- [ ] verify the `brepia` stack has the existing auth/users/conversations/messages/storage objects;
- [ ] verify `./start.sh` and normal application operation against `project_id = "brepia"`;
- [ ] commit the final `supabase/config.toml` project-id change after workstation success;
- [ ] inspect and remove only confirmed stale `cadam` Podman resources after the rollback window.

Do not manually delete the original persistent volumes before this migration and its application regression gate are verified.

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
- [ ] local seed identity `test@adamcad.com` should be changed to a Brepia synthetic address; connector write is currently blocked because the seed file contains a literal local test password, so this remains a small manual/tooling follow-up;
- [x] `scripts/load-prod-snapshot.mjs` classified as an unreferenced historical one-off production snapshot loader; preserve as historical migration tooling rather than editing its workstation-specific source paths or `/tmp/cadam_load` scratch directory;
- [x] `public/` currently contains only Brepia/current generic assets (`brepia-*`, Geist, HDR, libraries, manifest); no legacy Adam/CADAM public asset remains to delete;
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

Pull the revised copy/import migration tooling, run shell syntax validation and dry-run again. Only execute after the dry-run confirms the original `cadam` volumes exist, the `brepia` target volumes do not exist, and the expected database fingerprint is available.
