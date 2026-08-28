# Brepia Phase 6 checkpoint

Updated: 2026-08-28  
State: **closeout / final gate pending**

This is the reconciled execution checkpoint for `feature/brepia-remake`. Read it together with:

- `AGENTS.md`
- `docs/brepia_remake_plan.md`
- `docs/brepia_remake_status.md`
- `docs/brepia_branding.md`
- `docs/brepia_phase6_runtime_handover.md`
- `docs/brepia_cosmetic_closeout_handover.md`

The closeout handover and reconciled plan/status supersede older unchecked “next implementation” items in earlier versions of this file.

## Scope lock

The Brepia remake/cosmetic scope is frozen.

Before merge, do only:

- remaining explicit Instance identity runtime validation;
- genuine regression fixes caused by the remake/closeout;
- final local test/typecheck/lint/build gate;
- closeout documentation and merge preparation.

Do **not** start new Local Creative functionality, new backend experiments or the post-merge functionality plan on this branch.

## Branch lineage

Recorded master base / merge base:

`967f744976d3ae2fb64f3681745c8c046345499a`

At reconciliation commit `fcfbe55f48dfd7b778503990789cea44a95abb4f`, GitHub comparison showed the branch **270 commits ahead of `master`, 0 behind**.

Always re-check immediately before merge rather than relying on this historical count.

## Local environment convention

The local Supabase stack is managed by **NOx**.

Do not start/stop Supabase with a global CLI or `npx supabase start/stop`. Once NOx has started the stack, repository-local operations remain:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Follow `.cursor/rules/database-workflow.mdc`: declarative schema first, generated migration second, never `db push`/`db pull`, and never hand-edit `shared/database.ts`.

`src/routeTree.gen.ts` is generated through the normal TanStack/Vite toolchain and must not be hand-edited.

## Original Phase 6 technical gate — GREEN at its checkpoint

The original technical gate was completed in the real local development environment.

Verified at that checkpoint:

- Instance identity migration applied;
- Discord social-link migration applied;
- `shared/database.ts` regenerated from the running NOx-managed local Supabase instance;
- `src/routeTree.gen.ts` regenerated through the TanStack/Vite toolchain;
- generated database typing cleanup included;
- `npm test` PASS;
- `npm run typecheck` PASS;
- `npm run lint` PASS;
- `npm run build` PASS.

This historical PASS must **not** be presented as the final closeout gate because subsequent runtime/cosmetic changes were added afterward.

## Desktop/mobile visual gate — PASS

The main Brepia presentation was manually reviewed in the real running application on desktop and mobile.

Result:

- desktop presentation looks good;
- mobile presentation looks good;
- no broad Brepia branding/layout redesign remains justified.

Specialized GIF/GLB/reduced-motion edge workflows may still be exercised opportunistically, but they are not standalone merge blockers unless a closeout edit directly regresses them.

## Stable runtime — PASS for normal local use

The browser lifecycle/HMR problem is resolved for normal use through the production-like stable runtime documented in `docs/brepia_phase6_runtime_handover.md`.

Preserve:

- `start.sh` build/preview behavior;
- dynamic loopback preview port;
- `scripts/stable-runtime-proxy.mjs`;
- stable public/local port behavior;
- explicit opt-in HMR development mode.

Do not revert normal startup to Vite development/HMR.

User verification showed that extended Android app switching/backgrounding no longer caused the recurring Brepia reload problem.

## Parametric completion reconciliation — implemented and user-verified

The persisted completion recovery now handles the legitimate Parametric sequence where a live build/tool assistant is followed by a later terminal assistant in the same user turn.

It only treats the later terminal assistant as covering the live turn when no newer user message intervenes.

Regression coverage protects both the recovery case and the newer-user-message guard.

User verification after the change: the behavior appeared to work correctly.

Do not replace this with strict message-ID-only reconciliation.

## Avatar follow-up — implemented

The collapsed sidebar remains an avatar surface, not a replacement navigation icon.

Implemented:

- provider/social avatar support;
- uploaded/cropped profile photo support;
- Brepia preset avatars stored per user;
- preset choice can override provider photo without modifying provider-side identity;
- compact fixed-size desktop/mobile picker;
- initials fallback instead of an anonymous circle.

The main desktop/mobile review has already passed. Do not reopen this as a broad redesign item without a concrete defect.

## Instance identity architecture — static review PASS, live closeout evidence incomplete

The current architecture matches the intended open-source instance model:

- public `GET /api/settings/instanceIdentity` exposes only the whitelisted presentation DTO;
- `PUT` requires an authenticated active administrator through `requireAdmin`;
- fresh defaults contain no operator/contact/community/Discord/legal ownership claim;
- public URLs are normalized/restricted to HTTP/HTTPS;
- Community visibility cannot become effective without a valid Community URL;
- Discord is independent, administrator-configured and hidden when unset;
- admin Instance identity UI is admin-only;
- Sidebar/legal/settings consume the shared Instance identity state;
- desktop/mobile navigation shares the same rendering path;
- Community and Discord may coexist;
- external legal links require both the legal toggle and a configured URL.

### Non-blocking hardening observation

`InstanceLegalNotice` distinguishes loading from loaded state but not an Instance identity fetch error from an unconfigured instance. A failed request can visually fall back to the neutral “no document published” presentation.

Do not change this solely from static review. It is separate hardening unless a real closeout runtime failure shows a misleading regression.

### Remaining live Instance identity checks

Where not already exercised and explicitly recorded, verify before merge:

1. fresh/default public GET/presentation is neutral;
2. admin can save/reload operator and contact;
3. admin can save/reload Community label, URL and visibility;
4. admin can save/reload Discord URL;
5. admin can save/reload legal toggle, Terms URL and Privacy URL;
6. authenticated non-admin `PUT` is forbidden;
7. clearing Discord removes it from navigation after query refresh;
8. Community and Discord can be visible simultaneously;
9. disabling Community hides its entry without deleting its stored URL;
10. disabling legal links hides external legal links while neutral Brepia legal pages remain accessible;
11. Terms/Privacy show configured operator/contact accurately and never imply Brepia/Noty automatically operates every installation.

These are validation items only. Do not redesign Instance identity to satisfy them unless an actual defect is found.

## Runtime follow-ups — reconciled final state

### 1. Per-user default model selection — COMPLETE / RUNTIME VERIFIED

Implemented and verified:

- `default_parametric_model_id`;
- `default_creative_model_id`;
- storage in `user_ai_preferences`;
- API DTO/preferences integration;
- independent Settings controls;
- mode-specific defaults for new conversations;
- mode switches use the applicable saved default;
- existing conversations remain pinned;
- unavailable hidden Parametric defaults fall back safely;
- focused resolver tests exist.

Do not implement this again.

### 2. Standalone Generate prompt — REMOVED

This old “next implementation” item is complete.

Already removed:

- Wand/Generate-prompt control from `TextAreaChat`;
- associated client loading/error/request state;
- `/api/prompt-generator` route;
- stale route-tree entry through normal TanStack regeneration.

Prompt profiles, prompt lineage, conversation system prompts and title generation remain real functionality and must not be removed.

Do not repair or recreate the standalone prompt generator.

### 3. Creative TRELLIS text-to-mesh — VERIFIED / REMAKE UX COMPLETE

Real local runtime verification succeeded with:

- Creative mode;
- TRELLIS v1 selected;
- no reference image;
- text-only prompts;
- successful GLB generation.

Current retained local Creative targets:

- TRELLIS v1 — text + image;
- Hunyuan3D-2 — image required;
- Hunyuan3D-2.1 — image required.

Implemented UX:

- capability labels in the model picker;
- image-required early validation/error messaging;
- TRELLIS recommendation rather than silently switching the selected model.

Stable Fast 3D is retired from the active local stack and must not be restored.

Any new text-to-image pre-step, LLaMA-Mesh, `trellis.cpp`, backend contract redesign or installer program is outside the frozen remake branch.

### 4. Persistent Creative generation activity — IMPLEMENTED

The durable source of truth remains the pending mesh row. The UI restores a visible generation state from persisted activity after navigation/focus/reconnect rather than pretending the original SSE stream is the only source of truth.

Do not invent determinate percentages when the local backend does not persist determinate progress.

The separately paused mobile `Creating...` issue is out of closeout scope unless a final closeout edit creates a new regression.

## `CADAM Original` — FINAL DECISION COMPLETE

The intentionally-last prompt-profile decision has now been made after inspecting the actual built-in profile and prompt semantics.

Decision: **preserve `CADAM Original` as the explicit inherited/pre-Brepia built-in profile and lineage marker.**

Reasons:

- built-in ID `builtin:parametric` is synthetic and compatibility-sensitive;
- the profile resolves to the inherited `PARAMETRIC_AGENT_PROMPT` rather than a newly authored Brepia prompt;
- the actual system prompt still carries inherited Adam identity/behavior;
- fingerprint/base-revision values drive fork lineage and stale-fork warnings;
- renaming/revising the prompt itself would be a behavioral prompt revision, not merely cosmetic cleanup;
- Brepia branding rules explicitly permit accurate historical/upstream/compatibility naming.

Therefore no closeout code migration is required for this item. Do not rename the built-in ID, rewrite the prompt or deliberately change the fingerprint solely for brand consistency.

## Optional package cleanup

`lottie-react` remains declared in `package.json` after the Lottie consumer was removed.

This is a genuine but optional cleanup. It is **not a merge blocker**. If done, use npm in the real checkout and commit npm-generated package/lockfile changes. Do not hand-edit the lockfile remotely immediately before merge.

The conservative frozen-scope choice is to leave package metadata untouched for closeout.

## Final closeout gate — STILL REQUIRED

After the final branch state is pulled locally, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run focused tests relevant to any final code edit as appropriate.

No PASS may be claimed for commands not actually run in the user's local environment.

The remote assistant runtime cannot substitute for this gate: it has no access to the user's workstation and its container cannot currently resolve GitHub DNS.

## Final manual smoke

Before merge, minimally verify:

- normal desktop/mobile Brepia presentation;
- Parametric conversation creation/continuation;
- Creative model selection and capability messaging;
- authentication/settings access;
- Instance identity navigation/legal presentation;
- no obvious closeout regression.

Do not reopen deferred product work unless a closeout change directly caused a regression.

## Merge sequence

1. Complete/record the remaining live Instance identity checks if not already evidenced.
2. Run the final full local gate on the exact branch HEAD intended for merge.
3. Record that exact tested HEAD and command results in closeout documentation.
4. Freshly compare `feature/brepia-remake` against `master`; resolve only real integration drift if any.
5. Merge through the repository's normal integration procedure only when the gate is green.
6. After merge, create a new branch from updated `master` before beginning any deferred functionality work.

## Governing closeout rule

> **No new experiments. Reconcile what is already done, validate the genuinely open Instance identity/runtime gate, preserve stable-runtime and prompt-lineage semantics, run the final gate, document evidence and merge.**
