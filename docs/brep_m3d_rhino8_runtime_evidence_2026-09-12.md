# M3D — installed Rhino 8 / Grasshopper runtime evidence

Status: **partial — strict returned-GHX validation accepted; explicit host solve / visual / save-close-reopen observations still to be recorded**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Scope

This document records the installed-host evidence received so far for M3D bounded circular/polar pattern.

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

The repository acceptance utility generates two current-compiler fixtures:

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

The requested installed-host perturbation was:

```text
radius     40 mm
angleStep  45 deg
```

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

This proves for the returned host-saved definitions:

- both returned GHX files satisfy the strict parameter-only returned-document validator;
- the final circular-pattern definition persists `radius = 40` and `angleStep = 45`;
- the circular-pattern-as-cutters definition persists the same `40 / 45` perturbation;
- the final pattern preserves expected Result **List** access;
- the subtract fixture preserves expected Result **Item** access;
- both files contain a real bounded non-default parameter perturbation rather than only generated defaults.

The validator continues to reject unsupported script/component/graph/wiring/output-access or out-of-bounds parameter mutations. This acceptance therefore does not weaken the GHX parameter-only return boundary.

## Evidence not inferred from the validator

The returned-GHX validator does not itself observe Rhino's viewport, Grasshopper solve state or user interaction history. Therefore this document does **not** yet claim, solely from the validator output, that:

- the final fixture visibly solved as six distinct asymmetric bodies in installed Rhino 8 / Grasshopper;
- right-hand circular ordering and source orientation were visually inspected in the host;
- the cutter fixture visibly solved as one plate with six circular through-cuts;
- either returned document was explicitly closed and reopened after save and then observed to solve again.

Those host observations must be recorded explicitly before this document changes from partial to accepted.

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

This host validation does not change:

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

## Remaining host-closeout statement

To mark M3D installed Rhino 8 / Grasshopper acceptance complete, record the actual installed-host observations for both fresh fixtures:

1. final fixture opened/solved with six separate asymmetric bodies and Result List semantics;
2. `40 / 45` changed the circular placement/orientation as expected;
3. final fixture was saved, closed, reopened and solved again with `40 / 45` persisted;
4. cutter fixture opened/solved as one plate with six circular holes and Result Item semantics;
5. cutter fixture was saved, closed, reopened and solved again with `40 / 45` persisted.

Once those observations are explicitly supplied, this document can be promoted to **accepted**, and the M3D status/roadmap closeout can be recorded without conflating host evidence with repository CI or native runtime evidence.

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
