# BRep Phase 3H acceptance runbook

Date prepared: 2026-09-04

Branch:

```text
feature/brep-ai-native-editing
```

Starting checkpoint:

```text
7375c84a69bb60c0200f72cc26f6a4155be73fa7
Advance Phase 3 status to 3H
```

## Purpose

This is the reproducible browser/runtime acceptance run for Phase 3. It complements the already accepted 3D/3F/3G evidence by exercising the contracts together in one coherent flow.

Do not credit a step from visual appearance alone when the criterion is about persisted source, identity, lineage or stale-write behavior.

## Existing evidence that may be reused

The following identical behaviors already have live evidence and need not be rediscovered unless the fresh 3H flow contradicts them:

- explicit AI BRep creation reaches `/brep/$id` and native evaluation;
- local parameter preview + explicit Save creates one immutable source revision;
- refresh/reopen preserves saved source;
- native STEP product export works;
- BRep chat cache isolation, duplicate-submit guard and server-authoritative leaf synchronization;
- lifecycle-only BRep revisions are hidden from visible chat while remaining source history;
- Parametric-style desktop/mobile BRep workspace and compact revision list.

3H still requires a fresh cross-layer run for ID stability, structural diff, restore/branch, stale overlap and OpenSCAD normal-provider/OpenCode regression.

## A. Create one new canonical BRep acceptance project

From the explicit BRep AI creation surface, use a deliberately simple schema-supported prompt:

> Create a native parametric rectangular mounting plate. Width 120 mm, depth 80 mm and thickness 10 mm must be published numeric parameters in mm. Use a single box as the initial feature and keep the project simple so later edits can prove stable IDs.

Acceptance:

- conversation remains `parametric`;
- first AI build is native BRep, not OpenSCAD;
- one canonical source is persisted;
- native viewer renders;
- no false no-source flash or duplicate turn.

Open `project.brep.json` and record the baseline below.

### Baseline identity record

```text
conversation_id =
project.id      =
resultNodeId    =

parameters:
  width.id      =
  depth.id      =
  thickness.id  =

nodes:
  initial box.id =
```

Save/export the baseline canonical BRep JSON if useful for later comparison.

## B. Parameter-definition/default follow-up

Use AI follow-up:

> Change the existing Width parameter default from 120 mm to 140 mm. Set its minimum to 80 mm, maximum to 220 mm, step to 5 mm, and description to "Overall plate width". Preserve the existing project ID, all existing node IDs, and all existing published parameter IDs. Do not add or remove geometry.

Acceptance:

- project ID unchanged;
- initial box node ID unchanged;
- width/depth/thickness parameter IDs unchanged;
- Width definition has default 140, min 80, max 220, step 5 and requested description;
- no geometry node is spuriously replaced;
- tool/assistant structural summary reports a parameter change and no unintended node churn.

Record:

```text
parameter edit summary =
project.id stable      = yes/no
box.id stable          = yes/no
parameter IDs stable   = yes/no
```

## C. Feature-DAG follow-up

Use AI follow-up:

> Add one centered through-hole to the plate using only supported native BRep nodes. Publish a new Hole Radius parameter with default 5 mm, minimum 2 mm, maximum 15 mm and step 1 mm. Build the hole with a cylinder and subtract it from the existing plate. Preserve the project ID and every existing node/parameter ID; give genuinely new nodes and the new parameter new IDs.

This uses only the currently supported v1 node vocabulary: box, cylinder, transform and subtract.

Acceptance:

- project ID unchanged;
- original box node ID unchanged;
- width/depth/thickness IDs unchanged;
- new Hole Radius parameter has a new ID;
- genuinely new cylinder/transform/subtract nodes have new IDs;
- `resultNodeId` may legitimately move to the new subtract result;
- native viewer shows the hole;
- structural summary reports added nodes/new parameter without whole-project ID churn.

Record:

```text
DAG edit summary       =
new hole parameter id  =
new node IDs           =
old IDs stable         = yes/no
```

## D. Refresh/reopen persistence

Refresh the page, leave the project and reopen it from normal project navigation.

Acceptance:

- current saved source is still the holed 140 mm plate;
- canonical JSON retains the same project/old node/old parameter IDs;
- native viewer evaluates without a new source rewrite;
- browser console/network show no new error.

## E. Restore and branch

Restore the parameter-only revision from step B (the 140 mm plate before the hole). Confirm it becomes the active source, then issue:

> Add a 4 mm fillet to all edges parallel to the Z axis using the supported parallelToAxis selector. Preserve the project ID and all existing node/parameter IDs. Add only the new feature node needed for the fillet.

Acceptance:

- restore creates/selects an immutable branch rather than mutating old history;
- restored source has no hole;
- the branch AI edit follows the restored source, not the later hole source;
- original project/box/parameter IDs remain stable;
- the new fillet gets a new node ID;
- the hole nodes/parameter do not leak into this restored branch;
- refresh/reopen stays on the branch selected by `current_message_leaf_id`.

Record the visible revision/branch relationship and canonical IDs.

## F. Overlapping/stale AI edit

This is the browser-level stale guard test.

1. Start an AI follow-up that is slow enough to remain in flight, for example:

   > Change the Depth parameter default to 95 mm and keep all IDs stable.

2. While that AI turn is still running, change Width locally to a clearly different value such as 155 mm and click **Save parameter revision**.
3. Wait for the in-flight AI turn to finish.

Acceptance:

- the parameter-save revision becomes the newer active source;
- stale AI completion must not replace/reactivate it;
- the final canonical source still contains Width 155 mm;
- no stale AI `data-brep-project` becomes the active leaf;
- a stale failure/status is acceptable; silent replacement is not.

Also run the deterministic database race gate during 3H or 3I:

```bash
scripts/brep/test-brep-ai-atomic-race.sh
```

Both stale-first and AI-lock-first orderings must PASS.

## G. Native STEP from the accepted persisted state

After settling on the desired saved BRep branch/state:

1. export native STEP from the product;
2. confirm the export corresponds to the currently active saved project;
3. independently import/inspect it through the pinned build123d/OCCT path used by Phase 1/2 acceptance.

Acceptance:

- valid ISO STEP;
- independent import succeeds;
- bounds/dimensions match the active persisted source rather than an older revision;
- analytic cylindrical geometry is retained when the selected branch contains a cylinder/hole;
- no viewer mesh or stale source is used as STEP authority.

Record exact bounds/volume or equivalent independent inspection evidence.

## H. Ordinary OpenSCAD creation regression

From the ordinary Parametric/Generative creation surface, use:

> Create an OpenSCAD parametric box 50 mm wide, 40 mm deep and 30 mm high with published parameters.

Acceptance:

- ordinary creation still routes to OpenSCAD `build_parametric_model`;
- project opens in `/editor/$id`, not `/brep/$id`;
- parameters and browser OpenSCAD preview work;
- no native BRep source intent is inferred from prompt text.

## I. Multi-file OpenSCAD + OpenCode regression

Create or use an ordinary multi-file OpenSCAD project with `main.scad` and at least one support `.scad` file. If creating through AI, a suitable prompt is:

> Create an OpenSCAD project with `main.scad` and `lib/shape.scad`. `main.scad` must use the support file and render two parameterized boxes from a module defined in `lib/shape.scad`.

Then use an OpenCode follow-up such as:

> Update the support module in `lib/shape.scad` to add a small cylindrical mounting boss to each box while preserving the project entrypoint and the other file unchanged.

Acceptance:

- source kind remains OpenSCAD;
- OpenCode receives/returns the complete normalized OpenSCAD project snapshot;
- support files survive the round trip;
- `entrypointPath` remains stable;
- existing OpenSCAD asset/project reconciliation behavior remains intact;
- preview renders after follow-up;
- BRep routing/tooling is not selected.

The separate request to directly edit `main.scad` in the Project files UI is not part of this regression test.

## J. Console/network review

During A-I inspect browser console and network.

Acceptance:

- no new uncaught browser errors;
- no duplicate BRep submit/request for a single click;
- no transient false `no valid BRep source snapshot` error;
- no new `BRep evaluation capacity is currently busy` during normal parameter interaction;
- expected evaluation/chat/export requests return successful status except the deliberately stale AI completion, which must fail closed rather than overwrite current source.

## Static checkpoint before crediting 3H

Run from the real checkout after any acceptance fixes:

```bash
npm test -- --run \
  tests/brepAiProject.test.ts \
  tests/brepAiContext.test.ts \
  tests/brepAiTurn.test.ts \
  tests/brepProductChat.test.ts \
  tests/brepAiPersistence.test.ts \
  tests/brepAiAtomicSql.test.ts

npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
git status --short
git rev-parse HEAD
```

Full `npm test` and `scripts/brep/smoke-test.sh` remain mandatory for 3I closeout.

## 3H result

Status: **not yet accepted**.

Fill with exact browser/runtime evidence before changing this status.
