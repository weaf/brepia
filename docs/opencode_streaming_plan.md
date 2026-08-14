# OpenCode CLI + Streaming Implementation Plan

Reviewed: 2026-08-14 (third review)

Status tracking: `docs/opencode_streaming_status.md`

## Goal

Keep the OpenCode CLI execution path and add a selectable OpenCode Streaming execution path using `opencode serve`.

The user must be able to choose:

- `CLI` — OpenCode is invoked through the CLI path.
- `Streaming` — pCAD talks to the OpenCode HTTP server and receives live events/text.

Do not remove a working CLI path. Do not build a second HTTP/SSE stack beside reusable code that already exists.

## Repository facts found during review

These are evidence from the pushed `local-dev-continue` branch at code commit `01336488828a003e8870efa8229ae9e1dbcc8003`.

1. `src/server/opencode.ts` already contains an HTTP/SSE prototype implemented as an AI SDK `LanguageModelV2` adapter.
2. `src/server/aiChat.ts` imports both `opencodeChatModel` and `cliAgentChatModel`/`isCliAgentModel`, so CLI and HTTP transports are already conceptually separate.
3. `src/routes/api/opencode/models.ts` also imports `configuredCodexModels` from `src/server/cliAgents`.
4. `src/server/cliAgents.ts` is **not present in the pushed branch tree**, despite those imports. It may exist only in the local worktree. Never overwrite an untracked/local copy.
5. Dynamic model IDs returned by the reviewed models route use an `agent/opencode/...` prefix, while reviewed `aiChat.ts` explicitly recognizes `opencode/...` for the HTTP provider. The missing `isCliAgentModel()` implementation may explain the intended routing, so do not guess. Build an exact routing matrix before changing IDs.
6. `start.sh` starts OpenCode on port `4096`, while reviewed `src/server/opencode.ts` defaults to `14096` when `OPENCODE_PORT` is unset.
7. `start.sh` health-checks `/api/model`; reviewed `src/server/opencode.ts` also uses `/api/...` routes.
8. Current public OpenCode documentation (2026-08 review) documents `opencode serve` defaulting to `127.0.0.1:4096`, OpenAPI at `/doc`, health at `/global/health`, sessions at `/session`, async prompting at `/session/:id/prompt_async`, abort at `/session/:id/abort`, and SSE at `/event` or `/global/event`. **The installed server's `/doc` remains authoritative for this project.**
9. The reviewed prototype creates a new OpenCode session for every model request and sends formatted pCAD conversation text in that request.
10. Therefore persistent OpenCode session reuse must not later be combined with resending the whole pCAD transcript, or history will be duplicated and context wasted.
11. `formatPrompt()` currently tells the HTTP path not to use tools, files, or the app's tools. Transport changes must not silently change those semantics.
12. The existing HTTP prototype has several stream-lifecycle concerns that require explicit tests before it is trusted:
    - it emits text/reasoning deltas without clearly emitting matching start/end parts;
    - delta IDs are generated with `Date.now()`, so successive chunks may not share a stable part ID;
    - a terminal event is checked before the code below it extracts/yields newly received text, so final text in the same event batch may be skipped;
    - the current timeout callback does not abort anything;
    - dispatching an `abort` event on an `AbortSignal` is not the same as aborting an `AbortController`;
    - cursor handling is marked TBD and the event code accumulates events across polls.
13. The repository has no `npm test` script in the reviewed `package.json`; existing tests use `node:test`. Determine the actual invocation before adding a new test framework.
14. Current OpenCode CLI docs support `opencode run`, `--format json`, `--session`, `--attach`, `--dir`, `--model`, `--agent`, and cancellation via the spawned process. Preserve the existing local CLI behavior first; consider `--attach` only as a later explicit optimization.

## Working rules for coding agents

1. Work on **exactly one task ID per run**.
2. Read this plan and the status file first.
3. Start every run with:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

4. Work on `local-dev-continue` unless the status file explicitly changes the target branch.
5. Never `reset --hard`, `clean`, discard, overwrite, or replace uncommitted/untracked user work.
6. Especially protect any local/untracked `src/server/cliAgents.ts`.
7. Inspect current code before editing; do not assume this review is newer than the worktree.
8. For OpenCode behavior, trust the installed `opencode --version`, `opencode ... --help`, and running server `/doc` over this plan or web documentation.
9. For AI SDK stream protocol, inspect the installed `@ai-sdk/provider` types/version and existing project usage before changing the adapter.
10. Keep each change small enough for a local 35B-class model to reason about in one context window.
11. No unrelated refactors.
12. Do not add a global lock around an entire OpenCode agent run.
13. pCAD must not call llama-swap directly from this transport; OpenCode owns provider/model access.
14. Do not silently change OpenCode tool/file/workspace/permission semantics while changing transport.
15. No silent fallback from Streaming to CLI or CLI to Streaming.
16. Run the smallest relevant validation after the task.
17. Update the status file before stopping.
18. Mark a task `DONE` only after its acceptance condition is met.
19. If blocked, mark `BLOCKED`, record exact evidence, and stop rather than guessing.

## Target architecture

```text
existing pCAD chat flow
        |
        v
OpenCode execution-mode selection
        |
   +----+----+
   |         |
   v         v
 CLI       Streaming
transport  transport
   |         |
   |         +--> opencode serve
   |                 |
   +-----------------+--> OpenCode agent/provider/model
                              |
                              v
                          llama-swap
                              |
                              v
                          local Qwen
```

The transport boundary should be small. Do not create a generic agent framework unless current code genuinely requires one.

---

# Phase P — Preflight and integrity

No feature implementation before Phase P is complete.

## P01 — Confirm branch, worktree, and HEAD

- [ ] Run the three repository-state commands.
- [ ] Confirm current branch.
- [ ] Record HEAD.
- [ ] Record modified/untracked files without changing them.
- [ ] Confirm both plan/status files are present in the current branch.

**Acceptance:** repository state is documented and no user file was changed.

## P02 — Resolve `cliAgents.ts` discrepancy

Audit only unless the file is proven absent.

- [ ] Check whether `src/server/cliAgents.ts` exists locally.
- [ ] Check whether it is tracked, modified, or untracked.
- [ ] Inspect every import/reference.
- [ ] If local/untracked, preserve it exactly and document its role.
- [ ] If genuinely absent, record unresolved imports and stop this task as `DONE` audit evidence; do not invent the implementation yet.

**Acceptance:** classify it as `present+tracked`, `present+untracked/modified`, or `absent` and list importing files.

## P03 — Establish CLI compatibility baseline

If `cliAgents.ts` exists, inspect it rather than rewriting it.

If it is genuinely absent, implement only the smallest missing CLI transport needed by the existing imports/commit intent. Verify the installed `opencode run --help` first.

Record:

- [ ] exact command/flags;
- [ ] model-ID format;
- [ ] working directory behavior;
- [ ] stdout/stderr or JSON-event parsing;
- [ ] process cancellation/timeout behavior;
- [ ] whether it starts its own OpenCode server or uses `--attach`.

Do not edit the HTTP streaming prototype in this task.

## P04 — Baseline validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Also determine how the existing `node:test` files are actually invoked and run one relevant existing test if practical.

- [ ] Record all results.
- [ ] Separate pre-existing failures from new failures.
- [ ] Do not fix unrelated failures here.

---

# Phase A — Exact architecture audit

## A01 — Trace CLI routing end-to-end

- [ ] picker model ID -> request model ID -> `providerFor()` -> `isCliAgentModel()` -> CLI adapter;
- [ ] command construction;
- [ ] workspace/`--dir` behavior;
- [ ] output parsing;
- [ ] cancellation.

No code changes.

## A02 — Trace existing HTTP prototype end-to-end

- [ ] model discovery;
- [ ] session create;
- [ ] prompt submission;
- [ ] event connection/parsing;
- [ ] AI SDK stream parts;
- [ ] completion/error detection;
- [ ] abort/timeout.

No code changes.

## A03 — Build the model-ID/routing matrix

Create a status-file table for examples such as:

```text
UI id -> providerFor result -> adapter -> underlying OpenCode model id
```

Explicitly verify:

- [ ] `agent/opencode/...`;
- [ ] any `opencode/...` IDs;
- [ ] Codex agent IDs;
- [ ] local direct-provider Qwen IDs.

**Acceptance:** no ambiguous or unreachable transport path remains undocumented.

## A04 — Trace settings persistence

- [ ] identify existing settings store/persistence;
- [ ] identify suitable UI location for execution mode;
- [ ] decide whether execution mode is global, per-user, or per-conversation based on current architecture.

Do not implement yet.

## A05 — Document behavior semantics

For CLI and Streaming separately record:

- [ ] OpenCode tools enabled/disabled;
- [ ] file read/write capability;
- [ ] shell capability;
- [ ] workspace/project directory;
- [ ] permission behavior;
- [ ] pCAD tool behavior;
- [ ] conversation-history source.

No semantic changes in this task.

---

# Phase B — Selectable execution mode

## B01 — Define execution-mode type

Conceptually:

```ts
type OpenCodeExecutionMode = 'cli' | 'streaming'
```

Follow current project conventions.

## B02 — Add backward-compatible default

- [ ] default to current working CLI behavior unless the audit proves a different current baseline;
- [ ] deterministic handling of missing/old settings.

## B03 — Persist mode

- [ ] use the existing persistence mechanism from A04;
- [ ] no second settings store.

## B04 — Add selector UI

- [ ] clear labels `CLI` and `Streaming`;
- [ ] reuse existing components;
- [ ] active mode is visible.

## B05 — Test setting/selector

- [ ] default;
- [ ] set CLI;
- [ ] set Streaming;
- [ ] persistence/reload.

## B06 — Validate phase

- [ ] focused tests;
- [ ] typecheck;
- [ ] build if UI/types require it.

---

# Phase C — Minimal transport boundary

## C01 — Define only required shared operations

Likely operations:

```text
run/send prompt
emit/stream result parts
cancel
```

Do not over-generalize.

## C02 — Put existing CLI path behind boundary

Mechanical change only. Preserve command/flags/output behavior.

## C03 — Put existing HTTP prototype behind boundary

Reuse `src/server/opencode.ts`; do not create another SSE client.

## C04 — Route by selected execution mode

- [ ] CLI -> CLI transport;
- [ ] Streaming -> HTTP transport;
- [ ] no silent fallback.

## C05 — CLI regression validation

- [ ] model selection;
- [ ] successful run;
- [ ] visible failure;
- [ ] cancellation if supported.

---

# Phase D — Canonical OpenCode server configuration

## D01 — Choose one base-URL configuration

Prefer a canonical URL rather than separate hard-coded host/port values.

Default should match the verified installed OpenCode server; current public docs use `http://127.0.0.1:4096`.

## D02 — Align `start.sh`, env template, and client

- [ ] same default host/port;
- [ ] no stale `/api/model` health probe if installed `/doc` says otherwise;
- [ ] document env variable;
- [ ] loopback by default.

## D03 — Implement verified health check

Use the endpoint verified in Phase E (public docs currently document `/global/health`).

## D04 — Handle optional server authentication

- [ ] if `OPENCODE_SERVER_PASSWORD`/username is configured, server-side requests can authenticate;
- [ ] never expose credentials to browser code;
- [ ] do not require auth for the normal local-only setup unless configured.

## D05 — Config/health tests

- [ ] default URL;
- [ ] configured URL;
- [ ] unavailable server;
- [ ] auth path if implemented.

---

# Phase E — Verify installed OpenCode contract

No runtime migration in this phase.

## E01 — Record installed version

```bash
opencode --version
```

## E02 — Inspect server `/doc`

Start/use the configured OpenCode server and inspect its OpenAPI spec.

## E03 — Record required operations

Verify actual installed paths/body shapes for:

- [ ] health;
- [ ] providers/models;
- [ ] create session;
- [ ] async prompt/message;
- [ ] SSE/events;
- [ ] abort;
- [ ] auth if configured.

## E04 — Create prototype migration table

For every current `/api/...` call, record:

```text
current path/body -> installed verified path/body -> required change
```

---

# Phase F — Repair/modernize the existing Streaming adapter

Only use API details verified in Phase E.

## F01 — Fix provider/model discovery

- [ ] migrate stale endpoint/body assumptions;
- [ ] preserve stable UI/model IDs where possible;
- [ ] keep CLI fallback only if audit says it is still useful.

## F02 — Fix session creation

- [ ] use verified create-session body;
- [ ] keep current one-session-per-request history strategy for now.

## F03 — Fix async prompt submission

- [ ] use verified async endpoint/body;
- [ ] pass model/agent/tools/parts only according to verified API and documented semantic choice.

## F04 — Implement one real SSE connection

- [ ] use verified `/event` or `/global/event` behavior;
- [ ] parse incremental SSE frames from the response body;
- [ ] do not repeatedly download a whole event history unless installed API explicitly requires polling;
- [ ] handle chunk boundaries and multiple events per chunk.

## F05 — Filter events by session

- [ ] identify session ID from real event shape;
- [ ] ignore unrelated sessions;
- [ ] support simultaneous A/B sessions without cross-talk.

## F06 — Fix AI SDK text/reasoning part lifecycle

Inspect installed `@ai-sdk/provider` types/version first.

- [ ] emit required `text-start` before text deltas;
- [ ] use one stable text-part ID across start/deltas/end;
- [ ] emit matching `text-end`;
- [ ] do the equivalent for reasoning if reasoning is exposed;
- [ ] do not expose hidden chain-of-thought if the product does not intentionally support it.

## F07 — Flush final content before completion

- [ ] process/yield newly received message parts before acting on `session.idle`/completion or equivalent terminal event;
- [ ] add a test where final text and terminal event arrive in the same SSE chunk/batch;
- [ ] ensure zero final-token loss.

## F08 — Fix cancellation and timeout plumbing

- [ ] use a real `AbortController`/linked signal where needed;
- [ ] `Stop` must actually abort in-flight fetch/event reading and call verified OpenCode session abort when appropriate;
- [ ] timeout must actually trigger cancellation/error;
- [ ] remove no-op timeout/abort code.

## F09 — Focused Streaming adapter tests

Use existing repository test conventions.

- [ ] session creation;
- [ ] async prompt;
- [ ] SSE split frames;
- [ ] multiple events in one chunk;
- [ ] session filtering;
- [ ] stable text lifecycle IDs;
- [ ] final text + terminal event same chunk;
- [ ] abort;
- [ ] timeout;
- [ ] server error.

---

# Phase G — Internal event adaptation

## G01 — Define minimal pCAD event/state representation

Only what the existing UI needs: text, high-level status/tool activity, error, complete.

## G02 — Map OpenCode message parts without duplication

Determine whether OpenCode event parts are deltas, snapshots, or updates by part ID.

Acceptance:

```text
Hello
Hello world
Hello world!
```

must render exactly `Hello world!`, not concatenated snapshots.

## G03 — Completion/error mapping

- [ ] deterministic completion;
- [ ] useful errors;
- [ ] partial answer preservation where sensible.

## G04 — Useful activity only

- [ ] reuse existing pCAD activity/tool UI if available;
- [ ] do not dump raw event JSON;
- [ ] do not display hidden reasoning content unless explicitly intended.

## G05 — Event mapping tests

- [ ] delta/update sequence;
- [ ] snapshot/update-by-ID sequence;
- [ ] completion;
- [ ] error;
- [ ] unknown event.

---

# Phase H — Existing chat UI integration

## H01 — Reuse current assistant-message state

No second chat store.

## H02 — Show progressive Streaming text

Text grows while OpenCode runs and keeps existing Markdown/rendering behavior.

## H03 — Show completion/error state

Loading state ends correctly; partial output/error behavior is deliberate.

## H04 — Wire Stop/Cancel per transport

- [ ] CLI -> CLI process/session cancellation;
- [ ] Streaming -> verified HTTP session abort + local fetch abort;
- [ ] no transport switching.

## H05 — UI validation

- [ ] focused tests where practical;
- [ ] typecheck;
- [ ] build.

---

# Phase I — Concurrency and isolation

## I01 — Verify no whole-agent-run global lock

Do not serialize an entire OpenCode run in pCAD.

## I02 — Two simultaneous Streaming jobs

A and B may both be active at application level.

## I03 — Zero cross-talk

A events update only A; B events update only B.

## I04 — Tool/external-wait interleaving

Desired behavior with llama.cpp `--parallel 1`:

```text
A: model request
A: tool/external wait
B: model request
B: tool/external wait
A: next model request
```

## I05 — Deterministic interleaving test

Mock interleaved A/B events and verify final state.

---

# Phase J — Conversation-history ownership

## J01 — Document current history inputs for both transports

Record whether each uses full pCAD transcript, newest turn only, or OpenCode session history.

## J02 — Choose one history owner for Streaming

Low-risk initial strategy matching the reviewed prototype:

```text
pCAD owns history
+ new OpenCode session per pCAD request
+ required transcript/context is sent by pCAD
```

Optional later strategy:

```text
OpenCode owns history
+ persistent OpenCode session per pCAD conversation
+ pCAD sends only the new turn/context delta
```

## J03 — Enforce anti-duplication invariant

Never do:

```text
persistent/reused OpenCode session
+ full pCAD transcript resent every prompt
```

Add a test/assertion around the chosen strategy.

## J04 — Optional persistent-session implementation

Only if J02 deliberately chooses OpenCode-owned history. Otherwise mark `SKIPPED` with rationale.

---

# Phase K — Error handling/recovery

## K01 — Streaming server unavailable

Clear error; user may manually switch to CLI; no silent fallback.

## K02 — SSE disconnect/reconnect

No tight loop; conversation state survives; deterministic recovery.

## K03 — Malformed/unknown event

Defensive parsing; no app crash.

## K04 — Preserve CLI failure behavior

Non-zero exit, timeout, and stderr remain understandable.

## K05 — Error tests

Server unavailable, prompt failure, SSE loss, malformed event, CLI failure.

---

# Phase L — Final validation

## L01 — Manual CLI regression

Run a normal OpenCode task in CLI mode and test Stop/Cancel if supported.

## L02 — Manual Streaming test

Run a normal task; verify progressive text, completion, and Stop/Cancel.

## L03 — Manual two-session test

Start A, let it wait on tool/external work, start B, verify B progresses, then A resumes without cross-talk.

## L04 — Full checks

```bash
npm run typecheck
npm run lint
npm run build
```

Run relevant Node tests using the repository's established invocation.

## L05 — Documentation

Document mode selector, server configuration/auth, start command, history ownership, concurrency, troubleshooting.

## L06 — Final diff review

- [ ] CLI still exists and works;
- [ ] no duplicate HTTP/SSE stack;
- [ ] API paths verified against installed `/doc`;
- [ ] one canonical server URL;
- [ ] no direct llama-swap dependency;
- [ ] no whole-run global lock;
- [ ] no persistent-session + full-history duplication;
- [ ] correct AI SDK stream lifecycle;
- [ ] real abort/timeout behavior;
- [ ] no final-text loss at completion;
- [ ] no silent tool/workspace semantic change;
- [ ] no unrelated refactor.

## Definition of Done

- [ ] CLI and Streaming are both selectable and functional.
- [ ] Selection persists using existing settings architecture.
- [ ] Streaming modernizes/reuses the existing adapter.
- [ ] Installed OpenCode `/doc` is the API source of truth.
- [ ] Streaming text is progressive, ordered, non-duplicated, and complete.
- [ ] AI SDK text/reasoning parts have valid start/delta/end lifecycles and stable IDs.
- [ ] Stop and timeout actually cancel work.
- [ ] Multiple jobs can coexist without cross-talk or a whole-run app lock.
- [ ] Conversation history has one explicit owner and is not duplicated.
- [ ] CLI/Streaming behavioral differences are intentional and documented.
- [ ] Automated tests do not require llama-swap, a GPU, or a live model.
- [ ] Typecheck/lint/build pass, or only explicitly documented pre-existing failures remain.

## Standard prompt for each coding-agent run

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Work only on the `Current next task`. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`; never discard/reset/clean/overwrite uncommitted or untracked user work. Inspect current code before editing. For OpenCode behavior trust installed `opencode --version`, `opencode ... --help`, and server `/doc`; for AI SDK stream behavior inspect the installed `@ai-sdk/provider` types/version. Implement only that one task, run the smallest relevant validation, update the status file with evidence/files/tests/result, set the next task only if this task is DONE, then stop.