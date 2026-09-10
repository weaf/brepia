# BRep AI context budget and projection plan

Status: **C1-C2.5 accepted; C3 repository-complete / CI-accepted; representative C3 follow-up runtime remeasurement is the next active step**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Detailed evidence and phase plans:

- `docs/brep_c1_context_observability_closeout.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- `docs/brep_c2_runtime_evidence_2026-09-10.md`;
- `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`;
- `docs/brep_c25a_step_observability_status.md`;
- `docs/brep_c25d_rhino_disjoint_subtract_status.md`;
- `docs/brep_c3_model_context_projection_status.md`.

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

Status: **repository-complete, CI-accepted and post-C2 runtime dispatch succeeded**.

C2 reduced only the finite provider authoring depth from 3 to 2. The canonical M1 validator remains authoritative with depth `12` and expression-node limit `64`.

The ordinary M1 relationship:

```text
InnerWidth = Width - 2 * WallThickness
```

remains explicitly regression-tested against the depth-2 provider boundary.

The provider JSON Schema remains finite, reference-free, `$ref`-free and explicit about `add`, `sub`, `mul`, `div` and `neg`, while every received tool value is still validated by the full recursive/canonical validator.

Accepted C2 checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
Quality Gate #770       PASS
Grasshopper Build #342 PASS
```

A real post-C2 Native BRep generation using `local/qwen3.8-27b-mtp-128k` completed instead of reproducing the 131072-token overflow, but took approximately 60 minutes across 12 model steps and exposed the runtime/CAD issues that led to C2.5.

## C2.5 — Native BRep agent runtime and CAD specialization

Status: **complete and accepted, including installed Rhino 8 / Grasshopper host evidence**.

C2.5 completed:

1. **A — per-step/provider usage observability**;
2. **B — terminate a normal Native BRep turn on the first accepted canonical build while rejected builds may retry**;
3. **C — automatic OpenSCAD/Native-BRep source-kind CAD specialization under the shared Standard profile**;
4. **D — bounded Rhino/native disjoint-subtract parity**.

Representative post-C2.5 runtime evidence with:

```text
local/qwen3.8-27b-mtp-128k
```

reported:

```text
stepCount:           1
accepted build step: 1
elapsed:             about 10m33s
provider input:      56,413 tokens
provider output:     25,674 tokens
provider total:      82,087 tokens
```

The pre-dispatch byte estimator predicted only `36,419` input tokens, under-counting the provider by `19,994` tokens. Against the then-current conservative usable-input budget of `58,880`, actual first-turn provider input left only about `2,467` tokens of headroom.

Installed Rhino 8 / Grasshopper evidence then showed:

- the newer C2.5-C room model recomputed wall thickness and door opening parametrically;
- the older known-bad project with a disjoint door cutter no longer failed its Rhino Python component after C2.5-D;
- the bad door remained absent, correctly reflecting the unchanged canonical source while the disjoint subtraction became an explicit no-op;
- the rest of the geometry solved.

C2.5 therefore closed without broadening the canonical modeling vocabulary.

## C3 — BRep model-context projection

Status: **repository-complete and CI-accepted; representative real follow-up remeasurement pending**.

Implementation/status:

```text
docs/brep_c3_model_context_projection_status.md
```

C3 creates an explicit request-local projection between durable `AppUIMessage[]` history and the actual provider messages used for a persisted Native BRep follow-up.

The complete durable branch remains authoritative for DB/UI history, branch/leaf semantics and active canonical source resolution. The current canonical BRep continues to be injected exactly once through the existing BRep system context.

Before `streamText(...)`, C3 now removes superseded historical `build_brep_project` tool-call inputs and tool-result payloads from the actual provider message array. Successful historical revisions may leave a bounded server-derived summary of at most 512 characters. Historical `data-brep-project` parts remain persisted but are excluded from the branch projection because they are superseded geometry state.

C3 preserves user messages/current user intent and deliberately leaves images untouched for C4.

Repository checkpoint:

```text
1231eceee6cd48683a02a7fdc15bb025c1069b44
Quality Gate #826       PASS
Grasshopper Build #398 PASS
```

Diagnostics now expose both the persisted-history cost and C3 projection results through:

```text
brepModelProjection.branch
brepModelProjection.provider
```

The next required evidence is a small **follow-up edit on an existing persisted Native BRep conversation**, not another first-turn creation. Capture request-level context diagnostics, per-step diagnostics and real provider usage to verify that superseded full-project payloads are absent from the provider working context while the canonical source and user intent remain correct.

C3 must not be called runtime-accepted until that follow-up succeeds.

## C4 — image-context projection

Status: **not started; follows C3 runtime remeasurement if evidence still justifies it**.

Historical images must not automatically be rehydrated to base64 simply because they remain on the active branch.

Policy should distinguish:

- current-turn images: preserve when required;
- explicitly relevant recent reference image: preserve only when needed;
- older image history: omit from direct model context or replace with already-authoritative compact derived context where such context exists.

Do not silently replace image authority with an unverified generated summary where the original image is still required for the current operation.

## C5 — hard context budget

Status: **not started**.

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

C1 and the post-C2.5 provider measurement show that `bytes / 4` cannot be treated as exact for schema-heavy llama.cpp traffic. C5 must use provider/tokenizer-aware counting where practical or a tested conservative bound.

## C6 — rolling conversation summary, only if needed

Status: **not started**.

Do not begin with summarization as the primary fix. First remove duplicated structured state and enforce measured projection/budget behavior. Only add a durable/refreshable summary if older natural-language history remains a material cost after C1-C5.

The summary must never become BRep geometry authority.

## Current implementation order

Proceed in this sequence:

1. **C1 — context observability** — complete and empirically measured;
2. **C2 — compact provider schema** — complete and runtime-dispatched;
3. **C2.5 — Native BRep agent runtime/CAD specialization** — complete and runtime/host accepted;
4. **C3 — BRep model-context projection** — repository complete / CI accepted;
5. **representative real C3 Native BRep follow-up remeasurement** — next active step;
6. **C4 — image projection** only where measurements justify it;
7. **C5 — hard model-aware input budget**;
8. **C6 — rolling summary** only if measurements justify it;
9. **M2 — modeling capability expansion** only after this runtime/context track is sufficiently stable.

## Acceptance fixtures

Keep the original context failure as a regression target:

```text
context window: 131072
observed request: 169503 tokens
```

Keep the post-C2.5 first-turn measurement as a provider-tokenization baseline:

```text
model:                local/qwen3.8-27b-mtp-128k
stepCount:            1
accepted build step:  1
static input estimate:36,419 tokens
provider input:       56,413 tokens
provider output:      25,674 tokens
provider total:       82,087 tokens
elapsed:              about 10m33s
```

C3 specifically requires a persisted **follow-up** fixture because first-turn creation contains no superseded BRep history to project.

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
- claim installed-host parity without real Rhino 8 / Grasshopper evidence;
- merge PR #36 across its stacked boundary;
- start M2 `union` / `intersect` implementation during C2.5-C6.

## Relationship to the modeling roadmap

The context/runtime track remains the active engineering activity before M2 because it directly affects whether BRep AI work can execute efficiently and reliably.

M2 remains planned but unstarted. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed merely by context/runtime work.
