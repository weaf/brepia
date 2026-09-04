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

Phase 3H — browser/runtime and regression acceptance — is **complete and accepted**.

Final accepted implementation checkpoint before this evidence update:

```text
bb09063211f4cceb102461b13f94bf8b3233d18a
Cover large model visibility preference sets
```

The user reported the complete 3H browser/runtime flow green on the real local authenticated Brepia installation. Final local repository checks also reported a clean worktree and:

```text
HEAD = bb09063211f4cceb102461b13f94bf8b3233d18a
```

No CI evidence is claimed by this checkpoint.

## A-C — canonical AI creation, parameter-definition edit and DAG edit

A fresh native BRep project was created through the explicit AI BRep product route.

Baseline canonical source (Revision 1):

```text
project.id       = mounting-plate
resultNodeId     = plate
parameter IDs    = width, depth, thickness
initial node ID  = plate
width default    = 120
```

The accepted parameter-definition follow-up preserved all existing identities and changed Width to:

```text
id          = width
default     = 140
min         = 80
max         = 220
step        = 5
description = Overall plate width
```

The accepted DAG follow-up preserved the existing project/node/parameter IDs and introduced:

```text
new parameter = hole_radius
new nodes     = hole_cyl, hole_transform, hole_cut
resultNodeId  = hole_cut
```

Expected structural semantics were observed: the existing `plate` node and existing parameter IDs remained stable, while genuinely new semantic objects received new IDs.

A-C identity/DAG contract: **PASS**.

### Centered-origin geometry finding and correction

The first centered-hole attempt produced:

```text
hole_transform.translate = [70, 40, 0]
```

Independent geometry inspection proved the box occupies centered local bounds, so that translation placed the cylinder at a corner rather than at the requested center.

This was a prompt/runtime semantic error, not an evaluator or STEP-export error. BRep instructions were hardened across normal-provider, OpenCode and Codex paths to state explicitly that box/cylinder primitives use centered local origins and that `transform.translate` is an offset from that origin.

The user reran the scenario after the hardening. The hole was generated at the correct center and remained centered after dimension changes.

Centered-hole semantic regression recheck: **PASS**.

## D — refresh/reopen persistence

The selected saved BRep source survived refresh, normal navigation away from the project and reopen. The project reopened from persisted canonical source rather than being regenerated from prompt/template state.

D: **PASS**.

## E — restore and branch

An earlier immutable source revision was restored/selected and a subsequent AI edit continued from that historical source. Later branch-only geometry did not leak into the restored branch.

This proves the active `current_message_leaf_id` lineage remains authoritative for BRep continuation and that restore/branch does not mutate historical snapshots.

E: **PASS**.

## F — overlapping/stale AI edit

A browser-level overlapping/stale generation scenario was exercised. A newer source/leaf change won while an older AI generation was still in flight. The late AI completion did not reactivate or overwrite the newer canonical source.

This matches the transactional `persist_brep_ai_revision(...)` compare-and-set contract.

F: **PASS**.

## G — independent native STEP inspection

The AI-edited BRep was exported through the native STEP path and independently imported/inspected in the pinned build123d/OCCT container.

Observed output:

```text
bounds_min = -70.0 -40.0 -5.0
bounds_max =  70.0  40.0  5.0
dimensions = 140.0 80.0 10.0
volume     = 111803.65045915058
analytic_cylindrical_faces = 1
Phase 3H STEP topology inspection PASS
```

The harmless headless warning:

```text
Fontconfig error: Cannot load default config file
```

did not affect import/topology inspection.

The dimensions matched the selected canonical source and the analytic cylindrical face proved that native topology, not viewer tessellation, was exported.

The measured volume also exactly matched the original corner-positioned cylinder snapshot, further proving STEP authority came from the persisted BRep source. The later centered-origin instruction fix was separately live rechecked as described above.

G: **PASS**.

## H — ordinary OpenSCAD regression

The normal Parametric/Generative creation path was exercised after BRep creation routing was in place.

Accepted behavior remained OpenSCAD-native:

- ordinary creation stayed on `/editor/$id` rather than `/brep/$id`;
- `build_parametric_model` remained the OpenSCAD creation tool;
- published parameters and browser OpenSCAD preview worked;
- BRep source intent was not inferred from prompt text.

H: **PASS**.

## I — multi-file OpenSCAD + OpenCode regression

A normal multi-file OpenSCAD project was exercised through OpenCode follow-up.

Accepted behavior:

- source kind remained OpenSCAD;
- the complete normalized OpenSCAD project snapshot crossed the OpenCode boundary;
- support files survived the round trip;
- `entrypointPath` remained stable;
- preview still rendered after the follow-up;
- BRep routing/tooling was not selected.

During this acceptance block, enabling an OpenCode model exposed a separate model-preference scaling bug: the settings UI legitimately held more than 7,500 hidden model IDs while the visibility payload validator capped arrays at 1,024 IDs. The local Supabase migration was confirmed applied; the failure occurred before DB persistence.

The visibility schema was hardened with a bounded 16,384-ID limit and regression coverage for large preference sets:

```text
bb09063211f4cceb102461b13f94bf8b3233d18a
Cover large model visibility preference sets
```

OpenCode activation/persistence then worked and the regression flow completed.

I: **PASS**.

## J — console/network review

The final browser/network review reported no new blocking errors from the accepted flow:

- no duplicate BRep submission from one click;
- no transient false `no valid BRep source snapshot` error;
- no normal-interaction `BRep evaluation capacity is currently busy` regression;
- no unintended BRep routing in OpenSCAD projects;
- stale completion remained fail-closed rather than overwriting current source.

J: **PASS**.

## 3H conclusion

All required 3H acceptance categories A-J are green:

```text
A  explicit AI BRep creation                 PASS
B  parameter-definition/default edit         PASS
C  feature-DAG edit + stable IDs             PASS
D  refresh/reopen                            PASS
E  restore -> branch lineage                 PASS
F  stale/overlap guard                       PASS
G  independent native STEP inspection        PASS
   centered-origin semantic regression       PASS
H  ordinary OpenSCAD creation regression     PASS
I  multi-file OpenSCAD + OpenCode regression PASS
J  console/network review                    PASS
```

Phase 3H is therefore **complete and accepted**.

The separate requested feature to edit/save OpenSCAD `main.scad` directly from Project files remains outside Phase 3 and must not be mixed into closeout.

Next step: **3I — Phase 3 closeout**.
