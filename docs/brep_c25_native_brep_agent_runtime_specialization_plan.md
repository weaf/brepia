# C2.5 — Native BRep agent runtime and CAD specialization plan

Status: **complete — repository/CI accepted; installed Rhino 8 / Grasshopper acceptance captured**

Date: 2026-09-10

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Why C2.5 exists

C1 and C2 addressed the first observed local-model context overflow. C1 showed that the reference-free provider schema dominated the original first-turn request, and C2 reduced the provider authoring expression depth from 3 to 2 without reducing canonical M1 capability.

The first real post-C2 Native BRep runtime run on:

```text
local/qwen3.8-27b-mtp-128k
```

successfully reached a completed BRep artifact instead of failing the 131072-token context limit, but exposed three new engineering issues:

1. the run took almost 60 minutes where comparable earlier generation took about 2 minutes;
2. diagnostics reported `stepCount: 12` while provider usage was still reported as zero, so per-step latency/context/tool behavior was not observable enough;
3. the generated room model was broadly useful but placed the door cutter outside the room because the model mixed full extents and half extents; the resulting GHX loaded in installed Rhino 8 / Grasshopper but the generated Rhino Python raised Brepia's own boolean-difference guard on that disjoint cutter.

Runtime and host evidence is recorded in:

```text
docs/brep_c2_runtime_evidence_2026-09-10.md
```

C2.5 resolved the first-turn/runtime-loop and CAD-specialization issues before history projection changes the input shape again.

## Architectural intent

Keep the profile hierarchy layered rather than duplicating complete profiles per CAD backend.

Product-facing instruction profile remains, for example:

```text
Standard
```

Source-kind specialization is selected automatically by Brepia:

```text
Standard
├── shared behavior / package instructions
├── Parametric OpenSCAD CAD specialization
│   └── tool.build_parametric_model contract
└── Parametric Native BRep CAD specialization
    └── tool.build_brep_project contract
```

The user does not need to manually switch from `Standard OpenSCAD` to `Standard BRep` merely because a conversation changes source kind. Brepia already knows the authoritative source kind.

The distinction remains:

- a **profile/package** controls general behavior and lineage;
- a **source-kind CAD instruction** teaches geometry/modeling methodology for the active representation;
- a **tool instruction** describes the concrete tool contract and schema rules.

## C2.5-A — per-step and provider-usage observability

Status: **complete**.

Implemented bounded diagnostics for each model step without logging prompt/project payloads:

- step number;
- elapsed time for the step and cumulative elapsed time;
- active tool set / tool choice mode;
- tool calls emitted by that step;
- whether `build_brep_project` execution was accepted by full canonical validation;
- validation/tool execution error class when rejected;
- estimated effective model-context size for the step where available;
- cumulative tool-call/project-payload growth when multi-step state is fed back to the model;
- provider-reported input/output/total token usage when supplied.

For the local OpenAI-compatible provider, streaming usage metadata is explicitly requested. Provider usage is reported only when actually supplied; Brepia does not fabricate zero-token usage.

Detailed status:

```text
docs/brep_c25a_step_observability_status.md
```

## C2.5-B — terminate a Native BRep turn on accepted canonical build

Status: **complete**.

Runtime evidence confirmed that accepted Native BRep builds could occur before the configured multi-step loop finished. Normal Native BRep turns therefore now terminate on the first successfully validated canonical `build_brep_project` result.

Preserved behavior:

- invalid/rejected build: no accepted candidate, model may retry within the existing bounded max-step policy;
- valid canonical build: accepted candidate is set and further inference for that CAD turn stops;
- persistence/finalization continues to use the accepted canonical candidate;
- an `answer_user` call is not required merely to terminate a successful CAD build;
- OpenSCAD and Creative stop behavior remain separate.

## C2.5-C — source-kind CAD prompt specialization

Status: **complete and installed-host exercised**.

`Standard` remains the ordinary product/profile selection while Parametric CAD methodology is split by authoritative source kind.

Native BRep specialization teaches the model to:

1. interpret the user's geometric intent before emitting the graph;
2. establish coordinate axes, centered primitive semantics and main extents;
3. identify truly independent published parameters;
4. express dependent dimensions/offsets with bounded M1 scalar ASTs;
5. place features using centers and half-extents rather than confusing full dimensions with coordinates;
6. evaluate important default-value transforms numerically before emission;
7. verify that every subtract cutter intersects the intended material at default values;
8. verify wall-mounted/cut-through features against the actual wall center and thickness;
9. keep ordinary door/opening cutters reaching the intended floor/reference plane unless the user requests an offset;
10. verify the authoritative DAG/result, parameter effectiveness and current fail-closed boundaries before tool submission.

The existing `tool.build_brep_project` instruction remains the concrete canonical/tool contract rather than duplicating the full schema into the CAD methodology prompt.

Installed Rhino 8 / Grasshopper evidence from the post-specialization room fixture showed materially better parametric behavior: wall thickness and door opening recomputed correctly from their published parameters, even though the fixture's default visual composition was less polished than the earlier model.

## C2.5-D — Rhino/native disjoint subtract parity

Status: **complete — repository and installed-host accepted**.

The post-C2 host fixture exposed a semantic mismatch:

- native build123d/OCCT subtraction of a provably disjoint cutter behaves as a no-op;
- the Rhino Python compiler previously required every `Brep.CreateBooleanDifference(...)` call to return exactly one Brep and raised otherwise.

C2.5-D now applies a bounded parity rule:

1. if accurate Rhino BRep bounds prove the current base and cutter separated by more than document absolute tolerance, preserve the current base as an explicit no-op subtraction;
2. otherwise call RhinoCommon `Brep.CreateBooleanDifference(...)` using the existing document tolerance;
3. for overlapping/uncertain inputs, continue to fail closed when Rhino does not return the required deterministic result cardinality.

Repository regression coverage preserves multiple-cutter ordering and the real boolean path for non-proven-disjoint inputs.

Installed host acceptance on 2026-09-10 used the earlier persisted room/cabinets fixture whose door cutter remained outside the wall. A fresh GHX exported after the D change opened and solved in installed Rhino 8 / Grasshopper without the previous Python boolean error, while the remaining geometry rendered correctly. The absent door opening is the correct result for that unchanged bad source geometry: D restores native/Rhino no-op parity rather than masking the original CAD placement defect.

Detailed status:

```text
docs/brep_c25d_rhino_disjoint_subtract_status.md
```

## C2.5 acceptance summary

The representative C2.5 work established:

```text
A  per-step/provider observability                        COMPLETE
B  stop after first accepted canonical Native BRep build COMPLETE
C  source-kind Native BRep CAD specialization            COMPLETE
D  Rhino/native disjoint subtraction parity              COMPLETE
```

Key observed product/host improvements:

- Native BRep turns no longer need redundant post-acceptance inference;
- local-provider token usage is requested and surfaced when available;
- source-kind CAD guidance reduces coordinate/full-vs-half-extent mistakes;
- wall thickness and door-opening controls were verified as genuinely parametric in installed Grasshopper;
- the old persisted disjoint-door fixture now solves in Grasshopper instead of raising the Rhino Python boolean guard;
- bad source geometry is not silently rewritten into good geometry;
- build123d/OCCT remains authoritative.

## Ordering after C2.5

The engineering sequence is now:

1. C1 — context observability — complete;
2. C2 — compact provider schema — complete / CI accepted / runtime measured;
3. C2.5 — Native BRep agent runtime and CAD specialization — **complete**;
4. **C3 — BRep model-context projection — next active phase**;
5. representative long multi-turn re-measurement;
6. C4 — image-context projection where justified;
7. C5 — hard model-aware context budget;
8. C6 — rolling intent summary only if measurements still justify it;
9. M2 — modeling capability expansion (`union` / `intersect`) only after the context/runtime track is sufficiently stable.

C3 is especially important because the representative C2.5 runtime measured 56,413 input tokens where the byte-based estimator predicted only 36,419, leaving little conservative usable-input headroom even before historical BRep payload growth.

## Boundaries preserved

C2.5 preserved:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'` for Native BRep;
- canonical BRep + immutable revision authority;
- M0 parameter/graph integrity;
- canonical M1 depth 12 / expression-node limit 64;
- finite reference-free provider schema and no recursive-reference warnings;
- no nested `$ref` dependency as the llama.cpp baseline;
- build123d/OCCT as authoritative native geometry evaluator;
- strict GHX parameter-only return/import boundary;
- non-zero rotation remains unsupported/fail-closed;
- Settings/discovery as sole model-selection authority;
- OpenSCAD regressions unchanged;
- PR #36 remains draft/stacked and is not merged without separate reconciliation;
- M2 remains unstarted.
