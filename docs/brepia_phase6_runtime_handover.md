# Brepia Phase 6 runtime handover

Updated: 2026-08-27

This handover supplements `docs/brepia_phase6_checkpoint.md` and captures the browser lifecycle/stable-runtime work completed after that checkpoint.

## Branch

- Repository: `weaf/pCAD`
- Branch: `feature/brepia-remake`
- Latest implementation before this handover: `53f9bea48efd83a1627373f87dc6d86906f99c0f`
- Keep `CADAM Original` as the final prompt-profile decision after all Brepia regression/follow-up work.

## Local environment

Supabase lifecycle is owned by **NOx**.

`start.sh` must not start or stop Supabase. It checks that the NOx-managed local stack is already running and reads the local credentials from it.

After NOx starts the stack, repository-local operations remain:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Never use `db push`/`db pull` and never hand-edit `shared/database.ts`.

## Browser reload investigation — RESOLVED FOR NORMAL LOCAL USE

### Observed root cause

Lifecycle diagnostics showed normal unload/reload sequences rather than an Android memory discard:

- `beforeunload`
- `pagehide`
- new `boot` with a new `documentId`

Kiwi DevTools also captured:

```text
[vite] server connection lost. Polling for restart...
```

The Vite development client reconnect path was therefore the primary recurring reload mechanism during app switching/background network suspension.

An attempted custom `/@vite/client` stub was reverted after it broke the TanStack/React Start runtime with `process is not defined`. Do **not** revive that approach.

### Stable runtime architecture

Normal `./start.sh` now uses a production-like runtime instead of Vite dev mode:

1. check the NOx-managed Supabase stack;
2. start the existing supporting services/OpenCode flow;
3. run `npm run build`;
4. choose a free internal loopback port dynamically;
5. run the built application through `vite preview` on that internal port;
6. expose port `3000` through `scripts/stable-runtime-proxy.mjs`;
7. reverse-proxy application traffic to the production preview and Supabase paths to the local Supabase gateway, including Realtime WebSocket traffic.

The public/local application URL and port remain unchanged. The internal app port is intentionally dynamic.

Stable mode contains no Vite **development** client, HMR reconnect polling or Vite dev error overlay.

Explicit development/HMR mode remains available with:

```bash
PCAD_ENABLE_HMR=1 ./start.sh
```

### Runtime result

User verification on 2026-08-27:

- stable runtime starts and the application works normally;
- switching away to other mobile apps for an extended period no longer reloads Brepia;
- repeated foreground/background transitions remain on the same page/session;
- the original disruptive reload problem is therefore considered resolved for normal local use.

## Lifecycle diagnostics

A dev/test Page Lifecycle panel exists under Settings -> Debug.

It exposes the persisted lifecycle log with:

- navigation type;
- `document.wasDiscarded`;
- visibility;
- online state;
- document id;
- recent lifecycle events;
- Refresh/Clear/Copy log controls.

The log itself is stored in localStorage so a genuine reload can be inspected after restart.

The panel was made touch-scrollable on mobile by removing nested vertical scroll containers.

For stable-runtime testing, lifecycle diagnostics are compiled in through `VITE_ENABLE_LIFECYCLE_DEBUG=1` by default from `start.sh`. This is a testing aid, not intended as a permanent public production feature.

## Background stream completion / stale loader recovery

After the stable runtime stopped browser reloads, a second lifecycle issue became visible:

- user continued an existing Parametric conversation;
- browser was backgrounded;
- server/model completed successfully and persistence contained the final result;
- client could remain stuck on the loading/`Creating…` state until a manual page reload.

The existing persistent-message recovery was too strict for Parametric auto-continuation. It only accepted a persisted terminal assistant when the local live assistant had the same message id. One Parametric user turn can legitimately contain multiple assistant rows: a build/tool assistant followed by a later final assistant.

`persistedCompletionCoversLiveTurn()` now also accepts a later terminal assistant when:

- the local live assistant exists in the persisted branch;
- the persisted terminal assistant comes later;
- **no newer user message appears between them**.

This preserves the protection against an old completion cancelling a genuinely new user turn.

Regression tests cover both:

- build/tool assistant -> later terminal assistant with no intervening user: recover;
- live assistant -> newer user -> later terminal assistant: do not recover.

User verification after this change: **"Det verkar fungera"**.

## Validation status

Do not claim the current branch has had the complete test/typecheck/lint/build gate after every latest runtime/handover change unless it is rerun locally.

The focused reconciliation test should be run after pulling:

```bash
npx vitest run tests/chatCompletionReconciliation.test.ts
```

Before merge/readiness, run the normal full gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Next chat — recommended focus

The user considers the major functionality working and wants to handle remaining **cosmetic issues** in a fresh chat.

Start the next chat by reading:

- `AGENTS.md`
- `docs/brepia_remake_plan.md`
- `docs/brepia_remake_status.md`
- `docs/brepia_branding.md`
- `docs/brepia_phase6_checkpoint.md`
- **this file** `docs/brepia_phase6_runtime_handover.md`

Then:

1. inspect the current branch/head before edits;
2. address only concrete cosmetic findings reported during desktop/mobile use rather than reopening broad redesign;
3. preserve the stable-runtime architecture while doing UI cleanup;
4. verify the compact avatar picker if still not explicitly confirmed;
5. remove the broken standalone `Generate prompt` feature after the cosmetic pass (unless the user reprioritizes it);
6. improve Creative model capability messaging (`Text + image` vs `Image required`) as a later product follow-up;
7. fold the verified TRELLIS repair dependencies into the clean installer;
8. rerun the full gate;
9. keep `CADAM Original` until **last**.

Repository/deployment renames (`weaf/pCAD` -> `weaf/brepia`, `/cadam`, `PCAD_*`, storage/DB/local-state identifiers) remain a separate deferred decision and must not be mixed into cosmetic cleanup.
