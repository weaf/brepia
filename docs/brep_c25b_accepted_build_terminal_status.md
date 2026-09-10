# C2.5-B — accepted canonical BRep build terminates the turn

Status: **repository-complete and CI-accepted; representative local runtime remeasurement pending**

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

The run later failed while saving the immutable revision because the request-bound Supabase JWT had expired. That is a persistence/session lifetime failure after successful canonical BRep generation; it is not evidence that the accepted geometry/build was invalid.

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

## Required runtime remeasurement

After pulling the C2.5-B checkpoint, repeat the representative Native BRep fixture. For a first-step accepted build the expected diagnostics are now approximately:

```text
ai step diagnostics ... stepNumber: 1 ... accepted: true
ai context actual usage ... stepCount: 1 ... acceptedBrepBuildSteps: [1]
```

There must be no second full model step after that acceptance.

Refresh/re-authenticate immediately before the long run so a stale/near-expiry access token does not confound the persistence result. A separate persistence robustness decision can be made if a fresh request still crosses the JWT lifetime during a long model step.

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

C2.5-C remains the next active engineering step.