# Brepia cosmetic closeout handover

Date: 2026-08-28  
Branch: `feature/brepia-remake`  
Original handover checkpoint: `15327e30e7209bdb54b27f1e1a631c56f2ce86b5`  
Reconciliation baseline before this document update: `1f3054b691073c86db6830485d8e299400de00f3`

## Decision

The Brepia cosmetic/remake implementation scope is **frozen**.

Do not add new functional experiments to this branch. New Local Creative/runtime work belongs only after this branch has been merged into `master` and a new functionality branch has been created from the updated `master`.

`docs/post_merge_functionality_plan.md` exists only as a deferred plan. **Do not start it before merge.**

## Read order

Before closeout/merge work, read:

1. `AGENTS.md`
2. `docs/brepia_remake_plan.md`
3. `docs/brepia_remake_status.md`
4. `docs/brepia_branding.md`
5. `docs/brepia_phase6_checkpoint.md`
6. `docs/brepia_phase6_runtime_handover.md`
7. this file

The plan/status/checkpoint were reconciled against the actual branch on 2026-08-28. Their current versions supersede stale unchecked “next implementation” items from earlier Phase 6 checkpoints.

## Reconciliation completed 2026-08-28

The old checklists were compared with the actual current implementation before doing any new work.

Already implemented / verified and **must not be redone**:

- main Brepia desktop/mobile presentation;
- Instance identity architecture and migrations;
- administrator-configured Discord social link;
- generated Supabase database types and generated TanStack route tree at the recorded technical checkpoint;
- per-user default Parametric/Creative model selection;
- removal of the standalone Generate-prompt feature;
- TRELLIS v1 text-only Creative generation;
- Creative capability labels and image-required guardrails;
- Stable Fast 3D retirement;
- persistent Creative generation activity;
- stable production-like runtime that avoids normal Vite development/HMR reload behavior;
- Parametric persisted-completion recovery across browser backgrounding.

Main desktop/mobile visual review has already passed. Specialized GIF/GLB/reduced-motion exercise is non-blocking/opportunistic unless a closeout change directly regresses it.

## `CADAM Original` — intentionally-last decision resolved

The actual built-in prompt/profile implementation was inspected after the rest of the reconciliation.

Final decision: **preserve `CADAM Original` as the explicit inherited/pre-Brepia built-in prompt profile and lineage marker.**

Do not rename `builtin:parametric`, rewrite the inherited `PARAMETRIC_AGENT_PROMPT`, or intentionally change its fingerprint solely for branding.

Reason:

- the built-in profile is synthetic and immutable;
- overlays resolve against the current inherited built-in prompt;
- forks store fingerprint/base-revision lineage and use it for stale-fork warnings;
- the actual prompt still carries inherited Adam agent identity/behavior;
- changing the prompt would be a behavioral prompt revision, not a cosmetic display cleanup;
- accurate historical/upstream/compatibility naming is allowed by the Brepia branding boundary.

`CADAM Original` is therefore no longer an open rename item.

## Optional package cleanup

`lottie-react` is still declared even though the old Lottie consumer is gone.

This is a genuine but **optional, non-blocking** cleanup. If it is ever done, use npm in the real checkout and commit the npm-generated lockfile changes. Do not hand-edit the lockfile remotely immediately before merge.

The conservative frozen-scope closeout path is to leave it untouched.

## Important state to preserve

- Stable Fast 3D remains retired from the active local Creative stack.
- Retained active local Creative targets are TRELLIS v1, Hunyuan3D-2 and Hunyuan3D-2.1.
- TRELLIS text-only generation has been runtime verified in the real installation.
- Creative capability labels/guardrails are implemented.
- The standalone Generate-prompt feature remains removed.
- Per-user default Parametric/Creative model selection remains implemented and runtime verified.
- Prompt Profiles and prompt lineage remain real functionality.
- `CADAM Original` remains the intentional inherited built-in profile label.
- `src/routeTree.gen.ts` is generated and must not be hand-edited.
- `shared/database.ts` is generated from the NOx-managed local Supabase instance and must not be hand-edited.
- NOx owns local Supabase lifecycle.
- Stable production-like runtime in `start.sh` / `scripts/stable-runtime-proxy.mjs` must not be reverted to Vite development/HMR.
- Parametric completion reconciliation must retain persisted-assistant recovery and must not become strict message-ID-only.

## Genuinely remaining pre-merge work

No new product feature is currently required by the reconciled remake plan.

The remaining work is validation/evidence:

### 1. Instance identity runtime smoke

Where not already explicitly exercised and recorded, verify:

- fresh/default identity shows no operator/contact/community/Discord/legal ownership claim;
- admin can save/reload operator and public contact;
- admin can save/reload Community label/URL/visibility;
- admin can save/reload Discord URL;
- admin can save/reload legal toggle/Terms URL/Privacy URL;
- authenticated non-admin update is forbidden;
- clearing Discord removes its navigation item after refresh;
- Community and Discord can coexist;
- disabling Community hides it without requiring its stored URL to be deleted;
- disabling legal links hides external links while neutral local Terms/Privacy pages remain accessible;
- Terms/Privacy show configured operator/contact accurately and never imply Brepia/Noty automatically operates every installation.

Treat defects found here as focused closeout regressions. Do not redesign the architecture unless a real defect requires it.

### 2. Final local regression gate

Run in the real local checkout on the exact HEAD intended for merge:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run focused tests for any final code fix if one becomes necessary.

A historical Phase 6 PASS exists, but it is not a substitute for this final gate after all later runtime/cosmetic changes.

No PASS claim may be made for commands not actually executed in the user's local environment.

### 3. Final manual smoke

At minimum verify:

- normal desktop/mobile Brepia presentation;
- Parametric conversation creation/continuation;
- Creative model selection and capability messaging;
- authentication/settings access;
- Instance identity navigation/legal presentation;
- no obvious regression caused by closeout changes.

Do not reopen deferred runtime bugs unless a closeout edit directly causes a regression.

### 4. Record exact evidence

When the gate is green, record:

- exact tested branch HEAD;
- Instance identity smoke results;
- `npm test` result;
- `npm run typecheck` result;
- `npm run lint` result;
- `npm run build` result;
- final branch-vs-master comparison.

Only then call the remake branch merge-ready.

## Merge

Merge `feature/brepia-remake` into `master` only after the final gate above is green and the branch is freshly compared with current `master`.

Use the repository's normal integration procedure. Do not force-update `master` simply because the feature branch is currently a linear descendant.

After merge:

1. update local `master`;
2. create a **new functionality branch from updated `master`**;
3. only then begin the deferred functionality program.

## Explicitly out of scope before merge

- LLaMA-Mesh integration;
- `trellis.cpp` integration;
- new Creative backend architecture;
- new text-to-image-to-3D chains;
- broad local-mesh redesign;
- reopening the paused mobile `Creating...` recovery issue;
- repository/deployment rename;
- unrelated feature additions.

## Governing rule

> **The remake branch is in verification closeout, not feature development. Validate the genuinely open Instance identity/runtime gate, run the final local regression gate, record evidence and merge. Functionality resumes only from updated master afterward.**
