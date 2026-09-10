# BRep AI context budget and projection plan

Status: **C1-C3 accepted; C4 deferred by evidence; C5 repository-complete / CI-accepted with representative runtime remeasurement next; C6 conditional; M2 not started**

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
- `docs/brep_c3_model_context_projection_status.md`;
- `docs/brep_c3_runtime_evidence_2026-09-10.md`;
- `docs/brep_c5_hard_context_budget_status.md`.

## Trigger

After the M1 provider-safe scalar-schema hardening, a real local-model request failed with:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The selected model was a local 128k-class OpenAI-compatible model. This exposed a context-construction problem rather than a reason to simply increase the llama.cpp context window.

## Architectural principle

Treat durable state and provider working memory as separate layers:

```text
Database / immutable revisions = durable history and source authority
Model context window           = bounded working memory for this turn
```

For Native BRep:

```text
canonical BrepProject = current structured truth
conversation history  = intent, rationale and user interaction history
```

Persisted conversation history must not be equated with the complete prompt sent to every model step.

## C1 — context observability

Status: **complete, CI-accepted and empirically measured**.

C1 added bounded request-level diagnostics for:

- system/instruction size;
- provider tool-schema size;
- current canonical BRep size;
- ordinary history;
- historical BRep tool payloads and snapshots;
- images/base64;
- effective model-message size;
- configured model context/output metadata;
- safety margin and estimated headroom.

The original overflow fixture reported:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
ordinary history estimate                 29 tokens
effective model messages                  42 tokens
total deterministic estimate          107862 tokens
llama.cpp request count                169503 tokens
```

The provider schema dominated before history existed. The static byte estimator also materially under-counted llama.cpp tokenization.

## C2 — compact provider schema

Status: **complete, CI-accepted and runtime-dispatched**.

C2 reduced only the finite provider authoring depth from 3 to 2. Canonical M1 validation remains authoritative at depth `12` with node limit `64`.

The provider JSON Schema remains finite, explicit and `$ref`-free. The ordinary M1 relation:

```text
InnerWidth = Width - 2 * WallThickness
```

remains supported and regression-tested.

Accepted C2 checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
Quality Gate #770       PASS
Grasshopper Build #342 PASS
```

A real post-C2 request completed instead of overflowing, but took approximately 60 minutes over 12 model steps and exposed the runtime/CAD issues addressed by C2.5.

## C2.5 — Native BRep agent runtime and CAD specialization

Status: **complete and accepted, including installed Rhino 8 / Grasshopper evidence**.

C2.5 completed:

1. per-step/provider usage observability;
2. termination on the first accepted canonical Native BRep build while rejected builds may retry;
3. automatic OpenSCAD/Native-BRep source-kind CAD specialization under the Standard profile;
4. bounded Rhino/native disjoint-subtract parity.

Representative post-C2.5 first-turn evidence using `local/qwen3.8-27b-mtp-128k`:

```text
stepCount:            1
accepted build step:  1
static input estimate:36419 tokens
provider input:       56413 tokens
provider output:      25674 tokens
provider total:       82087 tokens
elapsed:              about 10m33s
```

Installed Rhino 8 / Grasshopper evidence confirmed the corrected CAD methodology and disjoint-subtract parity without broadening the canonical vocabulary.

## C3 — BRep model-context projection

Status: **complete, CI-accepted and runtime-accepted on a persisted follow-up**.

C3 separates durable BRep history from provider working context. The full branch remains authoritative for UI, branch/leaf semantics and source resolution. The current canonical project is supplied exactly once through the dedicated BRep system context.

Before provider dispatch, superseded historical `build_brep_project` call/result payloads are removed and successful historical revisions may leave a bounded server-derived summary. Historical `data-brep-project` snapshots remain persisted but are not duplicated into model context.

Repository checkpoint:

```text
1231eceee6cd48683a02a7fdc15bb025c1069b44
Quality Gate #826       PASS
Grasshopper Build #398 PASS
```

Real follow-up evidence then showed:

```text
branch removedBuildToolParts:     1
branch removedBrepSnapshotParts:  2
provider removedToolCalls:        1
provider removedToolResults:      1
first-step historical BRep calls: 0
first-step historical results:    0
stepCount:                        1
accepted build step:              1
provider input:               83612 tokens
provider output:               2744 tokens
provider total:               86356 tokens
elapsed:                      167207 ms
```

This is recorded in `docs/brep_c3_runtime_evidence_2026-09-10.md`.

The same run calibrated the static estimator:

```text
static estimate: 59628
provider input:  83612
ratio:            1.4022
```

Combined with the original C1 ratio:

```text
169503 / 107862 = 1.5715
```

this confirms that `bytes / 4` cannot be used as an exact hard provider limit.

## C4 — image-context projection

Status: **deferred by current evidence, not cancelled**.

The accepted representative C3 follow-up had:

```text
images.count:           0
images.base64Chars:     0
images.estimatedTokens: 0
```

Historical image projection is therefore not the measured next bottleneck for the current Native BRep path.

When an image-bearing conversation demonstrates material historical image cost, C4 should distinguish:

- current-turn images that remain required;
- explicitly relevant recent reference images;
- older image history that can be omitted from direct provider context.

Do not replace image authority with an unverified generated summary when the original image is required for the current operation.

## C5 — hard model-aware context budget

Status: **repository-complete and CI-accepted; representative local runtime remeasurement pending**.

Implementation/status:

```text
docs/brep_c5_hard_context_budget_status.md
```

C5 adds a hard pre-dispatch budget for models whose Settings/discovery metadata contains a usable context window.

Until exact provider/tokenizer preflight is wired end-to-end, C5 deliberately uses a conservative empirical bound:

```text
conservativeInput = ceil(staticEstimatedInput * 1.75)
```

The factor `1.75` is above both measured llama.cpp ratios (`1.4022`, `1.5715`). It is explicitly a conservative calibration, not exact tokenization.

The configured route `maxOutputTokens` remains an upper bound rather than being blindly subtracted in full. C5 derives a minimum output reserve:

```text
minimumOutputReserve = clamp(contextWindow / 8, 4096, 16384)
```

capped by the configured/model output cap when smaller.

Then:

```text
hardInputLimit = contextWindow - safetyMargin - minimumOutputReserve
```

A known oversized request fails locally before provider dispatch.

For an admissible request C5 derives a safe per-request/per-step maximum output ceiling from the remaining context. The hard check is repeated from `prepareStep(...)` before every provider step so validation retries cannot accumulate beyond the model context.

Calibration against the accepted C3 follow-up:

```text
raw estimate:             59628
conservative x1.75:      104349
context window:          131072
safety margin:             8192
minimum output reserve:   16384
hard input limit:        106496
headroom:                  2147
effective max output:     18531
actual provider input:    83612
actual provider output:    2744
fixture result:            PASS
```

Original C1 overflow class:

```text
raw estimate:            107862
conservative x1.75:      188759
hard input limit:        106496
fixture result:           REJECT before provider
```

Accepted post-C2.5 first-turn fixture:

```text
raw estimate:             36419
conservative x1.75:       63734
effective max output:     59146
historical actual output: 25674
fixture result:            PASS
```

Unknown model context metadata is never invented; enforcement remains disabled for that model.

C5 code checkpoint:

```text
6eddeb73404468f9e9bdb4ae903d7c8fd86ee511
Quality Gate #833       PASS
Grasshopper Build #405 PASS
```

The next active evidence step is a real persisted Native BRep follow-up using the same local model. Capture the new `hardBudget`, effective per-step `maxOutputTokens`, provider usage and accepted-build step.

## C6 — rolling conversation summary, only if needed

Status: **not started; conditional on C5 runtime evidence**.

Do not add summarization merely because history exists. If C5 rejects or approaches its hard limit and diagnostics show older ordinary natural-language history is the dominant removable cost, then add a bounded rolling summary for intent/decisions only.

The summary must never become BRep geometry authority. Current canonical project state remains exact and authoritative.

## Current implementation order

1. **C1 — context observability** — complete and measured;
2. **C2 — compact provider schema** — complete and runtime-dispatched;
3. **C2.5 — runtime/CAD specialization** — complete and runtime/host accepted;
4. **C3 — BRep model-context projection** — complete and runtime-accepted;
5. **C4 — image projection** — deferred until image-bearing evidence justifies it;
6. **C5 — hard model-aware budget** — repository complete / CI accepted;
7. **representative real C5 Native BRep follow-up remeasurement** — next active step;
8. **C6 — rolling summary** only if the C5 measurement justifies it;
9. **M2 — modeling capability expansion** only after this runtime/context track is sufficiently stable.

## Acceptance fixtures

Keep all measured failure/success classes as regression targets.

Original context failure:

```text
context window: 131072
observed request: 169503 tokens
```

Post-C2.5 first turn:

```text
static estimate: 36419
provider input:  56413
provider output: 25674
stepCount:       1
elapsed:         about 10m33s
```

C3 persisted follow-up:

```text
static estimate: 59628
provider input:  83612
provider output: 2744
stepCount:       1
elapsed:         about 2m47s
images:          0
```

The next C5 follow-up should remain within the hard model-aware bound while preserving the current canonical source and user intent. If it does not, the measured removable category — images versus older natural-language history — determines whether C4 or C6 is next.

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

The context/runtime track remains the active engineering activity before M2 because it directly affects whether Native BRep AI work executes reliably within bounded model resources.

M2 remains planned but unstarted. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed merely by context/runtime work.
