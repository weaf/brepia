# C5 — hard model-aware context budget

Status: **complete, CI-accepted and runtime-accepted**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Detailed runtime evidence:

```text
docs/brep_c5_runtime_evidence_2026-09-10.md
```

## Trigger

C3 runtime acceptance proved that superseded Native BRep project payloads are removed correctly, but it also provided reliable provider-reported token counts for the projected follow-up request:

```text
static estimate:          59628 input tokens
llama.cpp reported:       83612 input tokens
observed ratio:           1.4022
```

The original C1 overflow fixture had already shown a larger schema-heavy discrepancy:

```text
static estimate:         107862 input tokens
llama.cpp request:       169503 input tokens
observed ratio:           1.5715
```

The deterministic byte estimator is therefore useful for decomposition and trend diagnostics but cannot be treated as an exact provider tokenizer.

C3 also exposed an accounting issue: the configured Generative maximum output setting was `64000`, but a real successful follow-up used only a few thousand output tokens. Treating the whole configured maximum as mandatory reservation made safe requests appear impossible.

## Implemented C5 policy

C5 introduces a hard pre-dispatch context boundary in `src/server/aiContextBudget.ts` and wires it through `src/server/aiChat.ts`.

### Conservative input bound

Until exact provider/tokenizer preflight is available end-to-end:

```text
conservativeInput = ceil(staticEstimatedInput * 1.75)
```

`1.75` is deliberately above the measured llama.cpp ratios `1.4022`, `1.5715`, and the later runtime-acceptance ratio `1.3996`. It is an empirical conservative bound, not exact tokenization.

### Output reserve

The configured runtime `maxOutputTokens` remains an upper bound. It is no longer treated as a mandatory reservation of that full amount.

For a model with known context metadata:

```text
minimumOutputReserve = clamp(contextWindow / 8, 4096, 16384)
```

capped by the configured/model output cap when smaller.

For the 131072-token local model:

```text
minimumOutputReserve = 16384
```

### Hard input gate

```text
hardInputLimit = contextWindow - safetyMargin - minimumOutputReserve
```

The request is rejected locally when:

```text
conservativeInput > hardInputLimit
```

No provider request is sent in that case.

### Per-request/per-step output ceiling

For a request that fits:

```text
maximumSafeOutput = contextWindow - safetyMargin - conservativeInput

effectiveMaxOutput = min(
  configuredMaxOutput,
  modelOutputLimit when known,
  maximumSafeOutput
)
```

The effective cap is supplied to `streamText(...)` and recalculated in `prepareStep(...)` before each later provider step.

### Retry growth protection

An invalid Native BRep build may still retry under C2.5-B, but `prepareStep(...)` remeasures the provider messages and asserts C5 before every retry. A retry cannot grow past the configured model context unnoticed.

## Fail-closed behavior

The C3 projection/context boundary is a required preflight. If it fails, Brepia does not dispatch an unprojected request.

Initial hard-budget rejection returns HTTP `413`, records `context_budget_exceeded`, and sends no provider request. A later per-step budget rejection aborts before the next model step and surfaces a bounded UI error.

Hard-budget logs contain numeric metadata only.

## Repository acceptance

Implementation checkpoints:

```text
2bff30490237c2d1ac1751494ec7d6f6733725d2  Add conservative C5 hard context budget policy
59c426ff55929fd063a053fd462c776487b187c5  Test C5 hard context budget policy
e1db31b2f0aa6a7b0ac1f246c627b1058bd19113  Enforce C5 hard context budget before dispatch
6eddeb73404468f9e9bdb4ae903d7c8fd86ee511  Keep C3 ordering regression current with C5 preflight
```

CI on `6eddeb73404468f9e9bdb4ae903d7c8fd86ee511`:

```text
Quality Gate #833       PASS
Grasshopper Build #405 PASS
```

## Runtime acceptance

A second persisted Native BRep follow-up using:

```text
local/qwen3.8-27b-mtp-128k
```

reported:

```text
hardBudget.enforced:             true
hardBudget.fits:                 true
rawEstimatedInputTokens:        60213
conservativeInputTokens:       105373
hardInputLimitTokens:          106496
hardInputHeadroomTokens:         1123
configuredMaxOutputTokens:      64000
effectiveMaxOutputTokens:       17507
provider input:                 84272
provider output:                 3147
provider total:                 87419
stepCount:                          1
accepted build step:                1
elapsed:                       177443 ms
```

The real static/provider input ratio was:

```text
84272 / 60213 = 1.3996
```

C3 remained active in the same run:

```text
removed historical build tool parts: 2
removed historical BRep snapshots:   3
removed provider tool calls:          2
removed provider tool results:        2
first-step historical BRep calls:     0
first-step historical BRep results:   0
```

The current canonical BRep remained present, the accepted build completed on the first step, and C2.5-B terminated the turn immediately.

C5 is therefore runtime-accepted for the representative local Native BRep follow-up path.

## Calibration fixtures retained

Original overflow class:

```text
raw estimate:       107862
conservative x1.75: 188759
hard input limit:   106496
result:             REJECT before provider dispatch
```

Post-C2.5 first turn:

```text
raw estimate:             36419
conservative x1.75:       63734
historical provider input:56413
historical output:        25674
result:                    PASS
```

C3 first projected follow-up:

```text
raw estimate:             59628
conservative x1.75:      104349
provider input:           83612
provider output:           2744
result:                    PASS
```

C5 runtime-acceptance follow-up:

```text
raw estimate:             60213
conservative x1.75:      105373
provider input:           84272
provider output:           3147
result:                    PASS
```

## C6 decision from runtime evidence

C5 succeeded, but its conservative hard headroom fell from `2147` to `1123` tokens after one additional small follow-up. The same run reported:

```text
ordinaryConversationHistory.bytes: 81114
effectiveModelMessages.bytes:      83312
images.count:                          0
```

C3 had already removed superseded structured BRep state. Inspection showed that historical assistant `reasoning` attached to accepted BRep build turns remained in model context.

That evidence is sufficient to begin a narrow C6 projection before introducing any generated rolling summary: omit superseded BRep-build assistant reasoning while preserving all user turns, bounded revision summaries, and exact current canonical geometry.

See:

```text
docs/brep_c6_reasoning_projection_status.md
```

C4 remains deferred because the representative C3 and C5 fixtures both contained zero images.

## Unknown model metadata

If Settings/discovery does not provide a usable context limit, C5 does not invent one. Hard enforcement remains disabled for that model and the configured/model output cap remains in effect.

## Preserved architecture

C5 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` authority;
- immutable revisions and branch/leaf persistence;
- build123d/OCCT native geometry authority;
- M0/M1 integrity;
- canonical scalar-expression depth 12 or node limit 64;
- provider expression depth 2 or finite/reference-free provider schema;
- Settings/discovery model authority;
- GHX parameter-only import boundary;
- non-zero rotation fail-closed behavior;
- OpenSCAD semantics;
- PR #36 draft/stacked/unmerged state;
- M2 status.
