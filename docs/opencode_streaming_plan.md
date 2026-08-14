# OpenCode CLI + Streaming Implementation Plan

Status tracking: see `docs/opencode_streaming_status.md`.

## Goal

Keep the existing OpenCode CLI integration intact and add a second selectable OpenCode execution mode that uses OpenCode server/API streaming.

The user must be able to choose between:

- `CLI` — current implementation, preserved.
- `Streaming` — persistent OpenCode server/API with live response updates.

Do not replace or remove the existing CLI implementation.

## Working rules for coding agents

1. Work on **one task ID at a time**.
2. Read this plan and `docs/opencode_streaming_status.md` before changing code.
3. Inspect the current implementation before editing the files named in a task. File names in this plan are architectural hints, not permission to assume stale structure.
4. Keep each change small enough to understand in one context window.
5. Do not perform unrelated refactors.
6. Preserve CLI behavior unless a task explicitly changes it.
7. After each task, run the smallest relevant validation first.
8. Update the status file after a task is completed.
9. If tests fail for reasons caused by the task, stop and fix them before continuing.
10. If the repository differs from this plan, adapt minimally and record the difference in the status file.
11. Do not add a global lock around an entire OpenCode agent run.
12. Do not call llama-swap directly from the new streaming transport. pCAD talks to OpenCode; OpenCode talks to its configured model provider.
13. Do not invent OpenCode endpoints or event names. Verify them against the installed/current OpenCode version before implementation.

## Target architecture

```text
pCAD UI
   |
   v
OpenCode integration
   |
   +-- CLI transport ----------> existing OpenCode CLI implementation
   |
   +-- Streaming transport ----> OpenCode server/API
                                   |
                                   +-- sessions
                                   +-- async prompt
                                   +-- SSE/events
                                   +-- abort
                                   |
                                   v
                              configured provider
                                   |
                                   v
                               llama-swap
```

CLI and streaming should share configuration and application-facing abstractions where that is genuinely useful, but should remain separate transports internally.

---

# Phase A — Audit current implementation

## A01 — Locate the current OpenCode CLI integration

**Purpose:** establish the exact current code path before refactoring anything.

- [ ] Pull/read latest `master`.
- [ ] Search for `opencode`, process spawning, CLI command construction, and relevant settings.
- [ ] Record the files that start OpenCode.
- [ ] Record where the prompt is built.
- [ ] Record how workspace/project path is passed.
- [ ] Record how stdout/stderr is handled.
- [ ] Record how cancellation currently works.

**Output:** add findings under A01 in the status file.

**Code changes:** none unless needed only to fix documentation mistakes.

## A02 — Trace CLI response flow to UI

- [ ] Identify where the CLI result enters application state.
- [ ] Identify chat/message state types.
- [ ] Identify any existing streaming or incremental message-update logic.
- [ ] Identify existing tool/reasoning/status UI components.

**Output:** short data-flow note in the status file.

## A03 — Trace settings persistence

- [ ] Find where local/user settings are stored.
- [ ] Find existing provider/model settings UI.
- [ ] Choose the correct place for OpenCode execution mode.
- [ ] Record persistence mechanism.

## A04 — Confirm baseline

Run the repository's normal checks before implementation:

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Record baseline result.
- [ ] Record any pre-existing failures separately.

**Phase A done when:** current CLI architecture, UI flow, settings flow, and baseline validation are documented.

---

# Phase B — Add execution-mode configuration

## B01 — Add the execution mode type

Add a small typed representation, conceptually:

```ts
type OpenCodeMode = 'cli' | 'streaming'
```

- [ ] Follow existing type conventions.
- [ ] Do not implement streaming yet.

## B02 — Add default mode

- [ ] Default to `cli` for backward compatibility.
- [ ] Keep current behavior unchanged when no explicit setting exists.

## B03 — Persist mode selection

- [ ] Store the selected mode through the existing settings mechanism.
- [ ] Read it on application startup.
- [ ] Avoid adding a second settings system.

## B04 — Add focused tests for setting behavior

- [ ] Default resolves to CLI.
- [ ] Streaming value can be stored.
- [ ] Stored value is restored correctly.

**Phase B done when:** pCAD has a persisted `cli | streaming` setting while all OpenCode execution still uses CLI.

---

# Phase C — Add mode selector UI

## C01 — Add selector to existing settings UI

- [ ] Reuse an existing select/radio/toggle component.
- [ ] Labels should clearly say `CLI` and `Streaming` or `OpenCode CLI` and `OpenCode Streaming`.
- [ ] Do not create a new settings page unless necessary.

## C02 — Wire selector to persisted setting

- [ ] Changing the selector updates the setting.
- [ ] Reload preserves the selected value.

## C03 — Keep active mode visible where useful

- [ ] Ensure the user can determine which OpenCode mode is active.
- [ ] Do not add noisy duplicate indicators.

## C04 — Validate UI-only change

- [ ] Typecheck.
- [ ] Relevant UI tests if available.
- [ ] Build.

**Phase C done when:** mode can be selected and persisted, even though both modes may still route to the current implementation temporarily.

---

# Phase D — Create a small shared OpenCode boundary

## D01 — Define the minimum application-facing OpenCode interface

Inspect current code first. Prefer a small interface that can support both transports.

Conceptually it may cover:

```text
send/run prompt
cancel active run
report execution events/result
```

Do not over-generalize.

## D02 — Wrap the existing CLI path

- [ ] Route current CLI execution through the shared boundary.
- [ ] Keep command construction and behavior unchanged.
- [ ] Avoid rewriting working CLI internals.

## D03 — Add transport selection

- [ ] `cli` selects existing CLI transport.
- [ ] `streaming` may return a clear `not implemented` result at this stage.
- [ ] No silent fallback.

## D04 — Regression-test CLI transport

- [ ] Existing CLI command/path behavior remains correct.
- [ ] Existing errors remain useful.
- [ ] Existing cancellation remains intact.

**Phase D done when:** the app can select an OpenCode transport without changing CLI semantics.

---

# Phase E — OpenCode server configuration and health

## E01 — Add server URL configuration

Default conceptually to:

```text
http://127.0.0.1:4096
```

- [ ] Use the project's existing config/env pattern.
- [ ] Keep one canonical source for the URL.

## E02 — Add optional settings UI for server URL if appropriate

- [ ] Only if the current settings architecture supports this cleanly.
- [ ] Otherwise use env/config and document it.

## E03 — Implement a minimal health/connectivity check

- [ ] Verify server availability using the current OpenCode API.
- [ ] Distinguish unavailable server from malformed response.

## E04 — Add health tests

- [ ] Available server.
- [ ] Connection refused.
- [ ] Unexpected response.

**Phase E done when:** pCAD can determine whether the configured OpenCode server is reachable.

---

# Phase F — Minimal OpenCode server client

## F01 — Verify current OpenCode API contract

Before coding:

- [ ] Confirm session-create endpoint.
- [ ] Confirm asynchronous prompt endpoint.
- [ ] Confirm abort endpoint.
- [ ] Confirm event/SSE endpoint.
- [ ] Confirm relevant event payload structure.
- [ ] Record exact verified endpoints/event names in the status file.

## F02 — Implement session creation

- [ ] Create one OpenCode session.
- [ ] Parse/store session ID.
- [ ] Use typed responses.

## F03 — Implement asynchronous prompt submission

- [ ] Submit a prompt to an existing session.
- [ ] Do not wait synchronously for the complete agent answer.

## F04 — Implement abort API call

- [ ] Add only if supported by verified API.
- [ ] Aborting a run must not automatically delete its session.

## F05 — Unit-test HTTP client

- [ ] Create session success/failure.
- [ ] Prompt success/failure.
- [ ] Abort success/failure if implemented.

**Phase F done when:** a mocked OpenCode server can create a session and accept an asynchronous prompt without SSE yet.

---

# Phase G — SSE/event transport

## G01 — Open one event stream

- [ ] Connect to the verified OpenCode SSE/event endpoint.
- [ ] Parse SSE frames correctly.
- [ ] Handle normal disconnect.

## G02 — Extract session identity

- [ ] Determine how session identity appears in actual events.
- [ ] Route events by verified session identity.

## G03 — Handle unknown events safely

- [ ] Ignore or log unsupported events without crashing.
- [ ] Do not expose raw event objects directly to React components.

## G04 — Add reconnect policy

- [ ] Keep it simple.
- [ ] Avoid infinite tight reconnect loops.
- [ ] SSE loss must not delete the OpenCode session.

## G05 — Unit-test event parser

- [ ] Multiple frames.
- [ ] Partial chunks if relevant to implementation.
- [ ] Unknown event.
- [ ] Disconnect.
- [ ] Session A/B events remain distinguishable.

**Phase G done when:** pCAD can consume and route OpenCode events without updating chat UI yet.

---

# Phase H — Internal pCAD event adapter

## H01 — Define a small internal event model

Use only events needed by pCAD, conceptually:

```text
text update
status
 tool start
 tool finish
error
complete
```

Names should follow current project conventions.

## H02 — Map verified OpenCode events

- [ ] Map text/message updates.
- [ ] Map useful tool/activity events.
- [ ] Map errors.
- [ ] Map completion.

## H03 — Keep transport details isolated

- [ ] React/chat code consumes pCAD events, not raw OpenCode API payloads.

## H04 — Unit-test mappings

- [ ] Text event.
- [ ] Tool event.
- [ ] Error.
- [ ] Completion.

**Phase H done when:** OpenCode-specific event details are isolated in one adapter layer.

---

# Phase I — Stream text into the existing chat UI

## I01 — Create/update the active assistant message

- [ ] Reuse current chat state machinery.
- [ ] Do not create a second chat-message store.

## I02 — Handle incremental text correctly

Determine whether verified OpenCode events are deltas, snapshots, or both.

- [ ] Delta handling does not lose text.
- [ ] Snapshot handling does not duplicate text.

Example acceptance check:

```text
Hello
Hello world
Hello world!
```

must result in exactly:

```text
Hello world!
```

## I03 — Mark completion

- [ ] Stop streaming state when OpenCode signals completion.
- [ ] Preserve final message in the same format as existing chat messages.

## I04 — Handle text-stream error

- [ ] Preserve already-received text where appropriate.
- [ ] Show a useful error state.

## I05 — Add focused tests

- [ ] Delta sequence.
- [ ] Snapshot sequence.
- [ ] Completion.
- [ ] Mid-stream error.
- [ ] No duplicate text.

**Phase I done when:** the assistant response visibly grows in the existing pCAD UI.

---

# Phase J — Show useful agent activity

## J01 — Identify existing activity/tool UI

- [ ] Reuse it if possible.

## J02 — Map tool start/finish

- [ ] Show concise activity only.
- [ ] Avoid dumping raw commands/events unless existing UX explicitly does so.

## J03 — Show waiting/working state if supported

- [ ] Only based on actual available events/state.

## J04 — Keep assistant text primary

- [ ] Activity indicators must not replace streamed answer text.

**Phase J done when:** the user can see useful high-level agent activity without event noise.

---

# Phase K — Session lifecycle

## K01 — Choose where OpenCode session ID belongs

- [ ] Map one pCAD streaming conversation to one OpenCode session.
- [ ] Follow current conversation-state architecture.

## K02 — Reuse session for follow-up prompts

- [ ] First prompt creates session.
- [ ] Following prompts reuse it.

## K03 — Recover from missing/expired session

- [ ] Detect invalid session.
- [ ] Provide deterministic recovery behavior.
- [ ] Do not silently mix histories.

## K04 — Separate CLI and streaming state

- [ ] CLI mode must not accidentally consume a streaming session ID.
- [ ] Switching mode must not corrupt either path.

## K05 — Add lifecycle tests

- [ ] New conversation creates session.
- [ ] Follow-up reuses session.
- [ ] Separate conversation gets separate session.
- [ ] Missing session handling.

**Phase K done when:** streaming conversations maintain proper OpenCode continuity.

---

# Phase L — Cancellation

## L01 — Preserve CLI cancellation

- [ ] Verify existing CLI stop behavior after transport refactor.

## L02 — Wire streaming cancellation

- [ ] Existing Stop/Cancel UI selects transport-specific abort behavior.
- [ ] Use verified OpenCode abort API.

## L03 — Continue after cancellation

- [ ] Session remains usable if OpenCode supports this.
- [ ] Send a new prompt after abort in manual/integration test.

## L04 — Tests

- [ ] CLI cancel.
- [ ] Streaming abort.
- [ ] Abort error.
- [ ] Continue session after abort where supported.

**Phase L done when:** Stop works correctly in both execution modes.

---

# Phase M — Concurrency and event isolation

This phase is important for local llama-swap usage.

## M01 — Ensure there is no whole-run global model lock

- [ ] Search for new locking/serialization introduced by this feature.
- [ ] Remove whole-agent-run locking unless independently required by pCAD.

## M02 — Two streaming sessions

- [ ] Start session A.
- [ ] Start session B.
- [ ] Both may remain active at application level.

## M03 — Verify event isolation

- [ ] A text never updates B conversation.
- [ ] B text never updates A conversation.
- [ ] Tool/status events remain session-scoped.

## M04 — Verify tool-wait interleaving

Desired behavior with llama.cpp `--parallel 1`:

```text
A: LLM request
A: waits on tool
B: LLM request
B: waits on tool
A: next LLM request
```

pCAD must not reserve the model for A for the lifetime of the entire agent run.

## M05 — Automated concurrency test

- [ ] Mock interleaved A/B SSE events.
- [ ] Verify correct routing and final messages.

**Phase M done when:** multiple OpenCode sessions can make progress without cross-streaming or app-level whole-run locking.

---

# Phase N — Error handling and recovery

## N01 — Streaming server unavailable

- [ ] Clear error with configured URL.
- [ ] Suggest starting server or selecting CLI.
- [ ] Do not silently fall back to CLI.

## N02 — Prompt submission failure

- [ ] Surface useful error.
- [ ] Leave conversation in a recoverable state.

## N03 — SSE connection loss

- [ ] Handle without deleting conversation/session.
- [ ] Reconnect according to the simple policy from G04.

## N04 — Unexpected event payload

- [ ] Defensive parsing.
- [ ] No application crash.

## N05 — Server-side agent error

- [ ] Surface useful error/status.
- [ ] Preserve received answer text where sensible.

## N06 — Tests

- [ ] Connection refused.
- [ ] Prompt error.
- [ ] SSE disconnect.
- [ ] Malformed event.
- [ ] Agent error.

**Phase N done when:** expected failure modes are explicit and recoverable.

---

# Phase O — Full validation and documentation

## O01 — CLI regression test

Manually verify current CLI workflow remains functional.

- [ ] New CLI task.
- [ ] Output displayed correctly.
- [ ] Error path.
- [ ] Stop/cancel.

## O02 — Streaming manual test

Start OpenCode server using the syntax supported by the installed version, conceptually:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

- [ ] Connect from pCAD.
- [ ] Start streaming prompt.
- [ ] Observe progressive text.
- [ ] Send follow-up in same conversation.
- [ ] Verify same OpenCode session.

## O03 — Two-session manual test

- [ ] Start A.
- [ ] Let A enter a tool/external wait.
- [ ] Start B.
- [ ] Confirm B can progress.
- [ ] Confirm A later resumes.
- [ ] Confirm no mixed UI events.

## O04 — Run project validation

```bash
npm run typecheck
npm run lint
npm run build
```

Run any relevant repository tests as well.

## O05 — Update documentation

Document:

- [ ] CLI mode.
- [ ] Streaming mode.
- [ ] Mode selector.
- [ ] OpenCode server configuration.
- [ ] How to start OpenCode server.
- [ ] Troubleshooting.
- [ ] Session behavior.
- [ ] Concurrency behavior.

## O06 — Final diff review

- [ ] No unrelated refactors.
- [ ] No direct llama-swap dependency added to pCAD streaming transport.
- [ ] CLI code still present.
- [ ] No global whole-run lock.
- [ ] No hard-coded server URL spread across multiple modules.

**Phase O done when:** both modes are usable, validated, documented, and CLI compatibility is preserved.

---

# Definition of Done

- [ ] Existing OpenCode CLI implementation remains available and functional.
- [ ] User can select `CLI` or `Streaming`.
- [ ] Selection persists.
- [ ] Streaming communicates through OpenCode server/API.
- [ ] Streaming response appears progressively in existing pCAD chat UI.
- [ ] OpenCode events are adapted behind a clean boundary.
- [ ] Streaming conversation reuses its OpenCode session.
- [ ] Stop/cancel works in both modes.
- [ ] Multiple streaming sessions can coexist.
- [ ] Tool waiting in one session does not create an app-level lock blocking another.
- [ ] Events never cross between sessions/conversations.
- [ ] Server/API failures are handled clearly.
- [ ] Normal automated tests do not require a live model/GPU.
- [ ] `npm run typecheck` passes or only documented pre-existing failures remain.
- [ ] `npm run lint` passes or only documented pre-existing failures remain.
- [ ] `npm run build` passes or only documented pre-existing failures remain.
- [ ] Documentation is updated.

## Recommended instruction to a coding agent

Use this short instruction for each iteration:

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Implement only the next uncompleted task ID. Inspect current repository code before editing. Keep the change minimal, preserve OpenCode CLI behavior, run task-relevant validation, update the status file with files changed/tests/results, and stop after that task. Do not start the following task in the same run.
