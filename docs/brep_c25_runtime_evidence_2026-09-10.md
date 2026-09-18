# C2.5 Native BRep runtime evidence — 2026-09-10

Status: **C2.5-B runtime-accepted; C2.5-C source-kind specialization exercised with mixed geometry-quality evidence; host parity still pending**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Test checkpoint:

```text
4b6b7678094a95bfb1c6449bb8f8d08c9b1a1f1f
```

Model:

```text
local/qwen3.8-27b-mtp-128k
```

Representative prompt:

```text
create a room 3000 x 4000 x 3000 mm with a door 1500 mm wide, add 4 cabinets 500 x 600 x 2000 mm on the long side.
```

## C2.5-B runtime result

The first Native BRep model step produced one canonical-accepted `build_brep_project` call:

```text
stepNumber = 1
finishReason = tool-calls
build_brep_project attemptCount = 1
accepted = true
stepDurationMs = 632996
provider usage = 56413 input / 25674 output / 82087 total
```

Final request diagnostics were:

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

There was no second model step after canonical acceptance. This is the required representative runtime evidence for C2.5-B. The accepted-build terminal predicate therefore removes the redundant post-acceptance inference observed in the preceding C2.5-A run while preserving successful persistence/finalization.

The elapsed model time was about 10 minutes 33 seconds. This confirms that the earlier second-step removal reduces redundant latency, but the dominant cost is still the first large structured-output generation itself rather than the stop loop.

## Context-budget finding

Pre-run diagnostics estimated:

```text
systemInstructions.estimatedTokens = 371
providerToolSchemas.estimatedTokens = 36006
ordinaryConversationHistory.estimatedTokens = 29
effectiveModelMessages.estimatedTokens = 42
total.estimatedInputTokens = 36419
usableInputBudgetTokens = 58880
estimatedHeadroomTokens = 22461
```

The provider then reported:

```text
inputTokens = 56413
```

The static estimate was therefore lower than the provider-reported prompt usage by:

```text
19994 tokens
```

or approximately 55% relative to the static estimate.

Using the current model-aware usable-input budget, the provider-reported first-turn prompt left only:

```text
58880 - 56413 = 2467 tokens
```

of effective input headroom.

This is a material planning result for the context-budget track. The UTF-8 byte estimator is useful for relative component accounting but must not be treated as a sufficiently accurate tokenizer estimate for this local Qwen/llama.cpp path. Provider-reported usage is the stronger runtime authority when available.

The result strengthens the case for C3 BRep context projection before representative multi-turn expansion: a single first-turn request is already close to the current conservative usable-input budget even with no historical BRep payloads, no canonical BRep snapshot in history and no images.

## C2.5-C geometry-quality evidence

The Standard source-kind Native BRep specialization was active for this run.

Positive observations from the generated Brepia preview:

- a valid native BRep artifact was produced and persisted;
- the room enclosure is recognizable;
- a visible door opening exists in the wall rather than the earlier clearly disjoint door-cutter failure;
- the door opening appears to reach the intended floor/reference region;
- the artifact exposes nine editable published dimensions.

Negative observations relative to the user request and the earlier fixture:

- the cabinet result is materially worse than the earlier generated model;
- the preview does not clearly show four distinct cabinets on the long wall and instead appears to contain one broad cabinet-like block/assembly;
- the visible `Cabinet width` parameter is 600 mm while the request specified cabinets `500 x 600 x 2000 mm`, indicating that dimension interpretation/order was not faithfully preserved;
- the run therefore does not establish general CAD-quality improvement from the source-kind specialization, even though it appears to have corrected the specific earlier door-placement failure.

This is mixed evidence, not a reason to weaken canonical validation or add fixture-specific hard-coded geometry rules. Model/profile-quality tuning can be revisited separately. The source-kind profile architecture remains useful because it gives Native BRep methodology a bounded place without contaminating OpenSCAD instructions.

## Runtime comparison and next decision

C2.5-B is now runtime accepted:

```text
accepted canonical build at step 1
-> stop inference
-> stepCount = 1
```

C2.5-C has been exercised in the real local runtime but its broad geometry-quality target is not yet proven. Avoid overfitting the general Standard profile to one room/cabinet fixture.

The immediate context-budget signal is stronger and objective: provider-reported first-turn input is already close to the conservative usable-input budget. After any remaining bounded C2.5 host/parity decision, continue with C3 BRep model-context projection and remeasure using provider-reported usage.

If installed Rhino 8 / Grasshopper is used for this exact generated artifact, capture whether a fresh GHX opens and solves. A successful solve would show that the specific earlier disjoint door subtraction no longer reproduces under this fixture; a deterministic disjoint-subtract parity change should still be judged independently and must remain fail-closed for overlapping/uncertain boolean failures.

## Preserved boundaries

This evidence does not change:

- `conversation.type = 'parametric'`;
- Native BRep source kind remains `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- build123d/OCCT as native geometry authority;
- M0/M1 validation integrity;
- canonical scalar AST depth 12 / node limit 64;
- finite reference-free provider schema and provider authoring depth 2;
- Settings/discovery as model-selection authority;
- GHX parameter-only return/import boundary;
- non-zero rotation remains unsupported/fail-closed;
- OpenSCAD behavior remains separate;
- PR #36 remains draft/stacked and unmerged;
- M2 remains unstarted.
