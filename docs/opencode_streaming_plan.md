# OpenCode CLI + Streaming Implementation Plan

Reviewed: 2026-08-14 (fourth/final pre-implementation review)

Status: `docs/opencode_streaming_status.md`

## Goal

Preserve the current OpenCode **CLI agent** path and add a selectable **Streaming** path using a running `opencode serve` instance.

The user-visible choice is:

- `CLI` — preserve the current CLI-based OpenCode behavior.
- `Streaming` — preserve the same intended OpenCode agent behavior, but receive live server events/text instead of waiting for CLI completion.

The transport may change; agent semantics must not change accidentally.

---

## Important review findings

These were verified against the pushed `local-dev-continue` branch and current public docs. The installed local versions remain authoritative during implementation.

1. The feature code is on `local-dev-continue`. The branch head after the third-review planning commits was `388ee3feb73a5def86b18a49ef4e2f1d703a2a46`.
2. `src/server/opencode.ts` already contains an HTTP/SSE prototype. **Repair or replace deliberately; do not add a second streaming stack.**
3. `src/server/aiChat.ts` imports both `opencodeChatModel` and `cliAgentChatModel`/`isCliAgentModel`.
4. `src/routes/api/opencode/models.ts` imports `configuredCodexModels` from `src/server/cliAgents`.
5. `src/server/cliAgents.ts` is missing from the pushed branch tree even though it is imported. It may be untracked/local user work. Never overwrite it before checking the worktree.
6. The models route returns IDs shaped like `agent/opencode/...`, while the reviewed HTTP route recognizes `opencode/...` directly. Exact routing depends on the missing `isCliAgentModel()` implementation and must be mapped before changes.
7. `start.sh` starts OpenCode on port `4096`; reviewed `src/server/opencode.ts` defaults to `14096` when `OPENCODE_PORT` is unset.
8. `start.sh` currently health-checks `/api/model`. Current public OpenCode docs instead document `/global/health`; the installed server `/doc` decides what is correct locally.
9. The existing HTTP prototype uses `/api/model`, `/api/session`, `/api/session/{id}/prompt`, and `/api/session/{id}/event`. Current public docs instead document `/provider` or `/config/providers`, `/session`, `/session/:id/prompt_async`, `/session/:id/abort`, and `/event`.
10. Current public OpenCode docs expose a type-safe `@opencode-ai/sdk` with `createOpencodeClient()` and `event.subscribe()`. Evaluate that before maintaining a hand-written SSE parser.
11. The current HTTP prototype creates a fresh OpenCode session per request and sends formatted pCAD conversation text. Persistent session reuse is **not required** for initial streaming.
12. Never combine a persistent OpenCode session with resending the whole pCAD transcript each turn.
13. `formatPrompt()` currently tells the HTTP path not to use tools/files. That may differ from the CLI agent. Streaming must not silently become a different kind of agent.
14. The current custom OpenCode adapter implements `LanguageModelV2`, while the repo uses `ai@6.0.177` and `@ai-sdk/provider@3.0.10`. AI SDK 6's current custom-provider specification is V3. Verify whether this adapter should be migrated to `LanguageModelV3` before repairing stream details.
15. The reviewed HTTP stream code has concrete lifecycle risks: unstable `Date.now()` part IDs, unclear text/reasoning start/end events, final text potentially skipped when completion arrives in the same event batch, no-op timeout behavior, ineffective abort plumbing, and TBD cursor logic.
16. Dynamic OpenCode models declare `supportsVision: false`, but `parametricModelSupportsVision()` only checks the static `PARAMETRIC_MODELS` list and defaults unknown IDs to `true`. Dynamic OpenCode models can therefore be treated as vision-capable unless capability lookup is fixed.
17. `ConversationSettings` already lives in the `conversations.settings` JSON field and currently persists `model`. This is a strong candidate for a per-conversation `openCodeExecutionMode` without a DB schema migration.
18. `master` and `local-dev-continue` are currently diverged mainly because planning docs were independently committed to both branches. Do not casually merge/rebase just to silence that divergence. Reconcile planning docs during final merge hygiene.

---

## Coding-agent operating rules

### Single-writer rule

**Default: run coding agents serially, one at a time.**

This plan uses one shared branch and one shared status file. Two agents reading the same `Current next task` at the same time will race and can overwrite each other.

If parallel execution is ever desired, use separate worktrees/branches and explicitly assign non-overlapping task IDs. Do not let parallel agents share this status file directly.

### Context-budget rule for Qwen3.6 35B-class agents

Do **not** load this entire document on every run unless necessary.

Each run should:

1. read the status file;
2. identify `Current next task`;
3. read the invariants above plus only that task's section and required prior findings;
4. inspect only the relevant code files;
5. implement exactly one task.

### Repository safety

At the start of every run:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

Rules:

- Work on `local-dev-continue` unless status explicitly changes the target.
- Never use `git reset --hard`, `git clean`, or discard local changes.
- Never overwrite an untracked/modified `src/server/cliAgents.ts`.
- Never use `git add -A` around unrelated user work.
- Do not merge/rebase `master` during implementation unless explicitly assigned a merge-hygiene task.
- Do not push/commit unrelated files.
- Stop on an unexplained worktree conflict instead of guessing.

### Technical invariants

- CLI remains available and compatible.
- Streaming is an additional transport, not a replacement.
- No silent CLI <-> Streaming fallback.
- pCAD talks to OpenCode; it does not call llama-swap directly from this feature.
- No application-level lock for the lifetime of a whole OpenCode agent job.
- Multiple OpenCode jobs may coexist while llama.cpp serializes inference with `--parallel 1`.
- Installed `opencode --version`, CLI `--help`, and server `/doc` override assumptions in this plan.
- Installed AI SDK/provider types override assumptions about stream-part shapes.
- Do not silently auto-approve OpenCode permissions.
- Do not expose hidden chain-of-thought/reasoning unless pCAD already intentionally supports it.

---

# Phase P — Preflight

No feature code before P01-P03 are complete.

## P01 — Confirm branch/worktree/HEAD

- Run the three repository-state commands.
- Confirm `local-dev-continue`.
- Record HEAD and `git status --short`.
- Confirm plan/status files are present.

**Done when:** state is recorded and no user file changed.

## P02 — Resolve `cliAgents.ts` discrepancy

Audit only.

- Check whether `src/server/cliAgents.ts` exists locally.
- Classify it as `present+tracked`, `present+untracked/modified`, or `absent`.
- List all imports/references.
- If local/untracked, inspect and preserve it exactly.
- If absent, document the broken imports; do not invent the implementation in this task.

**Done when:** status contains the classification and importing files.

## P03 — Baseline validation

Determine current test invocation first, then run:

```bash
npm run typecheck
npm run lint
npm run build
```

Also run one existing `node:test` test if practical.

Record pre-existing failures separately. Do not fix unrelated failures here.

---

# Phase A — Architecture and compatibility audit

## A01 — Trace the CLI agent end-to-end

Record:

- UI model ID;
- `providerFor()` result;
- `isCliAgentModel()` result;
- CLI adapter;
- exact `opencode run` command/flags;
- model/agent selection;
- `--dir`/working-directory behavior;
- output/JSON parsing;
- timeout/cancellation;
- whether CLI starts its own server or uses `--attach`.

No behavior change.

## A02 — Trace the existing HTTP adapter end-to-end

Record:

- model discovery;
- session creation;
- prompt body;
- event acquisition;
- text/reasoning conversion;
- completion detection;
- abort/timeout;
- session lifetime.

Also record whether `LanguageModelV2` is passing through compatibility mode in the installed AI SDK.

No behavior change.

## A03 — Build routing + capability matrix

Create a matrix for at least:

- `agent/opencode/...`;
- `opencode/...` if reachable;
- Codex agent IDs;
- direct `local/qwen3.6-...` IDs.

For each record:

```text
UI ID -> backend provider -> adapter -> underlying provider/model
```

Also record `supportsTools`, `supportsThinking`, and `supportsVision` as seen by the **actual UI**, not just route metadata.

Explicitly verify the dynamic-OpenCode vision mismatch caused by `parametricModelSupportsVision()`.

No fix yet.

## A04 — Choose execution-mode persistence location

Audit existing conversation settings flow.

Preferred starting design, unless audit finds a blocker:

```ts
ConversationSettings = {
  model?: Model
  openCodeExecutionMode?: 'cli' | 'streaming'
  ...
}
```

Reasons:

- `conversations.settings` is already JSON;
- model selection is already per conversation;
- no profile/DB schema migration should be needed;
- retries/follow-ups can retain the same transport.

Compare this with encoding transport into model IDs. Record the chosen design before coding it.

## A05 — Decide semantic target: agent vs model wrapper

This decision is critical.

Compare current CLI behavior with the HTTP prototype and answer:

- Is OpenCode intended to act as a full OpenCode agent, or only as a language-model wrapper inside pCAD's own agent loop?
- Should OpenCode tools/files/shell/workspace be available in Streaming mode?
- Should pCAD tools still be driven by the outer AI SDK loop?
- Does the current `formatPrompt()` "no tools/files" rule preserve or violate CLI behavior?

**Required invariant:** Streaming should match CLI's intended agent behavior unless a difference is explicitly documented and approved.

Do not redesign transport until this is written down.

---

# Phase B — Verify external contracts before implementation

This phase intentionally comes **before** server-config and streaming repairs.

## B01 — Verify installed OpenCode API

Run:

```bash
opencode --version
opencode serve --help
opencode run --help
```

Start/use the configured server and inspect:

```text
GET http://127.0.0.1:4096/doc
```

Record actual installed paths/bodies for:

- health;
- providers/models;
- session creation;
- async prompt/message;
- event stream;
- abort;
- permission response;
- authentication.

Create a migration table from every current `/api/...` call to the verified API.

## B02 — Evaluate official OpenCode SDK vs raw HTTP

Current public docs provide `@opencode-ai/sdk`, `createOpencodeClient()`, typed API methods, and `event.subscribe()`.

Evaluate using the installed OpenCode version:

**SDK option**

- client-only; do not use `createOpencode()` to spawn another server;
- version compatibility with installed OpenCode;
- auth/custom fetch support;
- session/prompt/abort support;
- event stream support;
- testability.

**Raw HTTP option**

- only if SDK introduces unacceptable version/dependency constraints or lacks required API.

Record one decision. Do not maintain both implementations.

## B03 — Verify AI SDK custom-model specification

Repo review shows:

```text
ai: 6.0.177
@ai-sdk/provider: 3.0.10
current OpenCode adapter: LanguageModelV2
```

Inspect installed types/docs and decide whether the adapter must migrate to `LanguageModelV3` / specification V3.

Record:

- required model interface version;
- required usage shape;
- required text/reasoning stream-part lifecycle;
- stable ID requirements;
- abort expectations.

Do not repair individual stream events before this decision.

---

# Phase C — Server configuration and startup

## C01 — Define one canonical OpenCode base URL

Prefer one server-side setting, e.g.:

```text
OPENCODE_BASE_URL=http://127.0.0.1:4096
```

Use the installed/default server behavior verified in B01.

## C02 — Align `start.sh`, client, and env template

- same base URL/default port;
- health-check the verified health endpoint;
- remove stale `/api/model` startup probing if invalid;
- document configuration;
- bind loopback by default.

Ensure an already-running server is detected without a 20-second false startup wait.

## C03 — Optional Basic Auth support

If `OPENCODE_SERVER_PASSWORD` is configured:

- server-side client can authenticate;
- username follows installed OpenCode behavior;
- credentials never reach browser code.

If no auth is configured for local loopback use, do not require it.

## C04 — Config/health tests

Test default URL, configured URL, unavailable server, and auth if implemented.

---

# Phase D — Repair/modernize the existing Streaming transport

Use only contracts chosen in Phase B.

## D01 — Provider/model discovery

- migrate stale discovery endpoint/API;
- keep model IDs stable where possible;
- retain CLI discovery fallback only if it has a demonstrated purpose.

## D02 — Session creation + async prompt

- use verified session-create shape;
- use verified asynchronous prompt/message shape;
- keep the current **fresh session per pCAD request** strategy initially;
- send model/agent/tools/parts according to A05 semantic decision.

## D03 — One real event stream

If SDK chosen, use its event subscription.

If raw HTTP chosen:

- consume SSE incrementally from the response body;
- handle split frames;
- handle multiple events per chunk;
- do not poll/download full event history unless the installed API explicitly requires it.

Prefer instance `/event` over global events unless the verified architecture requires `/global/event`.

## D04 — Session event filtering

- identify session ID from verified event shapes;
- ignore unrelated sessions;
- never update another pCAD conversation.

Do not build a process-global event multiplexer yet unless evidence shows per-job subscriptions are inadequate.

## D05 — Correct AI SDK stream lifecycle

Based on B03:

- use correct provider specification version;
- emit required text start/delta/end events;
- keep one stable text-part ID per part;
- do the same for reasoning only if reasoning should be exposed;
- emit correct finish/error/usage structures.

## D06 — Flush terminal content correctly

Regression case:

```text
same incoming OpenCode event chunk/batch:
1. final text/message update
2. completion/session-idle event
```

The final text must be emitted **before** finish.

## D07 — Real cancellation + timeout

- own/use a real AbortController where necessary;
- external pCAD Stop signal aborts local fetch/event consumption;
- call verified OpenCode abort endpoint for the active session when appropriate;
- timeout actually aborts/fails;
- remove no-op timeout/abort logic.

## D08 — Streaming transport tests

At minimum:

- model discovery;
- session create;
- async prompt;
- split SSE frame;
- multiple events/chunk;
- unrelated-session filtering;
- stable text lifecycle;
- final-text + completion same chunk;
- abort;
- timeout;
- server error.

No live model/GPU required.

---

# Phase E — Add execution-mode selection

Do this only after CLI baseline and Streaming transport are understood/testable.

## E01 — Add execution-mode type + default

Add the type chosen in A04.

Default old conversations to `cli` for compatibility unless A01 proves another baseline.

## E02 — Persist mode per conversation

Preferred: extend `ConversationSettings` JSON type and reuse the existing `updateConversation` merge pattern.

No DB migration unless the audit proves it is actually required.

## E03 — Minimal transport selection boundary

Route one application-facing OpenCode request to:

- existing CLI adapter when mode=`cli`;
- repaired HTTP/SDK adapter when mode=`streaming`.

Do not build a generic agent framework.

## E04 — CLI regression

Verify CLI command, model, workspace, output, failure, and cancellation remain unchanged.

---

# Phase F — UI integration and model capabilities

## F01 — Add CLI/Streaming selector near OpenCode model selection

Prefer a conversation/editor control near the model selector rather than account-wide Settings unless A04 found a better existing pattern.

Only show the transport selector when an OpenCode-agent model is selected if that is consistent with routing.

## F02 — Fix dynamic model capability lookup

Ensure dynamic OpenCode model metadata is actually used for UI capability gates.

Regression test:

```text
OpenCode model with supportsVision=false
=> image/STL attachment controls are not incorrectly enabled as vision input
```

Do not break legacy unknown-model fallback without an explicit migration decision.

## F03 — Progressive response UI

Reuse existing pCAD assistant-message/AI SDK stream state. Do not create a second chat store.

## F04 — Stop/Cancel UI

- CLI -> CLI cancellation;
- Streaming -> Streaming cancellation;
- no implicit transport switch.

## F05 — UI tests/validation

Test selector persistence, correct transport invocation, capability gates, progressive text, completion/error, and Stop.

---

# Phase G — Agent semantics, permissions, and history

## G01 — Enforce CLI/Streaming semantic parity decision

Implement only what A05 decided.

If Streaming is a full OpenCode agent, ensure model/agent/workspace/tool behavior matches CLI as closely as possible.

If it is intentionally a model wrapper, document that clearly.

## G02 — Permission handling

If OpenCode tools are enabled in Streaming mode:

- identify permission-request events;
- choose an explicit policy: existing trusted OpenCode config, user-visible approval, or another documented mechanism;
- never silently auto-approve dangerous operations just to avoid blocking;
- test a permission-required run.

If tools are intentionally disabled, mark this task `SKIPPED` with rationale.

## G03 — Choose history owner

Initial low-risk strategy matching the prototype:

```text
pCAD owns history
+ fresh OpenCode session per pCAD request
+ pCAD sends needed conversation context
```

Optional later strategy:

```text
OpenCode owns history
+ persistent session per pCAD conversation
+ pCAD sends only new turn/context delta
```

Never use persistent OpenCode history **and** resend the full transcript.

## G04 — Optional persistent OpenCode sessions

Implement only if G03 deliberately chooses OpenCode-owned history. Otherwise `SKIPPED` is correct.

---

# Phase H — Concurrency and recovery

## H01 — Verify no whole-run global lock

pCAD must not reserve OpenCode/llama-swap for one agent's entire job.

## H02 — Two simultaneous Streaming jobs

Run session A and B concurrently at application level.

## H03 — Zero cross-talk

A's text/status/tools only update A; B only updates B.

## H04 — Tool/external-wait interleaving

Desired behavior with llama.cpp `--parallel 1`:

```text
A: model request
A: tool/external wait
B: model request
B: tool/external wait
A: next model request
```

## H05 — Disconnect/error recovery

Handle:

- server unavailable;
- prompt error;
- SSE/event disconnect;
- malformed/unknown event;
- CLI process error.

No tight reconnect loops and no silent fallback.

## H06 — Deterministic concurrency/error tests

Mock interleaved A/B events and failure cases. No live GPU/model required.

---

# Phase I — Final validation and merge hygiene

## I01 — Manual CLI regression

Select CLI, run a normal task, verify response and cancellation.

## I02 — Manual Streaming test

Select Streaming, run a normal task, verify progressive text, agent behavior, completion, and cancellation.

## I03 — Manual two-job test

Start A, let A wait on a tool/external service, start B, verify B progresses, then verify A resumes without cross-talk.

## I04 — Full project checks

```bash
npm run typecheck
npm run lint
npm run build
```

Run all relevant Node tests using the repository's established command.

## I05 — Documentation

Document:

- CLI vs Streaming;
- selector persistence;
- OpenCode base URL/auth;
- server start command;
- agent/tool semantics;
- permissions behavior;
- history ownership;
- concurrency;
- troubleshooting.

## I06 — Reconcile branch/planning divergence

Before merging to `master`:

- fetch latest `master`;
- compare it with `local-dev-continue`;
- confirm whether master changed in runtime code since the original feature branch point;
- reconcile duplicate planning-doc history/content deliberately;
- do not lose newer plan/status content;
- resolve conflicts in a dedicated merge step, not inside an unrelated implementation task.

## I07 — Final diff review

Confirm:

- CLI remains functional;
- Streaming uses one implementation only;
- OpenCode API matches installed `/doc`;
- official SDK/raw-HTTP decision is documented;
- AI SDK provider spec/lifecycle is correct;
- one canonical server URL exists;
- dynamic model capabilities are correct;
- Stop and timeout really cancel;
- final text cannot be dropped on completion;
- no direct llama-swap call was added;
- no whole-run global lock exists;
- no history duplication exists;
- permissions are explicit;
- no unrelated refactors were introduced.

---

# Definition of Done

- [ ] Existing OpenCode CLI mode works.
- [ ] OpenCode Streaming mode works.
- [ ] User can choose mode per the selected persistence design.
- [ ] Old conversations default safely to CLI.
- [ ] Streaming reuses/replaces the existing prototype deliberately; no duplicate stack.
- [ ] Installed OpenCode `/doc` is the API source of truth.
- [ ] SDK vs raw HTTP is a deliberate single choice.
- [ ] Custom AI SDK adapter uses the correct installed provider specification.
- [ ] Stream text is progressive, ordered, complete, and non-duplicated.
- [ ] Dynamic model capabilities such as vision are respected.
- [ ] Stop and timeout actually cancel work.
- [ ] CLI and Streaming have intentional, documented agent/tool/workspace behavior.
- [ ] Permission behavior is explicit.
- [ ] Multiple jobs coexist without event cross-talk or whole-run locking.
- [ ] History has one owner and cannot be duplicated.
- [ ] Automated tests do not require a live model/GPU.
- [ ] typecheck/lint/build pass, or only explicitly documented pre-existing failures remain.
- [ ] final branch merge is deliberate and conflict-safe.

## Short prompt for each coding-agent run

> Read `docs/opencode_streaming_status.md` first. Work only on `Current next task`. Read the invariants and only that task's section from `docs/opencode_streaming_plan.md`, not the whole plan unless needed. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Never discard/reset/clean/overwrite uncommitted or untracked user work, and never overwrite a local `src/server/cliAgents.ts`. For OpenCode trust installed `opencode --version`, CLI `--help`, and server `/doc`; for AI SDK trust installed provider types. Implement exactly one task, run the smallest relevant validation, update the status file with evidence/result, set the next task only if DONE, then stop. Only one coding agent may write to this branch/status file at a time.
