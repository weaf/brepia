# OpenSCAD import branch — pre-merge regression hardening

Date: 2026-08-25
Branch: `feature/openscad-import-editing`
Import Step 6: complete
Merge: blocked pending this hardening gate and explicit operator approval

## Purpose

The OpenSCAD import feature itself completed Steps 1–6. Before merging the feature branch, the operator explicitly chose to resolve three previously separate product regressions that were discovered during Step 6 but are not part of the import contract:

1. empty assistant persistence after an early provider failure;
2. loading/spinner state remaining active after the completed model is already persisted;
3. intermittent third/later OpenCode turn across both CLI and streaming.

Keep these fixes conceptually separate from OpenSCAD import behavior. Do not reopen or redesign the import architecture to address them.

## Current branch head

Implementation head before operator validation:

`445929e35e2ad81eecc009e5339291ce37f66ea5`

Always re-check branch head and current file versions before further changes.

## A — Empty assistant persistence after early provider failure

Status: IMPLEMENTED — validation pending

### Root cause

The `messages_payload_present` database constraint rejects a message row with an empty `parts` array unless legacy `content` is present. AI SDK can still complete its UI-message callback with `responseMessage.parts = []` when a provider fails before emitting any assistant payload. The previous persistence classifier treated that as a normal fresh assistant response and attempted an INSERT.

### Fix

`src/server/chatToolPersistence.ts` now distinguishes three states at the persistence boundary:

- a real pending client tool call;
- a normal non-pending assistant payload;
- the explicit `EMPTY_ASSISTANT_RESPONSE` sentinel.

An empty assistant response maps to persistence action `skip` for both fresh and continuation callbacks. This preserves the database invariant instead of weakening it. Genuine first-turn build tool calls still map to `insert`, because the assistant row must exist before the browser persists the tool result.

The sentinel is intentionally truthy at the existing `aiChat.ts` call site, which also prevents post-response suggestion generation from running against a nonexistent assistant payload.

### Regression coverage

`src/server/chatToolPersistence.test.ts` covers:

- empty payload classification;
- empty fresh response -> `skip`;
- empty continuation -> `skip`;
- genuine fresh pending build -> `insert`;
- genuine fresh resolved response -> `insert`;
- pending continuation -> `skip`;
- resolved continuation -> `update`;
- existing dangling-tool recovery invariants.

### Manual acceptance

Use a provider/model that fails before emitting output, for example a deliberately missing/invalid provider credential.

Expected:

- the provider error is surfaced normally;
- no `messages_payload_present` persistence error is produced;
- no empty assistant row is created;
- the conversation remains usable for model switch/retry.

## B — Loading/spinner completion synchronization

Status: IMPLEMENTED — validation pending

### Root cause

`ChatSession` derives preview loading state from AI SDK status (`submitted` / `streaming`). The server independently tee-consumes and persists generation output, so a browser/SSE lifecycle loss can leave the cached client `Chat` in an in-flight state after authoritative terminal output already exists in the database.

Previously `useCachedAiChat` explicitly refused to adopt persisted messages while local status remained submitted/streaming. In addition, `useMessagesQuery` stopped polling as soon as any assistant row existed, even if that row represented an intermediate build/tool state.

### Fix

A pure completion classifier was added in `src/hooks/chatCompletionReconciliation.ts`.

A normal parametric build by itself is not terminal because it can legitimately require the browser -> server build-inspection continuation. A turn is terminal when authoritative persisted state proves completion, including:

- resolved `answer_user` after the last build;
- completed adapter text after the last build;
- completed non-build text/tool responses;
- an imported synthetic baseline, which is explicitly terminal without an AI continuation once its tool state is resolved.

`persistedCompletionCoversLiveTurn()` additionally proves that the persisted terminal assistant completes the same live turn. An older completed assistant cannot cancel a genuinely newer user request.

`useCachedAiChat` now:

- keeps normal in-flight behavior while persistence does not prove terminality;
- when persistence proves the same turn terminal, stops only the stale local client stream and adopts the authoritative persisted snapshot;
- does not use an arbitrary timeout.

`useMessagesQuery` now polls every 2.5 seconds while the newest recent row represents a non-terminal turn, up to the existing 10-minute maximum age. Imported synthetic baselines are classified terminal and therefore do not cause unnecessary polling.

### Regression coverage

`tests/chatCompletionReconciliation.test.ts` covers:

- normal resolved build-only remains non-terminal;
- imported resolved build-only is terminal;
- unresolved imported build remains non-terminal;
- build + resolved `answer_user` is terminal;
- build + completed adapter text is terminal;
- old terminal assistant cannot override a newer live user turn;
- persisted terminal assistant can complete the current live user turn;
- the same live assistant ID can reconcile when persistence advances it to terminal.

### Manual acceptance

With a working model:

- generate or edit a model through to completion;
- verify the preview loading/spinner state clears without reload;
- repeat several times;
- if practical, background/suspend the browser tab during a generation and return after server completion;
- verify the persisted completed turn is adopted and the spinner clears without a page reload.

If this still reproduces specifically on OpenCode after the completed model is already persisted, inspect the remaining OpenCode terminal-text persistence path before making any broader change to `aiChat.ts`.

## C — Intermittent third/later OpenCode turn

Status: IMPLEMENTED HARDENING + REGRESSION COVERAGE — live validation pending

### Architecture findings

The failure has been observed in both OpenCode CLI and streaming. Those transports use different external session mechanisms, so the shared pCAD lifecycle/persistence boundary is a stronger common candidate than one transport-specific session implementation.

Streaming OpenCode already uses one deterministic OpenCode session per pCAD conversation and sends the authoritative latest complete artifact on every turn.

CLI OpenCode persists the external session ID inside the build tool-call ID and recovers the latest matching session by walking the prompt backward. Each emitted build tool-call ID remains unique because a random UUID suffix is appended even when the same external session is resumed.

### Shared contract defect fixed

The common OpenCode/Codex result contract previously contradicted the post-build continuation prompt:

- continuation instructions allowed the agent to return only the final message when the current artifact already satisfied the task;
- the shared final-result contract simultaneously required non-empty `code` for every CAD request.

Different models could therefore either finish or repeatedly re-emit unchanged SCAD after a successful build.

`src/server/opencodeAgentResult.ts` now defines one unambiguous contract for OpenCode CLI and streaming:

- when proposing a new/revised CAD artifact, return complete runnable OpenSCAD in `code`;
- after `<pcad_build_result>`, return corrected complete code only if another geometry revision is actually required;
- if the authoritative current artifact already satisfies the task, return `code = ""` plus the concise final message;
- do not re-emit unchanged code merely to finish the turn.

No OpenCode transport/session implementation was changed speculatively.

### Four-turn regression coverage

`tests/opencodePersistentSession.test.ts` now explicitly checks a fourth streaming edit:

- turn 4 starts from turn 3's complete artifact, not turn 1/2;
- turn 4 includes the current user request;
- the post-build continuation sees turn 4's complete artifact and turn 4 build result;
- an ordinary reused-session build continuation does not replay the user request as a new request.

`tests/cliAgentPersistentSession.test.ts` now explicitly checks a fourth OpenCode CLI edit:

- the same resumable OpenCode session is still recovered after multiple build/result cycles;
- turn 4 starts from turn 3's complete artifact, not older revisions;
- turn 4 carries the current request;
- the turn 4 continuation sees the turn 4 artifact and build result while retaining the original task context.

### Manual acceptance

Run at least five sequential CAD edits in the same conversation in each mode.

CLI example sequence:

1. create a box;
2. make it wider;
3. make it taller;
4. add a hole;
5. modify another visible feature.

Repeat the same class of sequence in Streaming mode.

For every turn verify:

- the turn starts from the immediately preceding complete model;
- the requested edit appears in the resulting model;
- the turn finishes rather than remaining stuck/rebuilding unchanged code;
- the next turn remains usable.

## Automated validation gate

Before closing this hardening gate, run at minimum:

```bash
npm test -- tests/chatCompletionReconciliation.test.ts tests/opencodePersistentSession.test.ts tests/cliAgentPersistentSession.test.ts
npm run typecheck
npm run lint
npm run build
```

Also run the full Vitest suite before merge:

```bash
npm test
```

The server-side persistence tests in `src/server/chatToolPersistence.test.ts` and `src/server/agentOutputContract.test.ts` must remain green as part of the repository test suite.

## Current assessment

Implementation is complete enough for validation, but none of these three regressions should be marked operator-verified yet.

Do not merge `feature/openscad-import-editing` into `master` until:

- the automated gate is green;
- the three manual acceptance checks above are green;
- the final branch/master diff is reviewed again;
- the operator explicitly approves the merge.
