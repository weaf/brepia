# BRep AI context budget and projection plan

Status: **C1-C3 accepted; C4 deferred by evidence; C5 complete/runtime-accepted; C6 deterministic reasoning projection repository-complete / CI-accepted with runtime remeasurement next; M2 not started**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Detailed evidence/status:

- `docs/brep_c1_context_observability_closeout.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- `docs/brep_c2_runtime_evidence_2026-09-10.md`;
- `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`;
- `docs/brep_c25a_step_observability_status.md`;
- `docs/brep_c25d_rhino_disjoint_subtract_status.md`;
- `docs/brep_c3_model_context_projection_status.md`;
- `docs/brep_c3_runtime_evidence_2026-09-10.md`;
- `docs/brep_c5_hard_context_budget_status.md`;
- `docs/brep_c5_runtime_evidence_2026-09-10.md`;
- `docs/brep_c6_reasoning_projection_status.md`.

## Trigger

After M1 provider-safe scalar-schema hardening, a real local-model request failed with:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The selected model was a local 128k-class OpenAI-compatible model. The failure exposed a context-construction/runtime problem, not a reason to simply increase the llama.cpp context window.

## Architectural principle

Durable history and provider working memory are separate layers:

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

C1 added bounded diagnostics for system/instructions, provider tool schemas, current canonical BRep, ordinary history, historical BRep payloads/snapshots, images/base64, effective model messages, Settings-provided model budget metadata, and estimated headroom.

Original failure fixture:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
ordinary history estimate                 29 tokens
effective model messages                  42 tokens
total deterministic estimate          107862 tokens
llama.cpp request count                169503 tokens
```

The provider schema dominated before history existed, and the byte estimator materially under-counted llama.cpp tokenization.

## C2 — compact provider schema

Status: **complete, CI-accepted and runtime-dispatched**.

C2 reduced only provider authoring expression depth from 3 to 2. Canonical M1 validation remains authoritative at depth `12` and expression-node limit `64`.

The provider JSON Schema remains finite, explicit and `$ref`-free. Ordinary M1 relations such as:

```text
InnerWidth = Width - 2 * WallThickness
```

remain supported.

Accepted checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
Quality Gate #770       PASS
Grasshopper Build #342 PASS
```

The first real post-C2 request no longer overflowed but took about 60 minutes over 12 model steps, leading to C2.5.

## C2.5 — Native BRep runtime/CAD specialization

Status: **complete and accepted, including installed Rhino 8 / Grasshopper evidence**.

C2.5 completed:

1. per-step/provider usage observability;
2. stop on the first accepted canonical Native BRep build while rejected builds may retry;
3. automatic Native BRep/OpenSCAD source-kind CAD specialization under the Standard profile;
4. bounded Rhino/native disjoint-subtract parity.

Representative first-turn runtime after C2.5:

```text
model:                 local/qwen3.8-27b-mtp-128k
stepCount:             1
accepted build step:   1
static input estimate: 36419
provider input:        56413
provider output:       25674
provider total:        82087
elapsed:               about 10m33s
```

Installed Rhino/Grasshopper evidence confirmed working parametric wall thickness/door recomputation and disjoint-subtract parity without broadening the canonical vocabulary.

## C3 — BRep model-context projection

Status: **complete, CI-accepted and runtime-accepted**.

C3 keeps complete DB/UI history and source resolution intact while removing superseded structured BRep state from the actual provider working context. The exact current canonical BRep is supplied once through the dedicated system context.

Historical `build_brep_project` inputs/results are removed before dispatch; successful revisions may leave bounded server-derived summaries. Historical `data-brep-project` snapshots remain persisted but are not re-sent as geometry state.

Repository checkpoint:

```text
1231eceee6cd48683a02a7fdc15bb025c1069b44
Quality Gate #826       PASS
Grasshopper Build #398 PASS
```

Real persisted follow-up evidence:

```text
removed build tool parts:      1
removed BRep snapshots:        2
removed provider tool calls:   1
removed provider tool results: 1
first-step historical calls:   0
first-step historical results: 0
stepCount:                     1
accepted build step:           1
static estimate:               59628
provider input:                83612
provider output:                2744
provider total:                86356
elapsed:                       167207 ms
images:                        0
```

Static/provider ratio:

```text
83612 / 59628 = 1.4022
```

## C4 — image-context projection

Status: **deferred by evidence, not cancelled**.

The representative C3 and C5 follow-ups both had:

```text
images.count: 0
```

Historical image projection is therefore not the measured bottleneck on the current Native BRep path. When an image-bearing conversation demonstrates material historical image cost, C4 should preserve required current/relevant images and omit superseded image history without replacing required image authority with an unverified generated summary.

## C5 — hard model-aware context budget

Status: **complete, CI-accepted and runtime-accepted**.

C5 adds a hard pre-dispatch budget for models whose Settings/discovery metadata provides a usable context window.

Until exact provider/tokenizer preflight is wired end-to-end:

```text
conservativeInput = ceil(staticEstimatedInput * 1.75)
```

The factor is above all measured llama.cpp ratios so far:

```text
original C1 overflow:  1.5715
C3 follow-up:          1.4022
C5 acceptance follow-up: 1.3996
```

For a known context window:

```text
minimumOutputReserve = clamp(contextWindow / 8, 4096, 16384)
hardInputLimit       = contextWindow - safetyMargin - minimumOutputReserve
```

The configured `maxOutputTokens` remains an upper bound rather than a mandatory reservation. C5 derives a safe request/step-specific output ceiling from remaining context and repeats the hard check in `prepareStep(...)` before every provider retry.

Repository checkpoint:

```text
6eddeb73404468f9e9bdb4ae903d7c8fd86ee511
Quality Gate #833       PASS
Grasshopper Build #405 PASS
```

Real C5 acceptance follow-up:

```text
hardBudget.enforced:         true
hardBudget.fits:             true
raw estimate:                60213
conservative input:         105373
hard input limit:           106496
hard headroom:                1123
configured max output:       64000
effective max output:        17507
provider input:              84272
provider output:              3147
provider total:              87419
stepCount:                       1
accepted build step:             1
elapsed:                    177443 ms
```

C3 remained effective in the same run, removing two historical build calls/results and three persisted BRep snapshots from provider working context.

Detailed evidence:

```text
docs/brep_c5_runtime_evidence_2026-09-10.md
```

## C6 — bounded conversational working memory

Status: **deterministic superseded-build reasoning projection repository-complete / CI-accepted; runtime remeasurement next**.

C5 runtime acceptance showed the next limiting category:

```text
ordinaryConversationHistory.bytes: 81114
effectiveModelMessages.bytes:      83312
hardInputHeadroomTokens:             1123
images.count:                           0
```

From C3 to C5 one small follow-up changed:

```text
raw estimate:        59628 -> 60213  (+585)
conservative input: 104349 -> 105373 (+1024)
hard headroom:        2147 -> 1123   (-1024)
```

Inspection showed that historical assistant `reasoning` attached to accepted `build_brep_project` turns remained after the structured BRep payload itself had been projected away.

C6 therefore begins with a narrower deterministic operation instead of an AI-generated rolling summary:

- remove historical assistant `reasoning` only when attached to a superseded BRep build;
- preserve every user-authored turn;
- preserve unrelated assistant context;
- preserve bounded accepted-revision summaries;
- preserve exact current canonical BRep authority;
- leave DB/UI history untouched.

New diagnostics report:

```text
brepModelProjection.branch.removedBuildReasoningParts
brepModelProjection.branch.removedBuildReasoningBytes
brepModelProjection.provider.removedBuildReasoningParts
brepModelProjection.provider.removedBuildReasoningBytes
```

Repository checkpoint:

```text
d0130dd220d3cd10e3c6b7c05c3e4cb3c173653e
Quality Gate #838       PASS
Grasshopper Build #410 PASS
```

Detailed status:

```text
docs/brep_c6_reasoning_projection_status.md
```

The next active step is one real follow-up in the same persisted conversation to measure the removed reasoning bytes and restored C5 hard headroom.

Only if older **user-authored** natural-language history is still a material cost after this deterministic projection should a broader rolling summary/truncation mechanism be considered. The summary must never become geometry authority.

## Current implementation order

1. **C1** — complete and measured;
2. **C2** — complete and runtime-dispatched;
3. **C2.5** — complete and runtime/host accepted;
4. **C3** — complete and runtime-accepted;
5. **C4** — deferred until image-bearing evidence justifies it;
6. **C5** — complete and runtime-accepted;
7. **C6 deterministic superseded-build reasoning projection** — repository complete / CI accepted;
8. **representative real C6 follow-up remeasurement** — next active step;
9. broader rolling summary only if that measurement proves it is still needed;
10. **M2** — modeling capability expansion only after this runtime/context track is sufficiently stable.

## Acceptance fixtures

Keep the measured failure/success classes as regression targets.

Original failure:

```text
context window: 131072
observed request: 169503
```

Post-C2.5 first turn:

```text
static estimate: 36419
provider input:  56413
provider output: 25674
stepCount:       1
```

C3 projected follow-up:

```text
static estimate: 59628
provider input:  83612
provider output: 2744
stepCount:       1
images:          0
```

C5 accepted follow-up:

```text
static estimate: 60213
provider input:  84272
provider output: 3147
hard headroom:   1123
stepCount:       1
images:          0
```

The C6 runtime fixture should materially reduce provider working-context bytes if superseded BRep reasoning is the dominant remaining history cost, while leaving current canonical state and user intent intact.

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

## Relationship to modeling roadmap

The context/runtime track remains active before M2 because it directly determines whether Native BRep AI work executes reliably within bounded model resources.

M2 remains planned but unstarted. Phase 9 installed Rhino/Grasshopper host acceptance remains a separate evidence track and is not closed merely by context/runtime work.
