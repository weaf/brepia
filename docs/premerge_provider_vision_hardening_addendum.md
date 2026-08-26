# Pre-merge hardening addendum — provider errors, model switching, and Vision

Date: 2026-08-26
Branch: `feature/openscad-import-editing`
Status: COMPLETE
Merge state: approved by operator; final merge preparation in progress

## Scope

This addendum tracks provider/rate-limit UX, model/transport switching, Vision configuration, and persistent error presentation discovered during final OpenSCAD-import branch validation.

## Provider/rate-limit errors

Status: COMPLETE

`src/hooks/chatErrorPresentation.ts` classifies actionable provider failures, including HTTP 429 / `FreeUsageLimitError` / rate-limit conditions, missing provider authentication, and missing Vision configuration.

Operator verification:

- Big Pickle usage-limit condition produced the intended model-limit message;
- the conversation remained usable with another model afterward.

## Genuine provider errors remain visible

Status: COMPLETE

`useCachedAiChat` no longer clears a genuine provider/model error merely because older chat messages exist. Errors are cleared automatically only when a fresh authoritative DB snapshot actually recovers the turn.

## Same-conversation model/transport switching

Status: COMPLETE

The cached Chat now tracks the associated transport object. When the selected model or CLI/Streaming transport changes, the cached Chat is rebuilt with that transport while retaining conversation messages.

Operator verification showed llama-swap/OpenCode routing working after model changes. The previously observed stale GPT-Sol transport was not reproduced in the validated path.

## Missing Vision configuration

Status: COMPLETE

When a text-only/OpenCode/Codex flow requires image analysis and no applicable Vision model is configured, pCAD now stops with clear Settings -> Vision guidance rather than silently degrading.

Operator verification:

- missing-Vision warning displayed correctly;
- configured Vision routing worked afterward.

## Persistent error toast

Status: COMPLETE BY CODE/TEST; LIVE VERIFICATION OPPORTUNISTIC

Destructive/error toasts are intended to remain visible until manually dismissed.

The earlier `duration={0}` implementation was removed because it did not provide persistent behavior with Radix Toast. Current behavior is controlled explicitly:

- destructive toasts ignore primitive automatic close events;
- the X button explicitly dismisses the toast;
- normal non-destructive toasts retain automatic lifecycle behavior;
- up to three toasts may coexist.

`tests/toastPersistence.test.ts` covers the destructive-vs-normal dismissal rule.

A naturally occurring `Network error` is difficult to force reliably. Final live confirmation of that exact error toast is therefore deferred until the next naturally occurring error and is not a merge blocker.

## Validation

Final operator report for the branch:

```text
npm test      -> green
npm run typecheck -> green
npm run lint  -> green
npm run build -> green
```

Focused provider, Vision, OpenCode, completion-reconciliation, pending-tool recovery, and toast tests were also used during hardening.

## Final assessment

This addendum is COMPLETE and introduces no remaining merge blocker.
