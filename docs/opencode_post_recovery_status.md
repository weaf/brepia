# OpenCode Post-Recovery Status

Plan: `docs/opencode_post_recovery_plan.md`

Created after review of pushed commit `d942915386a7f303c70cb1678f17a9dd027f9470`.

## Overall status

**State:** Additional stream lifecycle correction required before G02 permissions implementation.

**Current next task:** `S01 — Reproduce the stream lifecycle defect with a failing test`

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

Production code currently emits `text-end`/`reasoning-end` after every polling response once a part has started, even when `hasTerminal === false`.

Required invariant:

```text
text-start -> text-delta* -> text-end
```

with no later delta after that end, regardless of the number of OpenCode polling batches.

### New G02 permission correction

The R07 recovery documentation currently describes tools as effectively disabled because prompts tell the model not to use tools. That is not an enforcement boundary.

Current public OpenCode documentation states:

- most permissions default to allow;
- `--auto` automatically approves permission requests that would otherwise ask;
- explicit `deny` still wins over auto mode.

The installed OpenCode version and `/doc` remain authoritative, so G02A must verify these locally before implementation.

The CLI path currently invokes `opencode run --auto`, and the Streaming path does not yet show an explicit per-session deny policy in pCAD code. Therefore G02 must audit and enforce the intended no-side-effects posture instead of assuming it.

## Task table

| Task | Status | Summary |
|---|---|---|
| S01 | TODO | Add failing multi-poll text/reasoning lifecycle regression test |
| S02 | TODO | Extract production event-to-AI-SDK state machine for real testing |
| S03 | TODO | Close text/reasoning parts only at actual terminal boundary |
| S04 | TODO | Automated + real Streaming lifecycle validation |
| G02A | TODO | Audit installed CLI/Streaming permission behavior |
| G02B | TODO | Choose explicit pCAD OpenCode permission policy |
| G02C | TODO | Enforce CLI permission policy |
| G02D | TODO | Enforce Streaming permission policy |
| G02E | TODO | Handle permission events/denials deterministically |
| G02F | TODO | Permission regression tests |
| G02G | TODO | Full permission validation gate; resume main plan at G03 |

## S01 evidence template

```text
installed @ai-sdk/provider version:
relevant LanguageModelV2 lifecycle contract:
current runtime sequence reproduced:
expected failing assertion:
test file:
```

## G02A permission matrix template

Do not record secrets.

| Property | CLI | Streaming |
|---|---|---|
| OpenCode version | TBD | TBD |
| Agent/model | TBD | TBD |
| Available tools | TBD | TBD |
| Effective permission config | TBD | TBD |
| `ask` behavior | TBD | TBD |
| `deny` behavior | TBD | TBD |
| `--auto` involved | TBD | n/a/TBD |
| Per-request/session enforcement available | n/a/TBD | TBD |
| Can touch repo/filesystem today | TBD | TBD |
| Can run shell today | TBD | TBD |
| Can use web/network tools today | TBD | TBD |

## Decisions

```text
S-lifecycle production helper design: TBD
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

## Prompt for coding agent

> Read `docs/opencode_post_recovery_status.md` first. Work only on `Current next task`. Read only that task's section from `docs/opencode_post_recovery_plan.md` plus the directly relevant source files. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Never reset/clean/discard unrelated user work. Implement exactly one task, run the focused validation, update this status file with evidence/results, set the next task only if DONE, then stop. For OpenCode API/permissions trust the installed version and `/doc`; for AI SDK lifecycle trust installed provider types. Do not resume the main G03 task until S01-S04 and G02A-G02G are complete.
