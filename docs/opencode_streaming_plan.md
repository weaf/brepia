# OpenCode CLI + Streaming Implementation Plan

Reviewed: 2026-08-14

Status tracking: see `docs/opencode_streaming_status.md`.

## Goal

Preserve the OpenCode CLI execution path and add a selectable OpenCode streaming execution path backed by `opencode serve`.

The user must be able to choose between:

- `CLI` — OpenCode executed through the CLI path.
- `Streaming` — OpenCode executed through the HTTP server/API with live events/text.

The transport choice must not silently change the intended OpenCode agent behavior.

## Current repository facts — read before coding

These facts were found during the 2026-08-14 review and are the reason this plan starts with a preflight phase.

1. The OpenCode implementation currently lives on branch `local-dev-continue`, not on `master`.
2. `local-dev-continue` was reviewed at commit `01336488828a003e8870efa8229ae9e1dbcc8003`.
3. `src/server/opencode.ts` already contains an HTTP/streaming prototype. Do **not** build a second streaming stack beside it without first auditing/reusing it.
4. The branch imports `src/server/cliAgents.ts` from `src/server/aiChat.ts` and `src/routes/api/opencode/models.ts`, but that file was not present in the pushed branch during review. It may exist uncommitted in the local worktree. Never overwrite or discard an untracked/local version.
5. `start.sh` starts OpenCode on port `4096`, while the reviewed `src/server/opencode.ts` defaults to port `14096`. This must be unified before streaming is considered reliable.
6. The reviewed HTTP prototype uses `/api/...` OpenCode paths. Current public OpenCode documentation uses paths such as `/global/health`, `/session`, `/session/:id/prompt_async`, `/session/:id/abort`, and `/event`. The **installed OpenCode server's `/doc` endpoint is authoritative** for this project; verify it before changing API code.
7. The current HTTP prototype creates a new OpenCode session for each request and formats the pCAD conversation into a prompt. Do not later reuse an OpenCode session while also resending the full pCAD transcript, because that would duplicate conversation history.
8. The reviewed `formatPrompt()` explicitly tells the HTTP OpenCode path not to use tools/files. Treat agent/tool semantics as a separate compatibility concern; transport work must not silently change them.
9. Some `.cursor/rules/*` documentation is older than the current TanStack/route architecture. Read repository rules, but when a rule conflicts with current code/package configuration, record the discrepancy and follow the current working code unless the rule is clearly normative.

## Working rules for coding agents

1. Work on **exactly one task ID per run**.
2. Read this plan and `docs/opencode_streaming_status.md` before editing code.
3. The first commands of every run must establish repository state:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

4. Work on `local-dev-continue` for this feature unless the status file explicitly changes the target branch.
5. Never discard, reset, overwrite, or clean uncommitted/untracked user work.
6. Especially protect any local/untracked `src/server/cliAgents.ts`.
7. Inspect the current files named by the task before modifying them. The plan is a roadmap, not proof that file contents are unchanged.
8. Keep each task small enough for a local 35B-class model to understand in one context window.
9. Do not perform unrelated refactors.
10. Preserve working CLI behavior unless a task explicitly changes the CLI transport.
11. Do not add a global lock around an entire OpenCode agent run.
12. pCAD must not call llama-swap directly from this feature. pCAD talks to OpenCode; OpenCode talks to its configured model provider.
13. Do not invent OpenCode API endpoints or event names. Verify the installed OpenCode version and its `/doc` specification first.
14. Transport work must not silently enable/disable OpenCode tools, file access, workspace access, or agent behavior. Record and resolve semantic differences explicitly.
15. Run the smallest relevant validation after the task.
16. Update `docs/opencode_streaming_status.md` before stopping.
17. Mark a task `DONE` only when its acceptance condition is met and task-caused validation failures are fixed.
18. If blocked, mark the task `BLOCKED`, record the exact reason/evidence, and stop. Do not guess around the blocker.

## Target architecture

```text
pCAD UI / existing chat pipeline
            |
            v
     OpenCode transport selector
            |
      +-----+------+
      |            |
      v            v
 CLI transport   Streaming transport
      |            |
      |            +--> opencode serve
      |                   |
      |                   +--> session/message/events/abort
      |                   |
      +-------------------+--> OpenCode agent/provider/model
                                  |
                                  v
                              llama-swap
                                  |
                                  v
                              local model
```

The shared boundary should be small. Do not force CLI and HTTP transports into identical internals where they naturally differ.

---

# Phase P — Preflight and branch integrity

No feature implementation is allowed before Phase P is complete.

## P01 — Confirm branch, worktree, and reviewed head

**Purpose:** ensure the coding agent is modifying the branch that actually contains the OpenCode work.

- [ ] Run the three repository-state commands from the working rules.
- [ ] Confirm branch is `local-dev-continue`.
- [ ] Record current HEAD in the status file.
- [ ] Record all modified/untracked files without changing them.
- [ ] Confirm both plan/status docs are readable in this branch.

**Acceptance:** branch/worktree state is documented; no user files changed.

## P02 — Resolve the `cliAgents.ts` discrepancy

**Audit only. Do not recreate the file yet.**

- [ ] Check whether `src/server/cliAgents.ts` exists locally.
- [ ] Check `git status --short` for an untracked/modified version.
- [ ] Confirm every import/reference to `cliAgents`.
- [ ] If a local file exists, inspect and preserve it exactly.
- [ ] If it is absent, record that the pushed branch has unresolved imports.

**Acceptance:** status file says one of: `present+tracked`, `present+untracked/modified`, or `absent` and lists importing files.

## P03 — Establish a valid CLI compatibility baseline

Only run after P02.

If `cliAgents.ts` exists locally:

- [ ] Treat it as user work.
- [ ] Do not rewrite it merely to match this plan.
- [ ] Validate how it invokes OpenCode CLI and which model IDs it owns.

If `cliAgents.ts` is genuinely absent:

- [ ] Inspect the current routing and recent commit intent.
- [ ] Implement only the smallest CLI transport needed to satisfy the existing imports and intended OpenCode CLI mode.
- [ ] Use the installed `opencode run --help` as the CLI contract.
- [ ] Prefer structured CLI output such as `--format json` when the existing architecture requires parsing.
- [ ] Do not modify the HTTP streaming transport in this task.

**Acceptance:** the CLI path exists as an explicit, testable compatibility baseline and the project no longer has unresolved `cliAgents` imports caused by this feature.

## P04 — Baseline validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Also inspect how existing `node:test` files are run in this repository and execute a small relevant existing test if practical.

- [ ] Record PASS/FAIL for every command.
- [ ] Separate pre-existing failures from task-caused failures.
- [ ] Do not fix unrelated failures in this task.

**Phase P done when:** correct branch confirmed, CLI baseline accounted for, and baseline validation is recorded.

---

# Phase A — Map existing OpenCode behavior

## A01 — Trace CLI routing end-to-end

- [ ] Identify user-facing model IDs routed to the CLI transport.
- [ ] Identify the selector/routing function in `aiChat.ts` or current equivalent.
- [ ] Identify CLI command construction.
- [ ] Identify workspace/directory handling.
- [ ] Identify stdout/event parsing.
- [ ] Identify cancellation behavior.
- [ ] Record the flow in the status file.

**Code changes:** none.

## A02 — Trace the existing HTTP/streaming prototype

- [ ] Read `src/server/opencode.ts` or its current replacement.
- [ ] Record model discovery behavior.
- [ ] Record session creation behavior.
- [ ] Record prompt submission behavior.
- [ ] Record event reading/parsing behavior.
- [ ] Record text/reasoning delta generation.
- [ ] Record abort behavior.

**Code changes:** none.

## A03 — Trace model discovery and picker flow

- [ ] Trace `/api/opencode/models` or current route.
- [ ] Trace dynamic model merge in `TextAreaChat` or current component.
- [ ] Record ID prefixes used for CLI vs HTTP/OpenCode models.
- [ ] Record any Codex entries separately.

**Code changes:** none.

## A04 — Trace settings persistence

- [ ] Identify current settings persistence mechanism.
- [ ] Identify the most appropriate existing settings UI location.
- [ ] Decide where one OpenCode execution-mode value should live.
- [ ] Record the decision; do not implement it yet.

## A05 — Document agent/tool semantics baseline

For both current transports, record whether the path allows:

- [ ] OpenCode tools.
- [ ] file reads/writes.
- [ ] shell execution.
- [ ] workspace/project context.
- [ ] pCAD tool calls.
- [ ] conversational-only behavior.

Do not change these semantics in this task.

**Phase A done when:** CLI, HTTP prototype, picker/routing, settings, and behavioral semantics are documented before refactoring.

---

# Phase B — Add selectable execution mode

## B01 — Define the execution-mode type

Add a small type following existing conventions, conceptually:

```ts
type OpenCodeExecutionMode = 'cli' | 'streaming'
```

No transport behavior changes yet.

## B02 — Add the backward-compatible default

- [ ] Default to `cli` unless current verified behavior makes another default necessary.
- [ ] Missing/old settings resolve deterministically.

## B03 — Persist the mode

- [ ] Use the existing settings persistence mechanism found in A04.
- [ ] Do not create a second settings store.

## B04 — Add the mode selector UI

- [ ] Reuse existing UI components.
- [ ] Labels clearly distinguish `CLI` and `Streaming`.
- [ ] User can tell which mode is active.

## B05 — Test setting and selector behavior

- [ ] Default is correct.
- [ ] CLI can be selected.
- [ ] Streaming can be selected.
- [ ] Selection survives reload/reinitialization according to existing settings behavior.

## B06 — Validate Phase B

- [ ] Relevant focused validation.
- [ ] `npm run typecheck`.
- [ ] Build if UI routing/types changed broadly.

**Phase B done when:** the user can persistently choose a mode, but transport internals have not been broadly rewritten.

---

# Phase C — Introduce the smallest shared transport boundary

## C01 — Define minimal application-facing operations

Inspect current call sites first. The boundary should expose only what pCAD needs, for example:

```text
execute/send prompt
stream/emit result parts
cancel
```

Do not design a general agent framework.

## C02 — Put the existing CLI path behind the boundary

- [ ] Preserve current command/options/output semantics.
- [ ] Keep the change mechanical and small.

## C03 — Put the existing HTTP prototype behind the boundary

- [ ] Reuse `src/server/opencode.ts` instead of duplicating it.
- [ ] Do not modernize endpoints in this task.

## C04 — Route by execution mode

- [ ] `cli` selects CLI transport.
- [ ] `streaming` selects HTTP transport.
- [ ] No silent fallback between modes.

## C05 — CLI regression validation

- [ ] Existing CLI model can still be selected.
- [ ] Existing CLI request still runs.
- [ ] CLI failure remains visible.
- [ ] CLI cancellation remains functional if already supported.

**Phase C done when:** both transport implementations have a small common selection point and CLI still behaves as before.

---

# Phase D — Unify OpenCode server configuration

## D01 — Choose one canonical server URL setting

Prefer a single base URL such as:

```text
http://127.0.0.1:4096
```

- [ ] Follow existing env/config conventions.
- [ ] Do not hard-code conflicting ports in multiple modules.

## D02 — Align `start.sh`, server client, and env template

- [ ] `start.sh` and application client use the same default.
- [ ] Document the env variable in `.env.local.template`.
- [ ] Preserve loopback binding by default.

## D03 — Add health check using verified installed API

- [ ] Prefer the installed OpenCode health endpoint from `/doc`.
- [ ] Return useful unavailable/version information.

## D04 — Account for optional OpenCode server authentication

- [ ] If `OPENCODE_SERVER_PASSWORD`/username is configured, ensure the pCAD server client can use the same credentials or document the required setup.
- [ ] Do not expose credentials to browser code.
- [ ] Do not add authentication if it is not configured/needed locally.

## D05 — Test config/health behavior

- [ ] default URL.
- [ ] configured URL.
- [ ] unavailable server.
- [ ] auth configuration if implemented.

**Phase D done when:** one server URL/health mechanism is used consistently.

---

# Phase E — Verify the installed OpenCode API contract

This phase is deliberately separate from implementation.

## E01 — Record installed OpenCode version

Run:

```bash
opencode --version
```

Record exact output.

## E02 — Inspect installed OpenAPI spec

With the configured server running, inspect:

```text
GET <base-url>/doc
```

Record actual paths and request shapes relevant to this feature.

## E03 — Record required API operations

At minimum verify the installed equivalents of:

- [ ] health.
- [ ] provider/model discovery.
- [ ] create session.
- [ ] async prompt/message submission.
- [ ] event/SSE stream.
- [ ] abort session/run.

## E04 — Compare prototype against installed API

Create a short migration table in the status file:

```text
current code path -> installed path -> action needed
```

Do not change runtime code in E01–E04.

**Phase E done when:** streaming implementation can be changed from evidence, not guessed endpoints.

---

# Phase F — Modernize the streaming client in small steps

Only use endpoints verified in Phase E.

## F01 — Fix provider/model discovery

- [ ] Replace stale model/provider endpoint usage if needed.
- [ ] Preserve CLI model discovery fallback only if it remains useful.
- [ ] Keep model IDs stable where possible.

## F02 — Fix session creation

- [ ] Use verified create-session request shape.
- [ ] Do not add persistent-session history behavior yet.

## F03 — Fix asynchronous prompt submission

- [ ] Use verified async endpoint/request shape.
- [ ] Include model/agent/parts fields only as required by installed API and intended behavior.

## F04 — Implement one real SSE/event stream

- [ ] Use the verified event endpoint.
- [ ] Read streaming response incrementally rather than repeatedly downloading an entire event response unless the installed API explicitly requires polling.
- [ ] Parse SSE framing correctly.

## F05 — Route events by session identity

- [ ] Extract session ID from verified event shape.
- [ ] Ignore unrelated session events.
- [ ] Keep simultaneous sessions isolated.

## F06 — Implement verified abort

- [ ] Abort the active streaming OpenCode session/run.
- [ ] Do not delete the session unless explicitly intended.

## F07 — Add focused streaming-client tests

Use the repository's existing test conventions; do not introduce a new test framework just for this feature.

- [ ] session creation.
- [ ] async prompt submission.
- [ ] SSE parsing.
- [ ] event session filtering.
- [ ] abort.
- [ ] server error.

**Phase F done when:** the existing HTTP prototype speaks the installed OpenCode API correctly.

---

# Phase G — Stabilize pCAD event adaptation

## G01 — Define a small internal event model

Represent only what the existing pCAD UI needs, conceptually:

```text
text update
reasoning/status update
tool/activity update
error
complete
```

Names must follow project conventions.

## G02 — Map text updates without duplication

First determine whether OpenCode emits deltas, snapshots, or both.

Acceptance example:

```text
Hello
Hello world
Hello world!
```

must end as exactly:

```text
Hello world!
```

## G03 — Map completion and errors

- [ ] Completion is deterministic.
- [ ] Partial text can survive an error where appropriate.

## G04 — Map useful agent activity only

- [ ] Reuse existing pCAD tool/reasoning/status UI concepts where available.
- [ ] Avoid raw event JSON in React components.
- [ ] Do not expose hidden reasoning content unless the existing product intentionally supports it.

## G05 — Unit-test event mapping

- [ ] delta sequence.
- [ ] snapshot sequence.
- [ ] completion.
- [ ] error.
- [ ] unknown event.

**Phase G done when:** OpenCode API details are isolated from the UI and text cannot duplicate during streaming.

---

# Phase H — Wire streaming into the existing chat UI

## H01 — Reuse existing assistant-message state

- [ ] Do not create a parallel chat store.
- [ ] Create/update the active assistant message through existing mechanisms.

## H02 — Show progressive text

- [ ] Text appears while OpenCode is running.
- [ ] Markdown/rendering behavior remains consistent with normal chat.

## H03 — Show completion/error state

- [ ] Loading state ends correctly.
- [ ] Useful error is visible.
- [ ] Partial response is handled deliberately.

## H04 — Wire Stop/Cancel by transport

- [ ] CLI uses CLI cancellation.
- [ ] Streaming uses verified OpenCode abort.
- [ ] Stop does not silently switch transport.

## H05 — Validate UI streaming

- [ ] focused tests where available.
- [ ] typecheck.
- [ ] build.

**Phase H done when:** switching to Streaming produces a progressive response in the existing pCAD chat UI.

---

# Phase I — Concurrency and event isolation

This phase preserves the useful behavior of llama-swap with `--parallel 1`: several agents may exist while only one model inference request runs at a time.

## I01 — Verify no whole-run global lock

- [ ] Search all new transport code for application-level serialization.
- [ ] Do not reserve the model for an entire OpenCode agent run.

## I02 — Run two streaming sessions concurrently

- [ ] Session A can remain active.
- [ ] Session B can also submit work.

## I03 — Verify zero cross-talk

- [ ] A text/status never updates B conversation.
- [ ] B text/status never updates A conversation.

## I04 — Test tool-wait interleaving

Desired application-level behavior:

```text
A: model request
A: tool/external wait
B: model request
B: tool/external wait
A: next model request
```

pCAD must not prevent B from reaching OpenCode merely because A's overall task is still active.

## I05 — Add deterministic interleaving test

- [ ] Mock/interleave A/B events.
- [ ] Verify correct routing and final text.

**Phase I done when:** multiple OpenCode jobs coexist without event mixing or whole-run locking.

---

# Phase J — Decide conversation-history ownership

Do not skip this phase. It prevents duplicated context and wasted tokens.

## J01 — Document current history behavior

Confirm whether each transport currently sends:

- full pCAD transcript,
- only newest user turn,
- or relies on an existing OpenCode session history.

## J02 — Choose one history owner for Streaming

Recommended initial low-risk choice:

```text
pCAD owns conversation history
+ one OpenCode session per pCAD request
+ pCAD sends required current transcript/context
```

This matches the reviewed prototype and avoids hidden OpenCode state.

Optional later choice:

```text
OpenCode owns conversation history
+ persistent OpenCode session per pCAD conversation
+ pCAD sends only the new turn/context delta
```

## J03 — Enforce the anti-duplication invariant

Never combine:

```text
persistent/reused OpenCode session
+ resend full pCAD transcript every prompt
```

Add a test or clear assertion around whichever strategy is chosen.

## J04 — Optional persistent-session implementation

Only implement this task if J02 deliberately chooses OpenCode-owned persistent history. Otherwise mark J04 `SKIPPED` with rationale.

**Phase J done when:** history ownership is explicit, tested, and non-duplicating. Persistent sessions are not required for initial feature completion.

---

# Phase K — Error handling and recovery

## K01 — Streaming server unavailable

- [ ] Clear error includes configured server location where safe.
- [ ] User can select CLI manually.
- [ ] No silent automatic fallback.

## K02 — SSE disconnect/reconnect

- [ ] No tight reconnect loop.
- [ ] Existing conversation state is not destroyed.
- [ ] Recovery behavior is deterministic.

## K03 — Malformed/unknown event

- [ ] Defensive parsing.
- [ ] No application crash.

## K04 — CLI process failure

- [ ] Non-zero exit/timeout remains clear.
- [ ] Streaming work has not degraded CLI errors.

## K05 — Test error paths

- [ ] server unavailable.
- [ ] prompt/API failure.
- [ ] SSE disconnect.
- [ ] malformed event.
- [ ] CLI failure.

**Phase K done when:** expected failure modes are visible and recoverable without mixing transports.

---

# Phase L — Final validation and documentation

## L01 — Manual CLI regression

- [ ] Select CLI.
- [ ] Run a normal OpenCode task.
- [ ] Verify response.
- [ ] Verify Stop/Cancel if supported.

## L02 — Manual Streaming test

- [ ] Select Streaming.
- [ ] Run a normal OpenCode task.
- [ ] Verify progressive text.
- [ ] Verify completion.
- [ ] Verify Stop/Cancel.

## L03 — Manual two-session test

- [ ] Start A.
- [ ] While A waits on tool/external work, start B.
- [ ] Verify B can progress.
- [ ] Verify A later continues.
- [ ] Verify no cross-talk.

## L04 — Full project validation

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Run relevant existing/new Node tests using the repository's established command.

## L05 — Documentation

Document:

- [ ] CLI mode.
- [ ] Streaming mode.
- [ ] mode selector.
- [ ] server URL/auth configuration.
- [ ] how to start `opencode serve`.
- [ ] history-ownership decision.
- [ ] concurrency behavior.
- [ ] troubleshooting.

## L06 — Final diff review

- [ ] CLI path still exists.
- [ ] No duplicate streaming implementation was added beside reusable code.
- [ ] No stale `/api/...` assumptions remain unless verified by installed `/doc`.
- [ ] One canonical OpenCode server URL/config path.
- [ ] No direct llama-swap dependency in pCAD OpenCode transport.
- [ ] No whole-agent-run global lock.
- [ ] No persistent-session + full-history duplication.
- [ ] No silent tool/agent semantic change.
- [ ] No unrelated refactors.

---

# Definition of Done

- [ ] Work was performed on the intended feature branch and user work was preserved.
- [ ] Existing OpenCode CLI transport is available and functional.
- [ ] User can select `CLI` or `Streaming`.
- [ ] Mode selection persists.
- [ ] Streaming reuses/modernizes the existing OpenCode HTTP prototype rather than adding a duplicate stack.
- [ ] Streaming uses endpoints verified against the installed OpenCode `/doc`.
- [ ] One canonical local server URL is used, defaulting to loopback unless explicitly configured otherwise.
- [ ] Streaming text appears progressively in the existing pCAD chat UI.
- [ ] Text is not duplicated when event shapes are snapshots/deltas.
- [ ] Stop/Cancel works appropriately in both transports.
- [ ] Multiple OpenCode sessions/jobs can coexist at application level.
- [ ] Session events never cross between pCAD conversations.
- [ ] pCAD does not globally lock the model for a whole agent run.
- [ ] Conversation-history ownership is explicit and cannot duplicate history.
- [ ] CLI and Streaming do not silently differ in tool/workspace semantics; any intentional difference is documented.
- [ ] Server/API/CLI failures are handled clearly.
- [ ] Normal automated tests do not require llama-swap, a model, or GPU.
- [ ] `npm run typecheck` passes or only documented pre-existing failures remain.
- [ ] `npm run lint` passes or only documented pre-existing failures remain.
- [ ] `npm run build` passes or only documented pre-existing failures remain.
- [ ] Documentation is updated.

## Standard prompt for a coding-agent run

Use this exact style for each iteration:

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Work only on the `Current next task` from the status file. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`; never discard or overwrite uncommitted/untracked user files. Inspect the current code needed for that task, and for OpenCode HTTP/CLI behavior trust the installed `opencode --version`, `opencode ... --help`, and server `/doc` over assumptions in the plan. Implement only that one task, run the smallest relevant validation, update the status file with evidence/files/tests/result, set the next task only if this task is DONE, then stop. Do not start another task in the same run.
