# BRep Phase 3 status

## Status

Phase 3 — AI-native BRep editing — is active on:

```text
feature/brep-ai-native-editing
```

Base:

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
Phase 2: native BRep project lifecycle
```

Active execution contract: `docs/brep_phase3_execution.md`.
Roadmap: `docs/brep_kernel_plan.md`.

Phase 1/2 execution/status files are historical evidence after merge.

## 3A — Architecture reconciliation and contract lock

Status: **complete**.

### Current ownership map

| Concern | Current implementation | Phase 3 direction |
| --- | --- | --- |
| Parametric project source | `shared/parametricProjectSource.ts` discriminates `openscad | brep`; absent discriminator is legacy OpenSCAD | Reuse unchanged. AI targets a complete normalized `BrepProject` for BRep. |
| Canonical BRep schema | `shared/brepProject.ts` owns versioning, bounds, IDs, parameter units, DAG/reference/cycle validation and semantic selectors | Remains the sole authoring contract. No AI-specific geometry schema. |
| Persisted BRep artifact | `shared/brepProjectArtifact.ts` validates `data-brep-project` with `{ title, version, source: { kind: 'brep', source } }` | Reuse for successful AI revisions; no parallel AI artifact/history model. |
| BRep lifecycle | `src/services/brepProjectService.ts` creates immutable assistant revisions, current-leaf CAS for parameter edits and validated restore branches | AI edits must use the same immutable/CAS semantics, anchored to the exact source leaf used as generation context. |
| OpenSCAD AI tool | `shared/chatAi.ts` `build_parametric_model` remains intentionally OpenSCAD-only | Preserve historical/current semantics unless a later reviewed discriminated change is demonstrably safe. |
| OpenSCAD helpers | `shared/parametricParts.ts` searches `tool-build_parametric_model` and normalizes OpenSCAD artifacts | Keep narrow; do not silently change helper meaning for BRep. |
| Normal AI server | `src/server/aiChat.ts` owns Parametric instructions/tools, stream lifecycle and tool/message persistence | Add source-kind-aware context/tool selection without regressing OpenSCAD/Creative. |
| External structured result | `src/server/opencodeAgentResult.ts` currently parses OpenSCAD `{ project, message }` only | Extend after shared/native BRep contract is stable; discriminate explicitly. |
| OpenCode/Codex continuation | `src/server/cliAgents.ts` serializes latest complete OpenSCAD tool artifact | Later add active BRep source lookup; OpenSCAD asset reconciliation remains OpenSCAD-only. |
| Previous/current source | OpenSCAD external paths use latest complete project; Phase 2 BRep resolves active assistant leaf | BRep generation must anchor to the exact active `data-brep-project` source revision present on the current branch. |
| Parameter vs DAG edit | Phase 2 BRep parameter editing persists complete normalized snapshots | AI parameter-definition and DAG edits both return complete snapshots; no patch source authority. |
| Selector/topology | v1 supports semantic `parallelToAxis`; canonical tests reject `edgeIndex` | AI may emit only canonical selector vocabulary; unsupported topology operations fail closed. |
| Runtime | accepted rootless Podman build123d/OCCT evaluator and STEP path | Preserve exactly. AI receives no Python/native execution authority. |

### Contract decisions

- Phase 2 already supplies the correct persistence seam; no new conversation type/database history model is needed.
- Complete BRep snapshots mirror the successful project-native OpenSCAD editing principle, but use `BrepProject`, not source files.
- Standalone schema validity is insufficient for follow-up edits: previous→next identity continuity must also be validated.
- Project ID must remain stable on ordinary follow-ups; unchanged node/parameter IDs should remain stable; genuinely new objects receive new IDs.
- Obvious whole-graph ID churn is rejected rather than silently accepted.
- Structural diff is deterministic derived diagnostics, never source authority.
- BRep source anchoring plus existing compare-and-set activation is the required stale-result policy.
- External-agent integration is downstream of the shared/native contract, not the contract owner.

### Primary regression risks

- polymorphizing `build_parametric_model` and breaking historical OpenSCAD tool parts/recovery;
- selecting a historical rather than active BRep snapshot for follow-up context;
- stale AI completion reactivating an older branch after restore/parameter edit;
- whole-project ID churn that still passes standalone schema validation;
- invented raw topology selectors;
- duplicated source authority between tool data and `data-brep-project`;
- OpenSCAD asset reconciliation leaking into BRep;
- native evaluation before AI candidate/identity validation;
- Phase 4 graph UX leaking into Phase 3.

## 3B — Shared BRep AI snapshot schema and structural diff

Status: **complete and locally verified**.

Added:

```text
shared/brepAiProject.ts
tests/brepAiProject.test.ts
```

The shared contract provides canonical normalization, deterministic project/parameter/node diffing and follow-up identity validation. Focused tests cover normalization/order independence, parameter edits, node add/remove/change, project-ID replacement, whole-graph node-ID churn and fail-closed raw topology selector rejection.

### Verification evidence

Reported from the real local checkout on 2026-09-03:

```text
npm test -- --run tests/brepAiProject.test.ts tests/brepProject.test.ts tests/brepProjectArtifact.test.ts tests/parametricProjectSource.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
git diff --check origin/master...HEAD  PASS (no output)
```

3B is accepted.

## 3C — Native AI tool/source contract

Status: **complete and locally verified**.

Decision: legacy `build_parametric_model` stays strictly OpenSCAD. Native BRep uses the separate `build_brep_project` tool contract.

Added/changed:

```text
shared/brepAiTool.ts
shared/chatAi.ts
config/ai/instructions/tool-build-brep-project.md
config/ai/instructions/manifest.json
tests/brepAiTool.test.ts
tests/aiInstructionCatalog.test.ts
```

The contract accepts only complete bounded canonical BRep snapshots, rejects runtime/Python/STEP/mesh authority, enumerates only supported topology vocabulary and delegates semantic validation to the canonical normalizer. `chatTools` knows the new type, but live `aiChat` routing is still unchanged.

### Verification evidence

Reported from the real local checkout on 2026-09-03:

```text
npm test -- --run tests/brepAiTool.test.ts tests/brepAiProject.test.ts tests/aiInstructionCatalog.test.ts tests/brepProject.test.ts tests/brepProjectArtifact.test.ts tests/parametricProjectSource.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
git diff --check origin/master...HEAD  PASS (no output)
```

3C is accepted.

## 3D — Prompting and native provider generation/follow-up context

Status: **separable source/context foundation implemented; local verification pending. Live provider wiring not started.**

Reconciliation findings:

- `loadBranchFromDb()` already loads the exact current message-tree path selected by `current_message_leaf_id`.
- A persisted native BRep source is already represented on that path as `data-brep-project`; no second DB/source lookup is necessary.
- A follow-up user message may be the current leaf while the authoritative BRep source is the nearest preceding assistant revision. Request leaf identity and source revision identity are therefore distinct and both matter for 3E stale handling.
- `convertToModelMessages()` currently has no conversion for `data-brep-project`, so normal providers do not yet receive canonical BRep source context.
- `parametricTools()` and forced tool-choice logic are currently hard-coded to `build_parametric_model`.
- OpenSCAD authoritative asset collection is separate and must remain OpenSCAD-only.
- Existing Phase 2 BRep conversations already have an unambiguous native source identity. Creation of an entirely new AI-authored BRep conversation needs an explicit product entry/mode decision in 3G rather than provider-layer heuristics.

### Implemented separable 3D foundation

Added/changed:

```text
shared/brepAiContext.ts
config/ai/instructions/context-brep-project.md
config/ai/instructions/manifest.json
tests/brepAiContext.test.ts
tests/aiInstructionCatalog.test.ts
```

The helper now:

- scans the loaded active branch newest-to-oldest for the nearest `data-brep-project` revision;
- correctly resolves a preceding BRep assistant source when the request leaf is a user follow-up;
- retains the exact source message ID server-side for later 3E identity validation;
- fails closed if the nearest BRep marker is malformed instead of silently falling back to an older snapshot;
- rejects a BRep source marker on a non-assistant message;
- serializes only a normalized canonical `BrepProject` JSON snapshot for model context, excluding message IDs/runtime authority.

The repository-driven `context.brep_project` template tells the model that the supplied JSON is exact source authority, requires complete-snapshot output/stable IDs and forbids Python/build123d/STEP/mesh/raw topology/runtime objects.

No live `src/server/aiChat.ts`, OpenCode/Codex, BRep evaluator, persistence, client tool recovery or product UI behavior changed in this checkpoint.

### Verification pending

Run locally:

```text
npm test -- --run tests/brepAiContext.test.ts tests/brepAiTool.test.ts tests/brepAiProject.test.ts tests/aiInstructionCatalog.test.ts tests/brepProjectArtifact.test.ts
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

### Next runtime boundary

After this checkpoint is green, do not expose `build_brep_project` by itself as a half-wired client tool. The next coherent change should combine the remaining 3D normal-provider source-kind routing/context/tool-choice work with the core 3E validation + immutable revision + stale/CAS path, so a produced BRep tool call can immediately converge to the existing canonical `data-brep-project` source lifecycle.

## Decision gates

Stop before broadening implementation if:

- BRep tool integration would require breaking historical OpenSCAD message/tool semantics;
- project-ID continuity or stale-parent anchoring cannot be enforced at the current message-tree boundary;
- a requested topology edit requires selectors outside canonical schema;
- provider/external-agent parity would require arbitrary Python/build123d execution;
- broad database changes appear necessary merely for AI editing.

## Current next action

Verify the separable 3D source/context checkpoint locally. Once green, prepare one coherent 3D-runtime + 3E implementation packet; that is the point where a focused Codex/local-runtime thread becomes materially useful.