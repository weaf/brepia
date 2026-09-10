# C5 — hard model-aware context budget

Status: **repository-complete and CI-accepted; representative local runtime remeasurement pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Trigger

C3 runtime acceptance proved that superseded Native BRep project payloads are removed correctly, but it also produced the first reliable provider-reported token count for the projected follow-up request:

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

C3 also exposed a separate accounting issue: the configured Generative maximum output setting was `64000`, and the pre-C5 diagnostic subtracted that entire value from the context window as if every request required a 64000-token completion. The real successful C3 request used only `2744` output tokens.

## Implemented C5 policy

C5 introduces a hard pre-dispatch context boundary in `src/server/aiContextBudget.ts` and wires it through `src/server/aiChat.ts`.

### Conservative input bound

Until exact provider/tokenizer preflight is available end-to-end, C5 uses:

```text
conservativeInput = ceil(staticEstimatedInput * 1.75)
```

`1.75` is deliberately above both measured llama.cpp ratios (`1.4022` and `1.5715`). It is an empirical conservative bound, not a claim of exact tokenization.

Image/base64 message content remains charged more aggressively than ordinary UTF-8 in the per-step estimator. C4 is still separate; C5 does not silently remove images.

### Output reserve

The configured runtime `maxOutputTokens` remains the user's/model route upper bound. It is no longer treated as a mandatory reservation of that full amount for every request.

For a model with known context metadata, C5 reserves:

```text
minimumOutputReserve = clamp(contextWindow / 8, 4096, 16384)
```

then caps that reserve by the configured/model output cap when smaller.

For a 131072-token context window this gives:

```text
minimumOutputReserve = 16384
```

### Hard input gate

With a known context window:

```text
hardInputLimit = contextWindow - safetyMargin - minimumOutputReserve
```

The request is rejected locally when:

```text
conservativeInput > hardInputLimit
```

No provider request is sent in that case.

### Per-request/per-step output ceiling

When the request fits, C5 derives:

```text
maximumSafeOutput = contextWindow - safetyMargin - conservativeInput

effectiveMaxOutput = min(
  configuredMaxOutput,
  modelOutputLimit when known,
  maximumSafeOutput
)
```

The effective cap is supplied to `streamText(...)` and recalculated in `prepareStep(...)` for every model step. This preserves room for a valid completion while preventing a configured `64000` upper cap from making otherwise safe requests appear impossible.

### Retry growth protection

The hard budget is not only checked on the initial request. `prepareStep(...)` measures the current provider messages before every subsequent model step, adds the fixed system/tool-schema estimate, derives a new conservative budget and throws before provider dispatch if a retry has grown beyond the safe boundary.

This matters for Native BRep validation retries: an invalid `build_brep_project` call may still retry under C2.5-B, but retries cannot grow past the configured model context unnoticed.

## Fail-closed behavior

The C3 context projection / diagnostics boundary is now a required preflight rather than best-effort logging. If that boundary fails, Brepia does not dispatch an unprojected request.

Initial hard-budget rejection returns HTTP `413` with a bounded product error and records the generation as `context_budget_exceeded`.

A later per-step budget rejection aborts before the next provider step and surfaces a bounded UI error.

Hard-budget logs contain numeric budget metadata only; they do not include prompt, project, image, tool-input or tool-output payloads.

## Calibration fixtures

### C3 real follow-up

```text
raw estimate:             59628
conservative x1.75:      104349
context window:          131072
safety margin:             8192
minimum output reserve:   16384
hard input limit:        106496
hard input headroom:       2147
maximum safe output:      18531
effective max output:     18531
actual provider input:    83612
actual provider output:    2744
result:                    PASS
```

This known-good request remains admissible.

### Original C1 overflow class

```text
raw estimate:            107862
conservative x1.75:      188759
hard input limit:        106496
result:                   REJECT before provider dispatch
```

### Accepted post-C2.5 first-turn fixture

```text
raw estimate:             36419
conservative x1.75:       63734
maximum safe output:      59146
actual historical output: 25674
result:                    PASS
```

The policy therefore does not regress the accepted first-turn fixture merely because the configured route maximum is 64000 output tokens.

## Unknown model metadata

If Settings/discovery does not provide a usable context limit, C5 does **not** invent one. Hard enforcement stays disabled for that model and the configured/model output cap remains in effect.

This preserves Settings/discovery as the sole model-capability authority.

## Repository acceptance

C5 implementation checkpoints:

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

Quality Gate includes the seven focused C5 budget tests plus the complete repository test suite, typecheck, lint, build and diff check.

## Required runtime remeasurement

Use the same persisted Native BRep conversation and local model used for the accepted C3 follow-up:

```text
local/qwen3.8-27b-mtp-128k
```

Perform another small unambiguous follow-up edit and capture:

```text
ai context diagnostics
ai step started
ai step diagnostics
ai context actual usage
```

Verify specifically:

1. `hardBudget.enforced = true`;
2. `hardBudget.fits = true` for the representative accepted-size request;
3. the effective output cap is below the unsafe configured 64000 ceiling when required;
4. provider-reported input remains below the context limit;
5. accepted BRep build still completes and persists immutably;
6. C2.5-B still terminates at the first accepted build;
7. C3 continues to remove superseded historical BRep tool payloads;
8. if the conversation has grown enough to fail C5, the failure happens locally before provider dispatch and the measured remaining cost determines whether C4 or C6 is justified.

## C4 and C6 decision boundary

The accepted C3 runtime fixture contained zero images, so C4 remains deferred until an image-bearing conversation demonstrates material historical image cost.

C6 rolling natural-language summary also remains deferred. If the C5 follow-up is blocked and diagnostics show older ordinary conversational history is now the dominant removable cost, that is the evidence required to begin C6. The summary must never become BRep geometry authority.

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
