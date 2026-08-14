# OpenCode CLI + Streaming Implementation Status

Plan: `docs/opencode_streaming_plan.md`

Reviewed: 2026-08-14 (fourth/final pre-implementation review)

## Overall status

**State:** Ready for controlled implementation after preflight

**Target branch:** `local-dev-continue`

**Feature code reviewed from:** `01336488828a003e8870efa8229ae9e1dbcc8003`

**Latest plan commit before this status update:** `bc3924085a09c535061db45bf4b6ae4ea1160d86`

**Current next task:** `P01 — Confirm branch/worktree/HEAD`

**Execution rule:** one coding agent, one task ID, one shared branch/status writer at a time.

## Critical invariants

- Preserve the existing OpenCode CLI agent path.
- Streaming is selectable in addition to CLI; it is not a replacement.
- Do not run two coding agents concurrently against this same branch/status file.
- Never discard/reset/clean/overwrite uncommitted or untracked user work.
- Protect any local/untracked `src/server/cliAgents.ts`.
- Reuse or deliberately replace the existing `src/server/opencode.ts` HTTP/SSE prototype; never create a second stack beside it.
- Installed OpenCode `--version`, CLI `--help`, and server `/doc` are authoritative.
- Inspect installed AI SDK/provider types before changing the custom model adapter.
- No silent CLI <-> Streaming fallback.
- No direct llama-swap integration from this OpenCode transport.
- No application-level lock for an entire OpenCode agent job.
- No persistent OpenCode session plus full pCAD transcript resubmission.
- No silent tool/file/workspace/permission semantic change.
- Do not auto-approve OpenCode permissions merely to keep runs moving.
- Do not expose hidden chain-of-thought unless pCAD intentionally supports it.

## Final review findings

1. `local-dev-continue` is the feature branch and now contains the current plan/status docs.
2. `src/server/opencode.ts` already implements a custom HTTP/SSE `LanguageModelV2` adapter.
3. `src/server/aiChat.ts` imports both the HTTP OpenCode adapter and a CLI-agent adapter.
4. `src/server/cliAgents.ts` is absent from the pushed branch tree despite imports; it may exist only in the local worktree.
5. Model IDs are potentially inconsistent: route output includes `agent/opencode/...`, while explicit HTTP routing recognizes `opencode/...`; the missing `isCliAgentModel()` implementation may account for this.
6. `start.sh` uses OpenCode port `4096`, while the reviewed server adapter defaults to `14096`.
7. Current public OpenCode docs use `/global/health`, `/provider` or provider/config endpoints, `/session`, `/session/:id/prompt_async`, `/session/:id/abort`, and `/event`; the installed `/doc` must verify exact local paths.
8. Public OpenCode docs also expose the typed `@opencode-ai/sdk` and `event.subscribe()`. The project should choose SDK **or** raw HTTP, not maintain both.
9. The repo uses `ai@6.0.177` + `@ai-sdk/provider@3.0.10`, while the OpenCode adapter currently implements `LanguageModelV2`. Verify whether migration to the current V3 provider interface is required before stream repair.
10. The current stream prototype has concrete lifecycle risks: unstable `Date.now()` IDs, unclear start/end stream parts, possible final-text loss at terminal events, ineffective abort plumbing, a no-op timeout, and TBD cursor logic.
11. Dynamic OpenCode model metadata declares `supportsVision: false`, but `parametricModelSupportsVision()` only checks static models and treats unknown IDs as vision-capable. Dynamic OpenCode models may therefore show attachment controls incorrectly.
12. `ConversationSettings` already persists `model` in a JSON settings field. A per-conversation `openCodeExecutionMode` likely needs no DB migration.
13. The current HTTP `formatPrompt()` explicitly disables tools/files. CLI vs Streaming agent semantics must be decided deliberately before transport behavior is changed.
14. `master` and `local-dev-continue` are diverged partly because planning docs were committed independently. Do not merge/rebase just to clean this up during feature work; reconcile in final merge hygiene.

## Task status

Legend: `TODO`, `IN PROGRESS`, `BLOCKED`, `DONE`, `SKIPPED`.

| Task | Status | Summary |
|---|---|---|
| P01 | TODO | Confirm branch/worktree/HEAD |
| P02 | TODO | Resolve `cliAgents.ts` discrepancy safely |
| P03 | TODO | Baseline typecheck/lint/build/test invocation |
| A01 | TODO | Trace CLI agent end-to-end |
| A02 | TODO | Trace existing HTTP adapter end-to-end |
| A03 | TODO | Build routing + capability matrix |
| A04 | TODO | Choose execution-mode persistence location |
| A05 | TODO | Decide agent-vs-model-wrapper semantics |
| B01 | TODO | Verify installed OpenCode API |
| B02 | TODO | Choose official OpenCode SDK vs raw HTTP |
| B03 | TODO | Verify AI SDK custom-model specification |
| C01 | TODO | Define canonical OpenCode base URL |
| C02 | TODO | Align start.sh/client/env template |
| C03 | TODO | Add optional Basic Auth support |
| C04 | TODO | Test config/health |
| D01 | TODO | Repair provider/model discovery |
| D02 | TODO | Repair session creation + async prompt |
| D03 | TODO | Implement one real event stream |
| D04 | TODO | Filter events by session |
| D05 | TODO | Correct AI SDK stream lifecycle |
| D06 | TODO | Flush terminal content before finish |
| D07 | TODO | Implement real cancellation + timeout |
| D08 | TODO | Add Streaming transport tests |
| E01 | TODO | Add execution-mode type + default |
| E02 | TODO | Persist mode per conversation |
| E03 | TODO | Add minimal transport selection boundary |
| E04 | TODO | CLI regression validation |
| F01 | TODO | Add CLI/Streaming selector near OpenCode model selection |
| F02 | TODO | Fix dynamic model capability lookup |
| F03 | TODO | Reuse existing chat state for progressive text |
| F04 | TODO | Wire Stop/Cancel per transport |
| F05 | TODO | UI tests/validation |
| G01 | TODO | Enforce CLI/Streaming semantic parity decision |
| G02 | TODO | Handle OpenCode permissions explicitly |
| G03 | TODO | Choose conversation-history owner |
| G04 | TODO | Optional persistent OpenCode sessions |
| H01 | TODO | Verify no whole-run global lock |
| H02 | TODO | Run two simultaneous Streaming jobs |
| H03 | TODO | Verify zero cross-talk |
| H04 | TODO | Verify tool/external-wait interleaving |
| H05 | TODO | Handle disconnect/error recovery |
| H06 | TODO | Add deterministic concurrency/error tests |
| I01 | TODO | Manual CLI regression |
| I02 | TODO | Manual Streaming test |
| I03 | TODO | Manual two-job test |
| I04 | TODO | Full project checks |
| I05 | TODO | Update documentation |
| I06 | TODO | Reconcile branch/planning divergence |
| I07 | TODO | Final diff review |

## P01 evidence template

```text
branch:
HEAD:
git status --short:
plan/status present:
```

## P02 evidence template

```text
cliAgents.ts: present+tracked | present+untracked/modified | absent
importing files:
notes:
```

## P03 baseline validation

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | NOT RUN | |
| `npm run lint` | NOT RUN | |
| `npm run build` | NOT RUN | |
| relevant existing Node test | NOT RUN | determine invocation first |

## A03 routing + capability matrix

Populate during A03.

| UI model ID | Backend provider | Adapter | Underlying model | Tools | Thinking | Vision as UI sees it | Notes |
|---|---|---|---|---|---|---|---|
| `agent/opencode/...` | TBD | TBD | TBD | TBD | TBD | TBD | |
| `opencode/...` if reachable | TBD | TBD | TBD | TBD | TBD | TBD | |
| Codex agent | TBD | TBD | TBD | TBD | TBD | TBD | |
| `local/qwen3.6-...` | TBD | TBD | TBD | TBD | TBD | TBD | |

## A04 persistence decision

Candidate:

```ts
ConversationSettings = {
  model?: Model
  openCodeExecutionMode?: 'cli' | 'streaming'
}
```

Chosen design: _TBD_

DB migration required: _TBD; expected NO if JSON settings are reused_

## A05 semantic decision

```text
OpenCode role: full agent | model wrapper | TBD
CLI tools/files/shell/workspace:
Streaming target tools/files/shell/workspace:
pCAD outer tools in OpenCode mode:
formatPrompt no-tools rule retained/removed:
permission strategy:
```

## B01 verified OpenCode contract

Populate from installed environment.

```text
opencode version:
serve help reviewed:
run help reviewed:
/doc reviewed:
health:
providers/models:
create session:
async prompt/message:
event stream:
abort:
permission response:
auth:
```

## B02 SDK decision

```text
@opencode-ai/sdk version considered:
compatible with installed server:
client construction:
event subscription:
auth/custom fetch support:
decision: SDK | raw HTTP
rationale:
```

## B03 AI SDK provider decision

```text
ai version: 6.0.177 (reviewed branch)
@ai-sdk/provider version: 3.0.10 (reviewed branch)
current adapter: LanguageModelV2
installed required interface:
required text lifecycle:
required reasoning lifecycle:
usage shape:
abort expectations:
migration required: YES | NO
```

## D06 terminal-content regression

Required case:

```text
one incoming OpenCode chunk/batch contains:
1. final message text/update
2. completion/session-idle event

expected: final text is emitted before finish
```

Result: _NOT TESTED_

## D07 cancellation/timeout audit

```text
local AbortController ownership:
external pCAD abort signal linkage:
OpenCode abort call:
event-stream abort:
timeout action:
CLI process cancellation:
```

## F02 capability regression

Required case:

```text
dynamic OpenCode model metadata: supportsVision=false
expected UI: image/STL vision attachment gate must not treat it as vision-capable
```

Result: _NOT TESTED_

## G03 history decision

Current reviewed HTTP strategy:

```text
fresh OpenCode session per pCAD request
+ pCAD sends formatted conversation context
```

Final history owner: _TBD_

Persistent OpenCode session: _TBD_

Full transcript resent with persistent session: must remain `NO`

## Single-writer concurrency rule

Current shared implementation workflow:

```text
ONE coding agent
    |
    v
Current next task
    |
    v
one patch + status update
    |
    v
next coding-agent run
```

Do not launch multiple agents against this same branch/status file simultaneously. For true parallel coding, create separate worktrees/branches and assign different task IDs.

## Implementation log template

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

None declared before P01/P02. P02 may reveal a real local-worktree blocker around `cliAgents.ts`; record it rather than guessing.

## Known risks

1. `cliAgents.ts` may be untracked local work.
2. OpenCode model-ID routing may currently be inconsistent.
3. OpenCode HTTP endpoints in the prototype may be obsolete.
4. Maintaining custom raw SSE may be unnecessary if the official SDK fits.
5. `LanguageModelV2` may be stale for the installed AI SDK 6/provider v3 stack.
6. Port/config mismatch: 4096 vs 14096.
7. Final text may be dropped at terminal events.
8. Current abort/timeout code may not actually cancel work.
9. Dynamic OpenCode models may be incorrectly treated as vision-capable.
10. CLI and Streaming may currently have different tool/file/workspace semantics.
11. Permission requests can deadlock or become unsafe if handled implicitly.
12. Persistent-session history can duplicate context if designed incorrectly.
13. A global whole-run lock would destroy useful llama-swap interleaving.
14. Global/mixed event streams can cause cross-talk without session filtering.
15. Two coding agents sharing this status file can race and overwrite each other.
16. `master`/feature-branch planning history will need deliberate final reconciliation.
17. 35B-class agents should read only the current task section, not repeatedly load the entire plan.

## Short prompt for coding agent

> Read `docs/opencode_streaming_status.md` first and work only on `Current next task`. Read the invariants and only that task's section from `docs/opencode_streaming_plan.md` unless more context is required. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Never discard/reset/clean/overwrite uncommitted or untracked user work and never overwrite a local `src/server/cliAgents.ts`. Trust installed OpenCode `--version`, CLI `--help`, server `/doc`, and installed AI SDK/provider types over assumptions. Implement exactly one task, run the smallest relevant validation, update this status file with evidence/result, set the next task only if DONE, then stop. Only one coding agent may write to this branch/status file at a time.