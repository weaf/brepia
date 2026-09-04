# BRep Phase 3G live acceptance checkpoint

Date: 2026-09-04

Branch:

```text
feature/brep-ai-native-editing
```

Accepted implementation checkpoint before this evidence file:

```text
4522865f55bdd8bbf720ff79c67c1fedb149f0d7
Cover Parametric-style BRep sidebar chrome
```

## Result

Phase 3G — Product AI editing integration — is accepted.

3G-A existing-project follow-up integration, 3G-B explicit first-turn BRep creation routing and 3G-C product/UX polish have all been exercised in the real authenticated browser/native BRep runtime.

## 3G-B — explicit AI BRep creation routing

The accepted product path keeps:

```text
conversation.type = 'parametric'
```

and uses explicit BRep creation/source intent rather than prompt heuristics. The first BRep turn can therefore route to `build_brep_project` without fabricating a previous project. Initial output is canonical-creation validated, persisted as the first canonical `data-brep-project`, and subsequent routing becomes source-derived again.

Ordinary Parametric/OpenSCAD creation remains on `build_parametric_model`.

Live acceptance created a genuinely new native BRep project from the BRep product entry and landed in `/brep/$id` with the native viewer and parameter controls. A follow-up AI edit added a hole and additional published parameters while preserving the BRep project lifecycle.

## Product hardening discovered during acceptance

Browser acceptance exposed a lifecycle/preview interaction that static tests did not catch:

- parameter commits could rapidly remount/evaluate native BRep previews and hit the single evaluator concurrency guard;
- lifecycle-only BRep source revisions appeared as empty/cube-only chat rows;
- focus changes around parameter fields could create excessive revisions.

The accepted behavior is now:

- native preview evaluation is debounced and serialized across preview remounts;
- stale intermediate preview values are skipped and latest-value wins;
- lifecycle-only BRep source revisions remain in the authoritative message/source tree but are omitted from the visible/cached AI chat branch;
- parameter edits are local live-preview drafts;
- only explicit **Save parameter revision** creates a new immutable source revision;
- moving focus between parameter fields creates no revision;
- AI follow-up continues from the latest saved canonical source, never from an unsaved local preview draft.

## 3G-C — shared product shell and revision UX

The native BRep workspace now reuses the same `ConversationView` product shell as ordinary Parametric design:

- desktop: resizable/collapsible Chat | Preview | Parameters layout;
- mobile/tablet: chat-first layout with the model/parameters in the shared bottom-sheet pattern;
- a Model action reopens the mobile preview sheet;
- BRep parameters use the Parametric visual hierarchy/spacing;
- project source is exposed as `project.brep.json` for direct canonical JSON inspection;
- revision history is collapsed by default, latest-first, bounded to approximately five visible rows and internally scrollable;
- active revision is marked;
- Restore remains available;
- Delete revision removes a revision from the product list while retaining its immutable lineage record internally so parent-chain/AI retry/branch semantics cannot be corrupted;
- active revision cannot be removed until another source revision is selected.

Revision removal is intentionally a product tombstone stored in conversation settings rather than a physical `DELETE FROM messages`.

## Export UX

The BRep parameter/sidebar panel now mirrors the Parametric export affordance at the bottom of the panel.

Supported product choices include:

- native `.STEP`;
- canonical `.BREP JSON` / Brepia BRep project package.

Canonical BRep JSON export requires saved source state. Native STEP may use the current evaluated parameter preview as before.

## Reported browser/runtime acceptance

The user reported the following 3G-C browser checks green on 2026-09-04:

1. desktop resize/collapse behavior;
2. unsaved parameter changes do not create revisions;
3. explicit Save creates one revision;
4. compact revision history with internal scrolling;
5. selecting older source revisions works;
6. non-active revisions can be removed from the visible revision list;
7. hidden revisions remain hidden after refresh/reopen;
8. parameter save and AI follow-up continue to work after revision cleanup;
9. mobile model/parameter sheet can be closed and reopened.

The subsequent Parametric-style BRep sidebar checks were also reported green, including native STEP export.

No new `BRep evaluation capacity is currently busy` regression was reported after serialized/latest-value native preview evaluation.

## Static verification reported during 3G

The implementation checkpoints were repeatedly verified from the real local checkout with focused BRep product tests plus TypeScript/lint/build/diff gates. The final sidebar browser acceptance was performed after those gates had already been reported green for the preceding 3G-C checkpoint.

Before Phase 3 closeout, 3I must still run the full repository gates required by `docs/brep_phase3_execution.md`.

## Architecture preserved

3G did not add:

- a `brep` conversation type;
- a parallel AI history model;
- prompt-text heuristics for selecting native BRep creation;
- arbitrary Python/build123d execution authority;
- raw topology indices;
- Phase 4 graph editing;
- Rhino/3DM/GH interoperability;
- generic STEP reconstruction.

3G also preserves the accepted 3G-A protections:

- BRep-specific chat cache isolation;
- duplicate-submit guard;
- server-authoritative leaf synchronization;
- transient cache reconciliation instead of false no-source errors;
- server-executed `build_brep_project`;
- OpenSCAD compiler/mesh behavior remaining OpenSCAD-only.

## Next Phase 3 step

Next is **3H — browser/runtime and regression acceptance** from `docs/brep_phase3_execution.md`.

Do not mix the separate requested Parametric/OpenSCAD `main.scad` direct-edit feature into 3H. That feature should be handled as its own focused Parametric workspace checkpoint/branch after the BRep Phase 3 boundary is coherent, unless explicitly reprioritized.