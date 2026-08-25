# Pre-merge hardening addendum — provider errors, model switching, and Vision

Date: 2026-08-25
Branch: `feature/openscad-import-editing`
Merge: still blocked pending automated/operator validation and explicit approval

## Operator findings

The 2026-08-25 live pass exposed three related product defects:

1. OpenCode Big Pickle reached its free/rate usage limit (`HTTP 429`, `FreeUsageLimitError`, `Rate limit exceeded`) but pCAD appeared to finish spinning without a useful product-level message.
2. A real provider error could be cleared from the cached Chat state merely because older messages existed, which made provider failures easier to lose than DB-recovery errors.
3. Changing the selected model or CLI/Streaming mode in an existing conversation created a new `DefaultChatTransport`, but `useCachedAiChat` reused the old Chat instance solely by `conversation.id`. The selected UI model could therefore diverge from the transport actually used by the cached Chat. This also explains observed requests unexpectedly reaching `openai/gpt-5.6-sol` after model changes.
4. Text-only/OpenCode/Codex vision fallback silently continued when no Fast/Deep Vision model was configured. The model then received an unavailable-vision placeholder instead of the user being told that Vision configuration was required.

## Implemented hardening

### User-facing provider failures

`src/hooks/chatErrorPresentation.ts` classifies raw chat errors into actionable messages.

Current explicit classes:

- OpenCode/provider HTTP 429, `FreeUsageLimitError`, `Rate limit exceeded`, or Too Many Requests -> `Model usage limit reached...`;
- missing Vision configuration -> Settings -> Vision guidance;
- missing provider authentication / HTTP 401 -> Settings -> Providers guidance;
- unknown errors remain unchanged so diagnostics are not hidden.

`tests/chatErrorPresentation.test.ts` covers the three explicit classes plus unknown-error preservation.

### Preserve genuine provider errors

`src/hooks/useCachedAiChat.ts` no longer calls `chat.clearError()` merely because the Chat already contains messages.

A cached error is cleared only when a fresh persisted DB snapshot actually recovered the chat. This preserves the mobile/SSE recovery behavior while keeping genuine provider/model errors visible.

### Refresh cached transport after model/mode changes

`ChatSession` already creates a new `DefaultChatTransport` whenever the selected model or OpenCode execution mode changes.

`useCachedAiChat` now records the transport associated with each cached conversation. If the transport object changes, it rebuilds that conversation's Chat using the new transport and carries the existing live message array forward. The old behavior reused the first transport indefinitely because the cache identity was only `conversation.id`.

This must be manually verified by switching models several times inside one existing conversation and checking the server `transport { modelId, executionMode, transportKind }` log for every send.

### Missing Vision configuration is no longer silent

`src/server/vision.ts` now throws a clear configuration error when image analysis is required but neither the required Fast model nor its allowed Deep->Fast fallback is configured:

`Vision models are not configured. Open Settings -> Vision and select a Fast vision model ...`

The error propagates through prompt rewriting rather than replacing the image with an unavailable placeholder and silently continuing the CAD turn.

Native direct-vision models still retain their existing direct-image behavior. The specific unexpected GPT-Sol observation is addressed separately by the cached-transport fix above; it was not the Vision fallback selecting GPT-Sol.

`src/server/vision.test.ts` now verifies that a Vision configuration failure propagates instead of silently stripping the image.

## Focused automated validation

Run:

```bash
npm test -- \
  tests/chatErrorPresentation.test.ts \
  src/server/vision.test.ts \
  tests/chatCompletionReconciliation.test.ts \
  tests/opencodePersistentSession.test.ts \
  tests/cliAgentPersistentSession.test.ts

npm run typecheck
npm run lint
npm run build
```

Then run the full Vitest suite before merge:

```bash
npm test
```

## Manual acceptance

### A. Big Pickle usage limit

Use Big Pickle while the free/rate limit is exhausted.

Expected:

- generation stops;
- pCAD visibly reports that the model usage/rate limit has been reached and suggests another model / trying later;
- the conversation remains usable;
- switching to a llama-swap OpenCode model works without reload.

### B. Same-conversation model switching

In one existing conversation, perform at least:

1. Big Pickle;
2. a llama-swap OpenCode model;
3. another llama-swap/OpenCode model or change CLI <-> Streaming;
4. switch back.

For each request verify the server `transport` log matches the model and execution mode currently displayed in the UI. No request should unexpectedly use the model that was active when the conversation first mounted.

### C. Missing Vision settings

Select a text-only/OpenCode/Codex primary model, clear Fast/Deep Vision configuration, and perform an operation requiring a reference or inspection image.

Expected:

- the turn stops with a visible message directing the operator to Settings -> Vision;
- pCAD does not silently continue without visual analysis;
- after configuring Fast Vision, retry succeeds;
- Deep may remain unset and correctly reuse Fast for inspection.

## Merge state

Do not merge until the original pre-merge hardening gate plus this addendum are green and the operator explicitly approves the merge.
