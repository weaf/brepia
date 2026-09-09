# BRep AI context budget and projection plan

Status: **C1 empirically complete; C2 repository-complete / CI-accepted; runtime re-measurement pending before C3**

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

C1 implementation/CI closeout is recorded in `docs/brep_c1_context_observability_closeout.md`. The reproduced failure-class measurement is recorded in `docs/brep_c1_runtime_evidence_2026-09-09.md`. C2 is now repository-complete and CI-accepted. The next action is to re-run the same first-turn Native BRep fixture with the depth-2 provider schema and compare the new diagnostics/provider outcome before C3 is started.

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

Status: **repository-complete, CI-accepted and empirically measured on the original failure class**.

C1 added bounded request-level diagnostics immediately before `streamText(...)`, including:

- resolved system/instruction size and BRep-context increment;
- provider-visible tool-schema size;
- current canonical BRep size;
- ordinary persisted message text/reasoning size and counts;
- historical `build_brep_project` input/result payload size and call count;
- historical `data-brep-project` persisted size/count separately from provider-facing messages;
- images/base64 in effective model messages;
- effective converted model-message size;
- estimated total input;
- configured local-model context/output limits from Settings metadata where available;
- reserved output tokens;
- safety margin, selected usable input budget and estimated headroom.

The logging is bounded and never includes full prompt/project/image payloads. Tests assert that raw fixture user text, BRep markers and base64 data are absent from the serialized diagnostics object.

Repository evidence on `5570d6539c94d890d23fb3f91edf9da9cddc9431`:

- Quality Gate #766 — PASS;
- Grasshopper Build #338 — PASS.

### C1 runtime result

The original overflow was reproduced on:

```text
local/qwen3.8-27b-mtp-128k
```

The first-turn fixture contained no historical BRep state and no images, yet diagnostics reported:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
ordinary history estimate                 29 tokens
effective model messages                  42 tokens
total deterministic estimate          107862 tokens
llama.cpp request count                169503 tokens
```

The request also had:

```text
context window          131072
reserved output          64000
safety margin             8192
usable input budget      58880
```

This ranked the provider schema as the dominant contributor before any history existed. C3 therefore cannot be the primary fix for the observed first-turn overflow.

The deterministic byte/token estimator materially under-counts the llama.cpp tokenizer for this schema-heavy request. Future C5 enforcement must therefore be provider/tokenizer aware or deliberately conservative; the observed ratio must not simply be hard-coded as a universal multiplier.

## C2 — compact provider schema

Status: **repository-complete and CI-accepted; real runtime re-measurement pending**.

C1 runtime evidence justified reducing the finite provider authoring depth from:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 3
```

to:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 2
```

The canonical M1 validator remains authoritative with depth `12` and expression-node limit `64`.

The ordinary M1 relationship:

```text
InnerWidth = Width - 2 * WallThickness
```

is explicitly regression-tested against the depth-2 provider-authoring Zod schema and remains accepted. A deliberately deeper expression is rejected by that finite provider boundary while the actual tool wrapper's full recursive/canonical validator still accepts it, proving that C2 changes constrained model authoring only and does not reduce canonical/persisted M1 capability.

The actual provider JSON Schema remains:

- finite;
- reference-free;
- free of nested `$ref`;
- explicit about `add`, `sub`, `mul`, `div` and `neg`;
- backed by full canonical validation after provider output.

A schema-size regression now requires the serialized `build_brep_project` provider schema to remain below:

```text
180000 bytes
```

This prevents future finite-expression changes from silently restoring the ~423 kB tool-schema class observed by C1.

C2 code/test checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
Test compact BRep provider schema depth
```

CI on that exact checkpoint:

- Quality Gate #770 — PASS;
  - dependency audit — PASS;
  - tests — PASS;
  - typecheck — PASS;
  - lint — PASS;
  - build — PASS;
  - diff check — PASS;
- Grasshopper Build #342 — PASS.

Runtime acceptance still required:

- update/restart the local Brepia runtime on the current branch;
- repeat the same first-turn Native BRep fixture on `local/qwen3.8-27b-mtp-128k`;
- capture the new bounded `ai context diagnostics` object;
- confirm the request no longer overflows 131072;
- if it succeeds, capture `ai context actual usage`;
- compare provider schema size and request count against the C1 baseline.

Do not begin C3 until this re-measurement shows the residual problem after C2.

## C3 — BRep model-context projection

Status: **not started; gated on C2 runtime re-measurement**.

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

The C1 failure-class measurement shows that the current deterministic byte estimator is not precise enough to be used blindly as this hard guard for schema-heavy llama.cpp traffic. C5 must therefore use provider/tokenizer-aware counting where practical or a tested conservative bound.

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

1. **C1 — observability** — complete and empirically measured;
2. **C2 — provider-schema size reduction + size regression** — repository complete / CI accepted; re-measure runtime next;
3. **C3 — BRep history projection / superseded snapshot removal** — only after C2 runtime evidence;
4. re-measure representative long multi-turn BRep conversations;
5. **C4 — image projection** where necessary;
6. **C5 — hard model-aware input budget**;
7. **C6 — rolling summary** only if measurements justify it.

C1 falsified the assumption that history projection was needed to solve the original first-turn failure: the provider schema dominated before history existed. C3 remains important for long sessions, but it is now deliberately sequenced after C2 runtime verification.

## Acceptance fixture

Use the real failure class as a regression target:

```text
local model context window: 131072
observed request:           169503 tokens
```

The immediate C2 runtime goal is that the same first-turn fixture fits comfortably enough to dispatch successfully without changing llama.cpp context size or weakening canonical M1.

A representative long Native BRep conversation should later, after C3/C4/C5 as needed, remain comfortably under the model-aware hard budget while preserving:

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
- reduce canonical M1 depth `12` or expression-node limit `64`;
- reintroduce recursive provider schema warnings;
- introduce nested `$ref` as the llama.cpp baseline;
- enable unsupported rotation/modeling operations;
- change GHX parameter-only return/import authority;
- change immutable revision semantics;
- merge PR #36 across its stacked boundary;
- start M2 `union` / `intersect` implementation.

## Relationship to the modeling roadmap

This context-budget phase remains the **next active engineering activity before M2** because current long-session behavior can prevent further BRep AI work from reaching the model at all.

M2 remains planned but not started. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed by context-budget work.
