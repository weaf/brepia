# BRep Phase 3 status

## Status

Phase 3 — AI-native BRep editing — is **complete and accepted** on:

```text
feature/brep-ai-native-editing
```

Base / merge-base against `master`:

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
Phase 2: native BRep project lifecycle
```

Active execution contract: `docs/brep_phase3_execution.md`.
Roadmap: `docs/brep_kernel_plan.md`.

Phase 1/2 execution/status files are historical evidence after merge.

## Phase 3 progress

| Step                                                    | Status                    |
| ------------------------------------------------------- | ------------------------- |
| 3A — Architecture reconciliation and contract lock      | **complete and accepted** |
| 3B — Shared BRep AI snapshot schema and structural diff | **complete and accepted** |
| 3C — Native AI tool/source contract                     | **complete and accepted** |
| 3D — Prompting and native-provider follow-up generation | **complete and accepted** |
| 3E — Immutable AI revision persistence and stale guards | **complete and accepted** |
| 3F — OpenCode/Codex external-agent parity               | **complete and accepted** |
| 3G — Product integration / creation UX                  | **complete and accepted** |
| 3H — Browser/runtime and regression acceptance          | **complete and accepted** |
| 3I — Phase 3 closeout                                   | **complete and accepted** |

## Current architecture lock

Phase 3 preserves the Phase 2 lifecycle and native runtime boundaries:

- `conversation.type` remains `parametric`; there is no separate BRep conversation type.
- `shared/brepProject.ts` remains the canonical native authoring schema.
- persisted native source revisions remain assistant `data-brep-project` snapshots.
- `current_message_leaf_id` selects active source/branch state.
- AI BRep output is a complete canonical snapshot, never a patch as source authority.
- follow-up validation preserves project identity and unchanged node/parameter IDs.
- `build_parametric_model` remains OpenSCAD-only; native BRep uses `build_brep_project`.
- arbitrary Python/build123d source, STEP, viewer mesh authority and raw topology indices remain forbidden as AI-authored source.
- the accepted rootless Podman build123d/OCCT evaluator remains the only native geometry execution boundary.
- exact native STEP is derived from canonical BRep source, not viewer tessellation.
- restore/branch/retry/stale handling reuse the existing Parametric message tree.

## Accepted implementation summary

### 3A-3C — contracts

The Phase 3 ownership map was reconciled against Phase 2 before implementation. Shared BRep AI primitives now provide:

- standalone canonical creation normalization;
- follow-up identity validation;
- deterministic project/parameter/node structural diffing;
- fail-closed selector/reference/DAG validation;
- separate strongly validated `build_brep_project` tool semantics without changing historical OpenSCAD `build_parametric_model` meaning.

### 3D — normal-provider BRep editing

Normal AI SDK providers receive the exact current canonical BRep source and return complete snapshots through `build_brep_project`.

Accepted behavior includes request-local validated-candidate capture, exactly one canonical `data-brep-project` source on successful persistence, stable-ID follow-up validation and native evaluation of the accepted snapshot.

Key persistence correction:

```text
41b80327cfbf29b1667359c5cb1ab73490ef5e4a
Persist validated BRep AI candidates from server execution
```

### 3E — immutable persistence and stale guards

`public.persist_brep_ai_revision(...)` locks the conversation, checks the expected current request leaf and inserts/activates the immutable AI source revision only when still current.

Both stale-first and AI-lock-first orderings were accepted against the real local Supabase runtime. Late/stale generation cannot overwrite a newer parameter/restore/branch source.

Relevant files:

```text
src/server/brepAiPersistence.ts
supabase/schemas/brep_ai.sql
supabase/migrations/20260903134810_brep_ai_atomic_revision.sql
scripts/brep/test-brep-ai-atomic-race.sh
```

### 3F — OpenCode/Codex parity

External-agent routing is source-aware. BRep receives the complete current canonical `BrepProject`; OpenSCAD retains the existing project/assets path and reconciliation behavior.

Live acceptance covered Streaming OpenCode and OpenCode CLI BRep edits and fixed two live-found regressions around terminal BRep tool completion and strict BRep tool input.

Detailed evidence:

```text
docs/brep_phase3_3f_live_checkpoint.md
```

### 3G — product integration / creation UX

Explicit BRep creation is product/source-intent driven rather than prompt-heuristic driven:

```text
conversation.type = 'parametric'
explicit BRep source intent
-> first AI turn
-> build_brep_project without fabricated previous source
-> canonical creation validation
-> atomic source persistence
-> /brep/$id
```

After the first canonical source exists, persisted source-derived routing is authoritative again. Ordinary OpenSCAD creation remains unchanged.

The accepted BRep workspace reuses the shared Parametric interaction model:

- desktop resizable/collapsible Chat | Preview | Parameters;
- mobile/tablet chat-first layout with shared model/parameter bottom sheet;
- local live parameter preview plus explicit **Save parameter revision**;
- focus changes do not create source revisions;
- debounced/serialized native evaluation;
- lifecycle-only source revisions hidden from visible AI chat while retained as authoritative history;
- compact latest-first revision history with restore/select and safe product-level Delete tombstones;
- `project.brep.json` canonical-source inspection;
- sticky Parametric-style native STEP / BRep JSON export control.

Detailed evidence:

```text
docs/brep_phase3_3g_live_checkpoint.md
```

### 3H — browser/runtime and regression acceptance

Status: **complete and accepted**.

Detailed runbook and live evidence:

```text
docs/brep_phase3_3h_acceptance.md
docs/brep_phase3_3h_live_checkpoint.md
```

The complete local authenticated acceptance covered:

1. explicit AI BRep creation;
2. parameter-definition/default follow-up edit;
3. feature-DAG edit;
4. stable existing project/node/parameter IDs;
5. structural change semantics;
6. refresh/reopen persistence;
7. restore -> branch lineage;
8. browser stale/overlap protection;
9. independent native STEP import/topology inspection;
10. ordinary OpenSCAD creation regression;
11. multi-file OpenSCAD + OpenCode follow-up regression;
12. browser console/network review.

The independent STEP inspection reported:

```text
bounds_min = -70.0 -40.0 -5.0
bounds_max =  70.0  40.0  5.0
dimensions = 140.0 80.0 10.0
analytic_cylindrical_faces = 1
Phase 3H STEP topology inspection PASS
```

A centered-hole AI semantic bug found by this pass was corrected by documenting the evaluator's centered local primitive coordinates across normal-provider/OpenCode/Codex BRep instructions and then live rechecked successfully.

A separate OpenCode model-preference bug was also found during 3H: large discovered catalogs could produce more hidden IDs than the visibility validator's old 1,024-item cap. The bounded limit was raised with regression coverage; OpenCode activation/persistence then completed successfully.

Accepted implementation checkpoint at the end of 3H:

```text
bb09063211f4cceb102461b13f94bf8b3233d18a
Cover large model visibility preference sets
```

## 3I — Phase 3 closeout

Status: **complete and accepted**.

The branch comparison at 3I entry was:

```text
base/merge-base = 6e0ec92a439fb7e936a5d02001742df38a4c38d7
branch          = feature/brep-ai-native-editing
ahead           = 145
behind          = 0
```

3I added no new product functionality. It was limited to closeout verification, documentation coherence and PR preparation.

The full local closeout chain from `docs/brep_phase3_execution.md` was run against the real local checkout and reported green by the user at:

```text
87bd2fd55d61e1f4eb0c19a00b337a3e7a788cf1
Advance Phase 3 handover to closeout
```

Verified chain:

```bash
scripts/brep/smoke-test.sh &&
npm test &&
npm run typecheck &&
npm run lint &&
npm run build &&
git diff --check origin/master...HEAD &&
git status --short &&
git rev-parse HEAD
```

The BRep smoke run emitted the headless/container warning:

```text
Fontconfig error: Cannot load default config file
```

This was non-blocking: the same run continued successfully and produced a valid native boolean/tessellation result:

```text
{"result":"cut","triangles":732}
```

No CI result is claimed by this closeout evidence; the final gate above is local verification plus the already recorded browser/native acceptance.

Phase 3 is therefore ready for draft-PR review against `master`. Merge remains explicitly gated on user approval.

## Separate Parametric/OpenSCAD request

A separate requested feature remains queued after Phase 3 closeout: allow direct editing/saving of the OpenSCAD project entrypoint (`main.scad`) from Project files rather than only support modules.

This is intentionally not part of BRep Phase 3. When implemented separately, preserve whole-project snapshot integrity, support files/assets/`entrypointPath`, parameter-write serialization, `metadata.originalCode` semantics, preview/parameter reparse and AI-streaming write exclusion.

## Current next action

Prepare and inspect a **draft PR** from `feature/brep-ai-native-editing` to `master`. Do not merge without explicit user approval.
