# C3 Native BRep model-context projection runtime evidence

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Runtime checkpoint under test:

```text
139d8b61650e14dd88379495a1a675dfa42f51d2
```

Model:

```text
local/qwen3.8-27b-mtp-128k
```

## Result

C3 is runtime-accepted for the representative persisted Native BRep follow-up class.

The follow-up used an existing canonical Native BRep conversation rather than a new creation turn. The provider-facing context projection removed superseded complete BRep project history while preserving the current canonical project through the dedicated BRep system context.

The normal Native BRep runtime then accepted the new build on the first model step and terminated through the already accepted C2.5-B stop condition.

## Context projection evidence

Request-level diagnostics:

```text
currentCanonicalBrep:
  present: true
  bytes: 5295
  estimatedTokens: 1324

brepModelProjection.branch:
  applied: true
  inputMessageCount: 4
  outputMessageCount: 3
  removedBuildToolParts: 1
  removedBrepSnapshotParts: 2
  summarizedAcceptedBuilds: 1
  removedBuildInputBytes: 5377
  removedBuildOutputBytes: 71
  removedSnapshotBytes: 10802

brepModelProjection.provider:
  applied: true
  inputMessageCount: 4
  outputMessageCount: 4
  removedToolCalls: 1
  removedToolResults: 1
  insertedRevisionSummaries: 1
  removedToolInputBytes: 5377
  removedToolOutputBytes: 95
```

The first provider step then reported:

```text
messageCount: 4
modelMessageBytes: 80972
brepToolCallCount: 0
brepToolResultCount: 0
brepToolInputBytes: 0
brepToolOutputBytes: 0
brepToolPayloadBytes: 0
```

This proves the historical `build_brep_project` call/result payload did not survive into the provider working context. The persisted BRep snapshots remain in durable history but are not duplicated into the model context.

## Runtime and usage evidence

The accepted build completed on the first step:

```text
stepNumber: 1
finishReason: tool-calls
toolCalls: [build_brep_project]
attemptCount: 1
accepted: true
stepDurationMs: 167199
totalElapsedMs: 167207
acceptedBrepBuildSteps: [1]
```

Provider usage was finally available through the local OpenAI-compatible streaming path:

```text
inputTokens: 83612
outputTokens: 2744
totalTokens: 86356
```

The turn therefore completed in approximately 2m47s and one accepted model step rather than reproducing the earlier approximately 60-minute / 12-step runtime loop.

## Estimator calibration finding

The deterministic byte-based C1 estimator reported:

```text
estimated input tokens: 59628
provider-reported input: 83612
```

Observed ratio:

```text
83612 / 59628 = 1.4022
```

The earlier original C1 overflow fixture had:

```text
llama.cpp request: 169503
static estimate:   107862
ratio:              1.5715
```

The current `bytes / 4` estimator is therefore useful for bounded component diagnostics but is not safe as an exact hard-limit counter. A hard C5 pre-dispatch budget must either use provider/tokenizer-aware counting or a deliberately conservative, regression-tested bound. The two measured llama.cpp fixtures support a conservative calibration factor above the observed 1.5715 maximum rather than treating the raw estimate as exact.

## Output-reservation finding

The pre-C5 diagnostic budget still treated the configured Generative maximum output setting as if all of it had to be reserved up front:

```text
contextWindowTokens: 131072
reservedOutputTokens: 64000
safetyMarginTokens: 8192
usableInputBudgetTokens: 58880
estimatedInputTokens: 59628
estimatedHeadroomTokens: -748
```

Despite that negative static headroom, the real request succeeded with 83612 input tokens and produced only 2744 output tokens.

This shows that `chat.parametricMaxOutputTokens = 64000` is an upper generation cap, not evidence that every request needs 64000 output tokens reserved before dispatch. C5 should preserve the configured maximum as an upper bound while deriving a safe per-request output allowance from the actual/conservatively bounded input and model context window.

## C4 decision

This representative C3 follow-up contained no images:

```text
images:
  count: 0
  base64Chars: 0
  estimatedTokens: 0
```

There is therefore no runtime evidence that historical image payloads are the next bottleneck for this Native BRep path. C4 remains planned and should be activated when a representative image-bearing conversation demonstrates material historical image cost. It is not justified as the next mandatory implementation step from this fixture.

## Next phase decision

Proceed to C5 hard model-aware context budgeting before M2.

C5 must:

- retain C3 durable-history/provider-context separation;
- use the configured model context metadata when available;
- never treat the raw byte estimator as exact;
- use provider/tokenizer-aware counting where practical or a conservative calibrated bound;
- retain a non-trivial output allowance rather than subtracting the full 64000-token Generative cap blindly;
- fail locally before provider dispatch when mandatory context cannot fit safely;
- preserve current user turn, current canonical BRep, required system instructions and provider tool contract;
- preserve C2.5 accepted-build termination and invalid-build retry semantics within the available budget;
- keep C4 dormant until image-bearing evidence justifies it;
- keep C6 dormant unless older natural-language history becomes the measured remaining cost;
- not start M2.

## Preserved boundaries

This runtime acceptance does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical `BrepProject` authority;
- immutable revision and branch/leaf semantics;
- build123d/OCCT geometry authority;
- canonical scalar depth 12 / node limit 64;
- provider expression depth 2 and finite/reference-free provider schema;
- Settings/discovery model authority;
- GHX parameter-only return/import authority;
- non-zero rotation fail-closed behavior;
- OpenSCAD behavior;
- PR #36 draft/stacked/unmerged state;
- M2 status.
