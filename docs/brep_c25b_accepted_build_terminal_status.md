# C2.5-B — accepted canonical BRep build terminates the turn

Status: **repository-complete, CI-accepted and representative local runtime-accepted**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Runtime evidence that justified C2.5-B

The representative C2.5-A run used:

```text
local/qwen3.8-27b-mtp-128k
```

and proved that the first Native BRep step already produced a fully canonical-accepted build:

```text
step 1
finishReason = tool-calls
build_brep_project attemptCount = 1
accepted = true
provider usage = 58176 input / 25080 output / 83256 total
step duration = 621978 ms
```

The runtime nevertheless performed another full model step:

```text
step 2
build_brep_project attemptCount = 0
finishReason = stop
provider usage = 83410 input / 431 output / 83841 total
step duration = 130012 ms
```

Final diagnostics were:

```text
stepCount = 2
acceptedBrepBuildSteps = [1]
totalElapsedMs = 751998
inputTokens = 141586
outputTokens = 25511
totalTokens = 167097
```

Step 2 therefore added about 130 seconds of redundant inference after the canonical BRep artifact had already been accepted. It also re-fed the accepted tool interaction, growing provider-facing model messages from 168 bytes to 83449 bytes.

The run later failed while saving the immutable revision because the request-bound Supabase JWT had expired. That was a persistence/session lifetime failure after successful canonical BRep generation; it was not evidence that the accepted geometry/build was invalid.

## Implemented stop semantics

Normal direct Native BRep turns now use request-local canonical acceptance as a stop condition.

The rule is intentionally stricter than `hasToolCall('build_brep_project')`:

- a malformed, invalid or otherwise rejected build attempt does **not** stop the model loop;
- the model can retry within the existing bounded max-step policy;
- the first build that completes the existing canonical validation/execution path with `accepted = true` terminates further model inference for that turn;
- `answer_user` remains a fallback termination path but is no longer required after a successful BRep build;
- the max-step bound remains unchanged;
- persistence/finalization still consumes the existing accepted canonical candidate and still writes a new immutable revision.

The accepted-build predicate is isolated in:

```text
src/server/aiBrepStopCondition.ts
```

with focused regression coverage in:

```text
tests/aiBrepStopCondition.test.ts
```

The normal Native BRep `streamText.stopWhen` integration is in:

```text
src/server/aiChat.ts
```

Other transport/source behavior is intentionally unchanged:

- non-normal Native BRep adapters keep their existing build-tool terminal behavior;
- streaming OpenCode/OpenSCAD behavior is unchanged;
- ordinary OpenSCAD direct behavior is unchanged;
- Creative behavior is unchanged.

## Repository acceptance

Implementation checkpoints:

```text
48a2ad9dae2a3ad3343a58c3d69d7842aeb75610  Add accepted BRep build stop predicate
d5466d60927dc2581d080706b13032cc3c8f574c  Test accepted BRep build stop predicate
d2f5801288ff8f3c0aa1c5ccd8bc893345cae294  Stop native BRep turns after accepted canonical build
4a3eaa5d8f30be4af572171d1ad07fd947941eea  Preserve dangling-tool diagnostic severity
```

The final correction only restored the pre-existing informational severity of an unrelated dangling-tool diagnostic that was accidentally changed during the whole-file contents update; the cumulative C2.5-B `aiChat.ts` delta is limited to the intended import and accepted-build stop condition.

CI on `4a3eaa5d8f30be4af572171d1ad07fd947941eea`:

```text
Quality Gate #790       PASS
Grasshopper Build #362 PASS
```

Quality Gate included tests, TypeScript typecheck, lint, build and diff check.

## Representative runtime acceptance

After C2.5-B and the C2.5-C source-kind package work, the same representative Native BRep fixture was re-run from checkpoint:

```text
4b6b7678094a95bfb1c6449bb8f8d08c9b1a1f1f
```

with:

```text
local/qwen3.8-27b-mtp-128k
```

The first model step produced one accepted build:

```text
stepNumber = 1
finishReason = tool-calls
build_brep_project attemptCount = 1
accepted = true
stepDurationMs = 632996
provider usage = 56413 input / 25674 output / 82087 total
```

Final diagnostics were:

```text
stepCount = 1
providerUsageRequested = true
providerUsageAvailable = true
inputTokens = 56413
outputTokens = 25674
totalTokens = 82087
totalElapsedMs = 633003
acceptedBrepBuildSteps = [1]
```

There was no second model step. The accepted canonical source persisted and rendered as a Native BRep project, so the earlier JWT-expiry confounder did not reproduce after fresh authentication.

This is the required runtime proof for C2.5-B: a valid first build stops immediately after canonical acceptance. Invalid/rejected retry behavior remains covered by repository regression tests.

Detailed context-budget and geometry-quality observations from this run are recorded in:

```text
docs/brep_c25_runtime_evidence_2026-09-10.md
```

## Preserved boundaries

C2.5-B does not change:

- `conversation.type = 'parametric'`;
- Native BRep source-kind routing;
- canonical BRep or immutable revision authority;
- build123d/OCCT geometry authority;
- M0/M1 validation semantics;
- canonical scalar AST depth 12 or node limit 64;
- the finite reference-free provider schema or provider authoring depth 2;
- Settings/discovery model selection;
- GHX parameter-only interoperability boundaries;
- non-zero rotation fail-closed behavior;
- OpenSCAD semantics;
- PR #36 merge state;
- M2 status.

C2.5-C source-kind specialization is implemented and has now been exercised in the real local runtime. Its architecture is validated, but broad model-quality improvement remains mixed rather than proven. The next bounded decision is whether to perform C2.5-D host parity work before continuing to C3 BRep model-context projection.
