# BRep kernel foundation status

## Current branch

```text
feature/brep-kernel-foundation
```

Base:

```text
master @ 68a89e238bb9b1da9ceebfd64a9dee0858e29321
```

## Product objective

Brepia is adding a native open B-Rep parametric modeling path based on a Brepia-owned model contract and an isolated OCCT/build123d backend.

The roadmap's explicit end goal is not static CAD export. A Brepia parametric project must ultimately be exportable/usable as a smart Grasshopper parametric object/component and generated `.gh` workflow while Brepia remains independent of Rhino as a mandatory runtime.

## Verified architectural decisions

- OpenSCAD remains a first-class modeling mode.
- Native BRep projects use a constrained, versioned Brepia-owned schema rather than arbitrary Python.
- OCCT/build123d is the preferred first native exact-geometry backend.
- Exact native geometry execution stays outside the Brepia/Nitro process in a hardened sandbox.
- The browser viewer is presentation, not the authoritative BRep kernel in the initial implementation.
- Published Brepia parameters are part of the public project contract and are designed to become future Grasshopper inputs.
- Stable feature/parameter IDs and semantic topology selectors are preferred over persistent raw OCCT topology indexes.
- Grasshopper/Rhino is a downstream project-composition target and optional provider/interoperability surface, not Brepia's mandatory core.

## Collaboration / checkpoint rule

Codex and ChatGPT/GitHub review now work in parallel through the shared branch.

Every meaningful **verified** Codex checkpoint must therefore be:

```text
verify -> update status -> commit -> push to origin/feature/brep-kernel-foundation
```

Only pushed state is available to the parallel GitHub reviewer/monitor. Incomplete or failing experiments may remain local, but must not be reported as shared/verified checkpoints.

This rule is defined authoritatively in `docs/brep_kernel_execution.md`.

## Current implementation state

### Phase 0 — Architecture closure

Accepted for implementation.

Plan:

```text
docs/brep_kernel_plan.md
```

Codex execution contract:

```text
docs/brep_kernel_execution.md
```

### Phase 1A — Canonical project contract

Implementation started, not yet locally verified/closed in the shared status record.

Current files:

```text
shared/brepProject.ts
tests/brepProject.test.ts
```

Current intended capabilities include:

- schema version 1;
- stable project ID;
- stable published parameter IDs;
- numeric published parameters with unit/default/min/max/step metadata;
- stable feature node IDs;
- initial operations: box, cylinder, transform, subtract and fillet;
- parameter references from node properties;
- explicit result node;
- deterministic normalization;
- duplicate/reference/cycle validation;
- initial semantic edge selector contract;
- rejection of unsupported raw edge-index selection.

The local Codex implementation thread must reconcile and run the focused tests/type checks before declaring Phase 1A complete. The schema is not released yet, so material design flaws should be corrected now rather than carried as compatibility debt.

## Commits on the foundation branch before Codex execution contract

```text
e4b8e1b6b84d1d830afdf7a5c0e994e160aa8d33  Add BRep kernel foundation architecture plan
545796f9dce5e25b4ba37aacceaa6a79538d4931  Clarify smart Grasshopper export as roadmap target
b8ad5756b75f68a1d761a3b346f739e8ff512461  Add canonical BRep project contract
5421423861ced37fd1460f4f4ba31202aa2357b3  Test canonical BRep project validation
```

Execution-contract setup continues after these commits.

## Active step

```text
Phase 1A — reconcile and verify canonical BrepProject contract
```

After Phase 1A is green, proceed to:

```text
Phase 1B — kernel-neutral provider and result contracts
```

Follow `docs/brep_kernel_execution.md` rather than improvising roadmap order.

## Validation evidence

No Phase 1 implementation gate is yet recorded as PASS in this shared status file.

Do not infer success from code presence alone. Codex must run the relevant local tests and record exact evidence here at verified checkpoints, then push that checkpoint so the evidence is reviewable from GitHub.

## Browser acceptance

Not started for the BRep path. Browser acceptance begins when the Phase 1 vertical slice reaches UI/viewer integration.

Existing OpenSCAD behavior is a regression boundary throughout this work.

## Known design risks to keep visible

- persistent topology naming/selection across feature changes;
- safe and deterministic build123d/OCCT execution;
- bounded tessellation/result payloads;
- direct exact STEP fidelity;
- future Grasshopper component/export mapping without coupling the canonical schema to Rhino;
- performance/caching for repeated parameter evaluation;
- keeping the new runtime isolated without duplicating unnecessary infrastructure.

## Next status update

Update this document at the next verified Codex checkpoint, including:

- final commit SHA;
- focused test result;
- typecheck/lint result as applicable;
- any schema changes made during reconciliation;
- clean/dirty status and branch ahead/behind relative to origin;
- successful push confirmation;
- next active step.
