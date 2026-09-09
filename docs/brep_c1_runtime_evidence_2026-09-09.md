# BRep AI C1 failure-class runtime evidence

Status: **empirical C1 measurement complete; C2 is justified as the next active change**

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Runtime fixture

The original overflow class was reproduced against the configured local model:

```text
local/qwen3.8-27b-mtp-128k
```

Settings metadata supplied:

```text
contextWindowTokens = 131072
outputLimitTokens    = unknown/null
```

The route configuration reserved:

```text
maxOutputTokens = 64000
```

The provider/llama.cpp request failed with the same exact class:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

No successful provider usage record exists for this call because dispatch failed at context validation.

## C1 breakdown

The bounded diagnostics immediately before `streamText(...)` reported:

| Category | Measurement |
| --- | ---: |
| system/instruction bytes | 8,308 |
| system estimated tokens | 2,077 |
| base system bytes before BRep context | 7,820 |
| added BRep-context bytes | 488 |
| provider-visible tool-schema bytes | **422,971** |
| provider-visible tool-schema estimated tokens | **105,743** |
| current canonical BRep | absent |
| ordinary branch messages | 1 |
| ordinary history bytes | 113 |
| ordinary history estimated tokens | 29 |
| historical `build_brep_project` calls | 0 |
| historical BRep tool payload bytes | 0 |
| historical `data-brep-project` snapshots | 0 |
| images/base64 payloads | 0 |
| effective model-message bytes | 168 |
| effective model-message estimated tokens | 42 |
| total deterministic estimated input | 107,862 tokens |
| provider/llama.cpp request count | **169,503 tokens** |

The deterministic C1 estimator therefore under-counted this provider/tokenizer path by approximately:

```text
169503 / 107862 ~= 1.57x
```

This is expected to be used as calibration evidence, not as a universal constant. C1 intentionally used a deterministic approximate byte/token estimator rather than claiming tokenizer-exact precision.

## Budget result

With the current route reservation:

```text
context window         131072
reserved output         64000
safety margin            8192
usable input budget     58880
estimated input        107862
estimated headroom     -48982
```

The request is therefore not merely close to the model ceiling; it is far above the intended model-aware working budget even before applying provider-specific calibration.

## Root-cause ranking

This fixture is especially decisive because it is a first-turn Native BRep creation request:

- `currentCanonicalBrep.present = false`;
- only one ordinary user message exists;
- no historical `build_brep_project` inputs/results exist;
- no historical BRep snapshots exist;
- no images exist.

Therefore C3 history projection and C4 image projection cannot materially fix this specific failure class.

The dominant measured contributor is the finite reference-free provider tool schema:

```text
provider tool schemas ~= 105743 estimated tokens
system + effective message context ~= 2119 estimated tokens
```

The finite provider expression expansion introduced for M1 is therefore the first engineering target supported by runtime evidence.

## C2 decision

Proceed with C2 before C3 for this failure class:

1. reduce `BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH` from `3` to `2`;
2. prove the ordinary M1 authoring relationship `Width - 2 * WallThickness` still fits the provider boundary;
3. keep canonical M1 depth `12` and expression-node limit `64` unchanged;
4. keep the provider schema reference-free and `$ref`-free;
5. keep full recursive/canonical validation behind the provider boundary;
6. add a provider-schema byte-size regression so future changes cannot silently recreate the prompt explosion;
7. re-run this same runtime fixture after C2 and compare both C1 diagnostics and the provider outcome.

C3 remains required for long multi-turn BRep conversations once the first-turn schema problem is under control, but it is not the root fix demonstrated by this fixture.

## C5 implication recorded early

The observed difference between deterministic estimate and provider request count means the future C5 hard budget must not assume that `UTF-8 bytes / 4` is sufficiently safe for every provider/tool-schema tokenizer path.

Before hard enforcement, C5 should use either provider/tokenizer-aware counting or a conservative calibrated estimate with explicit margin. The single observed ~1.57x ratio is evidence that calibration is necessary, not a universal multiplier to hard-code now.

The current `64000` route output reservation is also material because it leaves only `58880` tokens of intended input budget on this model. Changing that reservation is not part of C2; it remains a later model-aware budget-policy decision.

## Boundaries preserved

This evidence changes prioritization only. It does not change:

- canonical BRep + immutable revision authority;
- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical M1 depth `12`;
- canonical expression-node limit `64`;
- M0/M1 validation semantics;
- GHX parameter-only return/import authority;
- non-zero rotation fail-closed behavior;
- Settings/discovery model authority;
- OpenSCAD behavior;
- the stacked/draft PR #36 boundary;
- the prohibition on starting M2 during this context-budget phase.
