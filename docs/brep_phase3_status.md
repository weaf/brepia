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

## Phase 3 progress

| Step                                                    | Status                              |
| ------------------------------------------------------- | ----------------------------------- |
| 3A — Architecture reconciliation and contract lock      | **complete**                        |
| 3B — Shared BRep AI snapshot schema and structural diff | **complete and accepted**           |
| 3C — Native AI tool/source contract                     | **complete and accepted**           |
| 3D — Prompting and native-provider follow-up generation | **complete and accepted**           |
| 3E — Immutable AI revision persistence and stale guards | **complete and accepted**           |
| 3F — OpenCode/Codex external-agent parity               | **complete and accepted**           |
| 3G — Product integration / creation UX                  | **in progress; 3G-A accepted**      |
| 3H — Acceptance                                         | later                               |
| 3I — Closeout                                           | later                               |

## 3A — Architecture reconciliation and contract lock

Status: **complete**.

### Current ownership map

| Concern                     | Current implementation                                                                                                       | Phase 3 direction                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Parametric project source   | `shared/parametricProjectSource.ts` discriminates `openscad | brep`; absent discriminator is legacy OpenSCAD                 | Reuse unchanged. AI targets a complete normalized `BrepProject` for BRep.                                                        |
| Canonical BRep schema       | `shared/brepProject.ts` owns versioning, bounds, IDs, parameter units, DAG/reference/cycle validation and semantic selectors | Remains the sole authoring contract. No AI-specific geometry schema.                                                             |
| Persisted BRep artifact     | `shared/brepProjectArtifact.ts` validates `data-brep-project` with `{ title, version, source: { kind: 'brep', source } }`    | Reuse for successful AI revisions; no parallel AI artifact/history model.                                                        |
| BRep lifecycle              | `src/services/brepProjectService.ts` creates immutable assistant revisions and validated restore branches                    | AI edits use the same immutable source model, anchored to the exact source revision used as generation context.                  |
| OpenSCAD AI tool            | `shared/chatAi.ts` `build_parametric_model` remains intentionally OpenSCAD-only                                              | Preserved. Native BRep uses the separate `build_brep_project` tool.                                                              |
| OpenSCAD helpers            | `shared/parametricParts.ts` searches `tool-build_parametric_model` and normalizes OpenSCAD artifacts                         | Kept narrow; BRep does not redefine those helpers.                                                                               |
| Normal AI server            | `src/server/aiChat.ts` owns Parametric instructions/tools, stream lifecycle and persistence                                  | Routes active native BRep branches through the BRep context/tool/persistence path.                                               |
| External structured result  | `src/server/opencodeAgentResult.ts` parses complete structured Parametric results                                             | Source-aware OpenSCAD/BRep parsing is complete after 3F.                                                                         |
| OpenCode/Codex continuation | `src/server/cliAgents.ts` carries complete source snapshots                                                                  | Source-aware OpenSCAD/BRep continuation is complete after 3F.                                                                    |
| Previous/current source     | Phase 2 BRep resolves canonical source from assistant `data-brep-project` revisions                                          | BRep generation anchors identity validation to the nearest active BRep source revision and stale activation to the request leaf. |
| Parameter vs DAG edit       | Phase 2 BRep parameter editing persists complete normalized snapshots                                                        | AI parameter-definition and DAG edits return complete snapshots; no patch source authority.                                      |
| Selector/topology           | v1 supports semantic `parallelToAxis`; canonical tests reject `edgeIndex`                                                    | AI may emit only canonical selector vocabulary; unsupported topology operations fail closed.                                     |
| Runtime                     | accepted rootless Podman build123d/OCCT evaluator and STEP path                                                              | Preserved. AI receives no Python/native execution authority.                                                                     |

### Contract decisions

- Phase 2 supplies the canonical source/persistence representation; no new conversation type or parallel AI history model is introduced.
- Complete BRep snapshots mirror project-native OpenSCAD editing but use `BrepProject`, not source files.
- Standalone schema validity is insufficient for follow-up edits: previous→next identity continuity is also validated.
- Project ID stays stable on ordinary follow-ups; unchanged node/parameter IDs should remain stable; genuinely new objects receive new IDs.
- Obvious whole-graph ID churn is rejected.
- Structural diff is deterministic derived diagnostics, never source authority.
- External-agent integration is downstream of the shared/native contract, not the contract owner.

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

The contract accepts only complete bounded canonical BRep snapshots, rejects runtime/Python/STEP/mesh authority, enumerates only supported topology vocabulary and delegates semantic validation to the canonical normalizer.

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

## 3D — Prompting and native-provider generation/follow-up context

Status: **complete and accepted**.

Implemented:

```text
shared/brepAiContext.ts
src/server/brepAiTurn.ts
src/server/brepAiTools.ts
src/server/aiChat.ts
src/views/BrepProjectView.tsx
config/ai/instructions/context-brep-project.md
config/ai/instructions/tool-build-brep-project.md
tests/brepAiContext.test.ts
tests/brepAiTurn.test.ts
```

### Active behavior

- The active source is the nearest valid assistant `data-brep-project` revision on the selected branch.
- A user/tool-only leaf and the authoritative BRep source revision are intentionally distinct identities.
- The BRep project view follows the parent chain from `current_message_leaf_id` and resolves the nearest valid BRep source rather than requiring the current leaf itself to carry source data.
- Only the resolved canonical active BRep snapshot is injected as BRep source context; historical BRep source parts are not blindly exposed as model authority.
- Active BRep branches use `build_brep_project`; OpenSCAD branches continue to use `build_parametric_model`.
- `build_brep_project` executes server-side and performs only canonical snapshot validation plus previous→next structural diffing. It does not invoke OCCT/build123d.
- BRep `answer_user` is also server-resolved so no browser-side pending-tool lifecycle can overwrite canonical source data.
- A successful `build_brep_project.execute()` records the final validated candidate in request-local server state.
- Final persistence revalidates that accepted candidate against the exact source snapshot used for generation and attaches exactly one canonical `data-brep-project` part.
- UI tool parts remain diagnostics; canonical source persistence no longer depends on AI SDK reconstruction of the final UI-message tool part.
- Earlier build calls remain diagnostics only and never become competing source authority.
- OpenSCAD-specific mesh/import context is not injected into an active BRep turn.
- Creative and legacy OpenSCAD tool ownership remain unchanged.

### Local static verification evidence

Reported from the real local checkout on 2026-09-03 after provider wiring and review hardening:

```text
focused BRep AI tests  PASS
npm run typecheck      PASS
npm run lint           PASS
npm run build          PASS
git diff --check       PASS (no output)
```

### Live normal-provider acceptance evidence

Verified against the real authenticated Brepia deployment and native BRep runtime on 2026-09-03.

Baseline persisted source:

```text
project_id        = phaseOneCabinet
width_default     = 1200
cable_hole_radius = 40
```

First normal-provider follow-up changed only the published Width default from 1200 to 1400 mm while preserving project and existing object identities. The persisted assistant revision contained both the BRep tool result and one canonical source snapshot:

```text
source_parts      = 1
brep_build_parts  = 1
project_id        = phaseOneCabinet
width_default     = 1400
cable_hole_radius = 40
```

The native BRep viewer then evaluated and rendered the revised geometry with Width 1400 after configuring the accepted `PCAD_BREP_RUNNER` runtime.

The second follow-up requested `cableHole.radius` 40 -> 60 while preserving Width 1400 and stable IDs. This uncovered a real persistence regression: two server tool results were persisted as `output-available / success` with the correct candidate and structural diff, but their rows contained no `data-brep-project` source part. The candidate itself was valid:

```text
output_status        = success
candidate_project_id = phaseOneCabinet
candidate_width      = 1400
candidate_radius     = 60
output_message       = 0 nodes added, 0 nodes removed, 1 node changed
```

The regression was hardened in two places:

1. `BrepProjectView` resolves the nearest valid source ancestor so a user/tool-only leaf cannot brick an otherwise valid project branch.
2. Canonical persistence uses the request-local candidate captured directly from successful server tool execution instead of depending on final UI-message tool-part reconstruction.

The same second prompt was then rerun successfully. The active assistant row contained both the diagnostic tool result and canonical source snapshot:

```text
active            = true
source_parts      = 1
brep_build_parts  = 1
project_id        = phaseOneCabinet
width_default     = 1400
cable_hole_radius = 60
```

The BRep project view showed three source revisions and rendered the updated native geometry successfully. The two historical tool-only rows were intentionally retained as regression evidence rather than deleted.

Checkpoint containing the request-local accepted-candidate wiring:

```text
41b80327cfbf29b1667359c5cb1ab73490ef5e4a
Persist validated BRep AI candidates from server execution
```

3D is accepted.

## 3E — Immutable AI revision persistence and stale guards

Status: **complete and accepted**.

Implemented:

```text
src/server/brepAiPersistence.ts
supabase/schemas/brep_ai.sql
supabase/migrations/20260903134810_brep_ai_atomic_revision.sql
shared/database.ts
tests/brepAiPersistence.test.ts
tests/brepAiAtomicSql.test.ts
scripts/brep/test-brep-ai-atomic-race.sh
```

### Atomic activation contract

The existing `public.update_conversation_leaf()` trigger remains unchanged. A BRep AI response is activated through `public.persist_brep_ai_revision(...)`, which:

1. locks the target conversation row with `SELECT ... FOR UPDATE`;
2. verifies `current_message_leaf_id` still equals the request leaf captured at generation start;
3. inserts the immutable assistant revision only when that leaf is still current;
4. allows the existing insert trigger to advance the leaf inside the same transaction;
5. returns a stale result without inserting when a newer branch action already won.

The three identities remain deliberately separate:

- **request leaf ID** — current leaf at generation start; used only for stale activation;
- **source revision message ID** — nearest preceding assistant BRep source; used for previous→next identity validation;
- **response message ID** — new immutable assistant revision carrying the accepted source.

The RPC runs as `SECURITY INVOKER`, explicitly checks `user_id = auth.uid()`, is not executable by `PUBLIC`, and grants execution to `authenticated`.

### Runtime race evidence

Verified against the real local Supabase runtime on 2026-09-03 after applying the generated migration and regenerating `shared/database.ts`:

```text
stale-first ordering
PASS: newer leaf rejects the AI completion without inserting it

AI-lock-first ordering
PASS: AI revision commits atomically and the genuinely later user message wins the leaf

BRep AI atomic persistence race gate PASS
```

Post-migration repository gates were also reported green:

```text
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
git diff --check   PASS (no output)
```

3E is accepted. The race script remains as a regression gate.

## 3F — OpenCode/Codex external-agent parity

Status: **complete and accepted**.

The shared external-agent result contract distinguishes OpenSCAD and BRep explicitly. BRep continuation receives the exact current canonical `BrepProject`, returns a complete snapshot through `build_brep_project`, and never passes through OpenSCAD asset reconciliation/compiler validation/repair semantics. OpenSCAD remains on the existing `build_parametric_model` path.

The CLI adapter preserves OpenCode/Codex resumable session IDs. Streaming OpenCode preserves its conversation-scoped session while using the BRep-specific transport contract.

Static verification before live acceptance was green:

```text
focused 3F-D tests  PASS
npm test            PASS (69 files, 536 tests at the implementation checkpoint)
npm run typecheck   PASS
npm run lint        PASS
npm run build       PASS
git diff --check origin/master...HEAD  PASS
```

Live acceptance found and fixed two real regressions that the static suite had missed:

1. Streaming external BRep turns incorrectly continued after `build_brep_project`, repeatedly re-entering the same OpenCode session. External BRep now treats `build_brep_project` as terminal for that AI SDK turn.
2. The external adapter included an OpenSCAD-era `message` field in strict BRep tool input. BRep tool calls now emit only `title`, `version` and `project`; the emitted input is regression-tested against the real `brepAiBuildInputSchema`.

Accepted live Streaming edit:

```text
cableHole.radius = 60 -> 75
active            = true
source_parts      = 1
brep_build_parts  = 1
tool_state        = output-available
output_status     = success
```

Accepted live OpenCode CLI edit:

```text
cableHole.radius = 75 -> 85
active            = true
source_parts      = 1
brep_build_parts  = 1
tool_state        = output-available
output_status     = success
```

The active radius-85 revision was refreshed/reopened and confirmed to evaluate/render correctly in the native BRep viewer without a new browser/server error.

A separate live Codex CLI run is not required for 3F acceptance because Codex and OpenCode CLI share the same source-aware BRep prompt/result path, while focused tests cover Codex routing and resumable-session syntax.

Detailed evidence: `docs/brep_phase3_3f_live_checkpoint.md`.

3F is accepted.

## 3G — Product integration / creation UX

Status: **in progress; 3G-A complete and accepted**.

### 3G-A — Existing BRep project AI follow-up integration

The persisted native BRep project route now exposes the existing conversation lifecycle directly alongside the native BRep viewer.

Implemented/hardened in:

```text
src/components/brep/BrepChatSession.tsx
src/views/BrepProjectView.tsx
shared/brepAiContext.ts
tests/brepProductChat.test.ts
tests/brepAiContextLeafSync.test.ts
```

Product/runtime contract:

- `/brep/$id` reuses the existing Parametric conversation/message tree, model selection, OpenCode CLI/Streaming selection, retry/edit/restore/branch behavior and native BRep source lifecycle.
- BRep chat uses the shared `parametric-chat` server endpoint and server-executed `build_brep_project`; it does not run the OpenSCAD browser compiler, call `addToolOutput`, or auto-continue a BRep build in the client.
- OpenSCAD-only mesh/STL context is rejected from the BRep product chat. Text and image context remain available.
- `/editor/$id` and `/brep/$id` have separate cached AI-SDK chat identities (`$id` vs `brep:$id`) because their client-tool semantics differ.
- BRep submit has a synchronous in-flight guard so duplicate UI submission cannot race the same CAS-anchored source revision before AI-SDK status updates.
- The BRep source resolver treats a selected leaf missing from a temporarily stale message snapshot as unresolved/reconciling, while still failing closed for a genuinely broken parent chain.
- The BRep product view no longer moves `current_message_leaf_id` optimistically for newly sent user messages or streamed assistant completion. Persisted server state remains authoritative for leaf movement.
- A transient conversation/messages cache mismatch displays synchronization/loading state rather than the false error `The active project branch has no valid BRep source snapshot.`
- Parameter controls remain wired to immutable native BRep parameter revisions on the active canonical source.

Live browser acceptance on 2026-09-04 exposed and fixed three real product-integration regressions:

1. `/brep/$id` could crash with `Native BRep message branch is missing <leaf>` when the conversation cache was newer than the message snapshot.
2. A shared `/editor`/`/brep` chat cache plus the small pre-`submitted` UI window could start duplicate BRep turns; the atomic persistence correctly rejected the loser as stale.
3. Optimistic client leaf movement could briefly render the false `no valid BRep source snapshot` product error even though the AI run and persisted source were healthy.

After the final synchronization fix the user reported the focused regression gate and live `/brep/$id` follow-up flow green. The AI edit completed through the canonical BRep tool/persistence path and the native BRep view continued to render correctly without the transient false source error.

Checkpoint before status closeout:

```text
9708f7ced0202f64de466ab04e093b0eca0f4e2c
Cover BRep leaf synchronization UX
```

3G-A is accepted.

### Remaining 3G work

Next is **3G-B — explicit AI BRep creation routing**.

The current server selects BRep tools only after a valid active BRep source already exists. A new AI-created BRep project therefore needs explicit product/source intent for the first turn rather than prompt heuristics or a new conversation type.

Preferred direction:

- keep `conversation.type = 'parametric'`;
- store an explicit BRep creation/source intent in ordinary conversation settings or an equally narrow existing routing field;
- let the first user turn route to `build_brep_project` even though there is no previous BRep source;
- validate the initial returned project as canonical BRep creation rather than follow-up identity validation;
- persist the first canonical `data-brep-project` source revision through the existing conversation tree;
- once a source exists, source-derived routing becomes authoritative again;
- preserve ordinary OpenSCAD creation behavior unchanged.

3G-C remains product feedback/summary polish required by the 3G acceptance contract; do not start Phase 4 graph UX.

## Current next action

Continue with **3G-B — explicit AI BRep creation routing**, beginning with reconciliation of first-turn server routing, creation validation/persistence, product entry UX and OpenSCAD compatibility before implementation.

Do not mix unrelated product defects into 3G. Broad cross-cutting defects discovered while operating Brepia should be fixed on their own focused branch/checkpoint when practical.

Do not start Phase 4 graph UX, Rhino/3DM/GH interoperability or generic STEP reconstruction as part of 3G.
