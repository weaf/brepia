# BRep Phase 3G-B Codex handover

## Mission

Continue `weaf/brepia` on branch:

```text
feature/brep-ai-native-editing
```

Phase 3A-3F are complete and accepted. 3G-A — existing BRep project AI follow-up product integration — is also complete and live accepted.

The only active step is:

```text
3G-B — explicit AI BRep creation routing
```

Do not start 3G-C polish, 3H broad acceptance, Phase 4 graph UX, Rhino/3DM/GH interoperability, generic STEP reconstruction, or arbitrary Python/build123d authoring until 3G-B is coherent and accepted.

Use small forward commits. Never amend/rebase/squash/force-push shared pushed history.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. this handover
5. `src/server/aiChat.ts`
6. `src/server/brepAiTurn.ts`
7. `src/server/brepAiTools.ts`
8. `shared/brepAiProject.ts`
9. `shared/brepAiContext.ts`
10. `shared/brepAiTool.ts`
11. `src/components/brep/BrepChatSession.tsx`
12. `src/views/BrepProjectView.tsx`
13. the product/home creation flow (`PromptView`/conversation creation/routing)
14. relevant OpenSCAD first-turn creation tests

Reconcile docs against actual branch implementation before editing.

## Current accepted product behavior

### Existing BRep follow-up

`/brep/$id` now combines the existing Parametric conversation lifecycle with the native BRep viewer.

The BRep product chat:

- uses the shared `parametric-chat` endpoint;
- uses server-executed `build_brep_project` and canonical `data-brep-project` persistence;
- does not execute the OpenSCAD browser compiler or `addToolOutput` path;
- does not client-auto-continue a BRep build;
- allows text/image context but rejects OpenSCAD-only STL/mesh context;
- reuses model selection and OpenCode CLI/Streaming selection;
- preserves retry/edit/restore/branch semantics on the same message tree.

`/editor/$id` and `/brep/$id` deliberately use different AI-SDK cached chat IDs because their client-tool semantics differ:

```text
/editor -> <conversation-id>
/brep   -> brep:<conversation-id>
```

A synchronous BRep submit guard prevents duplicate UI dispatch before AI-SDK status flips to `submitted`.

### Leaf/source synchronization hardening

Live 3G-A acceptance exposed three integration bugs and all are fixed:

1. A transient conversation/messages cache mismatch could make the strict BRep branch resolver throw `Native BRep message branch is missing <leaf>` and hit the page error boundary.
2. Shared Editor/BRep cached Chat state plus the small submit timing window could start duplicate BRep turns. Atomic BRep persistence correctly rejected the second turn as stale; the client now prevents the duplicate instead.
3. Optimistic client movement of `current_message_leaf_id` could briefly display `The active project branch has no valid BRep source snapshot.` even though persistence/evaluation were healthy.

Current product rules:

- a leaf absent from the current message snapshot is treated as temporarily unresolved, not as corrupted ancestry;
- a leaf that exists but has a broken parent chain still fails closed;
- BRep chat does not optimistically move the persisted conversation leaf for sends/finishes;
- persisted server state is authoritative;
- transient cache mismatch shows synchronization/loading state instead of a false source error.

The user reported the final focused gate and live `/brep/$id` follow-up flow green after these fixes.

Checkpoint before the 3G-A status closeout:

```text
9708f7ced0202f64de466ab04e093b0eca0f4e2c
Cover BRep leaf synchronization UX
```

Status closeout commit:

```text
3266ca195acc0c43451857a899eba6944b6408f0
Record Phase 3G-A product acceptance
```

## Locked architecture for 3G-B

### No new conversation type

Keep:

```text
conversation.type = 'parametric'
```

Do not add `brep` as a new conversation type and do not create a second history model.

### Explicit first-turn source intent

Current `aiChat.ts` routes to BRep tools only when `resolveActiveBrepAiSource(...)` finds an existing BRep source. Therefore an empty/new Parametric conversation currently defaults to OpenSCAD creation.

3G-B must make BRep creation an explicit product routing decision, not a prompt heuristic.

Preferred shape:

```text
Parametric conversation settings
  + explicit source/creation intent = brep
  -> first user turn uses BRep creation contract
  -> successful build persists first canonical data-brep-project
  -> once source exists, source-derived BRep routing is authoritative
```

A field such as `parametricSourceKind: 'brep'` in the existing JSON conversation settings is acceptable if current types/usage support it cleanly. Avoid a database migration solely for routing intent.

### Initial creation validation differs from follow-up validation

For follow-up BRep edits, `validateBrepAiFollowUp(previous, next)` enforces project ID continuity and stable identity policy.

For first-turn creation there is no previous project. The returned project must still:

- normalize through the canonical `BrepProject` schema;
- use only supported selector semantics;
- exclude Python/build123d/STEP/viewer mesh/raw topology authority;
- be complete, not a patch;
- persist as one canonical BRep source revision.

Do not fake a previous sample project merely to reuse the follow-up validator.

### Persistence

The existing atomic RPC `persist_brep_ai_revision(...)` is designed for activating an assistant revision against an exact current request leaf and is useful for first-turn BRep creation after the user message exists.

Before changing persistence, reconcile the actual request lifecycle carefully:

```text
new parametric conversation
-> first persisted user message becomes current leaf
-> AI request loads that leaf
-> BRep creation tool validates complete project
-> atomic assistant/source revision inserts only if that user leaf is still current
```

Prefer reusing the accepted RPC and immutable assistant/source semantics rather than adding a separate BRep-creation persistence path.

### Product entry flow

The current normal creation prompt flow creates a Parametric conversation and navigates to the ordinary editor. 3G-B needs an explicit BRep entry affordance/routing path that:

- creates/marks the Parametric conversation as BRep-intent before first AI generation;
- starts the first AI turn using BRep tools;
- navigates to `/brep/$id` once appropriate;
- does not change ordinary OpenSCAD creation behavior.

There is already a `New BRep project` product area with direct sample/import lifecycle functionality. Reconcile whether AI creation should start there, through a dedicated action/modal, or through the existing general prompt with an explicit source selector. Keep the implementation narrow; do not redesign the whole home screen.

## Required 3G-B tests

At minimum cover:

### Server routing

- new Parametric conversation with explicit BRep intent and no existing source selects `build_brep_project`;
- ordinary Parametric conversation with no BRep intent still selects `build_parametric_model`;
- after a canonical BRep source exists, source-derived BRep routing wins regardless of stale creation intent;
- malformed/unsupported BRep creation output fails closed;
- first BRep creation does not run follow-up project-ID continuity against a fabricated previous project.

### Persistence

- successful first-turn BRep creation creates exactly one canonical `data-brep-project` source revision;
- stale current-leaf mismatch still inserts nothing;
- project route can reopen the persisted first source.

### Product

- explicit AI BRep creation affordance marks the conversation before generation;
- successful creation navigates/lands in `/brep/$id` with chat + native viewer;
- ordinary OpenSCAD creation remains unchanged.

Run focused tests before broad gates.

## Live acceptance target for 3G-B

Use the real local/authenticated Brepia runtime and create a genuinely new BRep project through AI rather than starting from the Phase 1 cabinet sample.

Acceptance chain:

```text
explicit product BRep creation intent
-> first user prompt
-> BRep tool routing without previous source
-> complete canonical BrepProject
-> validation
-> atomic immutable assistant/source persistence
-> /brep/$id
-> native evaluator/viewer renders project
-> refresh/reopen preserves source
```

Also create one ordinary OpenSCAD project afterward to prove first-turn backward compatibility.

## Do not regress 3G-A

While implementing 3G-B preserve:

- BRep-specific chat cache isolation;
- duplicate-submit guard;
- server-authoritative leaf synchronization;
- transient leaf/message snapshot reconciliation;
- no false `no valid BRep source snapshot` flash;
- server-executed BRep tool boundary;
- OpenSCAD mesh/compiler paths remaining OpenSCAD-only.

## Verification gates

Focused tests first, then when 3G-B implementation is coherent:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
git status --short
```

Report branch HEAD and ahead/behind state. Do not claim CI evidence that has not actually run.

## Expected next checkpoint

Return:

- starting/final SHA;
- exact explicit creation-intent representation;
- first-turn server routing changes;
- creation-vs-follow-up validation split;
- persistence semantics;
- product entry/navigation behavior;
- focused/broad gate evidence;
- live acceptance completed or exact remaining browser steps;
- any remaining 3G-C work.
