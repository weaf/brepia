# BRep AI C2 provider-schema closeout

Status: **repository-complete and CI-accepted; local runtime re-measurement pending**

Date: 2026-09-09

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Why C2 was selected

C1 reproduced the original first-turn failure:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The bounded diagnostics showed that the fixture contained no current canonical BRep, no historical BRep tool calls, no historical snapshots and no images. The dominant measured contributor was instead the provider-visible tool schema:

```text
provider tool schemas       422971 bytes / ~105743 estimated tokens
system instructions           8308 bytes / ~2077 estimated tokens
ordinary conversation          113 bytes / ~29 estimated tokens
effective model messages       168 bytes / ~42 estimated tokens
```

This made provider-schema compaction the evidence-backed next step. C3 history projection cannot materially solve a first-turn request with no history.

Full runtime evidence is recorded in:

```text
docs/brep_c1_runtime_evidence_2026-09-09.md
```

## Implementation

The finite, reference-free provider authoring boundary changed from:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 3
```

to:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 2
```

This changes constrained provider authoring only.

The authoritative canonical M1 contract remains unchanged:

- recursive canonical scalar AST;
- maximum canonical expression depth `12`;
- maximum expression-node count `64`;
- unit algebra unchanged;
- bounded/intermediate finite-value checks unchanged;
- full project normalization unchanged.

No persistence or migration change is introduced.

## Ordinary M1 relationship remains authorable

C2 adds an explicit provider-boundary regression for:

```text
Width - 2 * WallThickness
```

represented as:

```text
sub(
  parameter(Width),
  mul(2, parameter(WallThickness))
)
```

This nested relation fits the depth-2 finite provider schema and is accepted by the provider-authoring Zod boundary.

The same depth also covers the intended M1 classes such as:

- `Width / 2`;
- half offsets;
- `baseOffset + spacing * indexScale`.

## Canonical capability is not reduced

The regression suite deliberately constructs an expression deeper than the provider authoring limit.

It verifies both sides of the boundary:

1. the finite provider-authoring Zod schema rejects the too-deep shape;
2. `brepAiBuildProviderInputSchema.validate(...)` still accepts it through the full recursive/canonical validator when the project is otherwise valid.

Therefore C2 is not a canonical M1 depth reduction.

## Provider-schema properties preserved

`build_brep_project` remains wired to the provider-safe schema wrapper.

The provider-facing JSON Schema remains:

- finite;
- reference-free;
- free of `$ref`;
- explicit about `add`, `sub`, `mul`, `div` and `neg`;
- protected by the full canonical validator after provider output.

The previous `Recursive reference detected ... Defaulting to any` failure mode is not reintroduced.

## Schema-size regression

`tests/brepAiToolJsonSchema.test.ts` now measures the serialized provider JSON Schema and requires:

```text
serialized build_brep_project provider schema < 180000 bytes
```

This is intentionally far below the C1 runtime class where all provider-visible tools together measured `422971` bytes.

The test is a regression ceiling, not a claim that byte count is tokenizer-exact. C1 showed that the current deterministic byte/token estimate substantially under-counts llama.cpp's prompt tokenization for schema-heavy requests.

## Repository evidence

C2 implementation commits:

```text
820132a01f483b30a958eb64ed48bd0af500d0e5  Reduce BRep provider expression schema depth
93a4aac680b3fe529e19515d45df47d11e847452  Test compact BRep provider schema depth
```

Accepted code/test checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
```

CI on that exact checkpoint:

- Quality Gate #770 — **PASS**;
  - dependency audit — PASS;
  - tests — PASS;
  - typecheck — PASS;
  - lint — PASS;
  - build — PASS;
  - diff check — PASS;
- Grasshopper Build #342 — **PASS**.

The passing test suite proves that the `<180000` byte schema ceiling and the depth-2 M1 authoring fixture both hold in the repository toolchain.

## Required runtime evidence

C2 is not considered locally runtime-accepted until the same first-turn Native BRep fixture is repeated after updating/restarting Brepia.

Use:

```text
local/qwen3.8-27b-mtp-128k
```

Capture the new bounded:

```text
ai context diagnostics
```

If dispatch succeeds, also capture:

```text
ai context actual usage
```

Compare against the C1 baseline:

```text
provider schema bytes       422971
schema estimated tokens     105743
total estimated input       107862
llama.cpp request tokens    169503
context window              131072
```

The runtime result determines the next step:

- if the first-turn request now fits comfortably, proceed to measure a representative multi-turn BRep conversation before implementing C3;
- if the first-turn request remains too large, continue provider-schema analysis before history compaction;
- do not hide a residual mandatory-content overflow by dropping current user intent or weakening canonical M1.

## C5 note

The local model currently has:

```text
contextLimit = 131072
outputLimit  = unknown/null
```

and the Parametric route currently requests:

```text
maxOutputTokens = 64000
```

That route reservation leaves a conservative planned usable input budget of `58880` tokens after the current `8192` safety margin. It is a separate later C5 policy question and is not changed by C2.

Current llama.cpp error evidence identifies the reported `request (N tokens)` value as prompt/request tokenization (`n_prompt_tokens`), so the original `169503` overflow is not explained by adding the 64000 output reservation to the C1 estimate.

## Boundaries preserved

C2 does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- M0 graph/parameter integrity;
- canonical M1 depth `12` / node limit `64`;
- build123d/OCCT authority;
- GHX parameter-only return/import semantics;
- non-zero rotation fail-closed behavior;
- Settings/discovery model authority;
- OpenSCAD behavior;
- the draft/stacked PR #36 merge boundary.

C3, C4, C5, C6 and M2 remain unstarted by this closeout.
