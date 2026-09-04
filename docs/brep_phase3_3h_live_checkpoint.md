# BRep Phase 3H live acceptance checkpoint

Date: 2026-09-04

Branch:

```text
feature/brep-ai-native-editing
```

Acceptance runbook:

```text
docs/brep_phase3_3h_acceptance.md
```

## Status

Phase 3H is **partially accepted through G plus the centered-hole geometry regression recheck**. OpenSCAD normal-provider/OpenCode regression, console/network closeout, deterministic stale-race gate and the focused static checkpoint remain.

## A-C — canonical AI creation, parameter-definition edit and DAG edit

A fresh native BRep project was created through the explicit AI BRep product route.

Baseline canonical source (Revision 1) had:

```text
project.id       = mounting-plate
resultNodeId     = plate
parameter IDs    = width, depth, thickness
initial node ID  = plate
width default    = 120
width range      = 1..1000 step 1
```

The baseline consisted of one `box` node whose width/depth/height referenced the stable published parameters.

The accepted parameter-definition follow-up changed Width to:

```text
id          = width
default     = 140
min         = 80
max         = 220
step        = 5
description = Overall plate width
```

The later DAG revision (Revision 3) preserved:

```text
project.id       = mounting-plate
existing node ID = plate
existing params  = width, depth, thickness
```

and introduced genuinely new semantic objects:

```text
new parameter = hole_radius
new nodes     = hole_cyl, hole_transform, hole_cut
resultNodeId  = hole_cut
```

No whole-project ID churn occurred. The structural change therefore has the expected identity/diff semantics:

```text
project:
  resultNodeId: plate -> hole_cut

parameters:
  added: hole_radius
  changed: width
  unchanged: depth, thickness

nodes:
  added: hole_cyl, hole_transform, hole_cut
  unchanged: plate
```

### 3H geometry-intent finding and correction

The original C prompt requested a **centered** through-hole, but Revision 3 contained:

```text
hole_transform.translate = [70, 40, 0]
```

Independent STEP bounds later proved the plate occupies:

```text
X = -70 .. 70
Y = -40 .. 40
Z =  -5 .. 5
```

Therefore `[70,40,0]` is a plate corner, not its center. The persisted BRep snapshot was schema-valid and identity-stable, but the AI had inferred minimum-corner coordinate semantics instead of the evaluator's centered-origin primitive semantics.

This was not a STEP/export error and did not invalidate the stable-ID/DAG contract exercised by A-C. It was a real prompt/runtime semantic acceptance finding.

The native BRep instructions were hardened after the finding:

- `tool.build_brep_project` states that box/cylinder primitives are centered at their local origin;
- `transform.translate` is explicitly a displacement from that centered origin, not an absolute coordinate from a minimum corner;
- a concentric cylinder in a centered box normally stays at `[0,0,0]`;
- numeric half-dimension transforms must not be baked in when a relation is intended to stay parametric;
- OpenCode and Codex BRep transport instructions carry the same rule;
- instruction-catalog regression coverage asserts the rule remains present.

The user then pulled the hardening and reran the centered-hole AI scenario. The hole was generated at the correct center and remained centered when dimensions were changed.

A-C identity/DAG contract: **PASS**.
Centered-hole geometric intent after hardening: **PASS**.

## D — refresh/reopen persistence

The user reported the refresh/reopen step green. The selected saved BRep source remained canonical and the native project reopened correctly rather than being regenerated from prompt text or a template.

D: **PASS**.

## E — restore and branch

The user reported restore -> branch acceptance green. An earlier immutable BRep source was restored/selected and a subsequent AI edit continued from that historical source rather than leaking later branch geometry/state into the restored lineage.

This proves the active `current_message_leaf_id` source lineage is used for AI continuation and that restore/branch remains immutable rather than mutating historical snapshots.

E: **PASS**.

## F — overlapping/stale AI edit

The user reported the browser stale-overlap scenario green. A newer branch/source change won while an AI generation anchored to the older request leaf was still in flight. The late AI completion did not reactivate or overwrite the newer canonical source.

This is the browser-level counterpart to the accepted transactional `persist_brep_ai_revision(...)` compare-and-set contract.

The deterministic database race script remains required during 3H/3I closeout:

```bash
scripts/brep/test-brep-ai-atomic-race.sh
```

F browser stale race: **PASS**.

## G — independent native STEP inspection

Revision 3 was exported through the BRep product's native STEP path and then imported independently in the pinned `build123d-0.11.1` / OCCT container rather than inspected through the Brepia viewer.

Independent inspection reported:

```text
bounds_min = -70.0 -40.0 -5.0
bounds_max =  70.0  40.0  5.0
dimensions = 140.0 80.0 10.0
volume     = 111803.65045915058
analytic_cylindrical_faces = 1
Phase 3H STEP topology inspection PASS
```

The harmless headless container warning

```text
Fontconfig error: Cannot load default config file
```

did not affect STEP import or topology inspection.

The dimensions exactly match the active canonical 140 x 80 x 10 mm source. The analytic cylindrical-face check proves native STEP retained analytic cylinder topology rather than exporting viewer tessellation as authority.

The observed volume is also internally consistent with the original persisted, mispositioned Revision 3 source. A full 140 x 80 x 10 plate has volume 112000 mm^3. With a radius-5 cylinder centered at the plate corner `(70,40)`, only one quarter of the cylinder intersects the plate, giving:

```text
112000 - (pi * 5^2 * 10 / 4)
= 111803.650459...
```

This agreement is evidence that STEP was derived from the actual active BRep snapshot rather than an older/expected visual state. The placement mistake was the AI coordinate-semantics finding recorded above, not an export discrepancy.

G: **PASS**.

## Remaining 3H acceptance

Still required before 3H can be marked complete:

1. create an ordinary OpenSCAD project through the normal Parametric/Generative path and confirm `/editor/$id` + `build_parametric_model` behavior;
2. exercise a multi-file OpenSCAD follow-up through OpenCode while preserving entrypoint/support-file project state;
3. perform final browser console/network review;
4. run the deterministic `scripts/brep/test-brep-ai-atomic-race.sh` gate;
5. run the focused 3H static gate from the real checkout.

Do not mix the separate requested direct `main.scad` Project-files editing feature into this acceptance checkpoint.
