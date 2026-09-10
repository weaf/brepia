# BRep Phase 9 / modeling capability handover

Use this as the starting context for the next focused agent/chat. Reconcile it against current branch implementation before changing code.

## Branch and merge boundary

Repository: `weaf/brepia`

Branch:

```text
feature/brep-grasshopper-gh-packaging
```

PR #36 remains **draft**, stacked on `feature/brep-grasshopper-smart-component`, and must not be merged across the Phase 7 boundary without explicit reconciliation.

Keep:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'` for Native BRep;
- canonical BRep + immutable revision authority;
- build123d/OCCT as authoritative native geometry evaluator;
- strict parameter-only GHX return/import boundary;
- Rhino 8 built-in Python 3 as the zero-install executable carrier;
- Settings/discovery as the only LLM-model authority;
- OpenSCAD regressions unchanged;
- unsupported geometry operations fail closed;
- non-zero rotation remains unsupported/fail-closed;
- no installed-host parity claim without real Rhino 8 / Grasshopper evidence.

Do not use Codex unless it is genuinely needed.

## Read first

- `AGENTS.md`;
- `docs/brep_ai_context_budget_plan.md`;
- `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`;
- `docs/brep_c2_runtime_evidence_2026-09-10.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_m1_scalar_expression_closeout.md`;
- `docs/brep_m0_parameter_integrity_closeout.md`;
- `docs/brep_phase9_rhino_acceptance.md`;
- `docs/references/rhino8_mcneel_sources.md`.

Reconcile those documents against actual implementation before changing behavior.

## Accepted modeling baseline

### M0 — parameter effectiveness + graph integrity

**Repository-complete and CI-accepted.**

M0 provides deterministic reachability/effectiveness analysis and prevents new AI-authored snapshots from exposing ineffective geometry controls or unintended orphan feature branches while preserving legacy/manual/import compatibility.

### M1 — bounded scalar expression AST

**Repository-complete and CI-accepted.**

Canonical `schemaVersion: 1` supports:

```ts
type BrepScalar =
  | number
  | { parameter: string }
  | { op: 'add' | 'sub' | 'mul' | 'div'; args: [BrepScalar, BrepScalar] }
  | { op: 'neg'; args: [BrepScalar] };
```

Canonical safety remains:

- max absolute literal/parameter/intermediate value `1e9`;
- max expression depth `12`;
- max expression-node count `64`;
- finite/intermediate checks;
- division by zero fail-closed;
- deterministic `mm` / `deg` / `none` unit algebra;
- default/runtime validation before native execution;
- M0 follows nested references;
- GHX remains parameter-only on return/import;
- expression-backed rotation remains fail-closed.

Original M1 accepted code checkpoint:

```text
4ebfa486519c23d03996c514c326a2f2fff0e084
```

with Quality Gate #751 and Grasshopper Build #323 passing.

### Provider-safe M1 boundary

Do not wire recursive `z.lazy()` directly into provider-facing tool JSON Schema.

The accepted architecture is:

- full recursive/canonical validator remains authoritative;
- provider-facing schema is finite and reference-free;
- no nested `$ref` baseline for llama.cpp;
- after C2, `BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 2`;
- ordinary M1 authoring such as `Width - 2 * WallThickness` remains supported;
- provider schema size is regression-bounded below `180000` serialized bytes.

Provider-hardening checkpoint:

```text
b696e14d5c0ce2790adb37ce4a4ddc28575473a1
```

with Quality Gate #759 and Grasshopper Build #331 passing.

C2 accepted code/test checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
```

with Quality Gate #770 and Grasshopper Build #342 passing.

## Context/runtime track

### C1 — complete

The original local-model failure was:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

C1 observability showed that the first-turn failure had no BRep history or images and was dominated by the provider-visible tool schema:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
effective model messages                  42 tokens
llama.cpp request count                169503 tokens
```

This justified C2 before C3 history projection.

### C2 — complete in repository; real post-C2 dispatch succeeded

C2 reduced only provider authoring depth `3 -> 2`, preserving canonical M1 depth `12` / node limit `64`.

A real post-C2 Native BRep run on:

```text
local/qwen3.8-27b-mtp-128k
```

completed instead of reproducing the context overflow.

However the run exposed the next failure class:

```text
approximately 60 minutes total generation
stepCount: 12
ai context actual usage: inputTokens=0, outputTokens=0, totalTokens=0
```

The generated room/cabinet model was broadly useful but spatially misplaced the door cutter. At defaults it placed the door near `X=-2920 mm` while the centered 3000 mm-wide room occupies approximately `X=-1500..+1500 mm`, so the cutter did not intersect the wall.

The resulting fresh GHX loaded in installed Rhino 8 / Grasshopper, but the Rhino Python script reached Brepia's own boolean-difference guard and raised on the second `room_result` subtraction. This is runtime evidence, not a Python syntax failure.

Detailed evidence:

```text
docs/brep_c2_runtime_evidence_2026-09-10.md
```

A small immediate improvement was already added to `tool.build_brep_project`: models are now explicitly told to sanity-check centered extents, default-value transforms and cutter/material intersection before emission. Treat this as a tool-contract improvement, not yet the full source-kind CAD specialization.

## Next active phase — C2.5 Native BRep agent runtime and CAD specialization

**C2.5 is the next activity. Do not start C3 or M2 first.**

Plan:

```text
docs/brep_c25_native_brep_agent_runtime_specialization_plan.md
```

Execute in this order.

### C2.5-A — per-step and provider-usage observability

Instrument each model step with bounded metadata:

- step number;
- step and cumulative duration;
- tool calls;
- accepted/rejected `build_brep_project` outcome;
- validation/tool error class;
- context growth where available;
- provider-reported usage where supported.

Enable/request llama.cpp/OpenAI-compatible streaming usage metadata where supported so `0/0/0` is not mistaken for real zero usage.

The first goal is to distinguish:

```text
12 genuine validation retries
```

from:

```text
an accepted build succeeded early but inference continued unnecessarily
```

### C2.5-B — terminate on accepted canonical BRep build

If A confirms redundant post-acceptance inference, change the normal Native BRep loop so:

- rejected build -> model may retry within bounded max steps;
- fully validated accepted build -> generation turn completes;
- `answer_user` is not required merely to terminate a successful CAD build;
- immutable revision persistence/finalization remains unchanged.

Stop based on the request-local accepted canonical candidate, not merely the presence of a tool call.

### C2.5-C — source-kind CAD prompt specialization

Keep `Standard` as the high-level product/profile selection.

Do **not** require the user to manually choose `Standard OpenSCAD` versus `Standard BRep` for each project. Brepia already knows the active source kind.

Layer instructions conceptually as:

```text
Standard
├── shared profile/package behavior
├── Parametric OpenSCAD CAD specialization
│   └── tool.build_parametric_model contract
└── Parametric Native BRep CAD specialization
    └── tool.build_brep_project contract
```

Implement equivalent instruction scopes that fit the existing instruction catalog, for example:

```text
parametric.openscad
parametric.brep
```

Selection must be automatic from authoritative source kind while preserving `conversation.type = 'parametric'`.

The Native BRep CAD methodology should stay concise and teach:

- coordinate-system and centered-primitive reasoning;
- full extents versus half-extents;
- independent parameters versus derived M1 relationships;
- default-value transform evaluation;
- cutter/material intersection checks;
- wall-center and wall-thickness placement;
- ordinary floor-reaching openings unless intentionally offset;
- authoritative DAG/result and parameter-effectiveness checks.

Keep the BRep CAD methodology distinct from the concrete `build_brep_project` schema/tool contract. Remove/avoid OpenSCAD-only methodology from BRep turns rather than duplicating two monolithic system prompts. Measure instruction/context size so specialization improves quality without recreating the context problem.

UI may continue to display `Standard`; Settings can later expose effective source-kind specialization separately if useful.

### C2.5-D — Rhino/native disjoint subtract parity

The post-C2 host fixture exposed a parity edge:

- native build123d/OCCT treats a provably disjoint subtraction as a no-op;
- current Rhino Python translation requires `Brep.CreateBooleanDifference(...)` to return exactly one Brep and raises otherwise.

Do not treat every Rhino boolean failure as a no-op.

Design a bounded rule:

- provably disjoint base/cutter -> explicit no-op preserving base;
- overlapping or uncertain -> execute Rhino boolean with document tolerance;
- non-disjoint boolean failure or unexpected result cardinality -> remain fail-closed.

Follow `docs/references/rhino8_mcneel_sources.md` before changing Rhino translation. Repository tests do not substitute for installed Rhino 8 acceptance.

## Required C2.5 acceptance rerun

After C2.5-A/B/C/D, re-run the same or equivalent room/cabinets/door Native BRep fixture on:

```text
local/qwen3.8-27b-mtp-128k
```

Capture:

- request-level context diagnostics;
- per-step diagnostics;
- actual provider usage if available;
- total generation duration;
- total step count;
- accepted-build step number;
- canonical project;
- native Brepia preview;
- fresh GHX;
- installed Rhino 8 / Grasshopper open/solve result.

Compare against the baseline:

```text
~60 minutes
12 steps
0/0/0 surfaced usage
broadly useful model but door cutter outside room
GHX opens but Rhino Python raises on second room_result boolean
```

## Engineering order after C2.5

1. C1 — complete;
2. C2 — complete / accepted, post-C2 runtime evidence captured;
3. **C2.5 — next active phase**;
4. C3 — BRep model-context projection / superseded snapshot removal;
5. representative long multi-turn re-measurement;
6. C4 — image-context projection where justified;
7. C5 — hard model-aware context budget;
8. C6 — rolling intent summary only if measurements justify it;
9. M2 — modeling capability expansion after the context/runtime track is stable enough.

Architectural rule remains:

```text
Database / immutable revisions = durable history and source authority
Model context window           = bounded working memory for the current turn
```

For BRep, current canonical project state is structured truth and should be present exactly once after C3 projection work.

## Remaining Phase 9 installed-host acceptance

Separate from C2.5, still required before claiming full GHX product-loop acceptance:

1. focused M1 derived-expression host fixture;
2. authoritative fillet Result host test if fillet parity is claimed;
3. non-zero rotation analysis/implementation/host test before enabling rotation;
4. Grasshopper save/reopen;
5. returned Rhino-saved GHX import;
6. compatibility validation + parameter recovery;
7. explicit activation of imported immutable revision;
8. native Brepia preview;
9. continued Brepia AI edit;
10. fresh GHX export and installed-host open/solve again.

Do not infer these from repository CI.

## M2 — not started

M2 remains planned additive Boolean composition:

- `union`;
- `intersect`.

Do not start it during C2.5-C6 and do not combine it with pattern/mirror, profile/extrude, shell/wall abstractions, topology-selector expansion or rotation.

## Suggested next chat first action

Start a **new focused chat** at C2.5.

First reconcile the current branch against:

- `AGENTS.md`;
- `docs/brep_c25_native_brep_agent_runtime_specialization_plan.md`;
- `docs/brep_ai_context_budget_plan.md`;
- `docs/brep_c2_runtime_evidence_2026-09-10.md`;
- this handover;
- relevant runtime files, especially `src/server/aiChat.ts`, `src/server/brepAiTools.ts`, `src/server/brepAiTurn.ts`, `shared/brepAiTool.ts`, `config/ai/instructions/*` and `shared/brepGrasshopperRhinoScript.ts`.

Begin with **analysis and C2.5-A observability**, not with stop-loop implementation. First determine whether the 12-step run was repeated validation failure or redundant post-acceptance inference.

Do not start C3 or M2, do not merge PR #36, and do not claim Rhino parity without installed-host evidence.
