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
| BRep lifecycle | `src/services/brepProjectService.ts` creates immutable assistant revisions and validated restore branches | AI edits must use the same immutable source model, anchored to the exact source revision used as generation context. |
| OpenSCAD AI tool | `shared/chatAi.ts` `build_parametric_model` remains intentionally OpenSCAD-only | Preserve historical/current semantics. Native BRep uses a separate tool. |
| OpenSCAD helpers | `shared/parametricParts.ts` searches `tool-build_parametric_model` and normalizes OpenSCAD artifacts | Keep narrow; do not silently change helper meaning for BRep. |
| Normal AI server | `src/server/aiChat.ts` owns Parametric instructions/tools, stream lifecycle and tool/message persistence | Add source-kind-aware context/tool selection without regressing OpenSCAD/Creative. |
| External structured result | `src/server/opencodeAgentResult.ts` currently parses OpenSCAD `{ project, message }` only | Extend later in 3F after native provider path is stable. |
| OpenCode/Codex continuation | `src/server/cliAgents.ts` serializes latest complete OpenSCAD tool artifact | Extend later in 3F; OpenSCAD asset reconciliation remains OpenSCAD-only. |
| Previous/current source | Phase 2 BRep resolves canonical source from assistant `data-brep-project` revisions | BRep generation anchors identity validation to the nearest active BRep source revision and stale activation to the request leaf. |
| Parameter vs DAG edit | Phase 2 BRep parameter editing persists complete normalized snapshots | AI parameter-definition and DAG edits both return complete snapshots; no patch source authority. |
| Selector/topology | v1 supports semantic `parallelToAxis`; canonical tests reject `edgeIndex` | AI may emit only canonical selector vocabulary; unsupported topology operations fail closed. |
| Runtime | accepted rootless Podman build123d/OCCT evaluator and STEP path | Preserve exactly. AI receives no Python/native execution authority. |

### Contract decisions

- Phase 2 supplies the canonical source/persistence representation; no new conversation type or parallel AI history model is needed.
- Complete BRep snapshots mirror project-native OpenSCAD editing but use `BrepProject`, not source files.
- Standalone schema validity is insufficient for follow-up edits: previous→next identity continuity is also validated.
- Project ID stays stable on ordinary follow-ups; unchanged node/parameter IDs should remain stable; genuinely new objects receive new IDs.
- Obvious whole-graph ID churn is rejected.
- Structural diff is deterministic derived diagnostics, never source authority.
- External-agent integration is downstream of the shared/native contract, not the contract owner.

### Primary regression risks

- polymorphizing `build_parametric_model` and breaking historical OpenSCAD semantics;
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

The contract provides canonical normalization, deterministic project/parameter/node diffing and follow-up identity validation.

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

The contract accepts only complete bounded canonical BRep snapshots, rejects runtime/Python/STEP/mesh authority, enumerates only supported topology vocabulary and delegates semantic validation to the canonical normalizer. `chatTools` knows the new type, but live `aiChat` routing is unchanged.

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

Status: **source/context foundation complete and locally verified; live normal-provider wiring remains**.

Reconciliation findings:

- `loadBranchFromDb()` already loads the exact current message-tree path selected by `current_message_leaf_id`.
- A follow-up user message may be the current leaf while the authoritative BRep source is the nearest preceding assistant `data-brep-project` revision. Request-leaf identity and source-revision identity are distinct.
- `convertToModelMessages()` must not blindly expose every historical `data-brep-project`; the normal provider should receive only the resolved active canonical source snapshot.
- `parametricTools()` and forced tool-choice logic are currently hard-coded to `build_parametric_model`.
- OpenSCAD authoritative asset collection remains OpenSCAD-only.
- Existing Phase 2 BRep conversations already have unambiguous native source identity. AI creation routing belongs in 3G, not in provider heuristics.

### Verified separable 3D foundation

Added/changed:

```text
shared/brepAiContext.ts
config/ai/instructions/context-brep-project.md
config/ai/instructions/manifest.json
tests/brepAiContext.test.ts
tests/aiInstructionCatalog.test.ts
```

The helper:

- resolves the nearest BRep source revision on the active branch;
- resolves a preceding assistant source when the request leaf is a user follow-up;
- retains exact source message ID server-side;
- fails closed on a malformed nearest BRep marker;
- rejects BRep source markers on non-assistant messages;
- serializes only normalized canonical `BrepProject` JSON for model context.

### Verification evidence

Reported from the real local checkout on 2026-09-03:

```text
npm test -- --run tests/brepAiContext.test.ts tests/brepAiTool.test.ts tests/brepAiProject.test.ts tests/aiInstructionCatalog.test.ts tests/brepProjectArtifact.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
git diff --check origin/master...HEAD  PASS (no output)
```

The separable 3D checkpoint is accepted.

## 3E stale-activation decision gate discovered during handover review

Before live provider wiring, reconcile the database leaf trigger:

```text
public.update_conversation_leaf()
AFTER INSERT ON public.messages
-> unconditionally sets conversations.current_message_leaf_id = NEW.id
```

This means a naive application-level sequence of `INSERT message` followed by `UPDATE ... WHERE current_message_leaf_id = expected` is **not an atomic stale guard**: the insert trigger has already advanced the leaf.

For 3E, do not rely on post-insert CAS alone. The recommended minimal design is a focused transactional database function/RPC that:

1. locks the target conversation row (`SELECT ... FOR UPDATE`);
2. verifies `current_message_leaf_id` still equals the request leaf captured at generation start;
3. only then inserts the accepted BRep assistant/source revision in that same transaction;
4. lets the existing insert trigger advance the leaf to the new message while the row lock is held;
5. returns a clear accepted/stale result without inserting when the expected leaf no longer matches.

This preserves existing global trigger behavior and avoids a broad trigger rewrite. Reconcile RLS/function conventions and test the race against the real local Supabase runtime before accepting 3E.

Important identities for the implementation:

- **request leaf ID** — `current_message_leaf_id` at generation start; stale/activation guard compares against this;
- **source revision message ID** — nearest preceding assistant `data-brep-project`; previous→next identity validation uses this project;
- **response message ID** — new immutable assistant revision that carries the accepted BRep source.

Do not conflate these IDs.

## Current next action

Proceed with one coherent implementation packet covering only:

- remaining **3D normal-provider BRep routing/context/tool choice**, and
- core **3E validation + immutable source revision + atomic stale activation**.

Do not start 3F external-agent parity, 3G product creation/UI, Phase 4 graph UX or later interoperability work yet. Use `docs/brep_phase3_codex_handover.md` as the focused implementation handover.