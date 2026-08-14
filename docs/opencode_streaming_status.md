# OpenCode CLI + Streaming Implementation Status

Plan: `docs/opencode_streaming_plan.md`

Reviewed: 2026-08-14 (third review)

## Overall status

**State:** Ready for controlled implementation after preflight

**Target feature branch:** `local-dev-continue`

**Reviewed feature-branch head before planning docs:** `01336488828a003e8870efa8229ae9e1dbcc8003`

**Planning docs commit on feature branch:** `38308779f6d05a8b3d758b9f1b0d3e0cfef21d7a`

**Current next task:** `P01 — Confirm branch, worktree, and HEAD`

**Implementation rule:** exactly one task ID per coding-agent run. No feature implementation before Phase P is complete.

## Important invariants

- Preserve a working OpenCode CLI path.
- Streaming is selectable in addition to CLI, not a replacement.
- Work on `local-dev-continue` unless this file explicitly changes target branch.
- Never discard/reset/clean/overwrite uncommitted or untracked user work.
- Protect any local/untracked `src/server/cliAgents.ts`.
- Reuse/repair the existing `src/server/opencode.ts` HTTP/SSE prototype; do not create a duplicate stack without evidence replacement is necessary.
- pCAD does not call llama-swap directly from the OpenCode transport.
- No whole-agent-run global lock.
- Multiple OpenCode jobs may be active at application level.
- Installed `opencode --version`, CLI `--help`, and server `/doc` are authoritative for OpenCode behavior.
- Inspect installed `@ai-sdk/provider` types/version before modifying stream-part lifecycle.
- No silent change to tools/files/workspace/permission semantics while changing transport.
- No silent CLI<->Streaming fallback.
- Never combine persistent OpenCode session reuse with resending the full pCAD transcript each turn.
- Normal automated tests should not require OpenCode, llama-swap, a model, or GPU.

## Findings from the third review

1. The actual OpenCode feature code is on `local-dev-continue`; master was only carrying the planning docs before this review.
2. To remove that split-brain risk, this plan/status pair is now also committed directly to `local-dev-continue`.
3. `src/server/opencode.ts` already implements a custom `LanguageModelV2` HTTP/streaming adapter; new work must repair/modernize it, not duplicate it.
4. `src/server/aiChat.ts` imports `opencodeChatModel` and also `cliAgentChatModel`/`isCliAgentModel`.
5. `src/routes/api/opencode/models.ts` imports `configuredCodexModels` from `src/server/cliAgents`.
6. `src/server/cliAgents.ts` was still absent from the pushed feature-branch tree during this review. The local worktree may contain it, so P02 must inspect before any creation/replacement.
7. The reviewed models route produces `agent/opencode/...` IDs, while reviewed `providerFor()` has an explicit `opencode/...` branch and otherwise relies on `isCliAgentModel()`. The exact routing is therefore not safe to infer without `cliAgents.ts`; A03 must build a routing matrix.
8. `start.sh` starts OpenCode on port 4096, while reviewed `src/server/opencode.ts` defaults to 14096.
9. Current public OpenCode docs now align with the project's `start.sh` port: `opencode serve` defaults to `127.0.0.1:4096` and exposes OpenAPI at `/doc`.
10. Public docs currently describe health `/global/health`, create session `/session`, async prompt `/session/:id/prompt_async`, abort `/session/:id/abort`, and event streams `/event`/`/global/event`. Installed `/doc` must verify these before runtime changes.
11. The reviewed prototype still uses `/api/model`, `/api/session`, `/api/session/{id}/prompt`, and `/api/session/{id}/event`, so an API migration is likely but must be evidence-based.
12. The reviewed prototype creates a new OpenCode session for each request and formats pCAD history into the prompt. Persistent-session reuse is therefore optional, not a prerequisite for streaming.
13. `formatPrompt()` explicitly disables OpenCode tools/files in the HTTP path. CLI and Streaming semantic parity needs deliberate documentation/decision.
14. New stream-lifecycle risks found in the third review:
    - text/reasoning deltas are emitted without an obviously matching start/end lifecycle;
    - delta IDs use `Date.now()`, so the ID may change between chunks;
    - terminal event detection happens before the later extraction/yield block, so text arriving with the terminal event may be lost;
    - the timeout callback is effectively a no-op;
    - dispatching an `abort` event on the supplied `AbortSignal` is not equivalent to aborting a controller/request;
    - cursor handling is explicitly `TBD`;
    - accumulated events plus polling create duplication/memory-risk unless carefully deduplicated.
15. `package.json` has `typecheck`, `lint`, and `build` scripts but no `test` script; existing tests use `node:test`. Determine actual invocation before adding dependencies/frameworks.
16. Current public OpenCode CLI docs expose `opencode run` with JSON output, model/agent/session/directory options and optional `--attach`; preserve the actual local CLI implementation before considering architectural optimizations.

## Task status

Legend: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`, `SKIPPED`.

| Task | Status | Summary |
|---|---|---|
| P01 | TODO | Confirm branch, worktree, and HEAD |
| P02 | TODO | Resolve `cliAgents.ts` discrepancy safely |
| P03 | TODO | Establish CLI compatibility baseline |
| P04 | TODO | Baseline typecheck/lint/build/test invocation |
| A01 | TODO | Trace CLI routing end-to-end |
| A02 | TODO | Trace HTTP prototype end-to-end |
| A03 | TODO | Build model-ID/routing matrix |
| A04 | TODO | Trace settings persistence |
| A05 | TODO | Document CLI/Streaming behavior semantics |
| B01 | TODO | Define execution-mode type |
| B02 | TODO | Add backward-compatible default |
| B03 | TODO | Persist mode |
| B04 | TODO | Add selector UI |
| B05 | TODO | Test selector/settings |
| B06 | TODO | Validate Phase B |
| C01 | TODO | Define minimal transport boundary |
| C02 | TODO | Put CLI behind boundary |
| C03 | TODO | Put HTTP prototype behind boundary |
| C04 | TODO | Route by selected mode |
| C05 | TODO | CLI regression validation |
| D01 | TODO | Choose canonical OpenCode base URL |
| D02 | TODO | Align start.sh/client/env |
| D03 | TODO | Add verified health check |
| D04 | TODO | Optional server-auth handling |
| D05 | TODO | Test config/health |
| E01 | TODO | Record installed OpenCode version |
| E02 | TODO | Inspect installed `/doc` |
| E03 | TODO | Record installed API operations |
| E04 | TODO | Build prototype migration table |
| F01 | TODO | Fix provider/model discovery |
| F02 | TODO | Fix session creation |
| F03 | TODO | Fix async prompt submission |
| F04 | TODO | Implement one real SSE connection |
| F05 | TODO | Filter events by session |
| F06 | TODO | Fix AI SDK text/reasoning lifecycle |
| F07 | TODO | Flush final content before completion |
| F08 | TODO | Fix cancellation and timeout plumbing |
| F09 | TODO | Focused Streaming adapter tests |
| G01 | TODO | Define internal event representation |
| G02 | TODO | Map text without duplication |
| G03 | TODO | Map completion/errors |
| G04 | TODO | Map useful activity only |
| G05 | TODO | Event mapping tests |
| H01 | TODO | Reuse current assistant state |
| H02 | TODO | Show progressive text |
| H03 | TODO | Show completion/error state |
| H04 | TODO | Wire Stop/Cancel by transport |
| H05 | TODO | UI validation |
| I01 | TODO | Verify no whole-run global lock |
| I02 | TODO | Two simultaneous Streaming jobs |
| I03 | TODO | Verify zero cross-talk |
| I04 | TODO | Tool/external-wait interleaving |
| I05 | TODO | Deterministic interleaving test |
| J01 | TODO | Document history inputs |
| J02 | TODO | Choose Streaming history owner |
| J03 | TODO | Enforce anti-duplication invariant |
| J04 | TODO | Optional persistent-session implementation |
| K01 | TODO | Streaming server unavailable |
| K02 | TODO | SSE disconnect/reconnect |
| K03 | TODO | Malformed/unknown event |
| K04 | TODO | Preserve CLI failure behavior |
| K05 | TODO | Error tests |
| L01 | TODO | Manual CLI regression |
| L02 | TODO | Manual Streaming test |
| L03 | TODO | Manual two-session test |
| L04 | TODO | Full checks |
| L05 | TODO | Documentation |
| L06 | TODO | Final diff review |

## Preflight evidence templates

### P01

```text
branch:
HEAD:
git status --short:
plan/status present:
```

### P02

```text
cliAgents.ts: present+tracked | present+untracked/modified | absent
importing files:
notes:
```

### P03

```text
CLI command:
model ID mapping:
working directory:
output format/parsing:
cancellation:
server/attach behavior:
```

### P04

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | NOT RUN | |
| `npm run lint` | NOT RUN | |
| `npm run build` | NOT RUN | |
| relevant existing Node test | NOT RUN | determine invocation first |

## A03 routing matrix

Populate during A03.

| UI model ID | `providerFor()` result | Adapter | Underlying OpenCode/provider ID | Notes |
|---|---|---|---|---|
| `agent/opencode/...` | TBD | TBD | TBD | |
| `opencode/...` if used | TBD | TBD | TBD | |
| Codex agent | TBD | TBD | TBD | |
| `local/qwen3.6-...` | TBD | direct local? | TBD | |

## Verified OpenCode contract

Populate during Phase E from the installed environment.

- Version: _TBD_
- `/doc` inspected: _NO_
- Base URL: _TBD_
- Health: _TBD_
- Providers/models: _TBD_
- Create session: _TBD_
- Async prompt: _TBD_
- SSE events: _TBD_
- Abort: _TBD_
- Authentication: _TBD_
- Relevant event shapes/session-id location: _TBD_

### Prototype migration table

| Reviewed prototype | Installed verified API | Action |
|---|---|---|
| `/api/model` | TBD | TBD |
| `/api/session` | TBD | TBD |
| `/api/session/{id}/prompt` | TBD | TBD |
| `/api/session/{id}/event` | TBD | TBD |
| current abort behavior | TBD | TBD |

## AI SDK stream lifecycle audit

Populate during F06 after inspecting installed provider types.

```text
@ai-sdk/provider version:
required text part sequence:
required reasoning part sequence:
stable ID strategy:
hidden-reasoning policy:
```

## Stream terminal-content audit

Populate during F07.

Required regression scenario:

```text
same incoming SSE chunk/batch contains:
1. final message text/update
2. terminal/idle/completion event

expected: final text is emitted before finish
```

Result: _NOT TESTED_

## Cancellation/timeout audit

Populate during F08.

```text
local AbortController ownership:
upstream request abort signal:
OpenCode abort endpoint call:
timeout behavior:
CLI process cancellation:
```

## Conversation-history decision

Current reviewed HTTP strategy:

```text
new OpenCode session per pCAD request
+ pCAD formats/sends conversation context
```

Final history owner: _TBD_

Persistent OpenCode session: _TBD_

Anti-duplication invariant tested: _NO_

## Implementation log

After each task append:

```text
### YYYY-MM-DD — TASK_ID
Status: DONE | BLOCKED | SKIPPED
Repository state before task:
- branch:
- HEAD:
- relevant git status:
Files changed:
- ...
Evidence / change:
- ...
Validation:
- command -> PASS/FAIL
Notes:
- ...
Next task:
- ...
```

## Current blockers

No declared blocker yet. P02 may reveal a real local-worktree blocker around `cliAgents.ts`; record it rather than guessing.

## Known risks

1. Wrong-branch/split-planning risk — mitigated by committing these docs to `local-dev-continue`.
2. Untracked `cliAgents.ts` risk.
3. Duplicate HTTP/SSE implementation risk.
4. Model-ID/routing mismatch risk (`agent/opencode/...` vs explicit `opencode/...` routing).
5. OpenCode API-version risk.
6. 4096 vs 14096 configuration risk.
7. SSE lifecycle/protocol risk.
8. Final-text-loss risk at terminal event.
9. No-op abort/timeout risk.
10. Event cursor/duplication/memory risk.
11. Conversation-history duplication/context waste risk.
12. Tool/file/workspace behavior-parity risk.
13. Cross-session event-talk risk.
14. Whole-run lock would destroy llama-swap request interleaving.
15. Test-framework drift risk.
16. 35B scope risk — never combine task IDs.

## Short prompt for the coding agent

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Work only on the `Current next task`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`; never discard/reset/clean/overwrite uncommitted or untracked user work. Inspect current code before editing. For OpenCode behavior trust installed `opencode --version`, `opencode ... --help`, and server `/doc`; for AI SDK stream behavior inspect the installed `@ai-sdk/provider` types/version. Implement only that one task, run the smallest relevant validation, update this status file with evidence/files/tests/result, set the next task only if this task is DONE, then stop.