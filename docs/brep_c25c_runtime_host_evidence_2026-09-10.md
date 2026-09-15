# C2.5-C — representative Native BRep / Rhino parameter host evidence

Status: **representative runtime and installed-host evidence captured; CAD specialization is functionally positive, visual/model-quality tuning remains separate**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Fixture

Representative prompt:

```text
create a room 3000 x 4000 x 3000 mm with a door 1500 mm wide, add 4 cabinets 500 x 600 x 2000 mm on the long side.
```

Model:

```text
local/qwen3.8-27b-mtp-128k
```

Product route:

```text
Parametric -> Native BRep
instruction package = Standard
```

The run used the C2.5 source-kind split, so the Native BRep-specific CAD methodology was composed automatically under the ordinary Standard package.

## Runtime result

The first model step produced one fully accepted canonical build and C2.5-B stopped inference immediately afterward:

```text
stepNumber = 1
stepDurationMs = 632996
finishReason = tool-calls
build_brep_project attemptCount = 1
accepted = true
providerUsage = 56413 input / 25674 output / 82087 total
```

Final diagnostics:

```text
stepCount = 1
providerUsageAvailable = true
inputTokens = 56413
outputTokens = 25674
totalTokens = 82087
totalElapsedMs = 633003
acceptedBrepBuildSteps = [1]
```

This is representative runtime acceptance for C2.5-B. No redundant post-acceptance model step remained.

The run also exposed an estimator gap worth carrying into C3. Request-level diagnostics estimated 36,419 input tokens while llama.cpp reported 56,413 actual input tokens. Under the current conservative usable-input budget of 58,880 tokens, the observed first turn had only about 2,467 provider-reported input tokens of headroom even though the byte estimator predicted 22,461.

## Native product result

The resulting Brepia model was visibly less polished than the earlier post-C2 room fixture, so this evidence must not be described as a general visual-quality improvement.

However, the model was canonical, persisted, previewed and exposed nine published dimensions. The earlier door-placement failure was not reproduced: the opening was visibly cut through the wall rather than being a disjoint cutter outside the room.

A remaining model-quality issue is that the cabinet interpretation was not as faithful/clear as the earlier fixture. In the Brepia UI the generated Cabinet width control showed 600 mm despite the prompt requesting 500 mm width, and the four requested cabinets were not represented as cleanly as desired. Treat this as model/prompt quality evidence, not a canonical/runtime architecture failure.

## Installed Rhino 8 / Grasshopper evidence

A fresh GHX exported from this exact generated project was opened in the installed Rhino 8 / Grasshopper host.

Observed host behavior:

- the GHX opened successfully;
- the built-in Rhino 8 Python 3 carrier solved and produced visible Rhino geometry;
- changing **Wall thickness** recomputed the geometry correctly;
- changing the **door opening controls** recomputed the opening correctly;
- no repeat of the earlier disjoint-door boolean guard failure was observed for this fixture.

The captured Grasshopper view also showed all nine generated parameter controls wired to the Brepia Python component, including cabinet, door, room and wall-thickness inputs. Only the specifically observed wall-thickness and door-opening behavior is claimed as manual parameter acceptance here.

This is stronger functional evidence than the static default preview: important generated relationships remain parametric in the installed host rather than merely looking correct at one default value.

## C2.5-C assessment

The source-kind specialization is therefore **functionally positive** on the representative fixture:

1. Native BRep generation stayed within the model context window;
2. the first accepted canonical build terminated the turn;
3. the door cutter intersected the intended wall at default values;
4. the exported GHX opened and solved in the installed Rhino 8 host;
5. wall thickness and door opening remained live parameter relationships.

Do not overstate this as a complete CAD-quality victory. Cabinet count/dimension interpretation and default visual composition remain weaker than desired and can be revisited through model-specific/profile-quality work after the architectural context/runtime track is stable.

## C2.5-D remains a separate parity question

This successful host solve does **not** eliminate the known Rhino/native disjoint-subtract mismatch.

The earlier host fixture proved that a provably disjoint cutter can be a no-op under native build123d/OCCT while the current Rhino Python compiler calls `Brep.CreateBooleanDifference(...)` and fails when it does not receive exactly one Brep.

The new room fixture avoids that condition because the door cutter now intersects the wall. It therefore does not exercise the required C2.5-D disjoint no-op case.

C2.5-D should remain narrowly scoped:

- use deterministic bounds to prove disjointness before the Rhino boolean;
- preserve the current base as an explicit no-op only for proven-disjoint inputs;
- retain the Rhino boolean path for overlapping or uncertain inputs;
- continue to fail closed when an overlapping/uncertain boolean does not produce the required deterministic result.

Installed Rhino 8 / Grasshopper remains the final runtime authority for that parity change.

## Next ordering

Continue with the existing phase order:

```text
C2.5-D bounded Rhino/native disjoint-subtract parity
-> C3 BRep model-context projection
-> representative multi-turn remeasurement
```

M2 remains unstarted and PR #36 remains draft/stacked/unmerged.
