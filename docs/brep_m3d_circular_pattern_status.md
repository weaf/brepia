# M3D — bounded circular/polar pattern status

Status: **complete — repository/CI, native build123d / OCCT runtime and installed Rhino 8 / Grasshopper runtime accepted**

Date: 2026-09-12

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

## Accepted checkpoints and evidence

The final repository implementation/harness checkpoint before external runtime acceptance was:

```text
05c5c8d757ff9f039479983df5e0221aed0f30e6
Run M3D STEP verification in pinned CAD runtime
```

That exact tree passed repository CI:

```text
Quality Gate #1066      PASS
Grasshopper Build #638 PASS
```

The accepted native runtime evidence was then recorded at:

```text
acd4858ecec6f788385dfc312b6a184301e8534a
Record M3D native runtime evidence
```

That documentation checkpoint separately passed:

```text
Quality Gate #1067      PASS
Grasshopper Build #639 PASS
```

Repository CI is not treated as native or installed-Rhino runtime evidence. Those external acceptance layers are recorded independently in:

```text
docs/brep_m3d_native_runtime_evidence_2026-09-12.md
docs/brep_m3d_rhino8_runtime_evidence_2026-09-12.md
```

## Canonical contract

M3D adds one bounded canonical node while preserving `schemaVersion: 1`:

```ts
type BrepCircularPatternNode = {
  id: string;
  type: 'circularPattern';
  input: string;
  axis: 'x' | 'y' | 'z';
  center: BrepVector3;
  count: number;
  angleStepDeg: BrepScalar;
};
```

Accepted semantics:

- input must be an existing `single` node;
- result kind is the existing `instanceSet`;
- `count` is a literal integer from 2 through 32;
- `center` uses M1 millimetre scalar semantics;
- `angleStepDeg` uses M1 degree scalar/expression semantics;
- effective angular step must be non-zero at defaults and runtime overrides;
- `0 < abs(angleStepDeg) * count <= 360`;
- exact `360` is accepted because generated indices are `0..count-1`, so the endpoint is not duplicated;
- instance 0 is the unchanged source;
- instance `i` is the source rigidly rotated by `i * angleStepDeg` around the selected canonical principal axis through `center`;
- positive angle follows the right-hand rule about the positive canonical axis;
- negative angle rotates in the opposite direction;
- position and orientation rotate together;
- stable body identity is `<patternId>::<index>`;
- `nodeId = patternId`, `instance.index = index`, and `instance.sourceNodeId = input` remain explicit;
- nested patterns remain unsupported;
- only `subtract.tools[]` may consume an `instanceSet`;
- final circular patterns use Result List Access;
- no implicit union or general collection algebra is introduced.

There is deliberately no `startAngleDeg`, `totalAngleDeg`, radius field or trigonometric extension to M1. Seed phase/radius are expressed upstream through the existing transform/M6 model.

## Repository implementation

The completed repository surface includes:

- canonical normalization and `circularPattern` value-kind handling;
- default and runtime angle-step validation;
- the bounded one-turn anti-duplicate rule;
- dependency/value-kind compatibility checks requiring a `single` input;
- M0 reachability/effectiveness traversal;
- M1 scalar traversal for center and angular step;
- finite/reference-free provider-facing schema without increasing provider recursion depth;
- structural feature-editor authoring for input, axis, center, count and angle step;
- server result-boundary support for a final circular `instanceSet` with exact count validation;
- native build123d execution using exact rigid rotation about `Axis(center, canonicalDirection)`;
- ordered expansion of circular pattern instances through `subtract.tools[]`;
- final multi-body exact STEP through the existing Compound carrier, without fusing the instances;
- Rhino 8 Python/GHX compilation using `rg.Transform.Rotation(math.radians(index * AngleStepDeg), Axis, Center)`;
- circular final Result List semantics;
- circular-pattern-as-subtract-tools with final Result Item semantics;
- strict returned-GHX validation preserving the parameter-only round-trip boundary.

M3D-specific deterministic coverage includes:

```text
tests/brepM3DCircularPattern.test.ts
tests/brepM3DServerBoundary.test.ts
tests/brepM3DNativePattern.test.ts
tests/brepM3DRhinoPattern.test.ts
tests/brepM3DRhinoAcceptanceTool.test.ts
```

plus shared provider, structural-editor, integrity and scalar suites and:

```text
scripts/brep/m3d-circular-pattern-smoke.sh
scripts/brep/m3d-rhino-acceptance.ts
scripts/brep/m3d-rhino-acceptance.sh
```

## Native runtime acceptance

The real pinned runtime smoke completed successfully with observed output:

```text
{"result":"pattern","resultKind":"instanceSet","count":6,"ids":["pattern::0","pattern::1","pattern::2","pattern::3","pattern::4","pattern::5"],"center":[5,-10],"rightHandStepDeg":60,"exactStep":true}
{"override":{"radius":40,"angleStepDeg":45},"seedCenterShift":[10,0],"instance1":[17.72792206135786,26.76955262170047],"exactStep":true}
{"patternTool":"cutters","count":6,"result":"cut","resultKind":"single","triangles":3060,"exactStep":true}
{'build123d': '0.11.1', 'cadqueryOcpNovtk': '7.9.3.1.1', 'exactStepSolids': 1, 'cylindricalHoleFaces': 6}
```

This separately proves:

- six ordered final bodies with stable `pattern::0..5` identities;
- non-origin center behavior;
- right-hand +60 degree rotation ordering;
- radius `30 -> 40` and angle step `60 -> 45` recomputation;
- circular pattern consumption through `subtract.tools[]` while the final subtract remains `single`;
- exact STEP availability;
- independent STEP import in the pinned build123d/OCCT runtime;
- one imported solid with six cylindrical hole faces;
- fail-closed zero-step behavior;
- fail-closed `abs(angleStepDeg) * count > 360` behavior.

The STEP verifier itself runs inside the same pinned CAD container and explicitly requires:

```text
build123d=0.11.1
cadquery-ocp-novtk=7.9.3.1.1
```

so host-Python package availability is not part of the native acceptance contract.

## Installed Rhino 8 / Grasshopper acceptance

Two fresh current-compiler definitions were exercised in installed Rhino 8 / Grasshopper:

```text
m3d-final-circular-pattern.ghx
m3d-circular-pattern-cutters.ghx
```

Accepted final-pattern behavior:

- the GHX opened and solved successfully;
- six separate asymmetric bodies were visible;
- the circular placement and rigid orientation changed correctly for `radius 30 -> 40` and `angleStep 60 -> 45`;
- Result remained **List**;
- the changed definition was saved, closed and reopened;
- `radius = 40` and `angleStep = 45` persisted after reopen;
- the reopened definition solved successfully again.

Accepted cutter behavior:

- the GHX opened and solved successfully;
- the circular cutter `instanceSet` was consumed through `subtract.tools[]`;
- the final result was one body with six circular holes;
- Result remained **Item**;
- the `40 / 45` perturbation recomputed cutter placement;
- the changed definition was saved, closed and reopened;
- `40 / 45` persisted after reopen;
- the reopened definition solved successfully again.

The Rhino-saved returned files then passed the strict repository validator with exact expected persisted values:

```text
{"returnedValidation":"accepted","final":{"kind":"final","filename":"m3d-final-circular-pattern-returned.ghx","parameters":{"angleStep":45,"radius":40},"expectedResultAccess":"List"},"cutters":{"kind":"cutters","filename":"m3d-circular-pattern-cutters-returned.ghx","parameters":{"angleStep":45,"radius":40},"expectedResultAccess":"Item"}}
```

The validation test completed `1 passed / 1 passed`.

## Closeout

M3D now has all required acceptance layers:

- canonical/shared contract;
- provider/AI authoring contract;
- structural authoring UI;
- M0/M1 traversal and runtime-override validation;
- server result-contract validation;
- native build123d / OCCT execution;
- exact STEP behavior;
- final multi-body instance identity;
- circular pattern as ordered subtract cutters;
- Rhino 8 / Grasshopper compilation;
- Result Item/List persistence rules;
- repository CI;
- real pinned native runtime;
- real installed Rhino 8 / Grasshopper runtime;
- parameter perturbation;
- save -> close -> reopen persistence;
- strict returned-GHX validation.

There is no remaining known M3D acceptance boundary.

## Preserved boundaries

M3D does not change:

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
- existing M3 `single | instanceSet` result kinds;
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

PR #36 remains intentionally open, draft, stacked on `feature/brep-grasshopper-smart-component` and unmerged.
