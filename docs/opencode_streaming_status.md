# OpenCode CLI + Streaming Implementation Status

Plan: `docs/opencode_streaming_plan.md`

## Overall status

**State:** Ready for implementation

**Current next task:** `A01 — Locate the current OpenCode CLI integration`

**Implementation rule:** complete one task ID per coding-agent run unless the task is purely documentary and trivially coupled to the next one.

## Important invariants

- Existing OpenCode CLI mode must remain functional.
- Streaming is an additional selectable transport, not a replacement.
- Default mode remains CLI unless a later explicit decision changes it.
- pCAD must not call llama-swap directly from the streaming transport.
- Do not add a global lock around an entire OpenCode agent run.
- Multiple OpenCode sessions may be active at application level.
- Verify actual OpenCode API endpoints/events before implementing server/SSE code.
- Normal automated tests should not require a live OpenCode server, llama-swap, model, or GPU.

## Task status

Legend:

- `TODO` — not started
- `IN PROGRESS` — currently being implemented
- `BLOCKED` — cannot proceed; reason must be recorded
- `DONE` — implemented and validated

| Task | Status | Summary |
|---|---|---|
| A01 | TODO | Locate current OpenCode CLI integration |
| A02 | TODO | Trace CLI response flow to UI |
| A03 | TODO | Trace settings persistence |
| A04 | TODO | Confirm baseline checks |
| B01 | TODO | Add execution mode type |
| B02 | TODO | Add CLI default mode |
| B03 | TODO | Persist mode selection |
| B04 | TODO | Test setting behavior |
| C01 | TODO | Add mode selector UI |
| C02 | TODO | Wire selector to persisted setting |
| C03 | TODO | Make active mode clear |
| C04 | TODO | Validate UI-only change |
| D01 | TODO | Define minimal shared OpenCode boundary |
| D02 | TODO | Wrap existing CLI path |
| D03 | TODO | Add transport selection |
| D04 | TODO | Regression-test CLI transport |
| E01 | TODO | Add OpenCode server URL config |
| E02 | TODO | Add optional server URL UI if appropriate |
| E03 | TODO | Implement server health check |
| E04 | TODO | Test health behavior |
| F01 | TODO | Verify current OpenCode API contract |
| F02 | TODO | Implement session creation |
| F03 | TODO | Implement async prompt submission |
| F04 | TODO | Implement abort call if supported |
| F05 | TODO | Unit-test server client |
| G01 | TODO | Open SSE/event stream |
| G02 | TODO | Extract and route session identity |
| G03 | TODO | Handle unknown events safely |
| G04 | TODO | Add reconnect policy |
| G05 | TODO | Unit-test event parser |
| H01 | TODO | Define internal pCAD event model |
| H02 | TODO | Map verified OpenCode events |
| H03 | TODO | Isolate transport details |
| H04 | TODO | Unit-test event mappings |
| I01 | TODO | Create/update active assistant message |
| I02 | TODO | Handle incremental text correctly |
| I03 | TODO | Mark completion |
| I04 | TODO | Handle stream errors |
| I05 | TODO | Test streaming text behavior |
| J01 | TODO | Identify/reuse activity UI |
| J02 | TODO | Map tool start/finish |
| J03 | TODO | Show waiting/working state if supported |
| J04 | TODO | Keep assistant text primary |
| K01 | TODO | Choose storage for OpenCode session ID |
| K02 | TODO | Reuse session for follow-ups |
| K03 | TODO | Recover from missing/expired session |
| K04 | TODO | Separate CLI and streaming state |
| K05 | TODO | Test session lifecycle |
| L01 | TODO | Preserve CLI cancellation |
| L02 | TODO | Wire streaming cancellation |
| L03 | TODO | Continue after cancellation |
| L04 | TODO | Test cancellation |
| M01 | TODO | Ensure no whole-run global lock |
| M02 | TODO | Support two streaming sessions |
| M03 | TODO | Verify event isolation |
| M04 | TODO | Verify tool-wait interleaving |
| M05 | TODO | Automated concurrency test |
| N01 | TODO | Handle unavailable streaming server |
| N02 | TODO | Handle prompt submission failure |
| N03 | TODO | Handle SSE connection loss |
| N04 | TODO | Handle unexpected event payload |
| N05 | TODO | Handle server-side agent error |
| N06 | TODO | Test error/recovery paths |
| O01 | TODO | CLI regression manual test |
| O02 | TODO | Streaming manual test |
| O03 | TODO | Two-session manual test |
| O04 | TODO | Run full project validation |
| O05 | TODO | Update documentation |
| O06 | TODO | Final diff review |

## Audit findings

### A01

_Not started._

### A02

_Not started._

### A03

_Not started._

### A04

_Not started._

## Verified OpenCode API contract

Populate this section during `F01`. Do not assume stale endpoint names.

- OpenCode version: _TBD_
- Server base URL: _TBD_
- Create-session endpoint: _TBD_
- Async-prompt endpoint: _TBD_
- Event/SSE endpoint: _TBD_
- Abort endpoint: _TBD_
- Relevant event names/shapes: _TBD_

## Baseline validation

Populate during `A04`.

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | NOT RUN | |
| `npm run lint` | NOT RUN | |
| `npm run build` | NOT RUN | |

## Implementation log

Add one entry after every completed task.

Use this format:

```text
### YYYY-MM-DD — TASK_ID

Status: DONE

Files changed:
- path/to/file

What changed:
- concise description

Validation:
- command -> PASS/FAIL

Notes:
- compatibility decisions, API observations, or follow-up risks

Next task:
- TASK_ID
```

## Blockers

None recorded.

## Known risks to keep watching

1. The recently added CLI implementation is the compatibility baseline; avoid rewriting it while extracting a shared boundary.
2. OpenCode event payloads may differ by installed version; F01 must verify them before SSE mapping work.
3. Streaming event routing must be session-scoped to prevent cross-talk between simultaneous pCAD conversations.
4. Switching execution mode must not cause CLI state and streaming session state to be mixed.
5. A coding agent should not implement several later phases in one large patch; the plan is intentionally granular so local 35B-class models can work with bounded context and small diffs.

## Short prompt for the coding agent

> Read `docs/opencode_streaming_plan.md` and `docs/opencode_streaming_status.md`. Find the first task whose status is `TODO`, implement only that task, inspect current code before editing, preserve existing OpenCode CLI behavior, run the smallest relevant validation, update the status file with findings/files/tests/result, mark that task `DONE` only if validation succeeds, set the next task, and stop. Do not start another task in the same run.
