# Bounded full revolve status

Status: **complete — repository/CI, pinned native build123d/OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**

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

The accepted slice remains deliberately bounded:

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

## Gate A — repository / CI — accepted

Implementation spans canonical normalization/validation, M0/M1 traversal and effectiveness, runtime override validation, provider/AI schema, structural editor, native build123d/OCCT translation, Rhino/GHX translation, Result Item semantics and focused regression coverage.

Primary accepted checkpoints include:

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

be8e5e730568e80e83e91e79966d6720ce65b98c
Remove one-shot revolve native Gate B runner
Quality Gate #1084       PASS
Grasshopper Build #656   PASS

679bdc015707e6bb130e19979ec92af523279037
Add bounded revolve Rhino Gate C acceptance tooling
Quality Gate #1085       PASS
Grasshopper Build #657   PASS
```

Repository CI remains repository evidence only.

## Gate B — pinned native runtime — accepted

Full evidence:

```text
docs/brep_revolve_native_runtime_evidence_2026-09-12.md
```

Gate B executed through the temporary one-shot runner at:

```text
82de6ec07713d5d0d429f7cad4ff303047c51b76
Revolve Native Gate B #1
run id 34713678232
conclusion: success
```

Verified runtime:

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

Independent exact STEP re-import produced exactly one solid with positive volume `68612.38355440038` and bounds `(-22,-22,-26) -> (22,22,26)`.

## Gate C — installed Rhino 8 / Grasshopper — accepted

Full evidence:

```text
docs/brep_revolve_rhino8_runtime_evidence_2026-09-12.md
```

Fresh current-compiler fixtures:

```text
revolve-parameterized-z.ghx
revolve-axis-adjacent-y.ghx
```

The installed-host acceptance run was reported green for both definitions. The primary parameterized fixture exercised:

```text
outerRadius: 18 -> 22 mm
length:      40 -> 52 mm
```

The host-saved returned definitions were then checked through the strict parameter-only validator.

Observed returned validation:

```text
{"returnedValidation":"accepted","parameterized":{"kind":"parameterized","filename":"revolve-parameterized-z-returned.ghx","parameters":{"length":52,"outerRadius":22},"expectedResultAccess":"Item"},"axisAdjacent":{"kind":"axisAdjacent","filename":"revolve-axis-adjacent-y-returned.ghx","parameters":{},"expectedResultAccess":"Item"}}
```

The dedicated validator test passed:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

Gate C therefore confirms installed Rhino/Grasshopper execution for the current full-revolve compiler path, persisted radial and axial parameter edits, supported axis-adjacent geometry, save/close/reopen host persistence, Result Item access and the unchanged strict returned-GHX parameter-only boundary.

## Preserved architecture

Revolve does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project plus immutable revision authority;
- build123d/OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
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

## Closeout

Bounded full revolve is complete across all required acceptance layers:

```text
repository/CI
-> pinned native build123d/OCCT
-> installed Rhino 8 / Grasshopper
```

No revolve scope broadening is active after this closeout.
