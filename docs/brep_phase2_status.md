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

## Active step

```text
2A — Lifecycle architecture reconciliation
```

Before implementing persistence changes, reconcile the existing shared project/conversation lifecycle against native BRep requirements.

Required initial investigation:

- how project/model types are represented and persisted today;
- conversation/message artifact persistence;
- revision/history ownership;
- restore/retry/branch semantics;
- editor route/project loading;
- parameter persistence/update path;
- current project import/export format;
- assumptions specific to OpenSCAD and Creative workflows.

Record the actual integration surfaces and the chosen canonical persisted BRep representation here before broad implementation.

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

## Next checkpoint

Complete 2A analysis and push a documentation/architecture checkpoint before broad persistence implementation if material lifecycle ambiguities are found. If the current architecture maps cleanly, implementation may begin immediately after recording the reconciled ownership and contracts here.
