# BRep kernel execution contract

## Purpose

This file is the compact execution contract for Codex while implementing `docs/brep_kernel_plan.md` on branch `feature/brep-kernel-foundation`.

The architectural source of truth is, in order:

1. current implementation;
2. `AGENTS.md`;
3. `docs/brep_kernel_plan.md`;
4. this execution contract;
5. `docs/brep_kernel_status.md`.

Historical plan/status/checkpoint files are evidence only unless explicitly selected.

## Final product target

This roadmap is not complete when Brepia can merely export static B-Rep geometry.

The end goal is:

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

Published Brepia parameters must therefore be designed so they can become stable Grasshopper inputs later. Placement/orientation and project-object metadata must also remain representable. STEP/3DM are geometry interchange, not substitutes for the final parametric Grasshopper contract.

For the railway use case, Grasshopper is expected to own project-scale placement logic such as track alignment, profile, chainage/stationing and repeated placement. Brepia is expected to own reusable parametric project objects such as cabinets, rooms, foundations, cable pits and mounting components.

## Working rules

- Work only on `feature/brep-kernel-foundation`.
- Reconcile docs against actual code before each material step.
- Preserve existing OpenSCAD, Creative, viewer, persistence and export behavior unless the active step explicitly requires integration.
- Keep the Brepia-owned `BrepProject` schema kernel-neutral; do not persist build123d/OCCT implementation details without a documented reason.
- No arbitrary user Python execution.
- Native geometry execution must remain outside the Nitro/Brepia host process and preserve or improve the current STEP sandbox security posture.
- Prefer deterministic validation errors/warnings over silently guessing topology or references.
- Add focused tests with each contract/behavior change before broad gates.
- Use small forward commits. Do not amend/rebase/squash already-pushed shared history.
- Every verified logical checkpoint must be committed **and pushed** to `origin/feature/brep-kernel-foundation` before continuing materially beyond that checkpoint. This lets the parallel ChatGPT/GitHub review monitor inspect the exact shared state without user relay.
- If a checkpoint is intentionally kept local because it is failing/incomplete, do not represent it as shared/verified; report that explicitly in the handoff/status instead.
- Update `docs/brep_kernel_status.md` at verified checkpoints, not after every trivial edit.
- Do not implement Rhino.Compute, Grasshopper export, a graph editor or browser-authoritative OCCT early merely because they are future roadmap items.

## Shared-checkpoint publication workflow

At each meaningful verified checkpoint:

```text
focused verification
      |
      v
update docs/brep_kernel_status.md
      |
      v
commit logical checkpoint
      |
      v
git push origin feature/brep-kernel-foundation
      |
      v
continue implementation
```

A checkpoint is not considered available for parallel review until the push succeeds.

Before reporting a checkpoint, record/confirm:

- commit SHA;
- `git status --short`;
- local branch ahead/behind relative to `origin/feature/brep-kernel-foundation`;
- push result;
- relevant test/gate evidence.

Normal development edits between checkpoints may remain local. Do not create noisy commits merely to satisfy this rule; publish coherent, verified slices.

## Token/work efficiency

Do not repeatedly reread the whole repository. At the start of a step, read the source-of-truth files and then inspect only the implementation surfaces relevant to that step.

Use focused tests first. Run full gates only at meaningful checkpoints or before handoff/PR.

Avoid spawning extra agents unless a genuinely separable review/research task justifies the cost. Prefer one implementation thread with retained context.

## Phase 1 execution sequence

Phase 1 proves the architecture end to end. Complete one step before broadening scope.

### 1A — Canonical project contract

Current implementation has started this step in `shared/brepProject.ts` and `tests/brepProject.test.ts`.

Before proceeding, reconcile and verify it locally.

Acceptance:

- versioned `BrepProject` schema;
- stable project/feature/parameter identifiers;
- explicitly published parameter definitions suitable for future Grasshopper inputs;
- deterministic normalization;
- bounded graph size/complexity;
- reference validation;
- cycle rejection;
- semantic, non-index-based initial edge selection contract;
- focused tests pass;
- typecheck/lint implications understood.

If the current implementation has a material design flaw, fix it before 1B rather than preserving it for compatibility; the schema is not yet released.

### 1B — Provider and result contracts

Define the kernel-neutral server/provider boundary and the exact result contract before implementing the native runner.

Acceptance:

- provider request accepts a normalized `BrepProject` plus explicit parameter values;
- parameter overrides are validated without mutating canonical source;
- result contract can represent status, warnings, stable body/object identities, tessellated viewer geometry metadata, bounds and exact-export capability;
- provider/kernel version metadata is explicit;
- no native geometry code executes in-process;
- contracts are tested independently of build123d.

### 1C — Constrained build123d/OCCT evaluator

Implement the minimum Phase 1 operation set only:

```text
box
cylinder
transform
subtract
fillet
```

Acceptance:

- evaluator consumes only validated normalized data;
- published parameter overrides affect geometry;
- analytic cylindrical hole remains analytic in exact B-Rep/STEP output;
- fillet uses the documented semantic selector contract;
- unsupported/ambiguous selections fail explicitly;
- versions are pinned and license inventory is recorded.

### 1D — Hardened sandbox runner

Use the existing STEP sandbox as security precedent, but keep a dedicated BRep runner/image if that improves least privilege and maintainability.

Acceptance includes:

- rootless Podman;
- `network=none`;
- read-only root filesystem;
- no-new-privileges;
- capabilities dropped;
- no privileged devices;
- bounded CPU/RAM/PIDs/time/output sizes;
- narrowly mounted validated input and dedicated output;
- no arbitrary host path authority;
- robust cleanup and timeout behavior;
- smoke test proves real evaluator execution.

### 1E — Tessellation and viewer result

Produce a browser-consumable representation from the evaluated exact model without making the browser the authoritative geometry kernel.

Acceptance:

- deterministic body/object mapping;
- viewer payload is bounded and validated;
- colors/material metadata can be represented even if Phase 1 uses minimal defaults;
- bounding boxes are available;
- design does not prevent future face/edge picking metadata;
- existing OpenSCAD viewer path remains unchanged.

### 1F — Authenticated server API

Add the bounded Brepia API boundary for BRep evaluation.

Acceptance:

- authenticated appropriately for persisted/user work;
- validates request size and schema before native execution;
- maps provider/sandbox failures to stable application errors;
- concurrency is bounded;
- cancellation/timeout cleanup is safe;
- tests cover fail-closed configuration and malformed/oversized input.

### 1G — Minimal Brepia UI/viewer vertical slice

Add only enough product integration to create/load the canonical Phase 1 sample, vary its published parameters and display the result in the existing browser viewer.

Do not build the future node-graph editor in Phase 1.

Acceptance:

- parameter changes trigger BRep reevaluation through the new path;
- loading/error/warning states are clear;
- OpenSCAD and Creative workflows regress neither visually nor functionally;
- one representative cabinet/project-object sample demonstrates the intended component-level workflow.

### 1H — Direct exact STEP export

Export native BRep projects directly from the evaluated OCCT-backed path rather than routing them through OpenSCAD/scad123d.

Acceptance:

- valid ISO 10303-21 output;
- analytic cylinder/hole remains analytic;
- same sandbox/security posture is retained;
- existing OpenSCAD STEP export remains separate and unchanged.

### 1I — Browser and integration acceptance

Run the real local Brepia application and exercise the vertical slice in a browser. Use existing Playwright infrastructure for repeatable coverage and direct browser inspection for product acceptance when available.

Minimum acceptance:

- create/open Phase 1 BRep example;
- change at least two published parameters;
- verify visible geometry changes;
- exercise a validation/error case;
- verify existing OpenSCAD project still loads/renders/edits;
- export native BRep STEP and verify it independently through the available OCCT/build123d inspection path;
- inspect browser console/network for new errors.

If a browser action cannot be automated in the current Codex environment, document the exact manual check required rather than claiming it passed.

### 1J — Phase 1 closeout

Run the repository gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

Also run all BRep sandbox smoke/corpus tests introduced by Phase 1.

Update `docs/brep_kernel_status.md` with exact commits and evidence. Prepare a PR only after the implementation is coherent and the technical gates are green. Do not merge without explicit user approval.

## Decision gates / stop conditions

Stop and report instead of guessing if any of these becomes necessary:

- weakening the established native-execution sandbox boundary;
- introducing arbitrary user Python;
- changing the persisted schema in a way that undermines stable published parameters or future Grasshopper inputs;
- relying on raw OCCT edge/face indexes as persistent topology identity;
- replacing the existing OpenSCAD runtime/export path;
- adding a commercial/runtime dependency such as Rhino as a requirement for native BRep projects;
- a material licensing conflict;
- a design choice that makes the stated smart Grasshopper object/`.gh` end goal impractical.

Ordinary implementation bugs, test failures and local refactors are not decision gates; resolve them and continue.

## Handoff format

At a meaningful checkpoint, report concisely:

- starting and final commit;
- completed execution step(s);
- changed architectural contracts;
- focused and broad test results;
- browser/manual verification performed or still required;
- known limitations/risks;
- clean/dirty git status and ahead/behind state relative to origin;
- whether the checkpoint commit was successfully pushed and the remote branch now contains it;
- next active step.
