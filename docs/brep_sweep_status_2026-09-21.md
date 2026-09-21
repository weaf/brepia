# Bounded planar 90-degree circular sweep status

Status: **complete — Gate A/B/C/D accepted; final closeout verification and merge pending**

Date: 2026-09-21

Repository: `weaf/brepia`

Branch: `feature/brep-planar-elbow-sweep`

PR: **#50 — Implement bounded BRep planar elbow sweep**

## Scope

This status covers only the bounded first sweep slice locked by:

```text
docs/brep_sweep_implementation_boundary_2026-09-19.md
```

Canonical result:

```ts
type BrepSweepNode = {
  id: string;
  type: 'sweep';
  profile: BrepCircleProfile;
  path: {
    type: 'planarElbow90';
    planeNormalAxis: 'x' | 'y' | 'z';
    firstLegLength: BrepScalar;
    secondLegLength: BrepScalar;
    bendRadius: BrepScalar;
  };
};
```

The accepted slice remains deliberately narrow:

- circle profile only;
- one planar line + tangent +90-degree circular arc + line path;
- fixed X/Y/Z canonical plane frame;
- positive dimensions;
- strict `profile.radius < bendRadius`;
- one `single` result;
- exactly one positive-volume native solid;
- no general path/sketch grammar, arbitrary angle, multi-bend, non-planar rail, twist or guide rail.

Canonical `schemaVersion: 1` remains unchanged.

## Implementation checkpoints

Primary implementation:

```text
246ec56224f96dcdf285769d27a2f00267436336
Implement bounded planar elbow sweep
```

Native runtime evidence:

```text
b2cb855
Record sweep native runtime evidence
```

Rhino Gate C tooling:

```text
533eb64ba51700bdb2a227164b9499988e3fd2fa
Add sweep Rhino Gate C acceptance tooling
```

Installed Rhino Gate C evidence:

```text
a7273d1f017ce8eed52c8a55ec2f8ca39a67fc1d
Record sweep Rhino Gate C acceptance
```

Authenticated Gate D evidence:

```text
84239c89a70041db3f52f97f7fffadbd02657d22
Record sweep authenticated product acceptance
```

## Gate A — repository / CI — accepted

The implementation checkpoint passed the complete local repository gate:

```text
npm test                241 files / 1371 tests PASS
npm run typecheck       PASS
npm run lint            PASS
npm run build           PASS
npm run test:browser-smoke  3/3 PASS
git diff --check        PASS
```

GitHub Quality Gate on the implementation checkpoint:

```text
run 35458862909
head 246ec56224f96dcdf285769d27a2f00267436336
SUCCESS
```

Subsequent Gate-C tooling and evidence checkpoints also passed repository Quality Gate, including:

```text
a7273d1f017ce8eed52c8a55ec2f8ca39a67fc1d
Quality Gate run 35632934824
SUCCESS
```

Final documentation-only closeout verification is intentionally run again before merge and recorded separately.

## Gate B — pinned native build123d / OCCT — accepted

Full evidence:

```text
docs/brep_sweep_native_runtime_evidence_2026-09-19.md
```

Accepted native behavior includes:

- nominal target-E fixture;
- X/Y/Z frame parity;
- Bend Radius perturbation;
- Tube Diameter/profile-radius perturbation;
- fail-closed invalid radius and leg length;
- exactly one positive-volume solid;
- exact STEP export;
- independent STEP re-import.

Pinned runtime:

```text
build123d 0.11.1
cadquery-ocp-novtk 7.9.3.1.1
```

Nominal analytical/native evidence:

```text
centerline length = 1935.6194490192345 mm
volume            = 2432371.1364749004 mm^3
exact STEP solids = 1
```

## Gate C — installed Rhino 8 / Grasshopper — accepted

Full evidence:

```text
docs/brep_sweep_rhino8_runtime_evidence_2026-09-21.md
```

Fresh current-compiler GHX was opened and solved in installed Rhino 8 / Grasshopper.

Accepted host behavior:

- one continuous circular-section elbow;
- one straight first leg;
- one smooth tangent 90-degree bend;
- one straight second leg;
- Bend Radius changed to 180 mm;
- Tube Diameter changed to 50 mm;
- modified definition saved and returned;
- strict returned-GHX validation preserved Result Item access and exact published controls.

Dquark-Control validation:

```text
run 35632770539
request_id=brepia-sweep-gatec-validate-20260921-02
run_rc=0
```

Returned parameters:

```json
{"bendRadius":180,"tubeDiameter":50}
```

## Gate D — authenticated product path — accepted

Full evidence:

```text
docs/brep_sweep_product_path_evidence_2026-09-21.md
```

The original Target-E family was rerun through the normal authenticated Native BRep product path.

Actual generation:

```text
model: local/qwen3.6-35b-heretic-mtp-128k
OpenCode execution mode: cli
conversation: 81b9dbbf-66c5-4a7d-9ab3-23e821dfc998
```

Canonical product export:

```json
{
  "nodeCount": 1,
  "nodeTypeHistogram": {
    "sweep": 1
  }
}
```

No boxes or cylinders substitute for the bend.

The one canonical sweep contains:

- `profile.radius = tubeDiameter / 2`;
- `path.type = planarElbow90`;
- Z-plane frame;
- 1000 mm and 700 mm straight legs;
- Bend Radius parameter controlling centerline radius.

M0 integrity is clean:

```text
orphan nodes             0
orphan-only parameters   0
unused parameters        0
bendRadius               effective
tubeDiameter              effective
```

Native evaluation succeeds as one `single` result with no warnings.

Product-UI perturbation:

```text
Bend Radius 150 -> 180 mm
nominal max bounds   [1170.0000001, 850, 20.0000001]
perturbed max bounds [1200.0000001, 880, 20.0000001]
savedRevision=true
```

Dquark-Control execution:

```text
run 35633838120
request_id=brepia-sweep-gated-product-path-20260921-02
1 Playwright test passed (2.3m)
run_rc=0
```

This closes the exact representation gap that selected the sweep slice: the same product family that previously generated boxes/cylinder now generates the canonical path-defined sweep.

## Preserved architecture

The completed sweep does not change:

- canonical `schemaVersion: 1`;
- immutable BRep project revisions;
- M0 parameter effectiveness/integrity;
- M1 scalar depth/node limits and unit algebra;
- provider expression depth;
- M2 exact-one-body Boolean semantics;
- `single | instanceSet` discipline;
- accepted pattern/mirror behavior;
- accepted extrusion/multi-loop behavior;
- accepted full-revolve behavior;
- accepted Intrinsic XYZ transform behavior;
- build123d/OCCT as authoritative geometry runtime;
- Rhino/GHX as interoperability-only authority;
- strict parameter-only returned-GHX acceptance;
- exact STEP as native CAD export authority.

## Closeout and project pause

All four required sweep evidence layers are accepted:

```text
Gate A repository/CI       PASS
Gate B pinned native       PASS
Gate C installed Rhino     PASS
Gate D authenticated UI    PASS
```

The remaining actions are bounded closeout only:

1. reconcile/update stale planning-status wording;
2. run final repository verification on the documentation-closeout head;
3. require final PR checks green;
4. merge PR #50 to `master`;
5. verify accepted `master` state.

After that, Brepia is intentionally paused under:

```text
docs/brep_post_sweep_pause_decision_2026-09-21.md
```

No new modeling slice or feature phase is selected after sweep closeout.
