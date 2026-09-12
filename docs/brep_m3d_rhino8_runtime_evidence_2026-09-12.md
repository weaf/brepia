# M3D — installed Rhino 8 / Grasshopper runtime evidence

Status: **accepted**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

This document closes the installed-host acceptance boundary for M3D bounded circular/polar pattern.

The M3D implementation/runtime checkpoint before this host run was:

```text
acd4858ecec6f788385dfc312b6a184301e8534a
Record M3D native runtime evidence
```

That checkpoint had already passed repository CI separately:

```text
Quality Gate #1067      PASS
Grasshopper Build #639 PASS
```

Repository CI is not treated as installed-host evidence. Native build123d / OCCT evidence is also recorded separately in:

```text
docs/brep_m3d_native_runtime_evidence_2026-09-12.md
```

## Fresh installed-host fixtures

The repository acceptance utility generated two current-compiler fixtures:

```text
m3d-final-circular-pattern.ghx
m3d-circular-pattern-cutters.ghx
```

The final-pattern fixture exercises:

- an asymmetric source box;
- a non-origin circular center `[5, -10, 0]`;
- six instances around canonical Z;
- published radius and angular-step controls;
- final `instanceSet` / Grasshopper Result List semantics.

The cutter fixture exercises:

- a single base plate;
- an offset cylindrical cutter;
- a non-origin circular center `[20, -15, 0]`;
- six circular cutter instances consumed through `subtract.tools[]`;
- final single-body / Grasshopper Result Item semantics.

Published controls are:

```text
radius     default 30 mm, bounded 10..80 mm
angleStep  default 60 deg, bounded 15..60 deg
```

The installed-host perturbation was:

```text
radius     40 mm
angleStep  45 deg
```

## Final circular-pattern acceptance

The final-pattern definition was accepted in installed Rhino 8 / Grasshopper with the following explicitly confirmed behavior:

- the GHX file opened successfully;
- the definition solved successfully;
- the result contained six separate asymmetric bodies;
- the circular placement/orientation changed correctly when `radius` changed from `30 -> 40` and `angleStep` changed from `60 -> 45`;
- the final pattern remained a Grasshopper Result **List**, not an implicit Boolean union;
- the modified definition was saved, closed and reopened successfully;
- after reopen, `radius = 40` and `angleStep = 45` remained persisted;
- the reopened definition solved successfully again.

The non-origin pattern center and asymmetric source make the host fixture sensitive to both circular position and rigid orientation, rather than merely proving coincident radial points.

## Circular pattern as subtract cutters

The second definition was accepted in installed Rhino 8 / Grasshopper with the following explicitly confirmed behavior:

- the GHX file opened successfully;
- the definition solved successfully;
- the circular `instanceSet` was consumed through `subtract.tools[]`;
- the final result was one body through Grasshopper Result **Item** access;
- the plate contained six circular holes from the six cutter instances;
- the cutter placement recomputed correctly for `radius = 40` and `angleStep = 45`;
- the modified definition was saved, closed and reopened successfully;
- after reopen, the same `40 / 45` values remained persisted;
- the reopened definition solved successfully again.

This preserves the existing collection boundary: a circular pattern may be a final `instanceSet` or an ordered subtract-tool source, but it is not silently fused and does not become a general collection operand.

## Strict returned-GHX validation — accepted

The two Rhino-returned GHX files were validated through the repository wrapper:

```bash
./scripts/brep/m3d-rhino-acceptance.sh validate \
  tmp/m3d-rhino-acceptance/m3d-final-circular-pattern-returned.ghx \
  tmp/m3d-rhino-acceptance/m3d-circular-pattern-cutters-returned.ghx \
  40 45
```

Observed validator output:

```text
stdout | tests/brepM3DRhinoAcceptanceTool.test.ts > M3D Rhino acceptance tooling > strictly validates both installed-host returned circular GHX files
{"returnedValidation":"accepted","final":{"kind":"final","filename":"m3d-final-circular-pattern-returned.ghx","parameters":{"angleStep":45,"radius":40},"expectedResultAccess":"List"},"cutters":{"kind":"cutters","filename":"m3d-circular-pattern-cutters-returned.ghx","parameters":{"angleStep":45,"radius":40},"expectedResultAccess":"Item"}}

✓ tests/brepM3DRhinoAcceptanceTool.test.ts > M3D Rhino acceptance tooling > strictly validates both installed-host returned circular GHX files

Test Files  1 passed (1)
Tests       1 passed (1)
```

This independently proves for the returned host-saved definitions:

- both returned GHX files satisfy the strict parameter-only returned-document validator;
- the final circular-pattern definition persists `radius = 40` and `angleStep = 45`;
- the circular-pattern-as-cutters definition persists the same `40 / 45` perturbation;
- the final pattern preserves expected Result **List** access;
- the subtract fixture preserves expected Result **Item** access;
- both files contain a real bounded non-default parameter perturbation rather than only generated defaults.

The validator continues to reject unsupported script/component/graph/wiring/output-access or out-of-bounds parameter mutations. This acceptance therefore does not weaken the GHX parameter-only return boundary.

## Native parity already accepted separately

The same M3D contract has independently passed the real pinned native runtime. The accepted native run verified:

- final six-body `instanceSet` with stable `pattern::0..5` identities;
- right-hand +60 degree ordering about non-origin `[5, -10, 0]`;
- `radius 30 -> 40` and `angleStep 60 -> 45` recomputation;
- circular pattern consumption through `subtract.tools[]` with final `single` body;
- exact STEP availability;
- independent exact STEP import in pinned `build123d=0.11.1` / `cadquery-ocp-novtk=7.9.3.1.1`;
- one imported solid with six cylindrical hole faces;
- fail-closed zero step and `abs(angleStepDeg) * count > 360` behavior.

Native evidence remains separate from installed Rhino host evidence.

## Preserved architecture

This host acceptance does not change:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep plus immutable revision authority;
- build123d / OCCT geometry authority;
- Rhino/GHX interoperability-only authority;
- canonical `schemaVersion: 1`;
- M0 parameter-effectiveness semantics;
- M1 canonical scalar depth 12 / node limit 64;
- provider expression depth 2;
- M2 exact-one-body Boolean policy;
- M3 `single | instanceSet` discipline;
- the rule that only `subtract.tools[]` may consume an `instanceSet`;
- no nested patterns, implicit union or general collection algebra;
- M4 profile/extrusion semantics;
- M6 Intrinsic XYZ `R = Rx * Ry * Rz`, `p' = R*p + T`;
- GHX parameter-only return/import semantics;
- Result Item/List semantics;
- OpenSCAD regressions;
- C4 image projection deferral;
- M5 shell/thickness deferral;
- M7 topology/finishing deferral.

## Conclusion

M3D installed Rhino 8 / Grasshopper acceptance is **complete**.

Together with repository/CI coverage and the separately recorded real build123d / OCCT runtime evidence, all required M3D circular-pattern acceptance layers are now closed:

1. repository/CI implementation evidence;
2. pinned native build123d / OCCT runtime evidence;
3. installed Rhino 8 / Grasshopper runtime evidence.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
