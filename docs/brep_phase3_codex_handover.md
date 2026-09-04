# BRep Phase 3H handover

## Mission

Continue `weaf/brepia` on branch:

```text
feature/brep-ai-native-editing
```

Phase 3A-3G are complete and accepted.

The active Phase 3 step is:

```text
3H — browser/runtime and regression acceptance
```

Do not start Phase 4 graph UX, Rhino/3DM/GH interoperability, generic STEP reconstruction, or arbitrary Python/build123d authoring.

Use small forward commits. Never amend/rebase/squash/force-push shared pushed history.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. `docs/brep_phase3_3g_live_checkpoint.md`
5. this handover
6. `src/views/BrepProjectView.tsx`
7. `src/components/brep/BrepProjectEditor.tsx`
8. `src/components/brep/BrepChatSession.tsx`
9. `src/server/aiChat.ts`
10. `src/server/brepAiTurn.ts`
11. `shared/brepAiContext.ts`
12. `shared/brepAiProject.ts`
13. `src/server/brepAiPersistence.ts`
14. `src/services/brepProjectService.ts`

Reconcile docs against actual branch implementation before editing.

## Accepted Phase 3G product state

Accepted live checkpoint before the 3G evidence commit:

```text
4522865f55bdd8bbf720ff79c67c1fedb149f0d7
Cover Parametric-style BRep sidebar chrome
```

3G evidence commit:

```text
75074fc60e46bd7ffe4fa5f6c88aa8661c2d6da9
Record Phase 3G product acceptance
```

Detailed evidence: `docs/brep_phase3_3g_live_checkpoint.md`.

### Explicit AI BRep creation

The product keeps:

```text
conversation.type = 'parametric'
```

New BRep AI creation is driven by explicit persisted product/source intent, not prompt heuristics. The first native turn can select `build_brep_project` without an existing source and validates the result as canonical creation rather than fabricating previous-project identity.

After the first canonical `data-brep-project` exists, source-derived BRep routing becomes authoritative again.

Ordinary OpenSCAD first-turn creation remains unchanged and uses `build_parametric_model`.

### Existing BRep follow-up

`/brep/$id` uses the same Parametric conversation/message lifecycle while keeping a BRep-specific cached chat ID and server-executed BRep tools.

Preserve:

- `brep:<conversation-id>` cache isolation from `/editor`;
- synchronous duplicate-submit guard;
- server-authoritative `current_message_leaf_id` synchronization;
- temporary conversation/message cache mismatches render synchronization state rather than false no-source errors;
- OpenSCAD-only mesh/compiler behavior stays out of native BRep turns;
- canonical source persistence stays atomic and stale-guarded.

### Parameter/edit lifecycle

Accepted product behavior:

- changing BRep parameters updates native preview locally;
- focus changes do not create source revisions;
- explicit **Save parameter revision** creates one immutable canonical source revision;
- AI always follows the latest saved canonical source, not unsaved preview values;
- native preview evaluation is debounced/serialized across remounts so rapid changes do not race the accepted one-slot evaluator;
- lifecycle-only source messages remain authoritative history but are hidden from the visible AI chat branch.

### Shared Parametric-style BRep workspace

The BRep route now reuses `ConversationView`:

```text
Desktop: Chat | Preview | Parameters
Mobile:  Chat + shared model/parameters bottom sheet
```

The right panel now includes:

- Parametric-style header/spacing;
- `Project files` with `project.brep.json` canonical-source inspection;
- Parameters;
- explicit parameter Save;
- compact collapsible revision history;
- approximately five visible revision rows with internal scroll;
- select/restore actions;
- safe Delete revision product tombstones;
- sticky Parametric-style export control;
- native STEP and canonical BRep JSON/package export choices.

Delete revision intentionally does not physically delete a message-tree node. Hidden revision IDs are stored in conversation settings so immutable ancestry required by AI retry/branch/source resolution is preserved. The active revision cannot be deleted.

The user reported all 3G-C browser checks green on desktop/mobile, including refresh/reopen behavior and native STEP export.

## 3H acceptance contract

Run the real local authenticated browser/native BRep runtime against the accepted Phase 3 implementation.

Minimum acceptance from `docs/brep_phase3_execution.md`:

1. create a BRep project through AI;
2. make a parameter-definition/default follow-up edit;
3. make a feature-DAG follow-up edit adding or modifying a feature;
4. verify unchanged project/node/parameter IDs remain stable;
5. inspect structural diff/summary;
6. refresh/reopen and verify persisted source;
7. restore an earlier revision, branch with another AI edit and verify lineage;
8. trigger an overlapping/stale edit scenario and verify newer active state wins;
9. export native STEP from the AI-edited persisted state and independently inspect it;
10. run an OpenSCAD AI creation and multi-file follow-up through normal provider/OpenCode paths;
11. inspect browser console/network for new errors.

Do not dilute these checks into a visual smoke test. 3H is the cross-layer acceptance gate for the Phase 3 contracts already implemented.

## Recommended 3H order

Use one new AI-created BRep project and keep its exact IDs/results as evidence.

Suggested sequence:

```text
A. explicit AI BRep create
B. record project/node/parameter IDs
C. parameter-definition/default AI follow-up
D. feature-DAG AI follow-up
E. compare IDs + structural summaries
F. refresh/reopen
G. restore old source + branch with a different AI edit
H. stale/overlap test
I. native STEP export + independent import/inspection
J. ordinary OpenSCAD creation regression
K. multi-file OpenSCAD follow-up regression
L. console/network review
```

Reuse already accepted 3G browser evidence where it proves an identical criterion, but do not claim a 3H criterion unless the required cross-layer behavior has actually been exercised.

## Static/final gates

3H may add only narrow fixes required by acceptance findings. After 3H is coherent, 3I closeout will run:

```bash
scripts/brep/smoke-test.sh
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

Do not claim CI evidence unless CI actually ran.

## Separate Parametric request

A separate product request has been identified for ordinary Parametric/OpenSCAD workspaces: allow direct editing and saving of the project entrypoint (`main.scad`) from `ProjectFilesEditor`, not only support modules.

Current implementation deliberately blocks this in both `ProjectFilesEditor.tsx` and `EditorView.tsx`.

That feature is feasible, but it is **not part of BRep Phase 3H**. Handle it as its own focused Parametric workspace checkpoint/branch after Phase 3 is coherent, unless the user explicitly reprioritizes it.

When implemented, preserve:

- project snapshot integrity;
- support files/assets/entrypointPath;
- parameter-write serialization;
- metadata/originalCode default semantics;
- active preview refresh/reparse;
- AI-streaming write exclusion.

## Next action

Begin only **3H — browser/runtime and regression acceptance**. Start by reconciling the accepted 3G checkpoint against the exact 3H acceptance list and identifying which criteria are already evidenced versus which still need a fresh live run.