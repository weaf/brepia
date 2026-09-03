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
| Normal AI server | `src/server/aiChat.ts` owns Parametric instructions/tools, stream lifecycle and tool/message persistence | Later add source-kind-aware context/tool selection without regressing OpenSCAD/Creative. |
| External structured result | `src/server/opencodeAgentResult.ts` currently parses OpenSCAD `{ project, message }` only | Extend after shared/native BRep contract is stable; discriminate explicitly. |
| OpenCode/Codex continuation | `src/server/cliAgents.ts` serializes latest complete OpenSCAD tool artifact | Later add active BRep source lookup; OpenSCAD asset reconciliation remains OpenSCAD-only. |
| Previous/current source | OpenSCAD external paths use latest complete project; Phase 2 BRep resolves active assistant leaf | BRep generation must anchor to the exact active `data-brep-project` leaf at request start. |
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
- BRep source-leaf anchoring plus existing compare-and-set activation is the required stale-result policy.
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

The shared contract provides:

- `normalizeBrepAiProjectCandidate()` — validates every complete AI candidate through canonical `normalizeBrepProject()` and wraps failures as an AI-boundary error;
- `diffBrepProjects()` — normalizes both snapshots then computes deterministic project-field, published-parameter and node diffs keyed by stable IDs;
- field-level changed paths for modified parameters/nodes;
- added/removed/changed/unchanged counts and a concise human summary;
- `validateBrepAiFollowUp()` — enforces project-ID continuity and rejects obvious complete feature-node ID churn before returning the normalized next project and derived diff.

Focused tests cover:

- canonical normalization and order independence;
- no false diff from source array ordering;
- parameter-default/definition changes keyed by stable parameter ID;
- node modification/addition and result-node change;
- valid node removal;
- project-ID replacement rejection;
- whole-graph node-ID churn rejection;
- fail-closed rejection of invented raw `edgeIndex` topology selectors.

No provider, AI SDK tool, message persistence, OpenCode/Codex adapter, UI, evaluator or native sandbox code changed in 3B.

### Verification evidence

Reported from the real local checkout on 2026-09-03:

```text
npm test -- --run tests/brepAiProject.test.ts tests/brepProject.test.ts tests/brepProjectArtifact.test.ts tests/parametricProjectSource.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
git diff --check origin/master...HEAD  PASS (no output)
```

3B is therefore accepted as the shared provider-independent foundation for Phase 3.

## 3C — Native AI tool/source contract

Status: **implemented; local verification pending**.

Decision: keep legacy `build_parametric_model` strictly OpenSCAD and introduce a separate `build_brep_project` tool contract. This avoids changing the meaning of historical OpenSCAD tool parts, recovery helpers, imported artifacts or editor assumptions.

Added/changed:

```text
shared/brepAiTool.ts
shared/chatAi.ts
config/ai/instructions/tool-build-brep-project.md
config/ai/instructions/manifest.json
tests/brepAiTool.test.ts
tests/aiInstructionCatalog.test.ts
```

The BRep tool contract:

- exposes a provider-visible bounded Zod representation of the current canonical `BrepProject` v1 vocabulary;
- accepts complete project snapshots only, never patches;
- is strict at every object boundary so arbitrary Python/build123d/STEP/mesh/runtime fields are rejected rather than silently stripped;
- enumerates only canonical node types and the semantic `parallelToAxis` selector;
- delegates final graph/reference/unit/range/cycle/result validation to `normalizeBrepAiProjectCandidate()` / `normalizeBrepProject()`;
- has a minimal strict success result contract containing only `status` and `message`;
- registers its own instruction surface `tool.build_brep_project` with explicit stable-ID and no-runtime-code rules.

`chatTools` now knows the `build_brep_project` type so future BRep AI messages can be represented by the normal AI SDK message union. Crucially, `src/server/aiChat.ts` has **not** been changed: the active Parametric toolset still includes only legacy `build_parametric_model` plus `answer_user`. Therefore normal OpenSCAD conversations cannot see or call the new BRep tool yet.

Focused tests cover:

- valid complete canonical BRep input;
- raw topology selector rejection;
- rejection of Python/STEP/runtime authority fields;
- canonical invalid-reference/cycle rejection;
- explicit separation between legacy OpenSCAD and BRep tool payloads;
- strict BRep tool-result validation;
- instruction-catalog registration.

### Verification state

The GitHub-connected environment cannot execute the repository Node toolchain, and the isolated container available to ChatGPT has no external DNS access to clone GitHub. Local repository verification is therefore required before 3D.

Recommended checkpoint verification:

```bash
npm test -- --run tests/brepAiTool.test.ts tests/brepAiProject.test.ts tests/aiInstructionCatalog.test.ts tests/brepProject.test.ts tests/brepProjectArtifact.test.ts tests/parametricProjectSource.test.ts
npm run typecheck
npm run lint
git diff --check origin/master...HEAD
```

Do not wire `build_brep_project` into `aiChat`, OpenCode or the client tool lifecycle until this checkpoint is green.

## Decision gates

Stop before broadening implementation if:

- BRep tool integration would require breaking historical OpenSCAD message/tool semantics;
- project-ID continuity or stale-parent anchoring cannot be enforced at the current message-tree boundary;
- a requested topology edit requires selectors outside canonical schema;
- provider/external-agent parity would require arbitrary Python/build123d execution;
- broad database changes appear necessary merely for AI editing.

## Current next action

Verify **3C** locally. Once green, proceed to **3D — Prompting and native provider generation/follow-up context**.

3D is the first phase that changes the live `aiChat` tool selection/context pipeline. Keep it source-kind-aware: OpenSCAD must continue to receive only `build_parametric_model`, while an active BRep project receives `build_brep_project` and its exact current canonical snapshot as follow-up context.
