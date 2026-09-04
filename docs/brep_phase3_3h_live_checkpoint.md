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

Phase 3H is **partially accepted through A-F**. Native STEP independent inspection, OpenSCAD normal-provider/OpenCode regression, console/network closeout and the focused static checkpoint remain.

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

The later accepted DAG revision (Revision 3) preserved:

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

The complete Revision 3 source retained Width 140 and added a centered cylindrical subtraction with Hole Radius default 5 mm. No whole-project ID churn occurred.

The structural change therefore has the expected semantics:

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

One schema-capability limitation was observed but is not a Phase 3 acceptance failure: the current v1 scalar grammar has parameter references but no arithmetic expression such as `width / 2`, so the AI represented the then-current center as literal transform coordinates `[70, 40, 0]`. Future derived-expression support can address dynamic re-centering after later width/depth changes.

A-C: **PASS**.

## D — refresh/reopen persistence

The user reported the refresh/reopen step green. The selected saved BRep source remained canonical and the native project reopened correctly rather than being regenerated from prompt text or a template.

D: **PASS**.

## E — restore and branch

The user reported restore -> branch acceptance green. An earlier immutable BRep source was restored/selected and a subsequent AI edit continued from that historical source rather than leaking later branch geometry/state into the restored lineage.

This proves the active `current_message_leaf_id` source lineage is used for AI continuation and that restore/branch remains immutable rather than mutating historical snapshots.

E: **PASS**.

## F — overlapping/stale AI edit

The user reported the browser stale-overlap scenario green. A newer branch/source change won while an AI generation anchored to the older request leaf was still in flight. The late AI completion did not reactivate or overwrite the newer canonical source.

This is the browser-level counterpart to the already accepted transactional `persist_brep_ai_revision(...)` compare-and-set contract.

The deterministic database race script remains required during 3H/3I closeout:

```bash
scripts/brep/test-brep-ai-atomic-race.sh
```

F browser stale race: **PASS**.

## Remaining 3H acceptance

Still required before 3H can be marked complete:

1. select the known holed 140 x 80 x 10 mm Revision 3 source;
2. export native STEP and independently import/inspect it through the pinned build123d/OCCT image;
3. confirm bounds correspond to 140 x 80 x 10 mm and analytic cylindrical geometry is retained;
4. create an ordinary OpenSCAD project through the normal Parametric/Generative path and confirm `/editor/$id` + `build_parametric_model` behavior;
5. exercise a multi-file OpenSCAD follow-up through OpenCode while preserving entrypoint/support-file project state;
6. perform final browser console/network review;
7. run the focused 3H static gate from the real checkout.

Do not mix the separate requested direct `main.scad` Project-files editing feature into this acceptance checkpoint.
