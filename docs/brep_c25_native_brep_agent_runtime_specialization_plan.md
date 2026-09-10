# C2.5 — Native BRep agent runtime and CAD specialization plan

Status: **planned next active engineering phase before C3**

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
2. diagnostics reported `stepCount: 12` while provider usage was still reported as zero, so per-step latency/context/tool behavior is not yet observable enough;
3. the generated room model was broadly useful but placed the door cutter outside the room because the model mixed full extents and half extents; the resulting GHX loaded in installed Rhino 8 / Grasshopper but the generated Rhino Python raised Brepia's own boolean-difference guard on that disjoint cutter.

Runtime and host evidence is recorded in:

```text
docs/brep_c2_runtime_evidence_2026-09-10.md
```

This phase is deliberately placed before C3. C3 remains necessary for long multi-turn context projection, but the post-C2 run exposed first-turn/runtime-loop and CAD-specialization issues that should be resolved before history projection changes the input shape again.

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

The user should not need to manually switch from `Standard OpenSCAD` to `Standard BRep` merely because a conversation changes source kind. Brepia already knows the authoritative source kind.

The distinction is important:

- a **profile/package** controls general behavior and lineage;
- a **source-kind CAD instruction** teaches geometry/modeling methodology for the active representation;
- a **tool instruction** describes the concrete tool contract and schema rules.

Do not solve BRep CAD quality by adding unrelated OpenSCAD material to the BRep context, or vice versa.

## C2.5-A — per-step and provider-usage observability

Before changing stop behavior, make the 12-step runtime explainable.

Record bounded diagnostics for each model step without logging prompt/project payloads:

- step number;
- elapsed time for the step and cumulative elapsed time;
- active tool set / tool choice mode;
- tool calls emitted by that step;
- whether `build_brep_project` execution was accepted by full canonical validation;
- validation/tool execution error class when rejected;
- estimated effective model-context size for the step where available;
- cumulative tool-call/project-payload growth when multi-step state is fed back to the model;
- provider-reported input/output/total token usage when supplied.

For the local OpenAI-compatible provider, enable/request streaming usage metadata where supported so llama.cpp can return non-zero prompt/completion usage. Do not fabricate usage when the provider omits it.

Acceptance must distinguish at least:

```text
12 validation retries
```

from:

```text
valid build succeeded early but the loop continued unnecessarily
```

Those cases require different fixes.

## C2.5-B — terminate a Native BRep turn on accepted canonical build

If C2.5-A confirms that a valid `build_brep_project` can be accepted before the final configured step, change the normal Native BRep multi-step loop so the first successfully validated canonical build completes the CAD generation turn.

Use the existing request-local accepted-build state rather than merely checking that the model attempted the tool:

- invalid/rejected build: no accepted candidate, model may retry within the existing bounded max-step policy;
- valid canonical build: accepted candidate is set, stop further model inference for that turn;
- persistence/finalization continues to use the accepted canonical candidate;
- an `answer_user` call must not be required merely to terminate a successful CAD build.

Do not stop on a failed or malformed tool attempt.

Regression coverage should prove:

- valid first build stops immediately;
- rejected first build can retry;
- accepted candidate remains the persisted immutable source revision;
- OpenSCAD and Creative multi-step behavior is unchanged unless separately justified.

Runtime target is not an arbitrary fixed duration, but the same representative Native BRep fixture should no longer perform redundant full-model steps after an accepted build. Compare against the observed approximately 60-minute / 12-step run.

## C2.5-C — source-kind CAD prompt specialization

Keep `Standard` as the ordinary product/profile selection, but split Parametric CAD methodology by source kind.

Target conceptual instruction scopes:

```text
parametric.openscad
parametric.brep
```

or equivalent names that fit the existing instruction catalog cleanly.

Selection should be automatic from the authoritative product route/source kind:

```text
parametricSourceKind = openscad -> OpenSCAD CAD specialization
parametricSourceKind = brep     -> Native BRep CAD specialization
```

Do not introduce a new conversation type solely for this.

### Native BRep specialization should teach CAD methodology

Keep it concise and high-value. It should guide the model to:

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

The existing `tool.build_brep_project` instruction remains the concrete canonical/tool contract. Avoid duplicating the entire schema contract into the CAD methodology prompt.

### OpenSCAD specialization

Preserve current OpenSCAD-specific generation behavior and move/retain OpenSCAD-only methodology in the OpenSCAD source-kind instruction rather than sending it to Native BRep turns.

### Context-budget requirement

Prompt specialization must not recreate the context problem. Measure the effective system/instruction byte/token estimate before and after the split. Prefer a shorter shared base plus focused source-kind instructions over two duplicated monolithic prompts.

### UI/product behavior

The normal conversation header may continue to show `Standard` because that is the selected high-level profile. If Settings later exposes instruction internals, it may show the effective CAD specialization separately, but the baseline product should select it automatically.

## C2.5-D — Rhino/native disjoint subtract parity

The post-C2 host fixture exposed a semantic mismatch:

- native build123d/OCCT subtraction of a provably disjoint cutter behaves as a no-op;
- the Rhino Python compiler currently requires every `Brep.CreateBooleanDifference(...)` call to return exactly one Brep and raises otherwise.

Do not fix this by treating every Rhino boolean failure as a no-op. That would hide genuine topology/tolerance failures.

Design a bounded parity rule:

1. if the current base and cutter can be proven disjoint before the Rhino boolean operation using deterministic bounds/intersection logic, preserve the current base as an explicit no-op subtraction;
2. otherwise call RhinoCommon `Brep.CreateBooleanDifference(...)` using the existing document tolerance;
3. for overlapping/uncertain inputs, continue to fail closed when Rhino does not return the required deterministic result cardinality.

Before changing RhinoCommon translation, follow `docs/references/rhino8_mcneel_sources.md` and use Rhino 8-compatible McNeel evidence. Repository tests are necessary but installed Rhino 8 / Grasshopper remains runtime authority.

Regression coverage should include:

- disjoint box cutter -> deterministic no-op;
- intersecting cutter -> Rhino boolean path retained;
- actual boolean failure on a non-proven-disjoint case -> still fail closed;
- existing multi-tool subtract ordering preserved.

The bad door placement itself remains an AI CAD-quality defect addressed by C2.5-C; the compiler parity fix must not make bad model geometry look correct.

## Required post-C2.5 runtime fixture

Re-run the same or equivalent room/cabinets/door Native BRep prompt with:

```text
local/qwen3.8-27b-mtp-128k
```

Capture:

- request-level `ai context diagnostics`;
- per-step diagnostics;
- provider usage if available;
- total generation duration;
- step count;
- accepted-build step number;
- resulting canonical BRep project;
- native Brepia preview;
- fresh GHX export;
- installed Rhino 8 / Grasshopper open/solve result.

Compare against the post-C2 evidence:

```text
approximately 60 minutes
stepCount = 12
provider usage = 0 / 0 / 0 as currently surfaced
model broadly correct but door cutter outside room
GHX opens, Rhino Python fails on room_result second boolean
```

Success means the loop no longer performs redundant post-acceptance inference, CAD placement quality improves under the specialized BRep methodology, and Rhino disjoint-subtract semantics no longer disagree with native behavior while real boolean failures remain fail-closed.

## Ordering after C2.5

The engineering sequence is:

1. C1 — context observability — complete;
2. C2 — compact provider schema — repository complete / CI accepted; real post-C2 runtime evidence captured;
3. **C2.5 — Native BRep agent runtime and CAD specialization — next active phase**;
4. C3 — BRep model-context projection;
5. representative long multi-turn re-measurement;
6. C4 — image-context projection where justified;
7. C5 — hard model-aware context budget;
8. C6 — rolling intent summary only if measurements still justify it;
9. M2 — modeling capability expansion (`union` / `intersect`) only after the context/runtime track is sufficiently stable.

## Boundaries

C2.5 must preserve:

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
- no installed-host parity claim without real Rhino 8 / Grasshopper evidence;
- PR #36 remains draft/stacked and is not merged without separate reconciliation;
- M2 remains unstarted.
