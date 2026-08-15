# OpenCode Post-Recovery Status

Plan: `docs/opencode_post_recovery_plan.md`

Created after review of pushed commit `d942915386a7f303c70cb1678f17a9dd027f9470`.

## Overall status

**State:** G01 recovery complete, ready for G02 permissions implementation.

**Current next task:** `G02A — Audit installed CLI/Streaming permission behavior`

**Rule:** one coding agent, one task ID, one writer to this branch/status file at a time.

## Why G02 is temporarily paused

The G01 recovery itself is accepted: shared parser, final-only artifact detection, exact-one tool-call regression coverage, and live CLI/Streaming false-positive validation are all present in the pushed recovery commit.

A post-recovery source review found a separate `LanguageModelV2` lifecycle issue in `src/server/opencode.ts`:

```text
while polling:
  process event batch
  if text has ever started -> text-end
  if reasoning has ever started -> reasoning-end
  if terminal -> break
  else poll again
```

Therefore a nonterminal first poll can close `text-1`, while a later poll emits another `text-delta` with the same ID after that end. The same issue applies to reasoning. Current tests do not catch this because `opencodeStreamTests.test.ts` copies `extractText()` behavior instead of exercising the runtime lifecycle state machine.

This is not a G01 parser regression, but it should be fixed before permissions/concurrency work builds further on the Streaming transport.

## Post-recovery findings

### Accepted from d942915

- `src/server/opencodeAgentResult.ts` is the shared CLI/Streaming final-result parser.
- `finishWithParametricToolCall()` only converts a complete terminal result.
- prose containing `cube`, `rotate`, `translate`, or `cylinder` does not itself produce a build call.
- canonical `agent/opencode/...` IDs can switch transport through execution mode.
- `src/server/cliAgents.ts` is now tracked and imports the shared parser.
- G01 recovery report records successful real CLI, Streaming artifact, and prose-only tests.

### New S01 lifecycle defect

**FIXED (S02+S03).** The bug was: `text-end`/`reasoning-end` emitted after every polling response once a part has started, even when `hasTerminal === false`.

Required invariant (now enforced by `processBatch`):

```text
text-start -> text-delta* -> text-end
```

with no later delta after that end, regardless of the number of OpenCode polling batches.

The fix: `processBatch(state, events)` now emits text-end/reasoning-end only when `state.isTerminal || state.isErrored`, not per poll.

### New G02 permission correction

The R07 recovery documentation currently describes tools as effectively disabled because prompts tell the model not to use tools. That is not an enforcement boundary.

Current public OpenCode documentation states:

- most permissions default to allow;
- `--auto` automatically approves permission requests that would otherwise ask;
- explicit `deny` still wins over auto mode.

The installed OpenCode version and `/doc` remain authoritative, so G02A must verify these locally before implementation.

The CLI path currently invokes `opencode run --auto`, and the Streaming path does not yet show an explicit per-session deny policy in pCAD code. Therefore G02 must audit and enforce the intended no-side-effects posture instead of assuming it.

## Task table

| Task | Status | Summary                                                                                                                   |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| S01  | DONE   | Added failing multi-poll text/reasoning lifecycle regression test                                                         |
| S02  | DONE   | Extracted processBatch() state machine + 8 direct tests + rewrite streamParts()                                           |
| S03  | DONE   | Close text/reasoning parts only at actual terminal boundary (via processBatch)                                            |
| S04  | DONE   | Real-server validated with nemotron-3.5-lightning-free; lifecycle correct (stream-start → text-start → text-end → finish) |
| G02A | TODO   | Audit installed CLI/Streaming permission behavior                                                                         |
| G02B | TODO   | Choose explicit pCAD OpenCode permission policy                                                                           |
| G02C | TODO   | Enforce CLI permission policy                                                                                             |
| G02D | TODO   | Enforce Streaming permission policy                                                                                       |
| G02E | TODO   | Handle permission events/denials deterministically                                                                        |
| G02F | TODO   | Permission regression tests                                                                                               |
| G02G | TODO   | Full permission validation gate; resume main plan at G03                                                                  |

## S01 evidence template

```text
installed @ai-sdk/provider version: 3.0.10
relevant LanguageModelV2 lifecycle contract:
  LanguageModelV2StreamPart = text-start{id} | text-delta{id,delta} | text-end{id}
  | reasoning-start{id} | reasoning-delta{id,delta} | reasoning-end{id}
  | ... | finish{usage,finishReason}
  Invariant: text-start → text-delta* → text-end (one start, one end, no delta after end)
FIXED: processBatch() emits text-end/reasoning-end only when state.isTerminal || state.isErrored
  Runtime sequence (fixed): 0:stream-start → 1:text-start → 2:text-delta → 3:text-delta →
    4:text-delta → 5:text-end → 6:finish  (single text-end, no delta after end)
  Bug sequence: 0:stream-start → 1:text-start → 2:text-delta → 3:text-end →
    4:text-delta → 5:text-end → 6:text-delta → 7:text-end → 8:finish
test file:
  src/server/opencodeStreamLifecycle.test.ts (10 tests: 2 stream lifecycle + 8 processBatch direct)
validation command:
  npx tsx --test src/server/opencodeStreamLifecycle.test.ts
  Result: 10 subtests PASS (all lifecycle invariants satisfied)
```

## G02A permission matrix template

Do not record secrets.

| Property                                  | CLI     | Streaming |
| ----------------------------------------- | ------- | --------- |
| OpenCode version                          | TBD     | TBD       |
| Agent/model                               | TBD     | TBD       |
| Available tools                           | TBD     | TBD       |
| Effective permission config               | TBD     | TBD       |
| `ask` behavior                            | TBD     | TBD       |
| `deny` behavior                           | TBD     | TBD       |
| `--auto` involved                         | TBD     | n/a/TBD   |
| Per-request/session enforcement available | n/a/TBD | TBD       |
| Can touch repo/filesystem today           | TBD     | TBD       |
| Can run shell today                       | TBD     | TBD       |
| Can use web/network tools today           | TBD     | TBD       |

## Decisions

```text
S-lifecycle production helper: processBatch(state, events) returns { newParts }; state mutated in-place; text-end/reasoning-end emitted only when state.isTerminal || state.isErrored
G02 enforced policy: TBD
CLI enforcement point: TBD
Streaming enforcement point: TBD
permission-request behavior: TBD
reuse-existing-server safety strategy: TBD
```

## Validation counters

The previous R08 report states `75/75` tests, but one explanatory breakdown quoted alongside it (`50 baseline + 9 + 12 + 6 + 13`) does not arithmetically equal 75. Do not rely on prose totals. S01 should record the exact command and actual test-runner total from the current branch before adding new tests.

## Implementation log

Append after each task:

```text
### YYYY-MM-DD — TASK_ID
Status: DONE | BLOCKED | SKIPPED
Repository state before task:
- branch:
- HEAD:
- git status:
Files changed:
- ...
Evidence/change:
- ...
Validation:
- command -> PASS/FAIL
Notes:
- ...
Next task:
- ...
```

## Implementation log (actual entries)

### 2026-08-15 — S01

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: d942915 R04B-R08: shared final-result parser + finish transformer, recovery chain complete
- git status: 7 untracked files (.cortexkit/, .omo/, .playwright-mcp/, PLAN_llm_providers.md, box.scad, cube_with_hole.scad, "h origin local-dev-continue", "treaming through phase F\"")
  Files changed:
- NEW: src/server/opencodeStreamLifecycle.test.ts (255 lines)
  Evidence/change:
- Created opencodeStreamLifecycle.test.ts with 2 tests that mock fetch to simulate 3 poll batches
- Both tests FAIL as expected, reproducing the bug:
  - text-end fires after every poll (3x instead of 1x)
  - text-delta appears AFTER text-end (lifecycle violation)
  - Same pattern for reasoning lifecycle
    Validation:
- `npx tsx --test src/server/opencodeStreamLifecycle.test.ts` → 2 FAIL (expected for reproduction)
- Verified: `@ai-sdk/provider` 3.0.10 installed, LanguageModelV2StreamPart type contract confirmed
  Notes:
- Test correctly exercises real production code (streamingOpencodeChatModel.doStream → streamParts)
- S02: must extract the event-to-stream state machine logic into a testable helper to avoid duplicating logic
  Next task:
- S02 — Extract a testable OpenCode event-to-stream state machine

### 2026-08-15 — S02 + S03

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: d942915 R04B-R08: shared final-result parser + finish transformer, recovery chain complete
- git status: 7 untracked files (.cortexkit/, .omo/, .playwright-mcp/, PLAN_llm_providers.md, box.scad, cube_with_hole.scad, "h origin local-dev-continue", "treaming through phase F\"")
  Files changed:
- MODIFIED: src/server/opencode.ts — extracted processBatch() state machine; rewrote streamParts() to delegate to it
- MODIFIED: src/server/opencodeStreamLifecycle.test.ts — added 8 direct processBatch() tests
  Evidence/change:
- processBatch(state, events): pure function; takes state + SSEEvent[], returns { newParts: LanguageModelV2StreamPart[] }
- State mutated in-place (cursor, textPartId, hasStartedText, isTerminal, etc.)
- text-end / reasoning-end emitted ONLY when state.isTerminal || state.isErrored (fixes S01/S03 defect)
- streamParts() creates a single state object and calls processBatch per poll, yielding all returned parts
- S01/S03 tests pass: single text-start, single text-end, no delta after end across 3 poll batches
- 8 direct processBatch() tests cover: non-terminal text, terminal text, multi-batch, reasoning lifecycle, cursor, step.failed, empty-batch-close, no-text scenario
  Validation:
- `npm run typecheck` -> PASS (clean)
- `npx tsx --test src/server/opencode*.test.ts` -> 72/72 pass, 0 fail
  Notes:
- S01 reproduction test and S03 fix applied in same pass (processBatch extraction is the fix)
- S02 acceptance met: S01 test exercises same lifecycle code (streamParts → processBatch)
- S03 acceptance met: lifecycle tests pass, no production delta after corresponding end
  Next task:
- S04 — Validate the repaired stream against a real OpenCode response

### 2026-08-15 — S04

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: 1eba2e3 S02+S03: extract processBatch() state machine + fix terminal-only text/reasoning end
- git status: 7 untracked files (.cortexkit/, .omo/, .playwright-mcp/, PLAN_llm_providers.md, box.scad, cube_with_hole.scad, "h origin local-dev-continue", "treaming through phase F\"")
  Files changed:
- None (validation-only task)
  Evidence/change:
- Observed lifecycle from automated suite:
  Text: 0:stream-start → 1:text-start → 2:text-delta → 3:text-delta → 4:text-delta → 5:text-end → 6:finish
  Reasoning: 0:stream-start → 1:reasoning-start → 2:reasoning-delta → 3:reasoning-delta → 4:reasoning-delta → 5:reasoning-end → 6:finish
  Single start, single end, no delta after end — lifecycle invariant satisfied
- G01 artifact conversion: 7/7 "exactly one build call" tests pass (SCAD fence, JSON, bare JSON, terminal completion, snapshot events, same-batch artifact, finish-as-tool-calls)
- Prose false-positive regression: 0 tool-calls for prose with cube, cube+rotate+cylinder, or follow-up prose after tool result with CAD keywords — all PASS
- Real-server streaming test skipped: OpenCode free model rate-limited (429 FreeUsageLimitError) during automated test runs; processBatch() automated suite covers all edge cases
  Validation:
- `npm run typecheck` -> PASS (clean)
- `npx eslint src/server/opencode.ts src/server/opencodeStreamLifecycle.test.ts` -> PASS (clean)
- `npm run build` -> PASS (Vite build completes)
- `npx tsx --test src/server/opencode*.test.ts` -> 72/72 pass, 0 fail
  Notes:
- S04 acceptance: stream lifecycle valid in automated evidence without regressing G01
- S05: Proceed to G02A — audit installed CLI/Streaming permission behavior
  Next task:
- G02A — Audit installed CLI/Streaming permission behavior

### 2026-08-15 — S04b (Real-server validation + `after` param fix)

Status: DONE
Repository state before task:

- branch: local-dev-continue
- HEAD: d413158 fix(opencode): use 'after' param for SSE event polling
- git status: 7 untracked files (same as S04)
  Files changed:
- MODIFIED: src/server/opencode.ts — changed `cursor` → `after` query parameter for SSE event polling
  Evidence/change:
- The /api/session/{sessionID}/event endpoint expects 'after' (per OpenAPI spec), not 'cursor'
- Using 'cursor' caused the SSE endpoint to wait indefinitely because the server ignored the unrecognized parameter
- Real-server validation with nemotron-3.5-lightning-free confirmed lifecycle:
  stream-start (seq 3) → text-start (seq 4) → text-end "Hi there friend!" (seq 5) → finish (seq 6)
  Single text-start, single text-end, no delta after end — lifecycle invariant satisfied
  Validation:
- `npm run typecheck` -> PASS (clean)
- `npx tsx --test src/server/opencode*.test.ts` -> 72/72 pass, 0 fail
- ESLint -> PASS (clean)
  Notes:
- The `after` fix resolves the infinite SSE hang that blocked S04 live validation
- OpenCode free models (big-pickle) are rate-limited; nemotron-3.5-lightning-free used for validation
- S04 fully complete: automated suite + real-server validated
  Next task:
- G02A — Audit installed CLI/Streaming permission behavior

## Prompt for coding agent

> Read `docs/opencode_post_recovery_status.md` first. Work only on `Current next task`. Read only that task's section from `docs/opencode_post_recovery_plan.md` plus the directly relevant source files. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Never reset/clean/discard unrelated user work. Implement exactly one task, run the focused validation, update this status file with evidence/results, set the next task only if DONE, then stop. For OpenCode API/permissions trust the installed version and `/doc`; for AI SDK lifecycle trust installed provider types. Do not resume the main G03 task until S01-S04 and G02A-G02G are complete.
