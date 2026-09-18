# BRep AI C2 runtime + Rhino host evidence — 2026-09-10

Status: **post-C2 dispatch succeeds; latency and Rhino subtract parity issues remain open**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Runtime result

The same local model class that previously failed the first-turn Native BRep request at the 131072-token context limit was re-tested after C2 provider-schema compaction:

```text
local/qwen3.8-27b-mtp-128k
```

The request now dispatched and completed instead of failing with the previous:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

The bounded diagnostics fragment captured from the successful run included:

```text
systemInstructions.bytes = 8308
systemInstructions.estimatedTokens = 2077
bytesBeforeBrepContext = 7820
addedBrepContextBytes = 488
```

The completion-level usage diagnostic reported:

```text
stepCount: 12
inputTokens: 0
outputTokens: 0
totalTokens: 0
```

The zero usage fields are not evidence of zero token use; the local OpenAI-compatible streaming path did not surface usable provider usage for this run.

## Latency finding

The successful generation took approximately **60 minutes**, compared with approximately **2 minutes** for the earlier pre-regression workflow.

The key bounded signal is:

```text
stepCount: 12
```

The current normal Native BRep stop policy waits for `answer_user` or the generic max-step limit after a BRep source is active. A successful `build_brep_project` is therefore not itself a stop condition. Each additional AI SDK tool step can resend the previous tool result/context and incur another full local-model inference.

This is now an explicit latency investigation before treating C3 history projection as the only next optimization. Determine whether the 12-step run contained repeated successful BRep builds, repeated validation failures, or both. Add bounded per-step/tool-call observability before assuming the distribution.

## Generated project quality finding

The generated project was broadly useful and demonstrated nontrivial M1 scalar-AST authoring, including derived cabinet/cavity placement and dimensions.

However, the requested door did not affect the native model.

At default values:

```text
room_width     = 3000
wall_thickness = 200
```

The generated door X translation resolves to:

```text
-room_width + (wall_thickness - 120)
= -3000 + 80
= -2920 mm
```

The door cutter width in X resolves to:

```text
wall_thickness + 120 = 320 mm
```

so its approximate X extent is:

```text
[-3080, -2760]
```

while the centered 3000 mm room spans approximately:

```text
[-1500, +1500]
```

The cutter is therefore definitely disjoint from the room at the default parameter values. The generated Z translation also starts the door cutter at approximately `z = wall_thickness` rather than at the floor, which is suspicious for an ordinary full-height doorway unless a sill/threshold was explicitly intended.

This is model/CAD reasoning quality evidence, not a canonical-schema failure.

## Installed Rhino 8 / Grasshopper finding

The exported GHX loaded into the installed Grasshopper host and the Python component executed far enough to reach the generated boolean code.

The observed failure was the explicit Brepia runtime guard, not a Python syntax error:

```text
RuntimeError: Rhino boolean difference for Brepia node room_result did not produce exactly one Brep.
```

The generated sequence showed:

1. the first `room_result` boolean difference against the `cavity_cabinets` tool succeeded and produced one Brep;
2. the second `room_result` boolean difference against the `door` tool reached the guard and failed.

In the supplied canonical node order, `room_result` is node 15, `cavity_cabinets` is node 10 and `door` is node 11. This exactly matches the host failure and the disjoint door placement above.

## Rhino/native parity implication

The native build123d/OCCT evaluator currently permits a subtraction whose tool is disjoint from the base to behave as a no-op. The Rhino Python compiler currently calls `Brep.CreateBooleanDifference(...)` for every subtract tool and fails closed when the call returns `None` or a result count other than exactly one.

Do not broadly turn Rhino boolean failures into no-ops. A safe parity correction should distinguish **definitely disjoint** operands from an overlapping boolean that genuinely failed. A conservative bounding-box disjointness precheck is a suitable candidate: skip only a tool whose base/tool bounds prove no possible intersection, while retaining the existing fail-closed rule when bounds overlap and Rhino cannot produce exactly one Brep.

Installed-host evidence remains required after any such translation change.

## CAD-authoring instruction implication

The existing `build_brep_project` instruction explains centered primitive coordinates but does not yet require a compact spatial sanity pass for transformed cutters and openings.

A small Native BRep CAD-authoring instruction should teach the model to:

- evaluate important transform expressions at default parameter values before returning the snapshot;
- derive wall/opening positions from half-extents for centered primitives;
- verify every intended subtract cutter actually overlaps the target material at defaults;
- extend door/window cutters through the wall thickness with bounded clearance;
- make an ordinary doorway reach the floor unless the user explicitly requests a sill/threshold;
- place flush furniture from the interior wall face plus/minus half its depth rather than confusing full extents with center coordinates;
- keep the current unsupported-operation and one-authoritative-result boundaries explicit.

Keep this instruction compact so CAD quality does not recreate the context-budget problem.

## Next engineering order

Before C3 history projection:

1. add bounded per-step BRep tool observability so a 12-step run reveals successful vs failed tool attempts and step timing;
2. make a successfully validated/accepted `build_brep_project` a candidate terminal condition for normal Native BRep turns, preserving retries after validation failure;
3. enable/report local OpenAI-compatible streaming usage when supported so `inputTokens/outputTokens` are not silently zero;
4. add the compact Native BRep CAD spatial-sanity instruction;
5. add repository coverage for definitely-disjoint Rhino subtract parity, then re-test in installed Rhino 8;
6. re-run the same room/door/cabinet fixture and compare wall-clock time, step count, BRep door geometry and GHX solve behavior.

C3/C4/C5 remain relevant after this first-turn/loop issue is bounded. M2 remains out of scope during the context-budget track.

## Preserved boundaries

No finding here changes:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- M0/M1 validation semantics;
- canonical M1 depth 12 / node limit 64;
- build123d/OCCT native authority;
- GHX parameter-only return/import semantics;
- non-zero rotation fail-closed behavior;
- Settings/discovery model authority;
- OpenSCAD behavior;
- the draft/stacked PR #36 merge boundary;
- the prohibition on starting M2 during this context-budget phase.
