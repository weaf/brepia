# BRep AI context budget and projection plan

Status: **C1 empirically complete; C2 repository-complete / CI-accepted with successful post-C2 runtime dispatch; C2.5 is the next active phase before C3**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Detailed evidence and phase plans:

- `docs/brep_c1_context_observability_closeout.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- `docs/brep_c2_runtime_evidence_2026-09-10.md`;
- `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`.

## Trigger

After the M1 provider-safe scalar-schema hardening, a real local-model request failed with:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The selected model was a local 128k-class OpenAI-compatible model. This exposed a context-construction problem rather than a reason to simply increase the llama.cpp context window.

## Architectural principle

Treat these as separate layers:

```text
Database / immutable revisions = durable history and source authority
Model context window           = bounded working memory for this turn
```

For Native BRep work specifically:

```text
canonical BrepProject = current structured truth
conversation history  = intent, rationale and user interaction history
```

Do not equate persisted conversation history with the complete prompt sent to every model call.

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

The logging is bounded and never includes full prompt/project/image payloads.

The original overflow fixture contained no historical BRep state and no images, yet diagnostics reported:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
ordinary history estimate                 29 tokens
effective model messages                  42 tokens
total deterministic estimate          107862 tokens
llama.cpp request count                169503 tokens
```

The provider schema therefore dominated before history existed. C3 history projection could not be the primary fix for that first-turn failure.

The deterministic byte/token estimator also materially under-counted llama.cpp tokenization for this schema-heavy request. Future C5 enforcement must be provider/tokenizer aware or deliberately conservative.

## C2 — compact provider schema

Status: **repository-complete, CI-accepted and post-C2 runtime dispatch has succeeded**.

C2 reduced only the finite provider authoring depth from:

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

remains explicitly regression-tested against the depth-2 provider boundary.

The provider JSON Schema remains finite, reference-free, `$ref`-free and explicit about `add`, `sub`, `mul`, `div` and `neg`, while every received tool value is still validated by the full recursive/canonical validator.

A schema-size regression requires the serialized `build_brep_project` provider schema to remain below `180000` bytes.

Accepted C2 code/test checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
```

with Quality Gate #770 and Grasshopper Build #342 passing.

### Post-C2 runtime finding

A real post-C2 Native BRep generation using:

```text
local/qwen3.8-27b-mtp-128k
```

completed rather than reproducing the 131072-token overflow. However it exposed a new runtime quality/latency class:

```text
approximately 60 minutes total generation
stepCount: 12
provider usage surfaced as inputTokens=0, outputTokens=0, totalTokens=0
```

The generated room/cabinet model was broadly useful but misplaced a door cutter outside the room. The fresh GHX loaded in installed Rhino 8 / Grasshopper, where Brepia's Rhino Python script raised its own boolean-difference guard on the disjoint door cutter.

This evidence is recorded in:

```text
docs/brep_c2_runtime_evidence_2026-09-10.md
```

The successful dispatch means C2 addressed the immediate first-turn overflow sufficiently to expose the next bottlenecks. Do not jump directly to C3 without first resolving the newly isolated first-turn/runtime-loop and CAD-specialization issues.

## C2.5 — Native BRep agent runtime and CAD specialization

Status: **next active engineering phase**.

Detailed plan:

```text
docs/brep_c25_native_brep_agent_runtime_specialization_plan.md
```

C2.5 is ordered internally as:

1. **C2.5-A — per-step and provider-usage observability**
   - measure each model step, elapsed time, tool call, validation outcome and context growth;
   - request/use llama.cpp/OpenAI-compatible streaming usage metadata where supported;
   - distinguish repeated validation retries from redundant post-acceptance inference.
2. **C2.5-B — terminate on accepted canonical BRep build**
   - invalid/rejected `build_brep_project` calls may retry;
   - the first fully validated/accepted BRep build should complete the CAD generation turn without requiring an `answer_user` step;
   - preserve immutable persistence/finalization semantics.
3. **C2.5-C — source-kind CAD prompt specialization**
   - keep `Standard` as the high-level profile/package selection;
   - automatically select an OpenSCAD or Native BRep CAD methodology instruction from the authoritative source kind;
   - keep tool-contract instructions separate from CAD reasoning methodology;
   - Native BRep specialization should teach centered extents, half-extents, default-value transform sanity checks, cutter/material intersection checks and authoritative DAG/effectiveness checks;
   - keep the specialization concise and measure instruction/context cost.
4. **C2.5-D — Rhino/native disjoint subtract parity**
   - a provably disjoint cutter may be an explicit no-op, matching native build123d/OCCT behavior;
   - overlapping/uncertain boolean failures must remain fail-closed;
   - follow Rhino 8 evidence policy and obtain installed-host evidence before claiming parity.

C2.5 is not M2 and must not broaden the canonical modeling vocabulary.

## C3 — BRep model-context projection

Status: **not started; follows C2.5**.

Create an explicit projection from persisted `AppUIMessage[]` / branch history to the bounded messages that the model actually needs.

For BRep follow-up turns preserve:

- current user turn exactly;
- current canonical BRep source revision exactly once;
- recent relevant user intent/history;
- compact successful assistant/tool summaries needed to understand recent decisions;
- required system/tool instructions.

Remove or compact from model context while leaving DB/UI history untouched:

- complete project inputs from superseded historical `build_brep_project` calls;
- duplicate historical `data-brep-project` snapshots;
- old BRep state already superseded by the current canonical source;
- verbose historical tool mechanics that do not change current intent/state.

The current canonical project must remain authoritative and must never be reconstructed from a lossy conversation summary.

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

After observability and projection exist, enforce a deterministic request budget before provider dispatch.

Conceptually:

```text
inputBudget = contextWindow - reservedOutput - safetyMargin
```

Compaction/drop priority should be explicit and tested:

1. omit old non-current image payloads;
2. compact superseded historical BRep tool/project payloads;
3. bound older ordinary conversational turns;
4. use a rolling conversation summary only for older natural-language intent that remains useful;
5. preserve current user turn;
6. preserve current canonical BRep source;
7. preserve required system/tool contract;
8. fail locally with a clear bounded-context error if mandatory content alone cannot fit.

Never send a request known to exceed the selected model's context window.

C1 showed that `bytes / 4` cannot be treated as exact for schema-heavy llama.cpp traffic. C5 must use provider/tokenizer-aware counting where practical or a tested conservative bound.

## C6 — rolling conversation summary, only if needed

Do not begin with summarization as the primary fix.

First remove duplicated structured state. Once C1-C5 show that older natural-language history is the remaining significant cost, add a durable/refreshable compact summary for intent and decisions only.

The summary must not become BRep geometry authority. Canonical project state and immutable revisions remain authoritative.

## Current implementation order

Proceed in this sequence:

1. **C1 — context observability** — complete and empirically measured;
2. **C2 — compact provider schema** — repository complete / CI accepted; successful post-C2 runtime dispatch captured;
3. **C2.5 — Native BRep agent runtime and CAD specialization** — next active phase;
   - A: per-step/usage observability;
   - B: stop on accepted build;
   - C: OpenSCAD/BRep source-kind prompt specialization under the shared Standard profile;
   - D: Rhino/native disjoint-subtract parity;
4. **C3 — BRep history projection / superseded snapshot removal**;
5. re-measure representative long multi-turn BRep conversations;
6. **C4 — image projection** where necessary;
7. **C5 — hard model-aware input budget**;
8. **C6 — rolling summary** only if measurements justify it;
9. **M2 — modeling capability expansion** only after this runtime/context track is sufficiently stable.

## Acceptance fixtures

Keep both failure classes as regression targets.

Original context failure:

```text
context window: 131072
observed request: 169503 tokens
```

Post-C2 runtime/quality fixture:

```text
model: local/qwen3.8-27b-mtp-128k
result: request completes
latency: approximately 60 minutes
stepCount: 12
usage surfaced: 0 / 0 / 0
generated CAD: broadly useful room/cabinets, door cutter spatially wrong
GHX: opens in installed Rhino 8 / Grasshopper
Rhino Python: fails on second room_result boolean because the door cutter is disjoint
```

After C2.5, rerun the same or equivalent room/cabinets/door fixture before C3 and compare step count, accepted-build step, elapsed time, token usage, canonical geometry and installed-host behavior.

A representative long Native BRep conversation should later, after C3/C4/C5 as needed, remain comfortably under the model-aware hard budget while preserving current canonical state and user intent.

## Boundaries

This track must not:

- alter canonical `schemaVersion: 1` BRep authority;
- change `conversation.type = 'parametric'` or create a new BRep conversation type;
- weaken M0 parameter/graph integrity;
- weaken M1 canonical scalar validation;
- reduce canonical M1 depth `12` or expression-node limit `64`;
- reintroduce recursive provider schema warnings;
- introduce nested `$ref` as the llama.cpp baseline;
- enable unsupported rotation/modeling operations;
- change GHX parameter-only return/import authority;
- change immutable revision semantics;
- bypass Settings/discovery model authority;
- regress OpenSCAD behavior;
- claim Rhino parity without installed Rhino 8 / Grasshopper evidence;
- merge PR #36 across its stacked boundary;
- start M2 `union` / `intersect` implementation during C2.5-C6.

## Relationship to the modeling roadmap

The context/runtime track remains the active engineering activity before M2 because it directly affects whether BRep AI work can execute efficiently and reliably.

M2 remains planned but not started. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed by context/runtime work.
