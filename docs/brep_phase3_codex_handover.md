# BRep Phase 3 handover

## Mission

Continue `weaf/brepia` on branch:

```text
feature/brep-ai-native-editing
```

Phase 3A-3I are **complete and accepted**.

No Phase 3 implementation step remains active. The branch is in PR-review state only.

Do not start new product work during the merge closeout. In particular, do not start Phase 4 graph UX, Rhino/3DM/GH interoperability, generic STEP reconstruction, arbitrary Python/build123d authoring, or the separate requested `main.scad` Project-files editing feature on this branch.

Use small forward commits. Never amend/rebase/squash/force-push shared pushed history.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. `docs/brep_phase3_3h_live_checkpoint.md`
5. this handover

Use current branch implementation as source of truth and treat older phase/checkpoint files as evidence rather than active implementation plans.

## Phase 3 accepted architecture

Preserve these locks through PR review and merge:

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

## Phase 3I closeout evidence

3I is complete and accepted. It added no new product functionality.

The full local closeout chain was run on the real local checkout and reported green by the user at:

```text
87bd2fd55d61e1f4eb0c19a00b337a3e7a788cf1
Advance Phase 3 handover to closeout
```

Verified chain:

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

The smoke run emitted:

```text
Fontconfig error: Cannot load default config file
```

This is recorded as a non-blocking headless/container warning because the same run continued successfully and returned:

```text
{"result":"cut","triangles":732}
```

Do not claim CI from this closeout run. The accepted evidence is the full local gate plus the already recorded authenticated browser/native acceptance.

## Phase 3 branch/base

Phase 3 was based on:

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
```

Working branch:

```text
feature/brep-ai-native-editing
```

At 3I entry the branch was 145 commits ahead and 0 behind `master`. Re-check the PR head/base before merge rather than relying on that historical count.

## PR-review rules

The only remaining work on this branch is review/merge administration:

1. inspect the complete draft-PR changed-file set against `docs/brep_phase3_execution.md`;
2. verify no accidental Phase 4+/Rhino/GH/generic reconstruction scope entered the branch;
3. verify migrations/schemas/types remain coherent;
4. inspect GitHub quality-gate results if/when they exist;
5. fix only genuine Phase 3 regressions or closeout defects with small forward commits;
6. do **not** merge without explicit user approval.

## Separate queued Parametric request

After Phase 3 is merged, a separate requested ordinary Parametric/OpenSCAD feature is queued:

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

Create or inspect the **draft PR** from `feature/brep-ai-native-editing` to `master`, review its complete changed-file set and any GitHub quality gate, and stop before merge unless the user explicitly approves it.
