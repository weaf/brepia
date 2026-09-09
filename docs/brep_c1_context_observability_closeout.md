# BRep AI C1 context observability closeout

Status: **repository-complete and CI-accepted; real failing-conversation measurement pending**

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

C1 adds request-level observability for the BRep AI context budget without changing model-history projection, persisted conversation history, immutable revisions, canonical BRep authority, or M0/M1 semantics.

The triggering runtime failure remains:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

C1 is deliberately diagnostic. C2/C3 must not be selected from intuition alone; the real failing conversation should first be re-run with these diagnostics enabled.

## Reconciliation finding

The pre-C1 request path has several independent context contributors:

1. `loadBranchFromDb(...)` reconstructs the complete active root-to-leaf branch;
2. persisted image file parts on that branch can be downloaded and hydrated back to base64 before `convertToModelMessages(...)`;
3. historical `build_brep_project` tool inputs can contain complete BRep project snapshots;
4. the current canonical BRep project is injected separately into the resolved system prompt by `withBrepProjectSystemContext(...)`;
5. provider-visible tool schemas are passed independently to `streamText(...)`;
6. `data-brep-project` is durable UI/source history but is not converted to a provider model message by the current `convertDataPart` path.

The last distinction is important: a historical `data-brep-project` snapshot may be large in persisted storage while currently contributing zero direct provider-message tokens. C1 therefore records its persisted size/count separately instead of pretending that every persisted byte is model context.

## Implementation

### `src/server/aiContextDiagnostics.ts`

A dedicated diagnostics module now computes bounded size/count telemetry for:

- resolved system/instruction prompt;
- system bytes before current BRep injection and bytes added by BRep context;
- provider-visible tool schemas, including a per-tool size breakdown;
- current canonical BRep project size;
- ordinary persisted conversation text/reasoning size and message/part counts;
- historical `build_brep_project` tool input/result size and call count;
- historical `data-brep-project` count and persisted size;
- effective model-message size after conversion;
- image/base64 count and size inside the effective model messages;
- approximate total model input;
- configured model context window where Settings metadata provides it;
- configured model output limit where known;
- route `maxOutputTokens` reserved for output;
- initial deterministic safety margin and derived usable input budget;
- estimated input headroom.

The estimator is intentionally approximate and deterministic rather than claiming tokenizer-exact precision:

```text
ordinary UTF-8 content: ~4 bytes/token
base64 image content:   ~2 chars/token (conservative)
```

Actual provider-reported token usage is logged separately after successful model calls so estimates can be calibrated against reality.

### Settings/discovery authority

For direct `local/...` models, C1 reads `contextLimit` and `outputLimit` from the existing local-model Settings metadata path. It does not parse the model name or invent a context window.

For routes where authoritative model-limit metadata is not currently available, diagnostics record the budget values as unknown/null. C1 does not add a second model catalog or hard-code the observed 131072 value.

### Bounded logging

The diagnostics object contains counts, byte sizes, token estimates, model/transport identifiers, tool names, and budget numbers only.

It does **not** retain or log:

- user prompt text;
- system prompt text;
- canonical BRep JSON;
- historical tool payload contents;
- image/base64 contents.

Diagnostics are fail-open: telemetry failure is logged as an observability error but does not alter the ordinary generation path.

## Safety-margin policy recorded by C1

C1 records the initial plan policy without enforcing it yet:

```text
safetyMargin = clamp(contextWindow / 16, 8192, 12288)
usableInputBudget = contextWindow - reservedOutput - safetyMargin
```

For the observed `131072` context class with `8192` reserved output this yields:

```text
context window       131072
reserved output        8192
safety margin           8192
usable input budget   114688
```

This is observability only. C5 remains responsible for hard pre-dispatch enforcement.

## Tests

`tests/aiContextDiagnostics.test.ts` verifies that:

- all required C1 categories are measured independently;
- the finite provider-facing `build_brep_project` schema can be materialized and sized;
- historical BRep tool payloads and durable `data-brep-project` snapshots are distinguished;
- image/base64 size is measured separately;
- the 131072-class budget calculation is deterministic;
- unknown model limits remain unknown rather than guessed;
- serialized diagnostics do not contain fixture user text, project markers, or base64 payloads.

## Repository evidence

C1 code/test head:

```text
5570d6539c94d890d23fb3f91edf9da9cddc9431
Test AI context budget diagnostics
```

Commits in the C1 implementation series:

```text
2961626efb37c0a778684a694a0edddd258a6c94  Add AI context budget diagnostics
14324566384a95bcc893513a6d7b26ec1b0d871b  Instrument AI request context budget
5570d6539c94d890d23fb3f91edf9da9cddc9431  Test AI context budget diagnostics
```

CI on exact head `5570d653...`:

- Quality Gate #766 — PASS
  - dependency audit — PASS
  - tests — PASS
  - typecheck — PASS
  - lint — PASS
  - build — PASS
  - diff check — PASS
- Grasshopper Build #338 — PASS

PR #36 remains open, draft, and stacked on `feature/brep-grasshopper-smart-component`. C1 does not alter that merge boundary.

## Required runtime evidence before C2

Re-run the representative long Native BRep conversation on the local model class that previously produced the 169503/131072 overflow and capture the bounded log entry:

```text
ai context diagnostics
```

If a call succeeds, also capture:

```text
ai context actual usage
```

Only the numeric/count object is needed; do not copy raw prompts or project data.

The measurement should answer, at minimum:

- how much is system/BRep system context;
- how large the finite provider tool schema is;
- how much comes from effective model history;
- how many historical BRep tool payloads exist and their aggregate size;
- whether historical image/base64 content is material;
- configured model context/output limits and derived budget;
- estimated total versus provider-reported successful usage where available.

## Phase boundary

C1 is repository-complete and CI-accepted, but the diagnostic phase is not considered empirically closed until the real failure-class conversation has been measured.

Do not begin C2 provider-depth reduction or C3 history projection based only on the existence of likely duplication. Use the C1 evidence to rank the contributors first.

All previous locks remain unchanged:

- canonical BRep + immutable revisions remain authority;
- `conversation.type = 'parametric'` and `parametricSourceKind = 'brep'` remain unchanged;
- M0/M1 validation remains unchanged;
- canonical expression depth 12 / node limit 64 remains unchanged;
- provider-facing schema remains finite and `$ref`-free;
- no M2 `union` / `intersect` work begins;
- GHX return/import remains parameter-only;
- non-zero rotation remains unsupported/fail-closed;
- Settings/discovery remains model authority;
- OpenSCAD behavior remains unchanged.
