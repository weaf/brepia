# BRep Phase 2 status

## Status

Phase 2 — Native BRep project lifecycle — is active on:

```text
feature/brep-project-lifecycle
```

Base:

```text
3d0adc8e3b0507da81fbe095946cc05c947a7e91
Merge pull request #19 from weaf/feature/brep-kernel-foundation
Phase 1: BRep kernel foundation
```

Active execution contract:

```text
docs/brep_phase2_execution.md
```

Roadmap:

```text
docs/brep_kernel_plan.md
```

Phase 1 execution/status documents are now historical evidence and must not drive the active Phase 2 sequence.

## Phase 1 inherited foundation

Verified and merged before this phase:

- versioned kernel-neutral `BrepProject` contract;
- stable project/feature/published-parameter IDs;
- placement-plane and metadata semantics designed for future Grasshopper mapping;
- constrained build123d/OCCT evaluator;
- rootless, networkless, read-only native Podman sandbox;
- bounded/authenticated native BRep evaluation API;
- tessellated Three.js viewer result;
- direct authenticated exact STEP export;
- independent native STEP inspection preserving analytic cylindrical geometry;
- Phase 1 browser acceptance and OpenSCAD regression acceptance;
- GPU geometry replacement cleanup;
- PR #19 / Quality Gate #351 PASS before merge.

## 2A — Lifecycle architecture reconciliation

Status: **complete**.

This checkpoint reconciled the current conversation/workspace implementation against the Phase 2 BRep lifecycle requirements. No source implementation was changed as part of 2A; this is an architecture/ownership checkpoint.

### Current ownership map

| Concern                        | Current owner                                                                                                             | Phase 2 BRep integration                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product conversation mode      | `conversations.type` and conversation services distinguish `parametric` from `creative`                                   | Keep BRep inside the existing `parametric` mode. Do not add a `brep` conversation enum value unless implementation later proves this impossible.                                        |
| Active branch/revision pointer | `conversations.current_message_leaf_id`                                                                                   | Reuse unchanged. BRep does not need a parallel revision pointer.                                                                                                                        |
| Revision/branch lineage        | immutable message tree through `messages.parent_message_id` plus current leaf                                             | Reuse for BRep restore/retry/branch semantics. A BRep snapshot on a message path is revision evidence in the same way the current parametric source artifact is.                        |
| Parametric editable source     | assistant/workspace artifact payloads currently carry the complete normalized OpenSCAD project (`build_parametric_model`) | Introduce a source-kind discriminator/envelope at the parametric source-artifact boundary so a normalized `BrepProject` can be persisted beside legacy OpenSCAD source.                 |
| OpenSCAD normalization         | shared chat/tool schemas and conversation workspace model helpers                                                         | Preserve legacy behavior. Existing parametric artifacts without a new source discriminator must continue to normalize as OpenSCAD.                                                      |
| BRep canonical source          | Phase 1 `shared/brepProject.ts`                                                                                           | Persist normalized/versioned `BrepProject` JSON only. Never persist build123d/OCP objects, tessellation, STEP data or process/runtime state as authoritative source.                    |
| Parameter editing              | editor state updates the editable source snapshot and persistence path; rendered geometry is derived                      | BRep parameter edits must update/persist source-level parameter state through the same lifecycle boundary, then reevaluate derived geometry. Stable parameter IDs remain authoritative. |
| Runtime/viewer result          | OpenSCAD/BRep evaluators and viewer paths                                                                                 | Treat BRep evaluation result, tessellation, bounds and STEP as derived/cacheable outputs. They are not revision source-of-truth.                                                        |
| Editor/project loading         | parametric conversation/editor workspace resolves current source artifact and renders the appropriate editor/viewer       | Dispatch by parametric source kind. OpenSCAD and BRep should share conversation/history infrastructure while retaining separate source editors/runtimes.                                |
| Source import                  | existing parametric import creates a normalized imported baseline/artifact rather than bypassing workspace history        | Canonical BRep JSON import should create an imported normalized BRep source snapshot/baseline and then participate normally in revisions/history.                                       |
| Source export                  | conversation workspace source export is distinct from native derived export                                               | Add canonical BRep source JSON export. Native STEP remains a geometry export only and must never be promoted into editable BRep history.                                                |
| AI generation/editing          | `shared/chatAi.ts` and current `build_parametric_model` tool contract are OpenSCAD-oriented                               | Do not broaden AI-native BRep generation/editing in Phase 2. That is Phase 3. Phase 2 should create a source contract that Phase 3 can target later.                                    |

### Canonical Phase 2 source direction

The integration seam should be a small, kernel-neutral, discriminated parametric source contract rather than a new conversation type or a second persistence system. The exact TypeScript shape is a 2B implementation detail, but the intended semantics are equivalent to:

```text
ParametricProjectSource
  kind: openscad | brep
  source: normalized OpenScadProject | normalized BrepProject
  source/version identity as required
  persisted parameter/source state
```

Important compatibility rule:

```text
legacy parametric artifact without source-kind discriminator
    -> normalize as OpenSCAD
```

This avoids rewriting existing conversations or requiring a destructive migration simply to introduce BRep projects.

### Database decision

The first Phase 2 implementation should target **zero database migration**.

The current conversation/message model already provides:

- parametric vs Creative conversation classification;
- immutable message/artifact payload storage;
- parent-message branch lineage;
- current-leaf selection.

A source discriminator and normalized BRep snapshot can therefore live at the existing JSON artifact/source boundary. If 2B discovers a concrete requirement that cannot be represented safely there, stop and document it before introducing a migration. Do not add a database enum/value merely for BRep project type selection.

### Revision and restore semantics

BRep must not invent another revision system.

The intended lifecycle is:

```text
normalized BRep source snapshot
        |
        v
message/artifact on existing conversation tree
        |
        +--> later parameter/source revision
        |
        +--> restore historical snapshot
        |
        +--> retry/branch from historical parent
        v
current_message_leaf_id selects active path
```

Historical source snapshots remain immutable evidence. Restore/retry/branch operations should reuse the generic conversation lifecycle and preserve stable BRep project/feature/parameter IDs whenever the source itself has not semantically replaced those objects.

### Import/export semantics

Phase 2 must maintain a strict distinction:

```text
canonical BRep project JSON = editable source
STEP                        = derived exact geometry
viewer mesh                 = derived rendering data
```

A canonical BRep import is allowed to establish a new imported baseline snapshot after schema validation/normalization. STEP import must not synthesize parametric history or pretend to reconstruct the `BrepProject` DAG.

The concrete file extension/package name for canonical BRep source can be finalized in 2F; the data contract must remain versioned and self-contained regardless of naming.

### Grasshopper roadmap invariants preserved by Phase 2

Although Grasshopper work remains deferred, Phase 2 persistence must not lose or re-key:

- stable published parameter IDs;
- parameter units/defaults/ranges;
- project and feature IDs;
- placement plane/orientation semantics;
- project metadata/classification;
- source/model version identity.

These are future inputs to the smart Grasshopper object/`.gh` contract.

### Primary implementation seams for 2B–2F

The current reconciliation identified these as the main surfaces to inspect/change narrowly rather than broadly rewriting the app:

- `shared/brepProject.ts` — canonical BRep source schema;
- a new or existing shared parametric-source envelope near the workspace boundary;
- `src/server/conversationWorkspaceModels.ts` — source artifact resolution/normalization;
- `src/services/messageService.ts` — generic message-tree persistence, expected mostly unchanged;
- `src/server/conversationWorkspaceLifecycle.ts` — restore/retry/branch integration, expected to be reused;
- `src/views/EditorView.tsx` and related parametric editor loading — source-kind dispatch;
- current parameter persistence/update path — add BRep source persistence without storing runtime results;
- `src/server/conversationWorkspaceExportRequest.ts` and related import/export services — canonical source import/export;
- `src/services/conversationService.ts` / `supabase/schemas/conversations.sql` — compatibility boundary; avoid schema changes unless proven necessary;
- `shared/chatAi.ts` — preserve existing OpenSCAD AI behavior in Phase 2; BRep AI work belongs to Phase 3.

## 2B — Project type + persisted BRep source contract

Status: **complete**.

The shared source boundary is now `shared/parametricProjectSource.ts`:

```text
legacy OpenSCAD project JSON
  -> { kind: 'openscad', source: normalized OpenScadProject }

{ kind: 'brep', source: BrepProject }
  -> normalized/versioned BrepProject
```

The raw legacy representation deliberately has no inferred filename/content
discriminator: an absent `kind` is the explicit backward-compatible OpenSCAD
case. New source envelopes are validated at the shared parametric source
schema boundary. Invalid/unsupported BRep payloads fail explicitly through the
Phase 1 `normalizeBrepProject` contract; no evaluator, mesh, bounds or STEP
payload is accepted as source authority.

`ParametricArtifact` and the existing `build_parametric_model` UI behavior
remain OpenSCAD-oriented for now. This preserves the Phase 2 non-goal of
AI-native BRep editing while allowing 2C to add BRep creation/loading at the
same persisted source boundary rather than inventing a BRep conversation type.

No database migration was added. Conversations remain `parametric` or
`creative`; BRep is represented only in the versioned parametric source JSON.

Focused evidence:

- `npm test -- --run tests/parametricProjectSource.test.ts tests/importedArtifact.test.ts` — PASS (13 tests);
- `npm run typecheck` — PASS.

The focused compatibility tests prove legacy OpenSCAD normalization, deterministic
JSON round-trip of normalized BRep source, stable project placement/metadata and
published-parameter IDs, and explicit rejection of unsupported BRep versions.

## 2C — Create/open/project selection lifecycle

Status: **complete**.

`/brep` is now a template/creation surface rather than the Phase 1 singleton:
**Create BRep project** creates an ordinary `parametric` conversation and a
two-message immutable baseline. The active assistant leaf stores one
`data-brep-project` payload containing only:

```text
title, version, { kind: 'brep', source: normalized BrepProject }
```

The creation service explicitly sets `current_message_leaf_id` to that
assistant leaf, matching the existing imported-OpenSCAD lifecycle. `/brep/$id`
loads the authenticated conversation's active leaf and validates the BRep
artifact before rendering it. It never substitutes the Phase 1 sample when a
persisted source is absent or malformed. OpenSCAD and Creative routes remain
unchanged, and no conversation enum or database migration was added.

Focused evidence:

- `npm test -- --run tests/brepProjectArtifact.test.ts tests/parametricProjectSource.test.ts tests/brepProject.test.ts` — PASS (17 tests);
- `npm run typecheck` — PASS;
- `npm run lint` — PASS;
- `npm run build` — PASS.

## Current constraints

- Preserve OpenSCAD and Creative behavior.
- Persist normalized/versioned `BrepProject`, not build123d/OCCT objects.
- Stable IDs remain architectural invariants for later Grasshopper export.
- No AI-native BRep editing in Phase 2.
- No graph editor in Phase 2.
- No Rhino/rhino3dm/Grasshopper integration in Phase 2.
- No arbitrary user Python.
- No destructive database reset/migration as a shortcut.
- Native runtime remains sandboxed outside Nitro.
- STEP remains geometry export and must not be treated as editable parametric project import.

## Shared checkpoint workflow

For every verified logical checkpoint:

```text
focused verification
  -> update this status file
  -> commit
  -> push origin feature/brep-project-lifecycle
  -> continue
```

Do not represent local failing/incomplete work as shared PASS.

## Browser acceptance

A local development account may be used for browser acceptance, but credentials must never be committed, documented here, logged intentionally, or placed in tracked files.

Phase 2 browser acceptance is defined in `docs/brep_phase2_execution.md` and must cover create/open/edit/persist/reopen/revision/restore/branch/import/export/native STEP plus an OpenSCAD regression check.

## 2A verification note

2A changed documentation only. The architecture findings were reconciled against current source on the merged Phase 1 baseline and the Phase 2 branch before this checkpoint. No runtime/test PASS is claimed for source behavior that was not changed by this documentation checkpoint.

## Next checkpoint

Implement and verify 2D — published-parameter editing and revisions — through
the persisted BRep source and existing message-tree lifecycle.
