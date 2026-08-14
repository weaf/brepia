# OpenCode CLI + Streaming Implementation Status

Plan: `docs/opencode_streaming_plan.md`

Reviewed: 2026-08-14

## Overall status

**State:** Ready for controlled implementation after preflight

**Target feature branch:** `local-dev-continue`

**Reviewed feature-branch head:** `01336488828a003e8870efa8229ae9e1dbcc8003`

**Current next task:** `P01 — Confirm branch, worktree, and reviewed head`

**Implementation rule:** one task ID per coding-agent run. No feature coding before Phase P is complete.

## Important invariants

- Existing OpenCode CLI mode must remain functional.
- Streaming is an additional selectable transport, not a replacement.
- Work on `local-dev-continue` unless this file explicitly changes the target branch.
- Never discard/reset/overwrite uncommitted or untracked user work.
- Protect any local/untracked `src/server/cliAgents.ts`.
- Reuse/modernize the existing `src/server/opencode.ts` streaming prototype; do not create a duplicate streaming stack without evidence that replacement is necessary.
- pCAD must not call llama-swap directly from the OpenCode transport.
- Do not add a global lock around an entire OpenCode agent run.
- Multiple OpenCode jobs may be active at application level.
- Verify installed OpenCode endpoints/events from `opencode --version`, CLI `--help`, and server `/doc` before implementing API changes.
- Current public OpenCode docs are useful orientation, but installed `/doc` is authoritative for this project.
- Do not silently change tool/file/workspace semantics while changing transport.
- Do not combine a persistent OpenCode session with resending the full pCAD transcript on every prompt.
- Normal automated tests should not require a live OpenCode server, llama-swap, model, or GPU.

## Review findings before coding

These were found during the second review and should be treated as preflight evidence, not assumptions to blindly preserve.

1. `master` contains the plan/status docs, but the OpenCode implementation is on branch `local-dev-continue`.
2. `local-dev-continue` points to commit `01336488828a003e8870efa8229ae9e1dbcc8003` at review time.
3. That commit says the provider was changed from CLI streaming to HTTP REST+SSE and added a separate CLI-agent provider path.
4. `src/server/opencode.ts` on the feature branch already implements a custom AI SDK `LanguageModelV2` adapter with OpenCode model discovery, session creation, prompt submission, event parsing, text/reasoning deltas, and generation fallback.
5. `src/server/aiChat.ts` imports both `opencodeChatModel` and `cliAgentChatModel`/`isCliAgentModel`, so CLI and HTTP routing are already conceptually separate.
6. `src/routes/api/opencode/models.ts` also imports `configuredCodexModels` from `src/server/cliAgents`.
7. During GitHub review, `src/server/cliAgents.ts` was not present in the pushed `local-dev-continue` tree even though it is imported. It may exist only in the local worktree; P02 must resolve this without overwriting user work.
8. `start.sh` starts `opencode serve --port 4096` and health-checks `http://127.0.0.1:4096/api/model`.
9. The reviewed `src/server/opencode.ts` defaults its own server port to `14096`, creating a configuration mismatch.
10. The reviewed streaming prototype uses `/api/model`, `/api/session`, `/api/session/{id}/prompt`, and `/api/session/{id}/event`; these must be checked against installed OpenCode `/doc` before being treated as correct.
11. The prototype creates a fresh OpenCode session per model request. This means later session-persistence work is optional and must be designed around history ownership rather than assumed necessary.
12. `formatPrompt()` in the HTTP prototype explicitly instructs OpenCode not to use tools/files. This is a behavioral-semantic issue, separate from transport plumbing, and must be documented before any change.
13. The project currently uses `node:test` in at least some tests (for example `src/server/chatToolPersistence.test.ts`), so new tests should prefer existing conventions over adding another framework.
14. Some `.cursor/rules` text is stale relative to the current TanStack/React codebase; coding agents should record contradictions rather than blindly following obsolete architecture descriptions.

## Task status

Legend:

- `TODO` — not started
- `IN PROGRESS` — currently being implemented
- `BLOCKED` — cannot proceed; exact reason/evidence must be recorded
- `DONE` — implemented/verified and acceptance condition met
- `SKIPPED` — deliberately not needed; rationale required

| Task | Status | Summary |
|---|---|---|
| P01 | TODO | Confirm branch, worktree, and reviewed head |
| P02 | TODO | Resolve `cliAgents.ts` discrepancy without overwriting user work |
| P03 | TODO | Establish valid CLI compatibility baseline |
| P04 | TODO | Run and record baseline validation |
| A01 | TODO | Trace CLI routing end-to-end |
| A02 | TODO | Trace existing HTTP/streaming prototype |
| A03 | TODO | Trace model discovery and picker flow |
| A04 | TODO | Trace settings persistence |
| A05 | TODO | Document agent/tool semantics baseline |
| B01 | TODO | Define execution-mode type |
| B02 | TODO | Add backward-compatible default |
| B03 | TODO | Persist mode |
| B04 | TODO | Add mode selector UI |
| B05 | TODO | Test setting/selector behavior |
| B06 | TODO | Validate Phase B |
| C01 | TODO | Define minimal shared transport operations |
| C02 | TODO | Put CLI path behind boundary |
| C03 | TODO | Put existing HTTP prototype behind boundary |
| C04 | TODO | Route by execution mode |
| C05 | TODO | CLI regression validation |
| D01 | TODO | Choose canonical OpenCode server URL setting |
| D02 | TODO | Align start script/client/env template |
| D03 | TODO | Add verified health check |
| D04 | TODO | Account for optional OpenCode server auth |
| D05 | TODO | Test config/health behavior |
| E01 | TODO | Record installed OpenCode version |
| E02 | TODO | Inspect installed `/doc` OpenAPI spec |
| E03 | TODO | Record required API operations |
| E04 | TODO | Compare prototype paths with installed API |
| F01 | TODO | Fix provider/model discovery |
| F02 | TODO | Fix session creation |
| F03 | TODO | Fix async prompt submission |
| F04 | TODO | Implement one real SSE/event stream |
| F05 | TODO | Route events by session identity |
| F06 | TODO | Implement verified abort |
| F07 | TODO | Add focused streaming-client tests |
| G01 | TODO | Define internal event model |
| G02 | TODO | Map text without duplication |
| G03 | TODO | Map completion/errors |
| G04 | TODO | Map useful agent activity only |
| G05 | TODO | Unit-test event mapping |
| H01 | TODO | Reuse existing assistant-message state |
| H02 | TODO | Show progressive text |
| H03 | TODO | Show completion/error state |
| H04 | TODO | Wire Stop/Cancel by transport |
| H05 | TODO | Validate UI streaming |
| I01 | TODO | Verify no whole-run global lock |
| I02 | TODO | Run two streaming sessions concurrently |
| I03 | TODO | Verify zero cross-talk |
| I04 | TODO | Test tool-wait interleaving |
| I05 | TODO | Add deterministic interleaving test |
| J01 | TODO | Document current history behavior |
| J02 | TODO | Choose one Streaming history owner |
| J03 | TODO | Enforce anti-duplication invariant |
| J04 | TODO | Optional persistent-session implementation |
| K01 | TODO | Handle unavailable streaming server |
| K02 | TODO | Handle SSE disconnect/reconnect |
| K03 | TODO | Handle malformed/unknown event |
| K04 | TODO | Preserve CLI process failure behavior |
| K05 | TODO | Test error paths |
| L01 | TODO | Manual CLI regression |
| L02 | TODO | Manual Streaming test |
| L03 | TODO | Manual two-session test |
| L04 | TODO | Full project validation |
| L05 | TODO | Update documentation |
| L06 | TODO | Final diff review |

## Preflight findings

### P01

_Not started by coding agent._

Expected evidence to record:

```text
branch:
HEAD:
git status --short:
plan/status files present:
```

### P02

_Not started by coding agent._

Known review clue: pushed feature branch imports `src/server/cliAgents.ts`, but GitHub tree review did not find that file.

Required final classification:

```text
cliAgents.ts: present+tracked | present+untracked/modified | absent
importing files:
notes:
```

### P03

_Not started._

### P04

_Not started._

## Architecture audit findings

### A01 — CLI routing

_Not started. Do not infer final CLI command from commit messages alone._

### A02 — HTTP prototype

Review-level evidence only:

- `src/server/opencode.ts` implements `LanguageModelV2`.
- It has CLI model discovery fallback through `opencode models`.
- It creates an OpenCode session for each request.
- It submits a prompt through HTTP.
- It reads/parses events and emits AI SDK text/reasoning deltas.
- Current endpoint shapes still require installed-API verification.

Agent must replace this note with an exact current-code trace in A02.

### A03 — Model discovery/picker

Review-level evidence only:

- `/api/opencode/models` returns OpenCode-agent model entries and configured Codex entries.
- `TextAreaChat` merges dynamic OpenCode models into the parametric model picker.
- Feature-branch model IDs use `agent/opencode/...` according to recent commit intent.

Agent must verify exact current IDs and routing.

### A04 — Settings persistence

_Not started._

### A05 — Tool/agent semantics

Review clue only: HTTP `formatPrompt()` currently contains explicit instructions not to call tools/read/write files. Agent must document actual CLI semantics before deciding whether parity is required or whether modes intentionally differ.

## Verified OpenCode contract

Populate during Phase E using the installed environment.

- OpenCode version: _TBD_
- `/doc` inspected: _NO_
- Canonical server base URL: _TBD_
- Health endpoint: _TBD_
- Provider/model endpoint: _TBD_
- Create-session endpoint: _TBD_
- Async-prompt endpoint: _TBD_
- Event/SSE endpoint: _TBD_
- Abort endpoint: _TBD_
- Auth behavior: _TBD_
- Relevant event names/shapes: _TBD_

### Prototype migration table

| Current prototype | Installed verified API | Action |
|---|---|---|
| `/api/model` | TBD | TBD |
| `/api/session` | TBD | TBD |
| `/api/session/{id}/prompt` | TBD | TBD |
| `/api/session/{id}/event` | TBD | TBD |
| abort behavior TBD | TBD | TBD |

Do not fill this table from memory; use installed `/doc`.

## Server configuration audit

Known review state:

| Location | Reviewed behavior |
|---|---|
| `start.sh` | starts OpenCode on port `4096` |
| `src/server/opencode.ts` | defaults to `14096` unless `OPENCODE_PORT` is set |
| `.env.local.template` | reviewed copy does not document `OPENCODE_PORT` |

Phase D must reduce this to one canonical configuration path.

## Conversation-history decision

Populate during Phase J.

Current reviewed HTTP prototype strategy:

```text
new OpenCode session per pCAD model request
+ pCAD formats conversation/context into the prompt
```

Chosen final Streaming strategy: _TBD_

History owner: _TBD: pCAD | OpenCode_

Persistent OpenCode session: _TBD: YES | NO_

Anti-duplication invariant validated: _NO_

## Baseline validation

Populate during P04 on the feature branch/worktree actually used by the coding agents.

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | NOT RUN | |
| `npm run lint` | NOT RUN | |
| `npm run build` | NOT RUN | |
| relevant existing Node test | NOT RUN | determine repository command first |

## Implementation log

Add one entry after every completed task.

Use this format:

```text
### YYYY-MM-DD — TASK_ID

Status: DONE | BLOCKED | SKIPPED

Repository state before task:
- branch:
- HEAD:
- relevant git status:

Files changed:
- path/to/file

Evidence / what changed:
- concise description

Validation:
- command -> PASS/FAIL

Notes:
- compatibility decisions, installed API observations, user-work protection, or follow-up risks

Next task:
- TASK_ID
```

## Blockers

No blocker is currently declared by the plan itself. P02 may discover a real worktree/commit blocker around `cliAgents.ts`; if so, record it instead of guessing.

## Known risks to keep watching

1. **Wrong branch risk:** master has planning docs but feature implementation is on `local-dev-continue`.
2. **Uncommitted-file risk:** `cliAgents.ts` may exist locally but not in GitHub; an agent must not overwrite it.
3. **Duplicate implementation risk:** streaming already exists as a prototype in `src/server/opencode.ts`.
4. **API-version risk:** reviewed `/api/...` paths may be stale against installed/current OpenCode.
5. **Port/config risk:** reviewed code disagrees between 4096 and 14096.
6. **History duplication risk:** persistent OpenCode session plus full pCAD transcript would waste context and duplicate turns.
7. **Behavior parity risk:** HTTP prototype currently suppresses tools/files, while CLI agent behavior may differ.
8. **Concurrency risk:** global whole-run locking would destroy the useful llama-swap interleaving behavior.
9. **Cross-talk risk:** global SSE/event feeds must be filtered by session ID.
10. **Test-framework drift:** use existing Node test conventions rather than adding a new framework casually.
11. **Stale docs risk:** some Cursor rules no longer exactly match the current project architecture.
12. **35B scope risk:** coding agents should not combine task IDs; small diffs and explicit evidence are intentional.

## Short prompt for the coding agent

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Work only on the `Current next task` from the status file. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`; never discard or overwrite uncommitted/untracked user files. Inspect the current code needed for that task. For OpenCode HTTP/CLI behavior trust the installed `opencode --version`, `opencode ... --help`, and server `/doc` over assumptions in these docs. Implement only that one task, run the smallest relevant validation, update this status file with evidence/files/tests/result, set the next task only if this task is DONE, then stop. Do not start another task in the same run.
