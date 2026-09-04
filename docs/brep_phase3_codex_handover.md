# BRep Phase 3I handover

## Mission

Continue `weaf/brepia` on branch:

```text
feature/brep-ai-native-editing
```

Phase 3A-3H are complete and accepted.

The only active Phase 3 step is:

```text
3I — Phase 3 closeout
```

Do not start new product work during closeout. In particular, do not start Phase 4 graph UX, Rhino/3DM/GH interoperability, generic STEP reconstruction, arbitrary Python/build123d authoring, or the separate requested `main.scad` Project-files editing feature.

Use small forward commits. Never amend/rebase/squash/force-push shared pushed history.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. `docs/brep_phase3_3h_live_checkpoint.md`
5. this handover

Use current branch implementation as source of truth and treat older phase/checkpoint files as evidence rather than active implementation plans.

## Phase 3 accepted architecture

Preserve these locks through closeout:

- `conversation.type = 'parametric'`; no separate BRep conversation type.
- `shared/brepProject.ts` is the canonical native BRep authoring schema.
- native source revisions are ordinary assistant `data-brep-project` snapshots.
- `current_message_leaf_id` selects active source/branch state.
- BRep AI returns complete canonical snapshots, not source patches.
- follow-up edits preserve project identity and unchanged node/parameter IDs.
- OpenSCAD creation/editing remains `build_parametric_model`; BRep remains `build_brep_project`.
- BRep source cannot contain arbitrary Python/build123d, STEP, tessellation authority or raw topology indices.
- the accepted rootless Podman build123d/OCCT evaluator remains the only native execution boundary.
- exact native STEP is derived from canonical BRep source.
- stale AI generation fails closed and cannot overwrite a newer leaf.
- OpenCode/Codex use the same canonical BRep validation semantics while OpenSCAD project/assets behavior remains unchanged.

## Accepted Phase 3H evidence

Detailed evidence:

```text
docs/brep_phase3_3h_live_checkpoint.md
```

3H is complete across the full cross-layer acceptance flow:

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

Independent STEP inspection observed native 140 x 80 x 10 mm bounds and at least one analytic cylindrical face.

Two acceptance findings were fixed during 3H:

1. BRep AI instructions now explicitly encode centered local primitive coordinates so centered/concentric geometry does not bake minimum-corner assumptions into transforms.
2. model visibility preference validation now supports large discovered catalogs with a bounded 16,384-ID limit; this fixed OpenCode model activation when the hidden-model list exceeded the previous 1,024-ID cap.

Accepted implementation checkpoint at the end of 3H:

```text
bb09063211f4cceb102461b13f94bf8b3233d18a
Cover large model visibility preference sets
```

## 3I branch state at entry

GitHub comparison against `master` at 3I entry:

```text
base/merge-base = 6e0ec92a439fb7e936a5d02001742df38a4c38d7
branch          = feature/brep-ai-native-editing
ahead           = 145
behind          = 0
```

No master reconciliation is currently required before closeout.

## 3I required full gate

Run from the real local checkout:

```bash
scripts/brep/smoke-test.sh &&
npm test &&
npm run typecheck &&
npm run lint &&
npm run build &&
git diff --check origin/master...HEAD &&
git status --short &&
git rev-parse HEAD
```

The user prefers shell verification chains to continue with `&&`, including after `git diff --check`.

Do not claim a gate PASS unless the command actually ran successfully. Do not claim CI unless GitHub Actions actually ran.

## Closeout review after green gate

When the full local gate passes:

1. reconcile the full branch diff against the Phase 3 execution contract;
2. verify no accidental Phase 4+/Rhino/GH/generic reconstruction scope entered the branch;
3. verify migrations/schemas/types are coherent;
4. update `docs/brep_phase3_status.md` and this handover with exact final evidence/checkpoint;
5. create or update a **draft PR** from `feature/brep-ai-native-editing` to `master`;
6. inspect PR diff and GitHub quality gate when available;
7. do **not** merge without explicit user approval.

## Separate queued Parametric request

After Phase 3 is closed, a separate requested ordinary Parametric/OpenSCAD feature is queued:

> Allow direct editing and saving of the project entrypoint (`main.scad`) from Project files, not only support modules.

Current implementation intentionally blocks entrypoint editing. Handle this as a separate focused checkpoint/branch after Phase 3 closeout.

When implementing it later, preserve:

- whole-project snapshot integrity;
- support files/assets and stable `entrypointPath`;
- parameter-write serialization;
- `metadata.originalCode` parameter-default semantics;
- active preview refresh/parameter reparse;
- AI-streaming write exclusion.

## Next action

Run only the full 3I local closeout gate. If green, record final Phase 3 evidence and prepare the draft PR against `master`.
