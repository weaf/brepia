# BRep Phase 2 execution contract

## Purpose

This document is the active execution contract for Phase 2 of `docs/brep_kernel_plan.md`.

Phase 1 — BRep kernel foundation — is complete and merged to `master` through PR #19 at merge commit:

```text
3d0adc8e3b0507da81fbe095946cc05c947a7e91
```

Phase 2 turns the proven native BRep vertical slice into a first-class Brepia project lifecycle without starting AI-native editing, the graph editor, Rhino interoperability, or Grasshopper export.

## Final roadmap target

All Phase 2 decisions must preserve the later roadmap target:

```text
Brepia Parametric Model
        |
        v
smart Grasshopper parametric object/component
        |
        v
generated/usable .gh workflow
        |
        v
Rhino / Grasshopper project model
```

Stable project, feature and published-parameter identities; placement semantics; metadata; and deterministic revisions therefore remain architectural invariants.

## Authority

Use this order when reconciling ambiguity:

1. current implementation on the Phase 2 branch;
2. `AGENTS.md`;
3. `docs/brep_kernel_plan.md`;
4. this execution contract;
5. `docs/brep_phase2_status.md`.

`docs/brep_kernel_execution.md` and `docs/brep_kernel_status.md` are Phase 1 evidence after the merge and must not be treated as the active execution sequence.

## Phase 2 objective

A user must be able to create/open a native BRep project as a real Brepia project, edit its published parameters, persist and restore it across sessions and conversation lifecycle operations, use revision/history behavior correctly, and import/export its canonical project representation without regressing OpenSCAD or Creative projects.

The dedicated Phase 1 `/brep` sample route may remain as a diagnostic surface temporarily, but Phase 2 is not complete while native BRep exists only as that sample route.

## Explicit Phase 2 non-goals

Do not implement in this phase:

- AI generation/editing of `BrepProject` snapshots — Phase 3;
- feature/node graph editor — Phase 4;
- Rhino/rhino3dm/project-object interoperability — Phase 5;
- Grasshopper schemas/components/`.gh` export — Phases 6–8;
- arbitrary user Python/build123d execution;
- STEP-to-parametric-BrepProject reconstruction;
- replacement of OpenSCAD, Creative or their existing project/runtime paths;
- browser-authoritative OCCT.

## Shared working rules

- Work only on `feature/brep-project-lifecycle`.
- Reconcile actual implementation before each material step.
- Preserve the accepted rootless/networkless/read-only BRep sandbox boundary.
- Persist canonical kernel-neutral `BrepProject` snapshots, never build123d/OCCT runtime objects.
- Preserve stable IDs on normal edits/revisions.
- Do not silently reinterpret invalid or obsolete topology selectors.
- Keep native STEP export separate from canonical parametric project export.
- Prefer forward-compatible discriminated project/artifact types over BRep-specific conditionals spread throughout the app.
- Add focused tests with each lifecycle contract change.
- Use small forward commits. Never amend/rebase/squash already pushed shared history.
- Every verified logical checkpoint must be committed and pushed to `origin/feature/brep-project-lifecycle` before materially continuing.
- Update `docs/brep_phase2_status.md` at verified checkpoints.
- Focused tests first; full gates at meaningful checkpoints and closeout.
- Use one Codex implementation thread unless a truly separable review task warrants another agent.

## Phase 2 execution sequence

### 2A — Lifecycle architecture reconciliation

Before implementation, map the current project/conversation persistence path and identify the minimum shared contracts that must understand native BRep.

Inspect at least:

- current project/model discriminators;
- conversation/message artifact persistence;
- revisions/history;
- restore/retry/branch behavior;
- editor route/project loading;
- parameter persistence/update path;
- import/export project representation;
- OpenSCAD/Creative compatibility assumptions.

Acceptance:

- document the exact integration surfaces in `docs/brep_phase2_status.md`;
- choose one canonical persisted representation for native BRep projects;
- no implementation broadening before the persistence/lifecycle ownership is understood;
- existing Phase 1 `BrepProject` schema remains the canonical geometry/parameter payload unless a concrete flaw requires a reviewed schema change.

### 2B — First-class persisted project discriminator

Integrate native BRep into Brepia's shared project/artifact model as a first-class project type rather than a special sample route.

Acceptance:

- persisted data can distinguish OpenSCAD, native BRep and existing Creative projects without inference from filenames/content;
- existing persisted OpenSCAD/Creative data remains readable;
- BRep persistence stores normalized/versioned `BrepProject` data;
- malformed or unsupported BRep schema versions fail explicitly;
- database/type migrations, if needed, are forward-only and compatibility-reviewed;
- focused persistence/type tests pass.

### 2C — Create/open/project selection lifecycle

Provide the minimum product path to create a native BRep project and reopen it later.

Acceptance:

- native BRep is selectable/creatable through an appropriate existing project creation surface;
- opening a persisted BRep project enters the correct BRep editing/viewing surface;
- opening OpenSCAD/Creative projects continues to route exactly as before;
- the representative cabinet may be used as an initial template/example but must instantiate a real persisted project, not a singleton hard-coded runtime object;
- refresh/relogin/reopen preserves project identity and canonical snapshot.

Do not build the Phase 4 graph editor here.

### 2D — Published parameter editing and revisions

Integrate BRep published parameters with Brepia's real persisted editing/revision lifecycle.

Acceptance:

- parameter values are edited through a first-class project UI;
- edits reevaluate through `/api/brep/evaluate` and persist deterministically;
- revision/history state records enough information to reconstruct the exact canonical BRep project + parameter state;
- stable published parameter IDs remain separate from labels;
- invalid edits fail visibly and do not corrupt the last valid persisted revision;
- repeated edits do not leak viewer geometry/resources;
- native STEP export uses the currently persisted/evaluated parameter state.

### 2E — Conversation restore/retry/branch behavior

Make native BRep projects survive the same conversation lifecycle semantics required by Brepia's existing project workflows.

Acceptance:

- restore returns the correct BRep snapshot and parameter state;
- retry does not accidentally revert to a hard-coded sample/default;
- branching from an earlier revision yields a logically independent BRep project state while preserving stable IDs where appropriate;
- unchanged project data is preserved exactly;
- stale async evaluations cannot overwrite a newer restored/branched state;
- tests cover the lifecycle at the shared contract/state layer.

AI must not generate or rewrite BRep nodes in this phase; Phase 3 owns AI-native editing.

### 2F — Canonical project import/export

Add a deterministic portable representation of the parametric native BRep project.

Preferred Phase 2 baseline:

- versioned canonical JSON/project package containing the normalized `BrepProject` plus the persisted public parameter state and only the metadata needed to reconstruct the project;
- exact STEP remains a separate geometry export.

Acceptance:

- export -> import round trip preserves project semantics, stable IDs, published parameters, placement and metadata;
- import validates schema/version/bounds before persistence or native execution;
- importing STEP does not pretend to reconstruct Brepia parametrically;
- no host-path authority or arbitrary external references are introduced;
- malformed/oversized project import fails closed.

If the existing Brepia project export format can cleanly carry this payload, extend it rather than inventing a duplicate container format.

### 2G — Product UX integration and diagnostic cleanup

Consolidate the Phase 1 demo path into the real project lifecycle.

Acceptance:

- normal native BRep work does not depend on a hard-coded `/brep` cabinet singleton;
- shared viewer, parameter, loading/error/warning patterns are reused where appropriate;
- diagnostic/demo surfaces are clearly isolated or removed if redundant;
- responsive behavior is acceptable on desktop/mobile without broad UX redesign;
- no graph editor is introduced.

### 2H — Browser/integration acceptance

Run the real local Brepia runtime with the accepted BRep sandbox and exercise the complete first-class lifecycle.

Minimum browser acceptance:

1. authenticate with an existing local development account;
2. create a native BRep project;
3. edit at least two published parameters and observe native reevaluation + visible geometry changes;
4. refresh/reopen and confirm persisted state;
5. create at least one revision/history transition and restore it;
6. exercise retry/branch behavior relevant to the implemented lifecycle contract;
7. export the canonical parametric project, import it as a project and verify stable semantic round trip;
8. export exact native STEP and independently inspect/import it through the pinned OCCT/build123d path;
9. open/edit an existing OpenSCAD project and verify regression behavior;
10. inspect browser console/network for new application errors.

Use Playwright for reproducible coverage where practical and direct browser inspection for product acceptance. Do not mark a manual check PASS without evidence.

### 2I — Phase 2 closeout

Run:

```bash
scripts/brep/smoke-test.sh
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

Also run any Phase 2-specific lifecycle/import/export browser or integration tests added during the phase.

Update `docs/brep_phase2_status.md` with exact evidence and final commit. Create a draft PR against `master` when coherent and green. Do not merge without explicit user/ChatGPT approval.

## Decision gates / stop conditions

Stop and report rather than guessing if Phase 2 would require:

- changing the canonical `BrepProject` schema in a way that weakens stable Grasshopper-facing identities;
- making raw OCCT topology indexes persistent/public identity;
- weakening sandbox isolation;
- arbitrary user Python;
- a destructive migration with no forward-compatible path for existing projects;
- redefining core conversation/revision semantics for all project types merely to accommodate BRep;
- starting AI-native BRep mutation, graph editing, Rhino or Grasshopper scope early;
- importing arbitrary geometry as fake editable parametric history;
- a licensing/security change not already covered by Phase 1 architecture.

Ordinary implementation bugs, type/test/lint/build failures and small lifecycle refactors are not decision gates; fix them and continue.

## Handoff/checkpoint format

For each meaningful pushed checkpoint report:

- starting and final commit;
- completed Phase 2 step(s);
- shared lifecycle/persistence contracts changed;
- migrations, if any;
- focused/broad test evidence;
- browser/runtime evidence or remaining manual acceptance;
- clean/dirty worktree and ahead/behind relative to origin;
- next active step or explicit decision gate.
