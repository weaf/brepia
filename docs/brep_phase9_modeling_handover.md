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
- `parametricSourceKind = 'brep'`;
- canonical BRep + immutable revision authority;
- strict parameter-only GHX return/import boundary;
- Rhino 8 built-in Python 3 as the zero-install executable carrier;
- Settings/discovery as the only LLM-model authority;
- OpenSCAD regressions unchanged;
- unsupported geometry operations fail closed;
- no installed-host parity claim without real Rhino 8 / Grasshopper evidence.

Do not use Codex unless it is genuinely needed.

## Current modeling-track state

Read first:

- `docs/brep_ai_context_budget_plan.md`;
- `docs/brep_c1_context_observability_closeout.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- `docs/brep_modeling_capability_expansion_plan.md`;
- `docs/brep_m0_parameter_integrity_closeout.md`;
- `docs/brep_m1_scalar_expression_closeout.md`;
- `docs/brep_phase9_rhino_acceptance.md`;
- `docs/brep_phase9_host_model_evidence_2026-09-09.md`;
- `docs/references/rhino8_mcneel_sources.md`.

### M0 — parameter effectiveness + graph integrity

**Repository-complete and CI-accepted.**

M0 introduced shared deterministic reachability/effectiveness analysis that classifies nodes/parameters as authoritative/role reachable, orphan, effective, semantic-only, orphan-only or unused. AI-created/AI-edited snapshots fail closed on ineffective geometry controls and unintended orphan feature branches while legacy/manual/import compatibility remains preserved.

Closeout:

```text
docs/brep_m0_parameter_integrity_closeout.md
```

### M1 — bounded scalar expression AST

**Repository-complete and CI-accepted.** Installed Rhino 8 host evidence for the newly added derived-expression behavior remains separate.

Original accepted M1 code checkpoint:

```text
4ebfa486519c23d03996c514c326a2f2fff0e084
Remove stale M1 scalar editing import
```

Original checkpoint evidence:

- Quality Gate #751 — **PASS**;
- 126 test files / 808 tests — **PASS**;
- typecheck — **PASS**;
- lint — **PASS**;
- production build — **PASS**;
- diff check — **PASS**;
- Grasshopper Build #323 — **PASS** on Ubuntu and Windows packaging/build paths.

Post-closeout provider-schema hardening checkpoint:

```text
b696e14d5c0ce2790adb37ce4a4ddc28575473a1
Remove stale direct BRep tool schema import
```

Exact hardening evidence:

- Quality Gate #759 — **PASS**;
- 127 test files / 811 tests — **PASS**;
- dependency audit — **PASS**;
- typecheck — **PASS**;
- lint — **PASS**;
- production build — **PASS**;
- diff check — **PASS**;
- Grasshopper Build #331 — **PASS**;
- plugin build — **PASS**;
- Ubuntu package build — **PASS**;
- Windows package build — **PASS**.

M1 adds an additive canonical `schemaVersion: 1` scalar AST:

```ts
type BrepScalar =
  | number
  | { parameter: string }
  | { op: 'add' | 'sub' | 'mul' | 'div'; args: [BrepScalar, BrepScalar] }
  | { op: 'neg'; args: [BrepScalar] };
```

Safety/semantic contract:

- max absolute literal/parameter/intermediate value `1e9`;
- max expression depth `12`;
- max expression-node count `64`;
- finite bounded evaluation at every intermediate;
- division by zero fails closed;
- deterministic `mm` / `deg` / `none` unit algebra;
- default-time and runtime-override validation before native execution;
- native build123d driver and Rhino/GHX compiler share the same bounded operator semantics;
- M0 recursively follows parameter references through ASTs;
- placement, feature and project-object editors preserve existing ASTs but do not expose a free-form expression editor;
- `build_brep_project` teaches the AI to represent derived relationships as ASTs rather than fake published sliders;
- GHX remains parameter-only at the supported return/import boundary;
- expression-backed rotation remains fail closed even when the expression resolves to zero.

#### Provider-safe AI tool boundary

Do **not** wire the recursive `z.lazy()` scalar schema directly into the provider-facing `tool()` input again.

The direct recursive schema caused AI SDK JSON Schema conversion warnings of the form:

```text
Recursive reference detected at ...! Defaulting to any
```

A simple `$ref`-based fix was considered but rejected as the final local-provider strategy because Brepia's OpenAI-compatible local path includes llama.cpp and its JSON-schema-to-grammar implementation has known nested-reference limitations.

The current split is intentional:

- canonical/tool-validation schema remains fully recursive with M1 depth `12` and node limit `64`;
- provider/model-facing schema is finite and reference-free with `BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 2` after C2;
- ordinary M1 authoring such as `Width - 2 * WallThickness` is explicitly tested at the finite provider boundary;
- the provider wrapper delegates every received value to the full `brepAiBuildInputSchema.safeParseAsync(...)` validator before acceptance;
- a deliberately deeper expression is rejected by the finite provider authoring schema but remains accepted by the full canonical validator;
- `tests/brepAiToolJsonSchema.test.ts` verifies no recursive-reference warning, no `$ref`, explicit M1 operator vocabulary, actual tool wiring and a serialized provider-schema regression ceiling below `180000` bytes.

The provider depth is a constrained-generation/authoring bound only. It is not a persistence migration and does not reduce the canonical M1 contract.

M1 closeout:

```text
docs/brep_m1_scalar_expression_closeout.md
```

C2 provider-schema closeout:

```text
docs/brep_c2_provider_schema_closeout.md
```

## Why M0/M1 were needed

Installed Rhino 8 / Grasshopper evidence exposed product-level deficiencies in otherwise successfully solved Brepia definitions:

### Room project

The canonical graph uses boxes + literal transforms + one subtract with eight ordered cutters. It supplied useful real-host evidence for complex multi-node box/translation/subtract generation and eight-tool subtraction.

However, only five of ten published parameters reached result geometry. `cabinet_gap`, `cabinet_height`, `cabinet_width`, `door_height` and `wall_thickness` were disconnected, and several intended relationships were hard-coded literals.

M0 prevents new AI-authored snapshots from presenting ineffective geometry sliders; M1 provides a safe representation for the previously baked derived relationships.

### Rectangular plate project

The canonical graph contains box, two cylinders, literal + parameter-backed translation, two-tool subtract and a fillet node.

The fillet node was not `resultNodeId`, so the authoritative result remained unfilleted. The model also exposed ineffective parameters. M0 addresses the authoritative/orphan graph defect; M1 allows dependent positions/dimensions to remain relational rather than numerically baked.

`rotateDeg` remained `[0,0,0]`; M1 intentionally does not broaden that boundary.

## Active engineering phase — AI context budget / projection

**C1 is empirically complete. C2 is repository-complete and CI-accepted. Runtime re-measurement of C2 is the only next gate before C3.**

Plan:

```text
docs/brep_ai_context_budget_plan.md
```

Original trigger in the real local runtime:

```text
request (169503 tokens) exceeds the available context size (131072 tokens)
```

### C1 result

C1 added bounded observability and reproduced the overflow on:

```text
local/qwen3.8-27b-mtp-128k
```

The reproduced fixture was a first-turn Native BRep creation with:

- no current canonical BRep;
- one ordinary user message;
- no historical `build_brep_project` calls;
- no historical `data-brep-project` snapshots;
- no images.

Yet the diagnostics reported:

```text
system/instruction estimate             2077 tokens
provider-visible tool-schema estimate 105743 tokens
ordinary history estimate                 29 tokens
effective model messages                  42 tokens
total deterministic estimate          107862 tokens
llama.cpp request count                169503 tokens
```

The provider-visible schema therefore dominated before history existed. This falsified the idea that C3 history projection could be the primary fix for the original first-turn failure.

C1 also showed that the deterministic byte/token estimator materially under-counts llama.cpp tokenization for this schema-heavy request. C5 must use provider/tokenizer-aware or deliberately conservative preflight accounting rather than treating `bytes / 4` as exact.

Runtime evidence:

```text
docs/brep_c1_runtime_evidence_2026-09-09.md
```

### C2 result

C2 reduced only the finite provider authoring depth:

```text
BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 3 -> 2
```

while preserving canonical M1 depth `12` and node limit `64`.

C2 also added:

- an explicit provider-authoring regression for `Width - 2 * WallThickness`;
- proof that deeper canonical input remains valid behind the finite provider boundary;
- a serialized provider-schema ceiling below `180000` bytes;
- preservation of the no-recursive-warning / no-`$ref` provider baseline.

C2 accepted code/test checkpoint:

```text
93a4aac680b3fe529e19515d45df47d11e847452
Test compact BRep provider schema depth
```

Exact evidence:

- Quality Gate #770 — **PASS**;
- tests — **PASS**;
- typecheck — **PASS**;
- lint — **PASS**;
- production build — **PASS**;
- diff check — **PASS**;
- Grasshopper Build #342 — **PASS**.

### Next action — C2 runtime re-measurement

Update/restart the local Brepia runtime on the current branch and repeat the same first-turn Native BRep fixture with:

```text
local/qwen3.8-27b-mtp-128k
```

Capture:

```text
ai context diagnostics
```

and, if the request succeeds:

```text
ai context actual usage
```

Compare against the C1 baseline:

```text
provider schema bytes       422971
schema estimated tokens     105743
total estimated input       107862
llama.cpp request tokens    169503
context window              131072
```

Do **not** start C3 until this runtime re-measurement shows the residual problem after C2.

### Remaining sequence after that gate

1. **C3 — BRep model-context projection** only if/when multi-turn evidence shows superseded BRep tool payloads are material;
2. re-measure representative long multi-turn BRep conversations;
3. **C4 — image projection** where historical image payloads are material;
4. **C5 — hard model-aware input budget** with tokenizer-aware/conservative preflight, reserved output and safety margin;
5. **C6 — rolling intent summary only if still justified after structured-state deduplication**.

Architectural rule remains:

```text
Database / immutable revisions = durable history and source authority
Model context window           = bounded working memory for the current turn
```

For BRep, the current canonical project is structured truth. Historical complete BRep snapshots must not be repeatedly sent merely because they remain correctly persisted.

Do not solve this primarily by increasing llama.cpp context size. Larger context may be separately useful, but duplicate structured state should be removed first.

This phase must preserve:

- immutable revision/UI history in the database;
- current canonical BRep source authority;
- M0/M1 validation and integrity;
- provider-safe no-recursive-warning/no-nested-`$ref` baseline;
- branch/leaf semantics;
- GHX authority boundaries;
- model selection through Settings/discovery.

Do not start M2 as part of context-budget work.

## Remaining Phase 9 installed-host acceptance

Do not confuse repository-complete modeling milestones or context-budget work with completion of the existing GHX product loop.

Still separately required:

1. focused M1 derived-expression host fixture, for example `InnerWidth = Width - 2 * WallThickness`;
2. dedicated authoritative fillet Result host test if fillet parity is to be claimed;
3. non-zero rotation analysis + implementation + host test before enabling rotation;
4. Grasshopper save/reopen evidence;
5. returned Rhino-saved GHX import to Brepia;
6. deterministic compatibility validation and parameter recovery;
7. explicit activation of the imported immutable revision;
8. native Brepia preview after activation;
9. continued editing with Brepia AI;
10. export a fresh GHX again and open/solve it in Grasshopper.

For the M1 host fixture, verify specifically that only independent published inputs become Grasshopper controls, changing them updates the derived geometry, and GHX return/import changes only those published numeric values while the canonical AST remains Brepia source authority.

## Next modeling milestone — M2, not started

M2 remains the next modeling-capability milestone in `docs/brep_modeling_capability_expansion_plan.md`, but **no M2 implementation has started** and context-budget/projection work comes first.

Potential M2 scope remains bounded additive Boolean composition:

- `union`;
- `intersect`.

Before implementation, perform a separate analysis/scope pass covering:

- canonical node shape and deterministic result-cardinality rules;
- ordered inputs and DAG/reference semantics;
- build123d/OCCT authoritative behavior;
- Rhino 8 / RhinoCommon translation against branch-8 McNeel upstream references;
- fail-closed behavior for unsupported multi-body ambiguity;
- M0 reachability/effectiveness integration;
- AI schema/instructions;
- repository parity fixtures and the installed-host evidence required before any Rhino parity claim.

Do not combine M2 with pattern/mirror, profile/extrude, shell/wall abstractions, topology-selector expansion or rotation.

## Suggested next chat first action

Begin with **C2 runtime re-measurement only**.

First reconcile current branch implementation against:

- `AGENTS.md`;
- `docs/brep_ai_context_budget_plan.md`;
- `docs/brep_c1_runtime_evidence_2026-09-09.md`;
- `docs/brep_c2_provider_schema_closeout.md`;
- this handover.

Do not start C3 until the same first-turn fixture has been re-run on the depth-2 provider schema. Do not start M2, do not claim installed Rhino acceptance from repository tests, and do not merge PR #36 without explicit stacked-branch reconciliation.
