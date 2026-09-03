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

Closed and locally verified.

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

Reconciliation improvements in `1421fb6a2492b5668c54883ed92531b0791242a2`:

- normalized projects now have an explicit kernel-neutral placement plane
  (`origin`, `xAxis`, `yAxis`), defaulting deterministically to world XY for
  hand-authored v1 input;
- bounded, normalized project-object metadata supports future Grasshopper
  classification/property transfer without encoding kernel topology;
- parameter references are unit-checked against each semantic field.

Evidence recorded before this checkpoint:

```text
npx vitest run tests/brepProject.test.ts  PASS (1 file, 12 tests)
npm run typecheck                            PASS
npm run lint                                 PASS
git diff --check                             PASS
```

The local Codex implementation thread must first reconcile and run the focused tests/type checks before declaring Phase 1A complete. The schema is not released yet, so material design flaws should be corrected now rather than carried as compatibility debt.

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
Phase 1 — technically complete; review/PR readiness
```

Phase 1A–1J are implemented and verified through the Phase 1 closeout
checkpoint. The minimal cabinet viewer at `/brep` evaluates only through the
authenticated `/api/brep/evaluate` boundary; native STEP uses the separately
authenticated `/api/brep/export/step` boundary.

## Validation evidence

Phase 1A is PASS with the exact evidence recorded above. Later Phase 1 gates
remain unverified until their own focused evidence is recorded.

### Phase 1B–1E — provider, isolated evaluator, sandbox and tessellation

Implemented and locally verified through
`6ccdb5947e916153c3de95069f72e65565b3c439`. The provider request resolves published parameter overrides without
mutating the canonical project. Native evaluation is executed only by the
dedicated rootless Podman runner; it mounts a validated JSON input read-only and
writes to a dedicated output directory under `network=none`, read-only root,
`no-new-privileges`, dropped capabilities, bounded PIDs/CPU/RAM and timeout.

The original native smoke exposed a real incompatible pair:

```text
Python 3.12.14
build123d 0.8.0
cadquery-ocp 7.9.3.1.1 / OCP 7.9.3.1
AttributeError: TopoDS_Shape has no attribute HashCode
```

The image now pins and build-verifies `build123d==0.11.1` together with
`cadquery-ocp-novtk==7.9.3.1.1` (OCP 7.9.3.1). `libgl1` is retained because the
selected OCP binding cannot import without `libGL.so.1`. This is the no-VTK
binding variant; runtime execution remains networkless.

Native smoke evidence after the coherent dependency update:

```text
scripts/brep/build-image.sh                         PASS
scripts/brep/smoke-test.sh                          PASS (box/cylinder/transform/subtract/fillet)
native output                                        PASS (ISO 10303-21 STEP; 732 triangles)
npx vitest run BRep suites                           PASS (5 files, 20 tests)
npm run typecheck; npm run lint; git diff --check    PASS
```

### Shared review hardening checkpoint

The shared review series through
`2a4b1c5175bc45c83ccc1b082074e0d435f9c146` was fast-forwarded and reviewed
without rewriting its history. It adds resolved placement/Grasshopper Plane
validation, request cancellation propagation, cleanup/capacity hardening, and
bounded/malformed API body coverage.

```text
npx vitest run BRep suites                           PASS (5 files, 31 tests)
npm run typecheck; npm run lint; git diff --check    PASS
```

### Phase 1G and 1I — authenticated browser acceptance

`2edd5bb` prevents recursive growth of `redirect` values in the auth guard.
Against the production-like local runtime, an unauthenticated navigation to
`/brep` ended exactly once at:

```text
/signin?redirect=%2Fbrep
```

with no redirect loop.

The authorized local development account then completed browser acceptance in
the same production-like runtime, using the pinned rootless BRep Podman image:

- login returned to `/brep` and rendered the Phase 1 equipment cabinet;
- width `1200 -> 1400` and height `1800 -> 2100` each issued a new
  authenticated `POST /api/brep/evaluate` with HTTP 200;
- the evaluated bounds changed from `[-600, -300, -900]..[600, 300, 900]` to
  `[-700, -300, -1050]..[700, 300, 1050]`, and direct visual inspection showed
  the corresponding cabinet geometry;
- an invalid height of `100` returned HTTP 400 and showed the bounded,
  user-visible message `BRep parameter height is below its minimum.`;
- a pre-existing OpenSCAD cube loaded and rendered; changing its size `50 ->
60` visibly changed the model, then the local test value was restored to
  `50`.

Console inspection was clean for functional errors after normal navigation.
The intentional invalid BRep request produced the expected browser failed-400
resource entry. The only other messages were the existing no-key PostHog
warning and headless-WebGL performance warnings; no new application error was
observed.

### Phase 1H — direct native STEP export

The native evaluator already emits its ISO STEP artifact in its isolated
workspace. This checkpoint exposes it through a separate authenticated
`POST /api/brep/export/step` route and a viewer download action. It reuses the
same normalized BRep request, constrained Podman runner and bounded artifact
validation as evaluation; it does not call the OpenSCAD/scad123d STEP path.

Focused evidence:

```text
tests/brepEvaluation.test.ts, brepApi, provider, project   PASS (31 tests)
scripts/brep/smoke-test.sh                                 PASS (ISO 10303-21; 732 triangles)
npm run typecheck; npm run lint; npm run build             PASS
POST /api/brep/export/step without a session               PASS (401)
git diff --check                                            PASS
```

Browser acceptance then issued authenticated `POST /api/brep/export/step`
with HTTP 200 and downloaded `parametric-model.step`. Independent import in
the pinned build123d/OCCT image confirmed ISO 10303-21 content, five
`CYLINDRICAL_SURFACE`/`CIRCLE` records, nine faces, and bounds
`[-700, -300, -1050]..[700, 300, 1050]`. This preserves the analytic hole and
matches the final browser parameter values.

## Phase 1 closeout evidence

```text
scripts/brep/smoke-test.sh                                  PASS (ISO STEP; 732 triangles)
npm test                                                     PASS (59 files, 474 tests)
npm run typecheck                                            PASS
npm run lint                                                 PASS
npm run build                                                PASS
git diff --check origin/master...HEAD                        PASS
```

The browser artifacts were inspected locally and intentionally not committed.
No credentials, tokens, or local browser/session data are stored in the
repository.

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

Record review feedback, a draft PR URL if created, or any post-Phase-1 work as
a new checkpoint. Do not reopen the Phase 1 acceptance evidence without a
material implementation change.
