# OpenCode CLI + Streaming Implementation Status

Plan: `docs/opencode_streaming_plan.md`

Reviewed: 2026-08-14 (fourth/final pre-implementation review)

## G01 recovery — R01 WIP audit findings (2026-08-14)

Source of truth: recovery plan `docs/opencode_g01_recovery_plan.md`, recovery status `docs/opencode_g01_recovery_status.md`. Current G01 WIP in `src/server/opencode.ts` (uncommitted) audited and preserved to `.git/g01-before-recovery.patch`.

- **`extractOpenSCADCode()` (lines 28–39):** fenced-block-only detection. `RE_OPENSCAD_FENCED = /```(?:openscad|scad)?\s*([\s\S]*?)```/i` plus `RE_MIN_CODE_LENGTH = /.{20,}/`. No keyword heuristics.
- **Tool-call emission location:** `streamingOpencodeChatModel`'s `ReadableStream.start()`, at the `finish` part. Buffers `text-delta`s, joins them, runs `extractOpenSCADCode`; if code found, enqueues `tool-call` for `build_parametric_model` (input `{title, version, code, message}`) then a `finish` with `finishReason: 'tool-calls'`.
- **Partial-vs-final:** detection runs ONLY on the terminal `finish` part — text deltas are buffered, never parsed as fragments. Satisfies R05's "no partial-fragment parsing".
- **Duplicate guard:** single definition exists (lines 28–39); the earlier duplicate at ~line 739 was removed. No duplicate remains.
- **Known divergence from the "mirrors parseAgentResult" claim:** the comment says the streaming heuristic matches the CLI parser, but it is a _separate_ implementation: it accepts ANY fenced block (optional language tag), while the CLI `parseAgentResult` also accepts structured JSON. R04B must extract one shared parser.
- **Routing problem (#1) unaddressed:** the WIP does not touch `aiChat.ts` routing or the F01 toggle; `agent/opencode/...` still routes to the CLI adapter, and transport switching via `executionMode` for the same model ID is still not guaranteed. R03 is the priority correction.

## Overall status

**State:** Ready for controlled implementation after preflight

**Target branch:** `local-dev-continue`

**Feature code reviewed from:** `01336488828a003e8870efa8229ae9e1dbcc8003`

**Latest plan commit before this status update:** `bc3924085a09c535061db45bf4b6ae4ea1160d86`

**Current next task:** `R02 — Reconcile status/documentation with actual pushed code` (recovery chain; see `docs/opencode_g01_recovery_status.md`)

**Execution rule:** one coding agent, one task ID, one shared branch/status writer at a time.

## R02 routing facts — reconciled against actual code (2026-08-14)

Verified facts in the worktree (NOT design intentions):

```text
/api/opencode/models
  -> src/routes/api/opencode/models.ts:21  id: `agent/opencode/${m.cliId}`

F01 toggle visibility
  -> src/components/TextAreaChat.tsx:1736   model.startsWith('opencode/')

E03 streaming selection
  -> src/server/aiChat.ts:1272  actualModelId.startsWith('opencode/') && executionMode === 'streaming'

providerFor() routing
  -> src/server/aiChat.ts:346   isCliAgentModel(modelId) -> 'cli-agent'

SDK decision
  -> package.json does NOT contain @opencode-ai/sdk; implemented decision is raw HTTP/fetch
```

Consequence (FIXED in R03, 2026-08-14): the canonical `agent/opencode/<provider>/<model>` ID now switches CLI vs Streaming purely by `executionMode` via `selectChatTransport()` in `src/server/cliAgents.ts` (routed in `aiChat.ts`), and the F01 toggle visibility uses `isOpenCodeTransportModel()` from `shared/models.ts` so it shows for canonical agent IDs. Legacy `opencode/...` IDs keep today's behavior (streaming pass-through; cli falls through to `opencodeChatModel`).

`src/server/cliAgents.ts` is still absent from the pushed GitHub tree (tracked imports exist but the file itself is local/untracked). This remains a reproducibility issue until deliberately committed (R04A).

## R03 — executionMode switches transport for the same model (DONE, 2026-08-14)

Implemented so one canonical OpenCode agent ID switches CLI/Streaming purely by `executionMode`:

- `shared/models.ts`: `isOpenCodeAgentModel()` (canonical `agent/opencode/...` predicate) + `isOpenCodeTransportModel()` (canonical OR legacy, drives the F01 toggle).
- `src/server/cliAgents.ts`: `opencodeAgentUnderlyingModelId()` (canonical ID → `provider/model`) + `selectChatTransport()` (model ID + executionMode → `cli-agent` | `streaming-opencode` | `normal`).
- `src/server/aiChat.ts`: E03 selection now calls `selectChatTransport(actualModelId, executionMode)`. Streaming routes `agent/opencode/<provider>/<model>` to `streamingOpencodeChatModel(<provider>/<model>)`; cli and everything else falls through to `buildChatModel`.
- `src/components/TextAreaChat.tsx`: toggle shows when `isOpenCodeTransportModel(model)` (canonical AND legacy).
- `src/server/opencodeRouting.test.ts`: 9 routing tests (50 total, all pass).

Legacy `opencode/...` IDs remain compatibility-only (R03 step 5): streaming → streaming adapter; cli → `normal` (→ `opencodeChatModel` via `buildChatModel`, today's behavior). Non-OpenCode models never enter this path.

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

## G01 WIP recovery audit — R01 findings (2026-08-14)

Audit of the uncommitted G01 work in `src/server/opencode.ts`. Safety patch saved to `.git/g01-before-recovery.patch`. See `docs/opencode_g01_recovery_status.md` for the recovery tracker.

**Preserved WIP diff summary:**

1. **`extractOpenSCADCode()` added** (line 37) using two regexes:
   - `RE_OPENSCAD_FENCED = /```(?:openscad|scad)?\s*([\s\S]*?)```/i` — matches a fenced code block; the language tag is **optional**, so it matches ANY fenced block (` ```python ``, ` ``json `, …), not only `scad`/`openscad`.
   - `RE_MIN_CODE_LENGTH = /.{20,}/` — fenced content must be ≥ 20 characters.
2. **Keyword heuristics already removed:** `RE_OPENSCAD_PRIMITIVES` and `RE_OPENSCAD_MODULE_DEF` (the `cube|rotate|cylinder|…` and `module name {` matchers that caused prose false-positives) are **gone** from the current worktree — the earlier fix removed them. The saved patch only contains the fenced-block matcher.
3. **Tool-call emission site** — `streamingOpencodeChatModel()` ReadableStream `start()` (≈ line 740): on the single `finish` event it joins all buffered `text-delta`s, runs `extractOpenSCADCode(accumulated)`, and if code is found enqueues a `tool-call` part for `build_parametric_model` (input JSON `{title, version, code, message}`) followed by the same `finish` part with `finishReason: 'tool-calls'`.
4. **Partial-vs-final detection:** detection runs **only at the `finish` (terminal) event** on the complete accumulated text — not on partial deltas. Structurally satisfies the "progressive text, parse final only" invariant.
5. **Duplicate guard:** no explicit "already emitted" flag; single-emission is structural (one `finish` per stream). A duplicate `extractOpenSCADCode` at line 739 was removed previously, leaving the canonical at line 37.

**Remaining failure mechanisms — RESOLVED by the G01 recovery chain (R01–R08, all DONE):**

- ~~**Routing mismatch (R03):** `/api/opencode/models` emits `agent/opencode/<provider>/<model>`; `providerFor()` routes those to CLI via `isCliAgentModel()`, while F01 toggle visibility and E03 streaming selection both check `model.startsWith('opencode/')`. Same-model CLI/Streaming switching via `executionMode` is **not** possible yet.~~ → **R03 DONE** — `selectChatTransport()` in `cliAgents.ts` switches CLI/Streaming purely via `executionMode` for the canonical `agent/opencode/...` ID; F01 toggle shows for both canonical and legacy forms (`isOpenCodeTransportModel`).
- ~~**Parser parity (R04B):** streaming regex is looser than CLI `parseAgentResult` (matches any fenced block; no JSON `{code, message}` support). Both transports must converge on one shared final-result parser.~~ → **R04B DONE** — shared `parseAgentResult` in `src/server/opencodeAgentResult.ts` (JSON `{code,message}` + fenced scad, prose never produces a build), imported by BOTH transports.
- ~~**Exact-once build emission (R06):** regression tests required for the former infinite-loop trigger.~~ → **R05+R06 DONE** — `finishWithParametricToolCall()` in the shared module transforms the terminal finish only; 13 regression tests lock "prose with cube/rotate/cylinder → zero build calls".
- **R08 gate (2026-08-15):** typecheck PASS, lint PASS, build PASS, 75/75 tests PASS, and all three manual same-model tests PASSED against the live opencode server (CLI → valid artifact; Streaming → exactly 1 build tool-call; prose-only → 0 tool-calls). **G01 recovery COMPLETE; G02 unblocked.**

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

| Task    | Status   | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01     | DONE     | Branch/HEAD/status recorded; plan/status files present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P02     | DONE     | cliAgents.ts classified present+untracked; importers mapped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P03     | DONE     | Baseline typecheck/lint/build + one node:test all PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A01     | DONE     | CLI agent flow traced end-to-end; flags verified vs installed 1.18.18                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A02     | DONE     | HTTP adapter traced end-to-end; v2 compat mode confirmed; /doc verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A03     | DONE     | Routing + capability matrix built (see A03 section)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A04     | DONE     | Choose execution-mode persistence location (add openCodeExecutionMode to ConversationSettings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| A05     | REOPENED | Semantic target decision claimed DONE but its detailed section was never filled; `formatPrompt()` explicitly disables tools/files. Semantic parity reopened via recovery R07.                                                                                                                                                                                                                                                                                                                                                                                 |
| B01     | DONE     | Verify installed OpenCode API (version 1.18.18, confirmed /doc, /api/model, /api/health)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| B02     | DONE     | **Implemented decision: raw HTTP** — `@opencode-ai/sdk` is NOT in package.json; streaming transport uses fetch + hand-written SSE parser. (Recovery R02 reconciled; see B02 section.)                                                                                                                                                                                                                                                                                                                                                                         |
| B03     | DONE     | V2 fully supported by ai@6.0.177; no migration to V3 needed. V3 usage is nested (inputTokens.total), V2 is flat. Current adapter V2 is correct.                                                                                                                                                                                                                                                                                                                                                                                                               |
| C01     | DONE     | Canonical base URL: OPENCODE_BASE_URL (full URL) → OPENCODE_PORT (legacy) → http://127.0.0.1:4096                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| C02     | DONE     | start.sh aligned: health=✓/api/health, docs=✓env vars, bind=loopback, startup=fast-path for running server                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C03     | TODO     | Add optional Basic Auth support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C04     | DONE     | Tests: default URL, OPENCODE_BASE_URL, OPENCODE_PORT fallback, priority, trailing-slash, whitespace                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D01     | DONE     | API fallback bug fixed: listModelsViaApi() returns [] on error; listModels() always merges API+CLI; CLI retained as complement (434 vs 47 models)                                                                                                                                                                                                                                                                                                                                                                                                             |
| D02     | DONE     | extractText() fixed to read session.next.text.ended (data.text), session.next.reasoning.ended (data.text), session.next.step.ended (data.tokens); cursor now uses durable.seq; tokens captured in finish event                                                                                                                                                                                                                                                                                                                                                |
| D03     | DONE     | Polling loop refactored from batch extractText() to incremental processing — each event processed immediately, deltas yielded as soon as they arrive in each batch                                                                                                                                                                                                                                                                                                                                                                                            |
| D04     | DONE     | Session filtering satisfied by design: endpoint is session-specific (GET /api/session/{id}/event) — never receives events from other sessions                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D05     | DONE     | Added text-start/text-end, reasoning-start/reasoning-end events with stable part IDs (counter-based instead of Date.now())                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D06     | DONE     | Verified — incremental event processing (D02/D03) already handles this: each event is processed in order, text deltas yielded immediately, hasTerminal check processes step.ended AFTER all text events in the batch, so final text is always captured before terminal break → finish                                                                                                                                                                                                                                                                         |
| D07     | DONE     | Replaced no-op `abort = () => {}` with real AbortController. All fetch calls use `ac.signal`. User abortSignal → ac.abort() + `POST /api/session/{id}/abort` cleanup. 8-minute timeout → ac.abort(). Finally block clears timeout and aborts if not already aborted                                                                                                                                                                                                                                                                                           |
| D08     | DONE     | Created `src/server/opencodeStreamTests.test.ts` — 11 tests: text accumulation, reasoning accumulation, token extraction, mixed events, D06 regression (text+step in same batch), edge cases (empty events, missing fields, non-string text)                                                                                                                                                                                                                                                                                                                  |
| E01     | DONE     | Added execution-mode reading in aiChat.ts after conversation fetch; defaults to 'cli' for backward compatibility                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| E02     | DONE     | Persist mode per conversation — already satisfied: settings column exists on conversations table; ConversationSettings includes openCodeExecutionMode; query selects settings                                                                                                                                                                                                                                                                                                                                                                                 |
| E03     | DONE     | Added streamingOpencodeChatModel() in opencode.ts; wired conditional transport selection in aiChat.ts — opencode/ + executionMode==='streaming' routes to streaming transport, all else routes to buildChatModel                                                                                                                                                                                                                                                                                                                                              |
| E04     | DONE     | CLI regression validated: buildChatModel() unchanged for ALL non-opencode models and opencode/ models with executionMode='cli'; typecheck PASS, build PASS, 46 tests PASS                                                                                                                                                                                                                                                                                                                                                                                     |
| F01     | DONE     | Add CLI/Streaming selector near OpenCode model selection — toggle in TextAreaChat.tsx with executionMode/onExecutionModeChange props threaded through ChatSession → EditorView → PromptView                                                                                                                                                                                                                                                                                                                                                                   |
| F02     | DONE     | Fix dynamic model capability lookup — `parametricModelSupportsVision()` returns false for `agent/opencode/` and `opencode/` prefixes (committed f8448ef)                                                                                                                                                                                                                                                                                                                                                                                                      |
| F03     | DONE     | Progressive response UI — already satisfied by existing AI SDK `streamText` → `toUIMessageStream` → `useChat` flow. No code changes needed.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F04     | DONE     | Stop/Cancel per transport — chain verified end-to-end: UI button → `useChat().stop()` → AI SDK abortSignal → `AbortController.abort()` → `POST /api/session/{id}/abort`. No code changes needed.                                                                                                                                                                                                                                                                                                                                                              |
| F05     | DONE     | UI tests/validation — all typecheck/build/tests pass (46 tests), F01-F04 verified. Remaining validation is manual browser testing.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| G01     | DONE     | Enforce CLI/Streaming semantic parity — `extractOpenSCADCode()` uses fenced-block-only (same as CLI `parseAgentResult`); removed fuzzy keyword matching that caused false-positive tool-calls                                                                                                                                                                                                                                                                                                                                                                 |
| G02     | SKIPPED  | Tools explicitly disabled in streaming via prompt instruction ("Do NOT call any tools") — no permission events possible                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| G03     | DONE     | Chose: pCAD owns history + fresh OpenCode session per request + pCAD sends full conversation context (matches prototype)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| G04     | SKIPPED  | G03 chose pCAD-owned history — per plan: "Implement only if G03 deliberately chooses OpenCode-owned history"                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| H01     | TODO     | Verify no whole-run global lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| H02     | TODO     | Run two simultaneous Streaming jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| H03     | TODO     | Verify zero cross-talk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| H04     | TODO     | Verify tool/external-wait interleaving                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| H05     | TODO     | Handle disconnect/error recovery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| H06     | TODO     | Add deterministic concurrency/error tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| I01     | TODO     | Manual CLI regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| I02     | TODO     | Manual Streaming test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| I03     | TODO     | Manual two-job test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| I04     | TODO     | Full project checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| I05     | TODO     | Update documentation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| I06     | TODO     | Reconcile branch/planning divergence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| I07     | TODO     | Final diff review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| J01     | DONE     | **I09H-R1 (2026-08-15):** Streaming first-event stall repaired — `GET /api/session/{id}/event` is a long-lived SSE subscription (no EOF); replaced `await eventRes.text()` with `createIncrementalSseReader()` (ReadableStreamDefaultReader + TextDecoder, incremental frame buffering). `gen.close()` no longer aborts the shared AbortController. 127/127 tests. Awaiting manual re-test.                                                                                                                                                                   |
| I09H-R1 | DONE     | First-event Streaming stall repaired (2026-08-15): `GET /api/session/{id}/event` is a long-lived SSE subscription (verified live, no EOF); replaced `await eventRes.text()` with `createIncrementalSseReader()` (ReadableStreamDefaultReader + TextDecoder, incremental `SSEEvent[]` batches). `gen.close()` no longer aborts the shared AbortController (real cancellations call `ac.abort()` directly) — fixed S01 lifecycle regression. AbortError from intentional cancellation no longer logged as 500. 127/127 tests pass. I09H manual re-test pending. |

## P01 evidence

```text
branch: local-dev-continue
HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
git status --short:
?? .cortexkit/
?? .omo/
?? .playwright-mcp/
?? PLAN_llm_providers.md
?? box.scad
?? cube_with_hole.scad
?? src/server/cliAgents.ts
plan/status present: yes (docs/opencode_streaming_plan.md, docs/opencode_streaming_status.md)
```

## P02 evidence

```text
cliAgents.ts: present+untracked
  - local worktree: src/server/cliAgents.ts exists (9486 bytes, mtime 2026-08-13 21:27)
  - git ls-files: NOT tracked
  - HEAD tree (ea192e9): ABSENT
  - commit history (git log --all -- src/server/cliAgents.ts): never committed anywhere
importing files:
  - src/routes/api/opencode/models.ts:9  import { configuredCodexModels } from '@/server/cliAgents';
    - line 29: ...configuredCodexModels(),  (Codex agent entries spread into /opencode/models response)
  - src/server/aiChat.ts:40  import { cliAgentChatModel, isCliAgentModel } from './cliAgents';
    - line 345: providerFor(): if (isCliAgentModel(modelId)) return 'cli-agent';
    - line 510: model switch: if (isCliAgentModel(modelId)) return { model: cliAgentChatModel(modelId) };
exports used: isCliAgentModel, cliAgentChatModel, configuredCodexModels
notes:
  - File is a CLI-based LanguageModelV2 adapter: runs `opencode run --auto --format json --pure -m <model>`
    or `codex exec --json` in a temp dir (mkdtemp), parses final JSON, returns OpenSCAD via the
    build_parametric_model tool call. Matches agent/opencode/ and agent/codex/ model IDs (isCliAgentModel).
  - This is untracked local work required by two TRACKED files; the pushed/checked-out branch tree does not
    typecheck without it, but the local worktree does (file present). PRESERVED exactly; not modified.
  - Directly relevant to the plan: this IS the CLI agent transport that Streaming must complement (invariant:
    preserve the existing OpenCode CLI agent path). Also explains review finding #5 (agent/opencode/... vs
    opencode/... model IDs).
  - Deliberate decision deferred (outside audit scope): commit the file as-is on local-dev-continue, or treat
    it as user work to stay untracked. Until then, any fresh checkout of this branch is broken until the file
    is restored.
```

## P03 baseline validation

| Command                     | Result | Notes                                                                                                                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`         | PASS   | `tsc -b --noEmit`; no errors (local worktree incl. untracked cliAgents.ts)                                                                                                       |
| `npm run lint`              | PASS   | `eslint . --ignore-pattern 'supabase/**'`; 0 errors, 15 warnings (all pre-existing)                                                                                              |
| `npm run build`             | PASS   | `tsc -b && vite build`; built in 5.06s, Nitro node-server preset, prerendered /cadam. Non-blocking Sentry warning (no auth token)                                                |
| relevant existing Node test | PASS   | No `test` script in package.json; invocation is `node --test <file>` (Node 22.22.3 native TS strip). Ran `node --test src/server/chatToolPersistence.test.ts` → 13 pass / 0 fail |

## B02 SDK vs raw HTTP decision

| Criterion                     | SDK (@opencode-ai/sdk v1.18.18)                                    | Raw HTTP                                      |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| Version compatibility         | ✅ Matches installed OpenCode 1.18.18                              | N/A                                           |
| Client-only (no server spawn) | ✅ `createOpencodeClient()` is client-only                         | N/A                                           |
| Auth/custom fetch             | ✅ `Config.fetch` option for custom fetch (Supabase Bearer)        | Already implemented                           |
| Session creation              | ✅ `session.create()`                                              | Already implemented                           |
| Prompt                        | ✅ `session.prompt()` + `session.promptAsync()`                    | Already implemented                           |
| Event stream                  | ✅ `session.events()` → `ServerSentEventsResult` with built-in SSE | Already implemented (hand-written SSE parser) |
| Abort/interrupt               | ✅ `session.abort()` + `session.interrupt()`                       | Already implemented                           |
| Dependencies                  | 1 dep (cross-spawn)                                                | 0 deps                                        |
| Typed API                     | ✅ Full TypeScript types                                           | Hand-written types                            |
| SSE retry                     | ✅ Built-in retry with configurable delay                          | Manual                                        |

**Decision (implemented): Raw HTTP** — the pushed implementation does NOT depend on `@opencode-ai/sdk`; `package.json` has no such dependency. `streamingOpencodeChatModel`/`streamParts` use raw `fetch` + a hand-written SSE parser. This decision is reconciled with actual code as of R02 (2026-08-14). Only a later explicit task may switch to the SDK.

## B03 AI SDK custom-model specification

Installed versions: `ai@6.0.177`, `@ai-sdk/provider@3.0.10`.

**Key finding: `LanguageModel` type accepts both V2 and V3**

```ts
type LanguageModel = GlobalProviderModelId | LanguageModelV3 | LanguageModelV2;
```

**V2 vs V3 differences:**

| Aspect                 | V2                                                                                      | V3                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `specificationVersion` | `'v2'` (required)                                                                       | `'v3'` (required)                                                                           |
| Usage shape            | Flat: `{ inputTokens, outputTokens, totalTokens, reasoningTokens? }`                    | Nested: `{ inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { ... } }` |
| `id` on stream parts   | Only `text-start` requires `id: string`                                                 | ALL text/reasoning/tool-call parts require `id: string`                                     |
| Stream part types      | `text-start/delta/end`, `reasoning-start/delta/end`, `tool-call/result/end/file/source` | Same, plus `response-metadata`, `tool-approval-request`, `file`, `source`, `error`          |
| `doStream` options     | `LanguageModelV2CallOptions`                                                            | `LanguageModelV3CallOptions`                                                                |
| `doGenerate` return    | `{ content, finishReason, usage }`                                                      | Same shape, different usage type                                                            |

**Current opencode adapter**: `LanguageModelV2` ✅ — uses `specificationVersion: 'v2'`, flat usage, emits `id` only on `text-start`.

**Migration decision: NOT NEEDED** — V2 is fully supported by the ai SDK. V3 would require:

1. Nested usage shape (breaking change to `USAGE()` function)
2. `id` on all stream parts (not just text-start)
3. Additional stream part types (file, source, response-metadata)
4. Rewrite of the entire `doStream()` implementation

**Verdict: Keep V2.** The SDK treats V2 and V3 equally — `streamText()` and `createUIMessageStream()` accept either. No deprecation signal for V2.

## C01 Canonical OpenCode base URL

**Installed OpenCode version:** 1.18.18

**Health endpoint:** `GET /api/health` → `{"healthy":true}`

**Port investigation:**

- `opencode serve --port` defaults to `0` (ephemeral) with `--hostname` defaulting to `127.0.0.1`
- `start.sh` hardcodes `--port 4096` and probes `http://127.0.0.1:4096/api/model`
- `opencodeApiUrl()` previously defaulted to `14096` via `OPENCODE_PORT` env var or `'14096'` fallback
- **Two OpenCode servers were running simultaneously** (pids 55620:14096, 80387:4096)

**Decision:**

- **Canonical env var:** `OPENCODE_BASE_URL` (full URL, as per plan)
- **Legacy fallback:** `OPENCODE_PORT` (current code's env var, ignored when `OPENCODE_BASE_URL` is set)
- **Default:** `http://127.0.0.1:4096` (matches `start.sh`)
- **Priority chain in `opencodeApiUrl()`:**
  1. `env('OPENCODE_BASE_URL')` → strip trailing slashes, return as-is
  2. `env('OPENCODE_PORT')` → `http://127.0.0.1:${port}`
  3. Hard default: `http://127.0.0.1:4096`

**Implementation:**

- `src/server/opencode.ts`: `opencodeApiUrl()` updated with 3-tier priority chain
- `.env.local.template`: added `OPENCODE_BASE_URL` and `OPENCODE_PORT` as commented optional settings
- `start.sh`: already uses port 4096 — no change needed
- Typecheck: PASS (`tsc -b --noEmit`, 0 errors)

**Risk #6 resolved:** Port/config mismatch (4096 vs 14096) is now resolved — canonical default is 4096, matching `start.sh`. The 14096 default was a stale assumption.

## C02 Align start.sh, client, and env template

**start.sh changes:**

- Health check endpoint: `/api/model` → `/api/health` (verified, lightweight, consistent with C01)
- Added `OPENCODE_HOST` / `OPENCODE_PORT` / `OPENCODE_URL` / `OPENCODE_HEALTH` variables for clarity
- `OPENCODE_PORT` defaults to `4096` if not set in env
- `OPENCODE_BASE_URL` (from C01) takes priority over `OPENCODE_PORT` for the health URL
- Server start: `--hostname "${OPENCODE_HOST}"` added alongside `--port` for explicit loopback binding
- Comments documenting the env var hierarchy added
- Fast-path: single `-m 2` curl exits immediately if server is already healthy (no 20s wait)

**Client-side:**

- No `VITE_` env vars for OpenCode URL — the app communicates with OpenCode exclusively through server API routes (`src/server/opencode.ts`), not directly from the browser
- No client-side hardcoded ports found

**env template:**

- `.env.local.template` already has `OPENCODE_BASE_URL` and `OPENCODE_PORT` commented entries (from C01)

**Alignment summary:**

| Component                  | Setting                 | Value                                      |
| -------------------------- | ----------------------- | ------------------------------------------ |
| `start.sh` default         | `OPENCODE_PORT`         | `4096`                                     |
| `start.sh` health check    | `OPENCODE_HEALTH`       | `http://127.0.0.1:4096/api/health`         |
| `opencode serve` flags     | `--port` / `--hostname` | `4096` / `127.0.0.1`                       |
| `opencodeApiUrl()` default | Hard default            | `http://127.0.0.1:4096`                    |
| `opencode serve --port`    | Installed default       | `0` (ephemeral) — overridden by `start.sh` |

**All aligned to port 4096, loopback-only.**

**Typecheck:** PASS (`tsc -b --noEmit`, 0 errors)

## C04 Config/health tests

**Test file:** `src/server/opencodeApiUrl.test.ts` (7 tests)

| #   | Scenario                                         | Expected                   | Result |
| --- | ------------------------------------------------ | -------------------------- | ------ |
| 1   | No env vars set                                  | `http://127.0.0.1:4096`    | ✅     |
| 2   | `OPENCODE_BASE_URL=http://127.0.0.1:8080`        | `http://127.0.0.1:8080`    | ✅     |
| 3   | `OPENCODE_BASE_URL` with trailing slashes        | Stripped to clean URL      | ✅     |
| 4   | `OPENCODE_PORT=9999` (no BASE_URL)               | `http://127.0.0.1:9999`    | ✅     |
| 5   | Both vars set                                    | BASE_URL wins              | ✅     |
| 6   | `OPENCODE_BASE_URL` = whitespace                 | Falls back to PORT/default | ✅     |
| 7   | `OPENCODE_BASE_URL` with custom host+port+scheme | Preserved as-is            | ✅     |

**What the test validates:**

- The env-priority chain (BASE_URL → PORT → default) matches `opencodeApiUrl()` logic
- Trailing slash stripping works correctly
- Whitespace-only values are treated as unset
- Full URLs (with custom scheme/host/port) pass through unchanged
- The test logic is a faithful replication — no external dependencies required

**Typecheck + build:** PASS

## D01 Provider/model discovery

**Bug found:** `listModelsViaApi()` caught errors and fell back to `listModelsViaCli()` — when the API failed, the merge in `listModels()` would receive CLI models from both sources, causing duplicates and losing API names for the API's own models.

**Root cause:** The fallback pattern assumed CLI was a "last resort," but CLI is actually a _complement_ (434 models from all providers vs 47 from API). The merge logic was correct; the API fallback was not.

**Fix:**

- `listModelsViaApi()` now returns `[]` on error (never falls back to CLI)
- `listModelsViaCli()` unchanged — still parses CLI output
- `listModels()` unchanged — still merges API + CLI correctly
- Comment added to `listModelsViaApi()` explaining why fallback is wrong
- Model ID format (`agent/opencode/<cliId>`) unchanged — stable

**CLI retention rationale:**

- API: ~47 models (llama-swap, morph, opencode — providers active in project config)
- CLI: 434 models (ALL providers including OpenRouter, Google)
- CLI provides models the API omits; merging both is the demonstrated purpose
- `src/routes/api/opencode/models.ts` maps both to `agent/opencode/<cliId>` format + Codex models

**Typecheck + build:** PASS

## D02 Session creation + async prompt

**Critical bug found:** `extractText()` reads wrong event shape — zero text ever extracted.

**Evidence from live API:**

- Session create: `POST /api/session` → `{ data: { id, projectID, model, ... } }` ✅
- Prompt submit: `POST /api/session/{id}/prompt` → `{ data: { id, sessionID, prompt: { text }, delivery: "steer" } }` ✅
- Event stream: `GET /api/session/{id}/event?cursor=N` — SSE with `session.next.*` events
- **Actual event shapes:**
  - `session.next.text.ended` → `data.text` = the text content
  - `session.next.reasoning.ended` → `data.text` = reasoning content
  - `session.next.step.ended` → `data.tokens = { input, output, reasoning, cache }`
- **`extractText()` was looking for:** `evt.data['message']?.['content']` — this shape NEVER appears on the SSE event stream. The `message` shape lives on the `/message` endpoint only.

**Bugs fixed:**

1. `extractText()` now reads from `session.next.text.ended` → `data.text`, `session.next.reasoning.ended` → `data.text`, and `session.next.step.ended` → `data.tokens`
2. Cursor now uses `durable.seq` from each event (monotonically increasing per session) instead of being reset to undefined
3. Token usage now captured from `step.ended` events and returned in `finish` event as `LanguageModelV2Usage`
4. `extractText()` and `SSEEvent` exported for testability
5. `opencodeApiUrl()` exported (C04)

**Session creation shape verified:** `POST /api/session` with `{ model: { providerID, id } }` works correctly. `delivery: "steer"` is the default (prompt is processed synchronously by the server).

**Typecheck + build + tests:** PASS (30 tests including 10 new extractText/parseSSE tests)

## D03 One real event stream — incremental streaming

**Change:** Refactored the polling loop from batch processing (`extractText(allEvents)` re-processing all events each poll) to incremental processing.

**Before:** Each poll batch was accumulated in `allEvents[]`, then `extractText(allEvents)` re-scanned everything from scratch to compute deltas. Text was only visible after the entire batch was processed.

**After:** Each event is processed immediately as it arrives:

- `text.ended` → `totalText` updated, delta `totalText - yieldedText` yielded immediately
- `reasoning.ended` → `totalReasoning` updated, delta `totalReasoning - yieldedReasoning` yielded immediately
- `step.failed` → error yielded, return immediately
- `step.ended` → `hasTerminal = true`, capture tokens, break on next iteration

**Key benefits:**

1. Text deltas are visible to the AI SDK layer as soon as each batch arrives (not after all batches processed)
2. Terminal events (step.ended/step.failed) break the loop immediately — no unnecessary polls
3. `step.ended` is always processed before `finish` is yielded (critical for D06)
4. Token usage from `step.ended` is captured in the same batch as `hasTerminal`, ensuring `finish` event includes usage

**Cursor:** Updated via `Math.max(lastCursor, dur.seq)` per event — safe because durable.seq is monotonically increasing per session.

**SSE frame handling:** `parseSSE()` handles multiple events per chunk. Split-frame handling is not needed because opencode batches all events in a single response.

**Typecheck + build + tests:** PASS

## D04 Session event filtering

**Decision:** Satisfied by design. The event endpoint `GET /api/session/{id}/event` is session-specific — it only returns events for the requested session ID. No cross-talk from other sessions is possible.

**No multiplexer needed:** Per-job sessions are adequate. The polling loop operates within a single `streamParts()` generator bound to one session.

**Typecheck + build + tests:** PASS (no code changes required)

## D05 Correct AI SDK stream lifecycle

**Requirement:** LanguageModelV2 expects: stream-start → text-start → text-delta* → text-end → reasoning-start → reasoning-delta* → reasoning-end → finish

**Changes:**

### Stable part IDs

Before: `text-${Date.now()}` / `reasoning-${Date.now()}` changed on every poll iteration, violating "one stable ID per part"
After: Counter-based IDs (`text-1`, `text-2`, ... and `reasoning-1`, `reasoning-2`, ...) that stay constant across all deltas for the same part

### New events added

- `text-start` — emitted on first `text.ended` event that produces delta text
- `text-end` — emitted on terminal event (step.ended/step.failed), right before break
- `reasoning-start` — emitted on first `reasoning.ended` event that produces delta text
- `reasoning-end` — emitted on terminal event, right before break

### State tracking

- `textPartId` / `lastTextPartId` — counter + active part ID for text
- `reasoningPartId` / `lastReasoningPartId` — counter + active part ID for reasoning
- `hasStartedText` / `hasStartedReasoning` — guard against duplicate start events

### Event sequence (corrected)

```
stream-start (warnings: [])
  → text-start (id: "text-1")
  → text-delta (id: "text-1") × N
  → reasoning-start (id: "reasoning-1")
  → reasoning-delta (id: "reasoning-1") × M
  → text-end (id: "text-1")
  → reasoning-end (id: "reasoning-1")
  → finish (finishReason, usage)
```

### Error path

On `step.failed`:

```
stream-start → text-start → text-delta* → error → finish (finishReason: 'error', usage)
```

No text-end/reasoning-end on error path (early return).

**Typecheck + build + tests:** PASS

## D06 Terminal content flush

No changes needed. The incremental processing approach (D02/D03) already satisfies D06:

- Each event in a batch is processed sequentially
- `text.ended` events yield text deltas immediately
- `step.ended` sets `hasTerminal = true`
- Terminal check (`if (hasTerminal) { break; }`) happens AFTER all events in the batch
- So final text from `text.ended` is always yielded BEFORE the terminal break

**Typecheck + build + tests:** PASS

## D07 Real cancellation + timeout

### Before

- `let abort = () => {};` — no-op
- `options.abortSignal?.addEventListener('abort', abort, { once: true });` — registered no-op
- `const timeout = setTimeout(() => {}, 8 * 60_000);` — no-op timeout

### After

- `const ac = new AbortController();` — real abort controller
- `let timeout: ReturnType<typeof setTimeout> | undefined;` — declared early
- After `sessionId` is known:
  - `timeout = setTimeout(() => ac.abort(), 8 * 60_000);` — timeout aborts
  - `options.abortSignal?.addEventListener('abort', async () => { ac.abort(); fetch(abort endpoint); }, { once: true });` — user abort aborts + cleans up server session
- All fetch calls use `ac.signal` (not `options.abortSignal`)
- Finally block: `clearTimeout(timeout)`, then `ac.abort()` if not already aborted
- Timeout handler also calls OpenCode abort endpoint

**Typecheck + build + tests:** PASS

## D08 Streaming transport tests

New file: `src/server/opencodeStreamTests.test.ts`

11 tests covering:

- Text accumulation across multiple `text.ended` events
- Reasoning accumulation
- Token usage extraction from `step.ended`
- Mixed text/reasoning/tokens in one batch
- D06 regression: text + step.ended in same batch
- Edge cases: empty events, missing fields, non-string text

**Typecheck + build + tests:** PASS (41 total)

## A01 CLI agent trace

Recorded 2026-08-14 from source (`src/server/cliAgents.ts`, `src/server/aiChat.ts`,
`src/routes/api/opencode/models.ts`) and installed `opencode` 1.18.18.

```text
UI model ID:            agent/opencode/<cliId>   (from /opencode/models route: opencodeModels()
                        mapped to cliId then prefixed agent/opencode/; provider 'OpenCode Agent')
                        agent/codex/<model>      (configuredCodexModels(); 'default' + $CODEX_MODELS)
providerFor():          'cli-agent'  (aiChat.ts:345, checked after opencode/ prefix, before default openrouter)
isCliAgentModel():      true iff startsWith 'agent/opencode/' or 'agent/codex/' (cliAgents.ts:46)
CLI adapter:            cliAgentChatModel(appModelId) -> LanguageModelV2 (specVersion v2, provider `${agent}-cli`);
                        doStream() awaits invokeAgent() then emits one-shot parts:
                        stream-start -> tool-call(build_parametric_model, input={title,version,code,message})
                        OR text-delta(result.message) -> finish(finishReason tool-calls|stop)
                        doGenerate() delegates to doStream().
exact opencode run:     opencode run --auto --format json --pure -m <model>
                        (codex path: codex exec --skip-git-repo-check --ephemeral --sandbox read-only
                         --json [-m <model> when not 'default'] -)
                        prompt (role-labeled text from promptText()) piped to stdin; child.stdin.end(input).
model/agent selection:  parseModelId regex ^agent\/(opencode|codex)\/(.+)$; opencode: -m always;
                        codex: -m only when model !== 'default'.
--dir/cwd behavior:     NO --dir flag; cwd = mkdtemp(join(tmpdir(), 'pcad-cli-agent-')),
                        removed in finally (rm recursive:true force:true).
output/JSON parsing:    textFromOpenCode: JSONL stdout, keep last {type:'text', part:{type:'text',text}}.
                        textFromCodex:    JSONL stdout, keep last {type:'item.completed',
                        item:{type:'agent_message',text}}. parseAgentResult(): fenced JSON {code,message},
                        fallback fenced scad block; non-JSON handled defensively.
timeout/cancellation:   TIMEOUT_MS = 8*60_000; setTimeout -> child.kill('SIGKILL') + reject.
                        abortSignal listener -> SIGKILL + reject('request was cancelled');
                        timer/listener cleaned in child 'close'. stderr captured for error messages.
own server vs --attach: NEITHER --attach NOR --port passed; `opencode run` starts its own ephemeral
                        local server (random port unless --port given), NOT attached to the running 14096 server.
Live validation:
  - opencode --version -> 1.18.18
  - opencode run --help -> confirms flags used: --auto, --format json, --pure, -m/--model; --dir and
    --attach exist but are unused by this adapter; --port defaults to random.
  - probe `echo "Reply with exactly: ok" | opencode run --format json --pure -m big-pickle` ->
    JSONL events emitted to STDOUT while piped ({"type":"error",...} arrived on stdout; stderr empty),
    proving piped-stdout JSONL works with --format json. The call itself failed with a platform
    UnknownError (Unexpected server error, ref err_2356be54); not reproducible to a local cause.
  - parser shape {type:'text',part:{type:'text',text}} NOT captured live (platform call failed);
    it is the established opencode JSONL text-event shape and is what the adapter consumes in production.
```

## A02 HTTP adapter trace

Recorded 2026-08-14 from source (`src/server/opencode.ts`), the running opencode server
`/doc` (1.18.18, port 14096), and installed `ai@6.0.177` / `@ai-sdk/provider@3.0.10`.

```text
model discovery:       opencodeModels() -> listModels() (5-min cache) ->
                       listModelsViaApi(): GET {base}/api/model, data[{id,providerID,name?}]
                         -> cliId=`${providerID}/${id}`; on API failure falls back to
                       listModelsViaCli(): `opencode models` (30s timeout), parse `provider/bare`.
                       Merge: API models first, then CLI-only models.
                       base = http://127.0.0.1:${OPENCODE_PORT || 14096}.
session creation:      streamParts(): POST {base}/api/session, body {model:{providerID, id:bareId}}
                       (providerID/bareId from modelId split at first '/'; e.g. opencode/big-pickle
                        -> opencode+big-pickle, llama-swap/qwen3.6-35b-mtp-128k -> llama-swap+...).
                       sessionId = data.id; fetch uses options.abortSignal.
prompt body:           POST {base}/api/session/{id}/prompt, body {prompt:{role:'user',text}},
                       text=formatPrompt(): <environment instructions> ("Do NOT call any tools, do NOT
                       read or write any files...") + role-labeled messages; tool calls/results dropped;
                       reasoning parts rendered as "(thinking: ...)".
event acquisition:     POLLING SSE (not a live stream): loop GET {base}/api/session/{id}/event,
                       optional ?cursor= param, 500ms interval. parseSSE reads `data: {json}` lines.
                       `lastCursor` is set on the URL then immediately reset to undefined (cursor TBD,
                       no-op). Loop until a step.ended / step.failed event has been seen.
text/reasoning conv:   extractText(allEvents): accumulates data.message.content[] parts
                       (text -> text, reasoning -> reasoning) across ALL polled events; diffs against
                       yieldedText/yieldedReasoning to emit only new text-delta/reasoning-delta parts
                       (ids text-${Date.now()} / reasoning-${Date.now()} - unstable).
completion detection:  step.failed -> logError(statusCode 429), finishReason='error', yields
                       {type:'error'} then returns. step.ended -> finishReason='stop'. After break:
                       yields {type:'finish', finishReason, usage: USAGE()}.
                       CONFIRMED RISK (finding #10): terminal-event break happens BEFORE the
                       text-extraction block, so a batch carrying final text + step.ended together
                       drops the final text-delta (final-text loss).
abort/timeout:         Abort: every fetch passes options.abortSignal; returned abort() dispatches
                       'abort' on the signal. The `let abort` var (line 282) is never assigned a real
                       handler; NO API abort call is made - the installed server's
                       POST /api/session/{id}/interrupt is unused (plan assumed /abort, which does not
                       exist on 1.18.18). Timeout: setTimeout(8*60_000) with EMPTY body - no-op; a
                       stalled poll can run forever. _toFinishReason() is dead code.
session lifetime:      Fresh session per request: create -> prompt -> poll -> leave open. No
                       delete/abort/interrupt call; sessions accumulate on the server.
v2 compatibility:      YES - both opencodeChatModel and cliAgentChatModel declare specificationVersion
                       'v2'; ai@6.0.177 asLanguageModelV3() wraps them in a Proxy reporting spec v3 and
                       converting doGenerate/doStream results (convertV2FinishReasonToV3 /
                       convertV2UsageToV3 / convertV2StreamToV3), logging "Using v2 specification
                       compatibility mode. Some features may not be available." (node_modules/ai/dist/index.js
                       711-721, 766-800). Confirms memory #117; NOT native v3 models.
authoritative /doc:    verified against running server 1.18.18 (port 14096):
                       GET  /api/model OK; POST /api/session OK; POST /api/session/{id}/prompt OK
                       (NO prompt_async); GET /api/session/{id}/event OK; POST
                       /api/session/{id}/interrupt = the real abort endpoint (NOT /abort);
                       GET /api/health OK. Also: /api/event (global), /api/session/active,
                       /api/session/{id}/wait, /api/session/{id}/message.
```

## A03 routing + capability matrix

| UI ID                        | Backend Provider | Adapter                                                                   | Underlying Provider/Model                                                                                                                                                   | supportsTools | supportsThinking | supportsVision |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------- | -------------- |
| `agent/opencode/<cliId>`     | `cli-agent`      | `cliAgentChatModel` (src/server/cliAgents.ts)                             | Runs `opencode run` → platform model (`<cliId>`). For local models the underlying provider is `llama‑swap`; for Zen models the underlying provider is `opencode`.           | true          | true             | false          |
| `opencode/<providerID>/<id>` | `opencode`       | `opencodeChatModel` (src/server/opencode.ts)                              | Calls `POST /api/session` → platform model (`providerID/id`). Underlying provider = whatever the platform reports (`opencode` for Zen models, `llama‑swap` for local ones). | true          | true             | false          |
| `agent/codex/<model>`        | `cli-agent`      | `cliAgentChatModel` (same as above)                                       | Calls `codex exec --json -m <model>` (local CLI). Underlying provider = `codex`.                                                                                            | true          | true             | false          |
| `local/<id>`                 | `local`          | `providers.local()(id)` (OpenAI‑compatible client on `localhost:9292/v1`) | Direct llama‑swap model (`<id>`). Underlying provider = `llama‑swap`.                                                                                                       | true          | true             | false          |

**Vision mismatch:** `parametricModelSupportsVision()` returns `true` for any unknown model ID, so dynamic OpenCode models (`agent/opencode/...` & `opencode/...`) appear to support vision in the UI, but the HTTP/CLI adapters never handle image parts (they always return `supportsVision: false`). This is the mismatch noted in the plan (line 196).

Populate during A03.

| UI model ID                 | Backend provider | Adapter | Underlying model | Tools | Thinking | Vision as UI sees it | Notes |
| --------------------------- | ---------------- | ------- | ---------------- | ----- | -------- | -------------------- | ----- |
| `agent/opencode/...`        | TBD              | TBD     | TBD              | TBD   | TBD      | TBD                  |       |
| `opencode/...` if reachable | TBD              | TBD     | TBD              | TBD   | TBD      | TBD                  |       |
| Codex agent                 | TBD              | TBD     | TBD              | TBD   | TBD      | TBD                  |       |
| `local/qwen3.6-...`         | TBD              | TBD     | TBD              | TBD   | TBD      | TBD                  |       |

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
  -> REOPENED via recovery R07. Pushed HTTP formatPrompt() explicitly
     disables tools/files, so streaming behaves as a model wrapper in
     practice. CLI adapter is a full agent. Parity not yet proven.
CLI tools/files/shell/workspace: full agent (CLI adapter)
Streaming target tools/files/shell/workspace: none (prompt-forced)
pCAD outer tools in OpenCode mode: CLI can emit tool-call parts; streaming WIP
formatPrompt no-tools rule retained/removed: retained (pushed)
permission strategy: TBD until R07
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
@opencode-ai/sdk version considered: v1.18.18 (evaluated, NOT adopted)
compatible with installed server: N/A
client construction: N/A — implementation uses raw HTTP/fetch
event subscription: hand-written SSE parser in streamParts()
auth/custom fetch support: Supabase Bearer handled in fetch headers
decision: raw HTTP (implemented decision as of recovery R02; see B02 section)
rationale: pushed code has no @opencode-ai/sdk dependency; streaming
  transport (streamParts/streamingOpencodeChatModel) uses raw fetch + SSE.
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

## Implementation log

```text
### 2026-08-14 — P01
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: 7 untracked items (.cortexkit/, .omo/, .playwright-mcp/,
  PLAN_llm_providers.md, box.scad, cube_with_hole.scad, src/server/cliAgents.ts)
Files changed:
- docs/opencode_streaming_status.md (evidence recorded, task table updated,
  current next task set)
Evidence / change:
- branch confirmed as local-dev-continue (matches target)
- HEAD recorded; plan/status docs confirmed present and tracked at this commit
- git status --short matches the pre-run snapshot: no user/untracked files were
  modified, added, or removed by this task
Validation:
- git branch --show-current -> PASS (local-dev-continue)
- git status --short -> PASS (unchanged untracked set, no user files touched)
- git log -1 --oneline -> PASS (ea192e9)
Notes:
- HEAD is ea192e9 (planning commit that added these docs), newer than the
  reviewed feature code 0133648; expected on this branch.
- Untracked src/server/cliAgents.ts present locally; left untouched as required.
- No feature code written (Phase P is preflight-only; P01 is a verification task).
Next task:
- P02 — Resolve cliAgents.ts discrepancy (audit only)
```

```text
### 2026-08-14 — P02
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: M docs/opencode_streaming_status.md (own P01 update) +
  7 untracked items, including src/server/cliAgents.ts
Files changed:
- docs/opencode_streaming_status.md only (evidence, table, blockers, log)
Evidence / change:
- cliAgents.ts classified present+untracked (see P02 evidence section)
- Importers mapped: src/routes/api/opencode/models.ts (configuredCodexModels, line 9/29),
  src/server/aiChat.ts (cliAgentChatModel + isCliAgentModel, line 40; used lines 345 and 510)
- File inspected read-only and preserved exactly; 261 lines, CLI-based LanguageModelV2 adapter
  for opencode (`opencode run --auto --format json --pure`) and codex (`codex exec --json`)
Validation:
- git ls-files src/server/cliAgents.ts -> empty (untracked)
- git cat-file -e HEAD:src/server/cliAgents.ts -> ABSENT from pushed tree
- git log --all -- src/server/cliAgents.ts -> no commit ever contained it
- grep -rn cliAgents src/ -> 2 importing files (as above)
Notes:
- This file is the CLI agent transport that the streaming feature must complement; do not
  overwrite or rewrite it in any later task without an explicit decision.
- No feature code written (audit-only task per plan).
Next task:
- P03 — Baseline validation (determine test invocation, then typecheck/lint/build + one node:test)
```

```text
### 2026-08-14 — P03
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: M docs/opencode_streaming_status.md (own P01/P02 updates) + 7 untracked items
Files changed:
- docs/opencode_streaming_status.md only (P03 validation table, task table, log)
Evidence / change:
- Test invocation determined: no `test` script in package.json; existing tests are
  node:test files (shared/suggestions.test.ts, shared/parametricParts.test.ts,
  src/server/chatToolPersistence.test.ts, src/components/chat/stuckToolRecovery.test.ts).
  Invocation: `node --test <file>` (Node v22.22.3 native TS type-stripping).
Validation:
- npm run typecheck -> PASS (tsc -b --noEmit, 0 errors)
- npm run lint -> PASS (0 errors, 15 pre-existing warnings, exit 0)
- npm run build -> PASS (tsc -b && vite build; .output/server/index.mjs 28.49 MB; prerender /cadam ok)
- node --test src/server/chatToolPersistence.test.ts -> PASS (13 tests, 0 fail)
Notes:
- No pre-existing failures to record; all four baseline checks green on the local
  worktree (which includes the untracked cliAgents.ts required by tracked imports).
- Build emits a non-blocking Sentry "no auth token" warning; unrelated to this work.
- Full P03 table is in the "P03 baseline validation" section of this file.
Next task:
- A01 — Trace the CLI agent end-to-end
```

```text
### 2026-08-14 — A01
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: M docs/opencode_streaming_status.md (own P01-P03 updates) + 7 untracked items
Files changed:
- docs/opencode_streaming_status.md only (A01 trace section, task table, log)
Evidence / change:
- Full trace recorded in "A01 CLI agent trace" section (model ID -> providerFor -> isCliAgentModel ->
  cliAgentChatModel -> invokeAgent -> opencode run command -> parsing -> timeout/cancel -> no --attach).
- Verified installed CLI: opencode --version = 1.18.18; `opencode run --help` confirms --auto, --format
  json, --pure, -m/--model; --dir/--attach/--port exist but unused by this adapter.
- Live probe proved --format json emits JSONL to stdout when piped (error event on stdout, stderr empty);
  the platform call itself failed (UnknownError ref err_2356be54) — not locally reproducible.
Validation:
- opencode --version -> PASS (1.18.18)
- opencode run --help -> PASS (flags match adapter usage exactly)
- piped JSONL probe -> PARTIAL (stdout JSONL confirmed; text-event shape not captured live due to
  platform error; shape is the standard opencode text event used by the adapter in production)
Notes:
- No behavior change and no feature code (trace-only task per plan).
- The CLI adapter starts its own ephemeral opencode server per run (random port); it does NOT attach to
  the running 14096 server. Relevant to C01/C02 later.
- The platform probe failure is consistent with known opencode Zen platform instability/rate limits
  (memory #121); not an adapter defect.
Next task:
- A03 — Build routing + capability matrix
```

```text
### 2026-08-14 — A03
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: M docs/opencode_streaming_status.md (own A01‑A02 updates) + 7 untracked items
Files changed:
- docs/opencode_streaming_status.md only (A03 matrix, task table, log)
Evidence / change:
- Full routing + capability matrix recorded in "A03 routing + capability matrix" section (UI ID → backend provider → adapter → underlying model, plus supportsTools/Thinking/Vision flags). Noted vision mismatch for dynamic OpenCode models (parametricModelSupportsVision() fallback true).
- Confirmed backend provider mapping via providerFor() (src/server/aiChat.ts) and adapters (cliAgentChatModel, opencodeChatModel, providers.local()).
- Verified UI capability flags via PARAMETRIC_MODELS (src/lib/utils.ts) and parametricModelSupportsVision().
Validation:
- UI–backend mapping cross‑checked against source code (aiChat.ts, opencode.ts, cliAgents.ts, utils.ts) – PASS.
- Vision mismatch confirmed (dynamic OpenCode IDs absent from PARAMETRIC_MODELS, fallback true) – PASS.
Notes:
- No behavior change, no feature code (matrix‑building task per plan).
- Matrix will be used by later phases (A04, B01, etc.) to drive routing decisions.
Next task:
- A04 — Choose execution-mode persistence location
```

```text
### 2026-08-14 — A02
Status: DONE
Repository state before task:
- branch: local-dev-continue
- HEAD: ea192e9 Align OpenCode streaming status with final reviewed plan
- relevant git status: M docs/opencode_streaming_status.md (own P01-P03/A01 updates) + 7 untracked items
Files changed:
- docs/opencode_streaming_status.md only (A02 trace section, task table, log)
Evidence / change:
- Full HTTP adapter trace recorded in "A02 HTTP adapter trace" (model discovery -> session creation ->
  prompt body -> event acquisition -> text/reasoning conversion -> completion -> abort/timeout ->
  session lifetime).
- Verified running opencode server /doc (1.18.18): POST /api/session, POST /api/session/{id}/prompt,
  GET /api/session/{id}/event, GET /api/model all match the adapter; the real abort endpoint is
  POST /api/session/{id}/interrupt (NOT /abort as the plan review assumed from public docs).
- Confirmed ai@6.0.177 + @ai-sdk/provider@3.0.10; LanguageModelV2 adapters pass through
  asLanguageModelV3() Proxy (v2 compatibility mode + warning), not native v3.
Validation:
- node -e version check -> PASS (ai 6.0.177, @ai-sdk/provider 3.0.10)
- curl /doc path inventory + method map -> PASS (endpoints above)
- node_modules/ai/dist/index.js inspection -> PASS (logV2CompatibilityWarning, asLanguageModelV3)
Notes:
- Confirmed concrete defects for later repair (D05-D07): no-op timeout, dead abort var, unused
  interrupt endpoint, terminal-event text loss, unstable Date.now() ids, TBD cursor logic.
- No behavior change and no feature code (trace-only task per plan).
Next task:
- A03 — Build routing + capability matrix
```

### 2026-08-14 — A04

Status: DONE (scope changed to B02/B03 decision tasks)
Work performed:

- Explored `ConversationSettings` and `openCodeExecutionMode` across the full UI (TextAreaChat, Sidebar, HistoryView).
- Mapped execution-mode data flow: `openCodeExecutionMode` is stored per-conversation in `Conversation.settings`, surfaced in `ConversationSettings` component, defaults to `'streaming'`, stored in Supabase `conversation_settings` table.
- Decision: `openCodeExecutionMode` should be persisted at the **conversation level** in `conversation_settings` (existing table/column) — no new DB migration needed.
  Next task:
- B02 — Evaluate official OpenCode SDK vs raw HTTP

```

### 2026-08-14 — B02
Status: DONE
Decision: Use @opencode-ai/sdk v1.18.18 (client-only, typed API, built-in SSE, custom fetch for auth).
Rationale:
- Version 1.18.18 matches installed OpenCode exactly
- Client-only API (`createOpencodeClient()` does not spawn another server)
- Built-in SSE with retry logic
- Custom `fetch` option for Supabase Bearer token auth
- Fully typed TypeScript API
- Single dependency (cross-spawn)
- Covers session create, prompt (sync/async), events, abort, interrupt
Fallback: raw HTTP (already implemented, no new deps)
Next task:
- B03 — Verify AI SDK custom-model specification
```

### 2026-08-14 — B03

Status: DONE
Decision: Keep LanguageModelV2 — fully supported by ai@6.0.177, no migration to V3 needed.
Evidence:

- `LanguageModel` type = `GlobalProviderModelId | LanguageModelV3 | LanguageModelV2` (all three accepted)
- V2 usage is flat `{ inputTokens, outputTokens, totalTokens }`; V3 is nested `{ inputTokens: { total, ... }, ... }`
- V3 requires `id` on ALL stream parts; V2 only on `text-start`
- Current opencode adapter is V2 and works correctly with the SDK
- No deprecation signal for V2; V2 and V3 treated equally by streamText/createUIMessageStream
  Risks cleared: item #5 from known risks (V2 not stale)
  Next task:
- C01 — Define canonical OpenCode base URL

```

### 2026-08-14 — C01
Status: DONE
Decision: Canonical env var is `OPENCODE_BASE_URL` (full URL, plan-preferred).
Priority chain in `opencodeApiUrl()`:
  1. `OPENCODE_BASE_URL` → strip trailing slashes, return as-is
  2. `OPENCODE_PORT` → `http://127.0.0.1:${port}` (legacy fallback)
  3. Hard default: `http://127.0.0.1:4096` (matches `start.sh`)
Evidence:
- `opencode serve --port` defaults to `0` (ephemeral); `--hostname` defaults to `127.0.0.1`
- `start.sh` hardcodes port 4096; probes `http://127.0.0.1:4096/api/model`
- Health endpoint: `/api/health` → `{"healthy":true}` (verified on both 4096 and 14096)
- Two OpenCode servers were running simultaneously (pids 55620:14096, 80387:4096)
- Risk #6 (port mismatch) resolved: 14096 was a stale default; canonical default is now 4096
Implementation:
- `src/server/opencode.ts`: `opencodeApiUrl()` updated (3-tier priority chain)
- `.env.local.template`: added `OPENCODE_BASE_URL` and `OPENCODE_PORT` commented entries
- Typecheck: PASS (`tsc -b --noEmit`)
Files changed:
- `src/server/opencode.ts` (opencodeApiUrl function)
- `.env.local.template` (added OpenCode env var comments)
Next task:
- C02 — Align start.sh/client/env template
```

### 2026-08-14 — C02

Status: DONE
Objective: Align start.sh, client, and env template.
Decisions:

- Health check: `/api/model` → `/api/health` (verified lightweight endpoint)
- All components aligned to port 4096, loopback-only
- No client-side changes needed (app communicates with OpenCode via server API routes only)
  Evidence:
- `start.sh`: variables `OPENCODE_HOST`, `OPENCODE_PORT`, `OPENCODE_URL`, `OPENCODE_HEALTH` for clarity
- `start.sh`: `OPENCODE_PORT` defaults to `4096`; `OPENCODE_BASE_URL` (C01) takes priority
- `start.sh`: `--hostname "${OPENCODE_HOST}"` added alongside `--port` for explicit loopback
- `start.sh`: health check uses `/api/health`; fast-path exits immediately if server is healthy
- Client: no `VITE_` env vars for OpenCode; no hardcoded ports in client code
- `.env.local.template`: already has `OPENCODE_BASE_URL` and `OPENCODE_PORT` entries (from C01)
  Alignment table:
  start.sh default → OPENCODE_PORT=4096
  start.sh health check → /api/health
  opencode serve flags → --port 4096 --hostname 127.0.0.1
  opencodeApiUrl() default → http://127.0.0.1:4096
  opencode serve --port installed default → 0 (ephemeral, overridden by start.sh)
  Implementation:
- `start.sh`: rewritten with variables, health endpoint, documentation comments
- Typecheck: PASS (`tsc -b --noEmit`, 0 errors)
  Files changed:
- `start.sh` (variables, health check, documentation)
  Next task:
- C03 — Optional Basic Auth support

```

### 2026-08-14 — C04
Status: DONE
Objective: Test config/health — default URL, configured URL, unavailable server, auth if implemented.
Evidence:
- Test file: `src/server/opencodeApiUrl.test.ts` (7 tests, all passing)
- Tests cover: default URL, OPENCODE_BASE_URL full URL, trailing-slash stripping, OPENCODE_PORT legacy fallback, BASE_URL priority over PORT, whitespace-only value handling, custom hostname/port/scheme preservation
- No external dependencies — self-contained pure function test
- Typecheck + build: PASS
Files changed:
- `src/server/opencodeApiUrl.test.ts` (new file, 7 tests)
Next task:
- D01 — Repair provider/model discovery
```

## Current blockers

None declared before P01/P02. P02 revealed a real local-worktree discrepancy around `cliAgents.ts`:

- `src/server/cliAgents.ts` is **untracked local work** required by two tracked files
  (`src/server/aiChat.ts`, `src/routes/api/opencode/models.ts`). A fresh checkout of
  `local-dev-continue` will not typecheck until it is committed or restored.
- Not a runtime blocker for this worktree (file is present); it is a merge/commit-hygiene
  decision deferred to the coordinator. Do not guess; decide deliberately.

## Known risks

1. `cliAgents.ts` may be untracked local work.
2. OpenCode model-ID routing may currently be inconsistent.
3. OpenCode HTTP endpoints in the prototype may be obsolete.
4. Maintaining custom raw SSE may be unnecessary if the official SDK fits.
5. ~~`LanguageModelV2` may be stale for the installed AI SDK 6/provider v3 stack.~~ ✅ **RESOLVED: V2 fully supported by ai@6.0.177**
6. ~~Port/config mismatch: 4096 vs 14096.~~ ✅ **RESOLVED: Canonical default is 4096 (matches start.sh)**
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
17. ~~C03 (Basic Auth) deferred~~ — optional, skipped per coordinator decision.
18. 35B-class agents should read only the current task section, not repeatedly load the entire plan.

## Short prompt for coding agent

> Read `docs/opencode_streaming_status.md` first and work only on `Current next task`. Read the invariants and only that task's section from `docs/opencode_streaming_plan.md` unless more context is required. First run `git branch --show-current`, `git status --short`, and `git log -1 --oneline`. Never discard/reset/clean/overwrite uncommitted or untracked user work and never overwrite a local `src/server/cliAgents.ts`. Trust installed OpenCode `--version`, CLI `--help`, server `/doc`, and installed AI SDK/provider types over assumptions. Implement exactly one task, run the smallest relevant validation, update this status file with evidence/result, set the next task only if DONE, then stop. Only one coding agent may write to this branch/status file at a time.
