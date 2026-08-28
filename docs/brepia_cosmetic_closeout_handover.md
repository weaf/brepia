# Brepia cosmetic closeout handover

Date: 2026-08-28  
Branch: `feature/brepia-remake`  
Checkpoint when this handover was created: `15327e30e7209bdb54b27f1e1a631c56f2ce86b5`

## Decision

The Brepia cosmetic/remake implementation scope is now **frozen**.

Do not add new functional experiments to this branch. New local 3D/runtime work, including LLaMA-Mesh and `trellis.cpp`, is recorded separately in:

`docs/post_merge_functionality_plan.md`

That plan starts only after this branch has been merged into `master` and a new functionality branch has been created from the updated `master`.

## Purpose of the next chat

The next chat should focus only on closing the existing Brepia remake plan and getting the branch ready to merge.

Read first:

1. `AGENTS.md`
2. `docs/brepia_remake_plan.md`
3. `docs/brepia_remake_status.md`
4. `docs/brepia_branding.md`
5. `docs/brepia_phase6_checkpoint.md`
6. `docs/brepia_phase6_runtime_handover.md`
7. this file

Do **not** start the post-merge functionality plan in that chat.

## Scope lock

Allowed work before merge:

- reconcile the old remake checklist with work that is already implemented;
- finish remaining Brepia presentation/cosmetic cleanup that is actually still open;
- finish required Instance identity validation that belongs to the remake gate;
- perform the intentionally-last `CADAM Original` prompt-profile display/lineage decision;
- perform npm-generated dead dependency/package metadata cleanup only if still desired and only through the real npm toolchain;
- run/fix the final regression gate;
- make documentation accurately describe final state;
- prepare/perform merge to `master` when the gate is green.

Out of scope before merge:

- LLaMA-Mesh integration;
- `trellis.cpp` integration;
- new Creative backend architecture;
- new text-to-image-to-3D chains;
- broad local-mesh redesign;
- reopening the paused mobile `Creating...` recovery issue;
- repository/deployment rename;
- unrelated feature additions.

## Important state to preserve

- Stable Fast 3D has been retired from the active local Creative stack. Do not restore it.
- The retained local Creative targets are TRELLIS v1, Hunyuan3D-2 and Hunyuan3D-2.1.
- TRELLIS text-only generation has been runtime verified in the real installation.
- Creative capability labels/guardrails have been implemented.
- The standalone Generate-prompt feature has been removed.
- Per-user default Parametric/Creative model selection has been implemented and runtime verified.
- Prompt Profiles and prompt lineage remain real functionality; do not remove them while resolving the `CADAM Original` presentation.
- `src/routeTree.gen.ts` is generated and must not be hand-edited.
- `shared/database.ts` is generated from the NOx-managed local Supabase instance and must not be hand-edited.
- NOx owns local Supabase lifecycle. Do not replace it with `supabase start/stop` or `npx supabase start/stop`.
- Stable production-like runtime behavior in `start.sh` / `scripts/stable-runtime-proxy.mjs` must not be reverted to Vite dev/HMR.
- Parametric completion reconciliation must retain the existing persisted-assistant recovery behavior; do not make it strict message-ID-only.

## Closeout sequence

### 1. Reconcile documentation against the branch

The older plan/status files contain stale unchecked items from earlier checkpoints. Before implementing anything, inspect the current branch and classify each remaining checkbox as:

- already implemented / verified;
- still genuinely open;
- intentionally deferred post-merge;
- no longer applicable.

Do not redo already completed functionality merely because an old checkbox is unchecked.

### 2. Finish only genuine remake items

Expected candidates include:

- remaining Instance identity end-to-end checks if not already evidenced;
- any still-required visual edge-state checks that are practical and relevant;
- npm-generated removal of dead `lottie-react`/metadata cleanup if deliberately kept in scope;
- the final `CADAM Original` display/lineage decision.

Avoid broad redesign. Desktop/mobile presentation has already passed the main manual review.

### 3. Run the final local gate

Use the real development environment.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also run focused tests relevant to any final edits.

If database/schema work is still needed, remember:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

only after NOx has started the local Supabase stack.

No PASS claim should be made for commands not actually run in the user's local environment.

### 4. Final manual smoke review

At minimum verify that the final branch still preserves:

- normal desktop/mobile Brepia presentation;
- Parametric conversation creation/use;
- Creative model selection and capability messaging;
- Instance identity navigation/legal presentation;
- authentication/settings access;
- no obvious regression from the final cleanup.

Do not reopen deferred runtime bugs unless a closeout change directly causes a regression.

### 5. Update closeout documentation

When the gate is green:

- mark completed/remapped items accurately in the remake plan/status/checkpoint;
- record the exact final branch HEAD and validation evidence;
- explicitly state that new Creative/runtime improvements are deferred to `docs/post_merge_functionality_plan.md`.

### 6. Merge

Only after the remake gate is green, merge `feature/brepia-remake` into `master` using the repository's normal integration procedure.

After merge, start a **new branch from updated `master`** for the functionality program. Do not continue functional development on the old remake branch.

## Post-merge continuation

The first document for the later functionality chat is:

`docs/post_merge_functionality_plan.md`

Its major investigations are:

- LLaMA-Mesh text-to-3D through the llama.cpp/llama-swap ecosystem;
- `trellis.cpp` as a native GGML/GGUF image-to-3D candidate;
- comparison against retained TRELLIS/Hunyuan paths;
- backend contract/readiness/error improvements;
- installer/model-storage cleanup and selective installation;
- retirement of Python runtime pieces only after validated replacements exist.

## Governing rule for the next chat

> **Do not expand the remake branch. Reconcile, validate, finish the intentionally remaining Brepia items, run the full gate, document the final state and merge. Functionality work resumes only from the updated master afterward.**
