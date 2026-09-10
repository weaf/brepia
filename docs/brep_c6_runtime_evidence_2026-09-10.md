# C6 real runtime evidence — 2026-09-10

Status: **runtime-accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Model:

```text
local/qwen3.8-27b-mtp-128k
```

## Fixture

A third small follow-up edit was run in the same persisted Native BRep conversation used for the earlier C3 and C5 measurements after pulling the C6 deterministic superseded-build reasoning projection.

The turn contained no images and already contained three prior accepted Native BRep AI builds.

The persisted DB/UI history was not truncated or summarized. Only the provider working-context projection changed.

## C6 projection diagnostics

The branch projection reported:

```text
input messages:                     8
output messages:                    7
removed build tool parts:           3
removed BRep snapshot parts:        4
removed build reasoning parts:      3
summarized accepted builds:         3
removed build input bytes:      16127
removed build output bytes:       294
removed snapshot bytes:         21600
removed build reasoning bytes:  83981
```

The provider-side safety projection independently reported:

```text
input messages:                     10
output messages:                     7
removed tool calls:                  3
removed tool results:                3
removed build reasoning parts:       3
inserted revision summaries:         3
removed tool input bytes:        16127
removed tool output bytes:         366
removed build reasoning bytes:   83981
```

This directly verifies the C6 hypothesis: historical assistant reasoning attached to superseded accepted `build_brep_project` turns was the dominant removable ordinary-history cost.

## Durable history remained intact

The persisted-history diagnostics still saw the complete conversation state:

```text
ordinaryConversationHistory.messageCount: 8
ordinaryConversationHistory.textPartCount: 7
ordinaryConversationHistory.bytes:     84356
historicalBrepToolPayloads.callCount:       3
historicalBrepToolPayloads.bytes:        16421
historicalBrepSnapshots.count:               4
historicalBrepSnapshots.persistedBytes:  21600
```

Compared with the preceding C5 fixture, persisted ordinary history actually grew:

```text
81114 -> 84356 bytes (+3242)
```

The reduction therefore came from request-local projection rather than destructive history truncation.

## Effective provider working context

After projection:

```text
effectiveModelMessages.count:            7
effectiveModelMessages.bytes:         1000
effectiveModelMessages.estimatedTokens: 250
images.count:                             0
```

The preceding C5 fixture had:

```text
effectiveModelMessages.bytes: 83312
```

So the effective provider-message serialization fell by:

```text
83312 -> 1000 bytes
-82312 bytes
-98.8%
```

The first provider step still contained no superseded BRep payloads:

```text
brepToolCallCount:    0
brepToolResultCount:  0
brepToolInputBytes:   0
brepToolOutputBytes:  0
```

The current canonical BRep remained separately present:

```text
currentCanonicalBrep.present: true
currentCanonicalBrep.bytes:   5295
```

## C5 hard-budget effect

Request-level C5 diagnostics reported:

```text
enforced:                    true
fits:                        true
contextWindowTokens:       131072
safetyMarginTokens:          8192
rawEstimatedInputTokens:    39635
conservativeMultiplier:      1.75
conservativeInputTokens:    69362
configuredMaxOutputTokens:  64000
minimumOutputReserveTokens: 16384
hardInputLimitTokens:      106496
hardInputHeadroomTokens:    37134
maximumSafeOutputTokens:    53518
effectiveMaxOutputTokens:   53518
```

Compared with C5 acceptance before reasoning projection:

```text
raw estimate:        60213 -> 39635  (-20578, -34.2%)
conservative input: 105373 -> 69362  (-36011, -34.2%)
hard headroom:        1123 -> 37134  (+36011, about 33.1x)
effective max output:17507 -> 53518  (+36011)
```

The same `53518` cap was applied to the actual first model step.

## Provider usage and terminal build behavior

The first and only provider step reported:

```text
stepDurationMs: 154734
finishReason: tool-calls
toolCalls: [build_brep_project]
build attempt count: 1
build accepted: true
```

Provider token usage:

```text
inputTokens:  60212
outputTokens:  4210
totalTokens:  64422
```

Overall turn diagnostics:

```text
stepCount: 1
acceptedBrepBuildSteps: [1]
totalElapsedMs: 154741
```

The real provider/static input ratio was:

```text
60212 / 39635 = 1.5192
```

This remains below the C5 conservative multiplier of `1.75`.

Compared with the preceding C5 follow-up, provider input also fell materially:

```text
84272 -> 60212 tokens
-24060 tokens
-28.6%
```

The accepted canonical `build_brep_project` completed on step 1, so the C2.5-B terminal-build behavior remained intact.

## Acceptance conclusion

C6 deterministic reasoning projection is runtime-accepted for the representative persisted Native BRep follow-up path because:

1. historical superseded-build reasoning was directly observed and removed on both branch and provider projections;
2. `83981` reasoning bytes were removed without mutating DB/UI history;
3. effective provider-message bytes fell by `98.8%` despite persisted ordinary history growing;
4. C5 hard headroom increased from `1123` to `37134` tokens;
5. the first provider step still contained zero historical BRep tool calls/results;
6. the exact current canonical BRep remained present through the authoritative system context;
7. the first canonical BRep build was accepted and the turn terminated after one step;
8. actual provider usage remained within the selected 131072-token context window and below the 1.75 conservative calibration envelope.

The evidence does not justify an AI-generated rolling summary. The narrow deterministic projection is sufficient for the measured bottleneck.

A broader summary/truncation mechanism should be reconsidered only if future evidence shows that older user-authored natural-language history itself becomes a material context cost.

C4 remains deferred because this fixture again contained zero images.

M2 remains unstarted and PR #36 remains draft/stacked/unmerged.
