# C5 real runtime evidence — 2026-09-10

Status: **runtime-accepted**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Model:

```text
local/qwen3.8-27b-mtp-128k
```

## Fixture

A second small follow-up edit was run in the same persisted Native BRep conversation used for C3 acceptance after pulling the C5 hard-budget implementation.

The turn contained no images and already contained two prior accepted Native BRep AI builds.

## Request diagnostics

C3 projection remained active and removed superseded structured state:

```text
branch input messages:                 6
branch output messages:                5
removed historical build tool parts:  2
removed historical BRep snapshots:    3
summarized accepted builds:            2
removed historical build input bytes: 10752
removed historical build output bytes:183
removed historical snapshot bytes:    16201

provider input messages:               7
provider output messages:              7
removed provider tool calls:           2
removed provider tool results:         2
inserted revision summaries:           2
removed provider tool input bytes:     10752
removed provider tool output bytes:    231
```

The first provider step contained no superseded BRep payloads:

```text
brepToolCallCount:    0
brepToolResultCount:  0
brepToolInputBytes:   0
brepToolOutputBytes:  0
```

The current canonical BRep remained present separately:

```text
currentCanonicalBrep.present: true
currentCanonicalBrep.bytes:   5295
```

## C5 hard budget

The request-level C5 budget reported:

```text
enforced:                   true
fits:                       true
contextWindowTokens:        131072
safetyMarginTokens:           8192
rawEstimatedInputTokens:      60213
conservativeMultiplier:        1.75
conservativeInputTokens:      105373
configuredMaxOutputTokens:     64000
minimumOutputReserveTokens:     16384
hardInputLimitTokens:          106496
hardInputHeadroomTokens:         1123
maximumSafeOutputTokens:        17507
effectiveMaxOutputTokens:       17507
```

The same `17507` effective output cap was applied to the actual first model step.

This verifies that C5 does not blindly reserve the configured 64000-token route maximum. It derives a bounded output ceiling from the remaining conservative context budget instead.

## Provider usage and completion

The provider reported:

```text
inputTokens:     84272
outputTokens:     3147
totalTokens:     87419
stepCount:            1
accepted build step:  1
elapsed:         177443 ms
```

The static/provider input ratio was:

```text
84272 / 60213 = 1.3996
```

This remains below the C5 conservative multiplier of `1.75`.

The accepted canonical `build_brep_project` completed on the first step, so the C2.5-B terminal-build behavior remained intact.

## Acceptance conclusion

C5 is runtime-accepted for the representative persisted Native BRep follow-up path because:

1. hard enforcement was active for the selected model's Settings-provided 131072-token context window;
2. the known-good request was admitted rather than falsely blocked;
3. the effective completion ceiling was reduced from configured 64000 to 17507 before provider dispatch;
4. actual provider input remained below the model context limit;
5. the first canonical BRep build was accepted and the turn stopped after one step;
6. C3 continued to remove superseded structured BRep history;
7. provider usage was returned and remained inside the conservative calibration envelope.

## C6 trigger discovered by the same run

The run also exposed the next bounded-context issue:

```text
ordinaryConversationHistory.bytes:       81114
effectiveModelMessages.bytes:             83312
hardInputHeadroomTokens:                    1123
images.count:                                  0
```

Compared with the preceding C3 runtime fixture:

```text
raw estimated input: 59628 -> 60213  (+585)
conservative input: 104349 -> 105373 (+1024)
hard headroom:        2147 -> 1123   (-1024)
```

One more similarly sized turn would likely reach the conservative C5 boundary even though actual llama.cpp input is still materially lower than the 1.75 bound.

Inspection of the current C3 projection shows that historical assistant `reasoning` attached to accepted `build_brep_project` turns remains in provider working context even after the superseded tool payload itself is removed. That reasoning is neither user intent nor geometry authority.

The next evidence-driven C6 step is therefore deliberately narrower than a generated rolling summary: omit superseded BRep-build assistant reasoning from provider working context while preserving durable history, all user turns, bounded accepted-revision summaries and the exact current canonical BRep. Measure the removed reasoning bytes directly before considering any broader natural-language summarization.

C4 remains deferred because this fixture again contained zero images.

M2 remains unstarted and PR #36 remains draft/stacked/unmerged.
