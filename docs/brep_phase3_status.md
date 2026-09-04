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

| Step                                                    | Status                    |
| ------------------------------------------------------- | ------------------------- |
| 3A — Architecture reconciliation and contract lock      | **complete and accepted** |
| 3B — Shared BRep AI snapshot schema and structural diff | **complete and accepted** |
| 3C — Native AI tool/source contract                     | **complete and accepted** |
| 3D — Prompting and native-provider follow-up generation | **complete and accepted** |
| 3E — Immutable AI revision persistence and stale guards | **complete and accepted** |
| 3F — OpenCode/Codex external-agent parity               | **complete and accepted** |
| 3G — Product integration / creation UX                  | **complete and accepted** |
| 3H — Browser/runtime and regression acceptance          | **active**                |
| 3I — Closeout                                           | later                     |

## Current architecture lock

Phase 3 continues to preserve the Phase 2 lifecycle and native runtime boundaries:

- `conversation.type` remains `parametric`; there is no separate BRep conversation type.
- `shared/brepProject.ts` remains the canonical authoring schema.
- persisted native source revisions remain assistant `data-brep-project` snapshots.
- `build_parametric_model` remains OpenSCAD-only.
- native BRep uses the separate `build_brep_project` contract.
- AI returns complete canonical BRep snapshots, never patches as source authority.
- ordinary follow-up validation preserves project identity and stable unchanged object IDs.
- native BRep AI output cannot introduce arbitrary Python/build123d execution, raw STEP, viewer mesh authority or raw topology indices.
- the accepted rootless Podman build123d/OCCT evaluator and native STEP path remain authoritative for derived geometry/export.
- immutable source history, restore/branch and stale-leaf behavior share the existing Parametric conversation tree rather than introducing an AI-specific history model.

## 3A — Architecture reconciliation and contract lock

Status: **complete and accepted**.

The ownership map and Phase 3 contract were reconciled against Phase 2 before implementation. The key decision was to reuse the canonical `BrepProject`, existing message tree and native lifecycle rather than introducing provider/runtime-specific BRep representations.

## 3B — Shared BRep AI snapshot schema and structural diff

Status: **complete and accepted**.

Implemented primarily in:

```text
shared/brepAiProject.ts
tests/brepAiProject.test.ts
```

The shared contract provides:

- canonical creation normalization;
- separate follow-up identity validation;
- deterministic project/parameter/node structural diffing;
- fail-closed selector/reference/DAG validation through the canonical normalizer.

Reported focused/typecheck/lint gates were green during acceptance.

## 3C — Native AI tool/source contract

Status: **complete and accepted**.

Native BRep uses `build_brep_project`; legacy OpenSCAD `build_parametric_model` semantics remain unchanged.

The BRep tool contract accepts only complete bounded canonical BRep snapshots and excludes runtime/Python/STEP/mesh authority.

Reported focused/typecheck/lint/build/diff gates were green during acceptance.

## 3D — Prompting and normal-provider follow-up

Status: **complete and accepted**.

Accepted behavior includes:

- nearest valid canonical BRep source resolution on the active branch;
- exact current BRep snapshot injection for follow-up context;
- server-side `build_brep_project` execution and validation;
- request-local accepted-candidate capture;
- exactly one canonical `data-brep-project` source on successful persistence;
- structural diff as diagnostics rather than source authority;
- OpenSCAD-only mesh/import context excluded from BRep turns.

Live normal-provider acceptance changed real BRep parameter/DAG state, persisted canonical sources and rendered the accepted native geometry.

A live-found persistence regression where successful tool results could lack `data-brep-project` was fixed by persisting the request-local validated candidate directly and by resolving the nearest valid source ancestor in the product view.

Key checkpoint:

```text
41b80327cfbf29b1667359c5cb1ab73490ef5e4a
Persist validated BRep AI candidates from server execution
```

## 3E — Immutable AI revision persistence and stale guards

Status: **complete and accepted**.

Implemented around:

```text
src/server/brepAiPersistence.ts
supabase/schemas/brep_ai.sql
supabase/migrations/20260903134810_brep_ai_atomic_revision.sql
scripts/brep/test-brep-ai-atomic-race.sh
```

`public.persist_brep_ai_revision(...)` locks the conversation, checks the expected current request leaf, inserts the immutable assistant/source revision only if still current and otherwise returns stale without inserting.

Both stale-first and AI-lock-first runtime race orderings were accepted against the real local Supabase runtime.

## 3F — OpenCode/Codex external-agent parity

Status: **complete and accepted**.

External-agent routing is source-aware:

- OpenSCAD continues through the existing project/source path;
- BRep receives the complete current canonical `BrepProject`;
- BRep output is validated through the same native snapshot contract;
- OpenSCAD asset reconciliation remains OpenSCAD-only;
- resumable OpenCode/Codex session continuity is preserved.

Live acceptance covered Streaming OpenCode and OpenCode CLI BRep edits. It also found and fixed:

1. external BRep streaming continuing after terminal `build_brep_project`;
2. an OpenSCAD-era extra `message` field in strict BRep tool input.

Detailed evidence:

```text
docs/brep_phase3_3f_live_checkpoint.md
```

## 3G — Product integration / creation UX

Status: **complete and accepted**.

Detailed live evidence:

```text
docs/brep_phase3_3g_live_checkpoint.md
```

Accepted implementation checkpoint before the 3G evidence commit:

```text
4522865f55bdd8bbf720ff79c67c1fedb149f0d7
Cover Parametric-style BRep sidebar chrome
```

3G evidence commit:

```text
75074fc60e46bd7ffe4fa5f6c88aa8661c2d6da9
Record Phase 3G product acceptance
```

### 3G-A — existing BRep follow-up product integration

Accepted protections include:

- `/brep/$id` reuses the existing Parametric conversation lifecycle;
- BRep-specific cached chat identity `brep:<conversation-id>` is isolated from `/editor`;
- duplicate-submit guard prevents two UI turns racing the same source;
- server state remains authoritative for `current_message_leaf_id`;
- temporary conversation/message cache mismatches show synchronization state instead of false no-source errors;
- BRep uses the shared `parametric-chat` endpoint with server-executed `build_brep_project`;
- OpenSCAD browser compiler and mesh-only context stay OpenSCAD-only.

3G-A was live accepted after fixing cache/leaf synchronization regressions.

### 3G-B — explicit AI BRep creation routing

Accepted first-turn behavior:

```text
conversation.type = 'parametric'
explicit persisted BRep source intent
-> first user turn
-> build_brep_project with no previous BRep source
-> canonical creation validation
-> atomic assistant + data-brep-project persistence
-> /brep/$id native product view
```

The first result is validated as standalone canonical creation; no sample/previous project is fabricated solely to reuse follow-up identity validation.

Once the first canonical BRep source exists, source-derived routing is authoritative again.

Ordinary OpenSCAD creation remains unchanged and continues to select `build_parametric_model`.

### 3G-C — product polish and shared Parametric-style workspace

The accepted native BRep workspace now uses the shared `ConversationView` interaction model:

- desktop resizable/collapsible Chat | Preview | Parameters;
- mobile/tablet chat-first layout with shared model/parameter bottom sheet;
- explicit Model action to reopen the mobile sheet;
- Parametric-style right-panel typography/spacing;
- `Project files` with canonical `project.brep.json` source inspection;
- local live parameter preview with explicit **Save parameter revision**;
- focus changes do not create revisions;
- native evaluation is debounced/serialized so rapid parameter interaction does not compete for the accepted one-slot evaluator;
- lifecycle-only source revisions stay in the authoritative tree but are hidden from visible AI chat;
- compact latest-first revision history with internal scrolling;
- select/restore revision;
- safe Delete revision product tombstones while immutable ancestry is retained internally;
- sticky Parametric-style export control;
- native STEP and canonical BRep JSON/package export.

Live browser acceptance on 2026-09-04 reported all agreed desktop/mobile checks green, including revision cleanup persistence, post-cleanup AI follow-up and native STEP export.

## 3H — Browser/runtime and regression acceptance

Status: **active**.

Minimum acceptance from `docs/brep_phase3_execution.md`:

1. create a BRep project through AI;
2. make a parameter-definition/default follow-up edit;
3. make a feature-DAG follow-up edit adding or modifying a feature;
4. verify unchanged project/node/parameter IDs remain stable;
5. inspect structural diff/summary;
6. refresh/reopen and verify persisted source;
7. restore an earlier revision, branch with another AI edit and verify lineage;
8. trigger an overlapping/stale edit scenario and verify newer active state wins;
9. export native STEP from the AI-edited persisted state and independently inspect it;
10. run an OpenSCAD AI creation and multi-file follow-up through normal provider/OpenCode paths;
11. inspect browser console/network for new errors.

Some individual behaviors were already exercised during 3D/3F/3G, but 3H remains the deliberate cross-layer acceptance pass. Reuse prior evidence only where it proves the identical criterion; do not silently waive missing acceptance items.

## Separate Parametric/OpenSCAD request

A separate requested feature is to make the OpenSCAD project entrypoint (`main.scad`) directly editable from `ProjectFilesEditor`, not only support modules.

The current Parametric implementation deliberately keeps the entrypoint read-only in both `ProjectFilesEditor.tsx` and `EditorView.tsx`.

This feature is feasible but is outside BRep Phase 3H. Handle it as a focused Parametric workspace change after the Phase 3 boundary is coherent, unless explicitly reprioritized.

When implemented, preserve:

- whole-project snapshot integrity;
- support files/assets/`entrypointPath`;
- parameter-write serialization;
- `metadata.originalCode` parameter-default semantics;
- active preview refresh and parameter reparse;
- AI-streaming write exclusion.

## Current next action

Continue only with **3H — browser/runtime and regression acceptance** using `docs/brep_phase3_codex_handover.md` as the active handover.

Do not start Phase 4 graph UX, Rhino/3DM/GH interoperability or generic STEP reconstruction as part of 3H.