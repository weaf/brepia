# Bounded full revolve implementation plan

Status: **repository/CI and pinned native runtime accepted; installed Rhino 8 / Grasshopper Gate C is the only remaining active revolve scope**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 must remain open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Context

The post-M3D scope decision selected bounded full revolve as the next modeling slice. The implementation boundary is locked in:

```text
docs/brep_revolve_implementation_boundary_2026-09-12.md
```

Current status:

```text
docs/brep_revolve_status.md
```

Pinned native runtime evidence:

```text
docs/brep_revolve_native_runtime_evidence_2026-09-12.md
```

## Locked canonical surface

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The first slice remains bounded to:

- full 360 degree revolve only;
- existing M4 inline `BrepProfile` grammar;
- canonical `schemaVersion: 1`;
- result kind `single`;
- exactly one positive-volume solid/Brep;
- no partial/start angles;
- no arbitrary vector or topology-attached axes;
- no open profiles;
- no reusable sketch/profile graph;
- no new M1 functions;
- GHX return remains parameter-only;
- build123d/OCCT remains geometry authority;
- Rhino/GHX remains interoperability-only authority.

## Locked frame contract

Profile `u` is axial and `v` is radial.

```text
X: U=+X, V=+Y, (u,v) -> (u,v,0)
Y: U=+Y, V=+Z, (u,v) -> (0,u,v)
Z: U=+Z, V=+X, (u,v) -> (v,0,u)
```

Resolved `v` must remain non-negative. A non-zero boundary segment on `v=0` is valid axis contact; negative-radial crossing and isolated point-only contact fail closed.

Centered M4 rectangle/circle profiles remain unchanged for extrusion but are rejected for this first revolve slice. `closedPolyline` is the intended turned-profile family.

## Phase 1 — boundary reconciliation — complete

The boundary document locks canonical semantics, profile frames, cardinality, fail-closed cases, provider/AI limits, structural editor behavior, native translation, Rhino/GHX translation, server boundary and returned-GHX invariants.

## Phase 2 — fixtures — complete

Locked fixtures:

1. stepped bushing / turned part;
2. parameterized radial + axial dimensions;
3. valid axis-adjacent profile;
4. explicit invalid axis-crossing profile;
5. exact STEP plus installed-host acceptance path.

## Phase 3 — repository implementation — complete

Implemented across:

- canonical node/normalization/validation;
- M0 parameter effectiveness;
- M1 scalar traversal and runtime override validation;
- provider/AI finite reference-free schema with provider expression depth 2;
- structural editor;
- native build123d/OCCT translation;
- Rhino/GHX full-revolve translation;
- Result Item semantics;
- strict generated-GHX validation;
- focused repository regressions.

No `single | instanceSet` algebra broadening was introduced.

## Phase 4 — repository acceptance — complete

Primary implementation checkpoint:

```text
ed4e0312254ef42e051fb8ce850c92c9f091d919
Add bounded revolve native translation and parity tests
Quality Gate #1077       PASS
Grasshopper Build #649   PASS
```

Runtime-harness/status checkpoint:

```text
cc9470c5e69e2cd972f65d8f13ac0a0a8882857e
Quality Gate #1079       PASS
Grasshopper Build #651   PASS
```

Repository CI is repository evidence only.

## Phase 5 — pinned native runtime acceptance — complete

Gate B executed the dedicated `scripts/brep/revolve-smoke.sh` through a one-shot rootless Podman runner.

Execution checkpoint/run:

```text
82de6ec07713d5d0d429f7cad4ff303047c51b76
Revolve Native Gate B #1
run id 34713678232
PASS
```

Verified runtime:

```text
podman 4.9.3, rootless=true
build123d 0.11.1
cadquery-ocp-novtk 7.9.3.1.1
OCP 7.9.3.1
rhino3dm 8.32.1
```

Gate B verified:

- stepped bushing bounds/cardinality;
- published radial and axial parameter perturbations;
- valid axis-adjacent profile;
- fail-closed negative-radial axis crossing;
- exact STEP export;
- independent exact STEP re-import;
- exactly one positive-volume imported solid with deterministic bounds.

Full evidence is recorded separately in `docs/brep_revolve_native_runtime_evidence_2026-09-12.md`.

## Phase 6 — installed Rhino 8 / Grasshopper acceptance — next active gate

Only Gate C remains:

- generate fresh GHX from the accepted current compiler;
- open and solve in installed Rhino 8 / Grasshopper;
- visually verify intended turned geometry;
- perturb the same radial and axial parameters;
- verify recomputation;
- save -> close -> reopen;
- verify persisted values and solve state;
- validate the host-saved returned GHX through the strict parameter-only validator;
- record results in a separate Rhino runtime evidence document.

Gate C must remain distinct from both repository CI and Gate B native evidence.

## Preserved architecture

Continue to preserve:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project plus immutable revision authority;
- build123d/OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter effectiveness;
- M1 depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean semantics;
- `single | instanceSet` discipline;
- only `subtract.tools[]` may consume an `instanceSet`;
- M3A-M3D semantics;
- M4 extrusion semantics;
- M6 Intrinsic XYZ semantics;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Stop conditions

Do not broaden revolve to reusable sketch/profile graph values, topology-attached axes, raw face/edge identities, partial sweeps, arbitrary vector axes, spline/NURBS authoring, general collection algebra or new M1 functions without a separate product decision.

## Immediate next action

Proceed only with **Gate C — installed Rhino 8 / Grasshopper acceptance**. No further canonical/native revolve expansion is active.
