# BRep AI context budget and projection plan

Status: **next active implementation phase — planned, not started**

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Trigger

After the M1 provider-safe scalar-schema hardening, a real local-model request failed with:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The selected model was a local 128k-class OpenAI-compatible model. This exposed a context-construction problem rather than a reason to simply increase the llama.cpp context window.

The current request path can multiply tokens in several places:

1. the provider-facing `build_brep_project` schema is intentionally reference-free and therefore repeats finite scalar-expression shapes across many BRep fields;
2. `loadBranchFromDb(...)` reconstructs the entire active conversation branch and that branch is converted to model messages;
3. historical `build_brep_project` tool calls can contain complete canonical project snapshots even though only the newest canonical BRep revision is current authority;
4. the current canonical BRep project is also injected into the system context for BRep follow-up turns;
5. historical images may be hydrated back to base64 before model-message conversion.

The resulting model context can therefore contain multiple copies of information that Brepia already stores authoritatively elsewhere.

## Architectural principle

Treat these as separate layers:

```text
Database / immutable revisions = durable history and source authority
Model context window           = bounded working memory for this turn
```

Do not equate persisted conversation history with the complete prompt sent to every model call.

For Native BRep work specifically:

```text
canonical BrepProject = current structured truth
conversation history  = intent, rationale and user interaction history
```

An older complete BRep snapshot should not remain in model working memory merely because it remains correctly persisted in immutable revision history.

## Context-budget target

For a model with a `131072` token context window, do not plan to fill the entire window with input.

Initial target policy:

```text
context window        131072
reserved output        model/route maxOutputTokens
safety margin          approximately 8192-12288
absolute input budget  derived from the two values above
normal operating goal  approximately 60000-90000 input tokens
```

Exact values must be configuration/model-capability driven rather than hard-coded to one local model.

Increasing llama.cpp context size is not the primary solution. A larger context may remain useful separately, but it does not remove duplicate state, increases KV-cache/prefill cost, and only moves the overflow threshold.

## C1 — context observability

Implement request-level context diagnostics before destructive compaction is introduced.

Measure/log a deterministic approximate breakdown at the point immediately before the final model request, including at least:

- resolved system/instruction text;
- provider-visible tool schemas;
- current canonical BRep context;
- ordinary recent message text;
- historical tool-call/tool-result payloads;
- images or image-data parts;
- estimated total input;
- configured model context window;
- reserved output tokens;
- selected input budget.

The logging must be bounded and must never dump full sensitive prompt/project payloads. Log sizes/counts, not raw content.

Where provider usage/tokenization data is available after successful calls, record actual usage separately so estimates can be calibrated.

Acceptance:

- a failing/large conversation exposes which category dominates context;
- ordinary requests continue unchanged;
- logging itself does not duplicate or persist full prompt content.

## C2 — compact provider schema

Re-evaluate the M1 provider-facing expression authoring depth.

Current provider boundary:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 3
```

The canonical M1 validator remains authoritative with depth `12` and expression-node limit `64`.

The ordinary M1 relationship:

```text
InnerWidth = Width - 2 * WallThickness
```

requires only a shallow provider-authoring tree. Assess reducing provider authoring depth from `3` to `2` if regression fixtures demonstrate that intended M1 authoring remains covered.

Constraints:

- do not reduce canonical/persisted M1 capability;
- do not restore recursive `z.lazy()` directly to the provider-facing tool;
- do not introduce nested `$ref` as the local llama.cpp baseline;
- retain full canonical validation after the provider call;
- add a token/schema-size regression so future schema changes cannot silently multiply prompt size again.

## C3 — BRep model-context projection

Create an explicit projection from persisted `AppUIMessage[]` / branch history to the bounded messages that the model actually needs.

For BRep follow-up turns:

### Preserve

- current user turn exactly;
- current canonical BRep source revision exactly once;
- recent relevant user intent/history;
- compact successful assistant/tool summaries needed to understand recent decisions;
- required system/tool instructions.

### Remove or compact

- complete BRep project inputs from superseded historical `build_brep_project` calls;
- duplicate historical `data-brep-project` snapshots;
- old BRep state that is already superseded by the current canonical source;
- verbose historical tool mechanics that do not change current intent/state.

Persisted UI/history remains untouched. This is only a model-context projection.

The current canonical project must remain authoritative and must never be reconstructed from a lossy conversation summary.

Initial recent-history policy should be conservative, e.g. a bounded number of recent user turns rather than arbitrary message count. Exact turn count should be validated empirically.

Acceptance:

- immutable revision/history behavior remains unchanged;
- current canonical BRep is present exactly once in effective model context;
- superseded full project snapshots no longer multiply input tokens;
- AI follow-up behavior remains semantically correct across multi-turn edits;
- branching/leaf semantics remain correct.

## C4 — image-context projection

Historical images must not automatically be rehydrated to base64 simply because they remain on the active branch.

Policy should distinguish:

- current-turn images: preserve when required;
- explicitly relevant recent reference image: preserve only when needed;
- older image history: omit from direct model context or replace with already-authoritative compact derived context where such context exists.

Do not silently replace image authority with an unverified generated summary where the original image is still required for the current operation.

## C5 — hard context budget

After observability and projection exist, enforce a deterministic request budget before `streamText(...)` / provider dispatch.

Conceptually:

```text
inputBudget = contextWindow - reservedOutput - safetyMargin
```

Compaction/drop priority should be explicit and tested. Proposed ordering:

1. omit old non-current image payloads;
2. compact superseded historical BRep tool/project payloads;
3. bound older ordinary conversational turns;
4. use a rolling conversation summary only for older natural-language intent that remains useful;
5. preserve current user turn;
6. preserve current canonical BRep source;
7. preserve required system/tool contract;
8. fail locally with a clear bounded-context error if mandatory content alone cannot fit.

Never send a request known to exceed the selected model's context window.

## C6 — rolling conversation summary, only if needed

Do not begin with summarization as the primary fix.

First remove duplicated structured state. Once C1-C5 show that older natural-language history is the remaining significant cost, add a durable/refreshable compact summary for intent and decisions only.

The summary must not become BRep geometry authority. Canonical project state and immutable revisions remain authoritative.

A useful summary may include facts such as:

- product/user intent;
- non-geometric preferences not represented canonically;
- rationale for recent design decisions;
- explicit constraints the user asked to preserve.

It must not replace exact current parameter/node/project state.

## Suggested implementation order

Implement in this sequence:

1. **C1 — observability**;
2. **C2 — provider-schema size reduction + size regression**;
3. **C3 — BRep history projection / superseded snapshot removal**;
4. re-measure the original failing conversation;
5. **C4 — image projection** where necessary;
6. **C5 — hard model-aware input budget**;
7. **C6 — rolling summary** only if measurements justify it.

The expectation is that C2 + C3 will produce the largest immediate reduction for the observed Native BRep case.

## Acceptance fixture

Use the real failure class as a regression target:

```text
local model context window: 131072
observed request:           169503 tokens
```

A representative long Native BRep conversation should, after projection, remain comfortably under the model-aware hard budget while preserving:

- current canonical project;
- current user request;
- recent relevant intent;
- valid `build_brep_project` tool calling;
- M0/M1 integrity;
- immutable revision persistence;
- BRep AI follow-up correctness.

For a 128k model, target normal input well below the hard ceiling rather than merely reducing `169503` to `130000`.

## Boundaries

This phase must not:

- alter canonical `schemaVersion: 1` BRep authority;
- weaken M0 parameter/graph integrity;
- weaken M1 canonical scalar validation;
- reintroduce recursive provider schema warnings;
- enable unsupported rotation/modeling operations;
- change GHX parameter-only return/import authority;
- change immutable revision semantics;
- merge PR #36 across its stacked boundary;
- start M2 `union` / `intersect` implementation.

## Relationship to the modeling roadmap

This context-budget phase is the **next active engineering activity before M2** because current long-session behavior can prevent further BRep AI work from reaching the model at all.

M2 remains planned but not started. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed by context-budget work.
