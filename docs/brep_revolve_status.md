# Bounded full revolve status

Status: **repository/CI and pinned native build123d/OCCT runtime accepted — installed Rhino 8 / Grasshopper Gate C pending**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.

## Scope

This status covers only the bounded first full-revolve slice locked in:

```text
docs/brep_revolve_implementation_boundary_2026-09-12.md
```

Canonical node:

```ts
type BrepRevolveNode = {
  id: string;
  type: 'revolve';
  profile: BrepProfile;
  axis: 'x' | 'y' | 'z';
};
```

The slice remains deliberately bounded:

- full 360 degree revolve only;
- existing inline M4 `BrepProfile` grammar;
- canonical X/Y/Z rotation axis through local origin;
- `resultKind: single`;
- exactly one positive-volume solid/Brep;
- no partial/start angles;
- no arbitrary-vector or topology-attached axes;
- no open profiles or reusable sketch/profile graph;
- no new M1 operators/functions;
- canonical `schemaVersion: 1` unchanged.

## Locked profile frame

Profile `u` is axial and `v` is radial.

| axis | axial U | radial V | mapping `(u,v)` |
| --- | --- | --- | --- |
| X | +X | +Y | `(u,v,0)` |
| Y | +Y | +Z | `(0,u,v)` |
| Z | +Z | +X | `(v,0,u)` |

Resolved radial `v` must remain non-negative. Axis contact at `v=0` is accepted only through a non-zero-length boundary segment. Negative-radial axis crossing and isolated point-only contact fail closed.

Centered M4 rectangle/circle profiles remain unchanged for extrusion but are rejected for the bounded first revolve slice; `closedPolyline` is the intended turned-part profile family.

## Repository implementation — accepted

Implementation spans canonical normalization/validation, M0/M1 traversal and effectiveness, runtime override validation, provider/AI schema, structural editor, native build123d/OCCT translation, Rhino/GHX translation, Result Item semantics and focused regression coverage.

Accepted repository checkpoints include:

```text
7f01c9feecdba991d85c648f6257391eb512f218
Lock bounded revolve implementation boundary
Quality Gate #1073       PASS
Grasshopper Build #645   PASS

b59510fa0f874ede5e3bf724367761cc4eb21475
Add bounded revolve authoring surfaces
Quality Gate #1075       PASS
Grasshopper Build #647   PASS

ed4e0312254ef42e051fb8ce850c92c9f091d919
Add bounded revolve native translation and parity tests
Quality Gate #1077       PASS
Grasshopper Build #649   PASS

cc9470c5e69e2cd972f65d8f13ac0a0a8882857e
runtime-harness/status checkpoint
Quality Gate #1079       PASS
Grasshopper Build #651   PASS
```

Repository CI remains repository evidence only.

## Gate B — pinned native runtime — accepted

Full evidence:

```text
docs/brep_revolve_native_runtime_evidence_2026-09-12.md
```

Gate B executed through a temporary one-shot runner at:

```text
82de6ec07713d5d0d429f7cad4ff303047c51b76
Revolve Native Gate B #1
run id 34713678232
conclusion: success
```

The job explicitly verified:

```text
podman 4.9.3
rootless=true
build123d 0.11.1
cadquery-ocp-novtk 7.9.3.1.1
OCP 7.9.3.1
rhino3dm 8.32.1
```

Observed native fixtures:

```text
R1 stepped bushing, X axis:
[-30,-16,-16] -> [30,16,16]
resultKind single
exact STEP available

R2 parameterized, Z axis:
default outerRadius=18, length=40
[-18,-18,-20] -> [18,18,20]

override outerRadius=22, length=52
[-22,-22,-26] -> [22,22,26]

R3 axis-adjacent, Y axis:
[-12,-20,-12] -> [12,20,12]

R4 negative-radial crossing:
failed closed as required
```

Independent exact STEP re-import in the same pinned CAD runtime produced:

```text
exactStepSolids = 1
volume = 68612.38355440038
bounds = (-22,-22,-26) -> (22,22,26)
```

Gate B therefore confirms real kernel execution, radial + axial parameter effect, supported axis contact, fail-closed unsupported crossing, exact-one positive-volume solid and independently importable exact STEP.

## Gate C — installed Rhino 8 / Grasshopper — next active gate

Still required before full revolve closeout:

- generate fresh GHX from the accepted compiler;
- open and solve in installed Rhino 8 / Grasshopper;
- verify intended turned geometry;
- perturb the same bounded radial and axial parameters;
- verify recomputation;
- save -> close -> reopen;
- verify persisted values and solve state;
- run strict returned-GHX validation and confirm only published parameter values changed;
- record results in a separate Rhino evidence document.

## Preserved architecture

Revolve does not change:

- M0 parameter effectiveness;
- M1 depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- `single | instanceSet`;
- only `subtract.tools[]` may consume `instanceSet`;
- M3A-M3D semantics;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ rotation semantics;
- Result Item/List semantics;
- GHX parameter-only return/import semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Current decision

Bounded full revolve is now accepted across **repository/CI and pinned native build123d/OCCT runtime**.

It is not yet complete across all three evidence layers. The only active revolve scope is now **Gate C — installed Rhino 8 / Grasshopper acceptance**.
