# OpenSCAD import branch — pre-merge regression hardening

Date: 2026-08-26
Branch: `feature/openscad-import-editing`
Import Step 6: complete
Hardening gate: COMPLETE
Merge state: approved by operator; final merge preparation in progress

## Purpose

The OpenSCAD import feature itself completed Steps 1–6. Before merge, three previously separate regressions plus several adjacent provider/transport issues were hardened and re-validated:

1. empty assistant persistence after an early provider failure;
2. loading/spinner state remaining active after a completed model is already persisted;
3. intermittent third/later OpenCode turn across CLI/streaming;
4. provider/rate-limit errors that were not presented clearly;
5. missing Vision configuration silently degrading;
6. stale cached transport after model/mode changes;
7. immutable workspace-agent replay mismatch;
8. client-tool persistence races that left `build_parametric_model` as `input-available` until reload;
9. destructive/error toast persistence.

These fixes remain conceptually separate from the OpenSCAD import contract.

## Final validated implementation state

The implementation through commit `6eef8599417562244877e86de94c9aa12c9d9ea3` was validated by the operator. Documentation-only closing commits may follow this SHA before merge.

## A — Empty assistant persistence

Status: COMPLETE

The persistence boundary now distinguishes an empty assistant response from a real assistant payload. Empty provider responses are skipped rather than inserted into `messages`, preserving the `messages_payload_present` database invariant.

Verified outcome:

- early provider errors surface without creating an empty assistant row;
- conversations remain usable for retry/model switch;
- no persistence-constraint regression was observed.

## B — Loading/spinner and persisted completion reconciliation

Status: COMPLETE

The cached chat can now reconcile against authoritative persisted completion for the same turn instead of depending solely on a possibly stale AI-SDK `submitted`/`streaming` state. Polling continues through non-terminal intermediate assistant/tool states.

A later OpenCode-specific race was also found: the browser could miss or delay the client-tool callback while the DB already contained an `input-available` `build_parametric_model`. Recovery now runs before the old in-flight early return, adopts the persisted assistant snapshot when necessary, and replays only the pending tool on the current assistant leaf. Historical dangling tools and tools behind a newer user leaf are never replayed.

Verified outcome:

- generated models update live without requiring reload;
- multi-turn edits update the preview immediately;
- the previously observed repeated dangling-tool recovery no longer reproduces in the validated flow.

## C — OpenCode multi-turn reliability

Status: COMPLETE

The common OpenCode/Codex result contract now has unambiguous first-step and post-build semantics:

- a new CAD request without a build result requires non-empty complete OpenSCAD code;
- after a successful build, corrected code is emitted only when another geometry revision is needed;
- if the current artifact already satisfies the task, the agent may finish with `code = ""` and a final message rather than re-emitting unchanged code.

Persistent-session regression coverage includes fourth-turn continuity for both OpenCode Streaming and CLI. The client-tool recovery hardening additionally fixed the live build-result persistence race that manifested most clearly in OpenCode Streaming.

Verified outcome:

- new OpenCode Streaming conversations build successfully;
- subsequent edits remain on the same external session;
- several sequential edits use the immediately preceding artifact;
- artifacts appear live without reload;
- direct llama-swap multi-turn behavior remains good.

## D — Provider errors, model switching, and Vision

Status: COMPLETE

Provider errors now receive product-level presentation, including explicit model/rate-limit messaging for HTTP 429 / `FreeUsageLimitError` / rate-limit conditions. Genuine provider errors are not cleared merely because old chat messages exist.

Cached chat transport identity now tracks the actual transport object. Changing model or CLI/Streaming mode rebuilds the cached Chat with the newly selected transport while retaining message history, avoiding requests through a stale previously selected model.

Vision analysis now stops with a clear Settings -> Vision configuration message when a text-only/OpenCode/Codex flow requires vision but no applicable Vision model is configured.

Operator verification:

- model-usage-limit message displayed correctly;
- missing-Vision message displayed correctly;
- llama-swap/OpenCode model switching worked;
- no further unexpected GPT-Sol fallback was reported in the validated path.

## E — Conversation workspace immutable agent history

Status: COMPLETE

Historical agent-turn sync no longer treats harmless evolution of derived metadata as an immutable-record mutation. The existing immutable snapshot wins when the same agent turn is rediscovered; true identity corruption remains an error.

The previously repeated `Immutable agent turn mismatch` diagnostic stopped being a merge blocker.

## F — Error toast persistence

Status: COMPLETE BY CODE/TEST; LIVE VERIFICATION OPPORTUNISTIC

Destructive/error toasts must remain visible until explicitly dismissed by the user. The original attempt using `duration={0}` was incorrect for Radix Toast and was replaced with controlled behavior:

- destructive toasts ignore primitive auto-close `onOpenChange(false)`;
- the X button explicitly dismisses the toast;
- ordinary non-destructive toasts retain normal auto-close behavior;
- up to three toasts may coexist.

`tests/toastPersistence.test.ts` locks the destructive-vs-normal dismissal rule.

A naturally occurring `Network error` is difficult to reproduce deterministically, so the final live confirmation of that specific toast will be performed opportunistically the next time a real network/provider error occurs. This is not considered a merge blocker because the behavior is isolated and regression-tested.

## Automated validation

Final operator report: all green on the current implementation.

Validated gate includes:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Focused regression suites for chat completion, pending-tool recovery, OpenCode persistent sessions, CLI persistent sessions, provider error presentation, Vision, workspace agents, persistence boundaries, and toast persistence were also exercised during hardening.

## Final assessment

Pre-merge hardening is COMPLETE.

Known merge blockers: none.

The operator has explicitly approved merge after the final green validation. Before creating the merge commit, re-check both `feature/openscad-import-editing` and `master` heads and verify that `master` remains the merge base / the feature is not behind.
