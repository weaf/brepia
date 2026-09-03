# BRep Phase 3D/3E Codex handover

## Scope

Continue `weaf/brepia` on:

```text
feature/brep-ai-native-editing
```

This handover is for **remaining 3D normal-provider wiring + core 3E persistence/stale guards only**.

Do not start:

- 3F OpenCode/Codex/external-agent parity;
- 3G product creation/UI routing;
- 3H browser acceptance beyond what is needed to verify 3D/3E locally;
- Phase 4 graph/editor UX;
- Rhino/3DM/Grasshopper work;
- arbitrary Python/build123d authoring;
- browser-authoritative OCCT.

Use small forward commits. Never amend/rebase/squash already pushed shared history.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. this file
5. `shared/brepAiProject.ts`
6. `shared/brepAiTool.ts`
7. `shared/brepAiContext.ts`
8. `shared/brepProjectArtifact.ts`
9. `src/server/aiChat.ts`
10. `src/server/chatToolPersistence.ts`
11. `src/services/brepProjectService.ts`
12. `supabase/schemas/triggers.sql`
13. relevant current migrations/functions/RLS before adding SQL

Reconcile all documentation against actual branch implementation before changing code.

## Verified foundation

User-reported real local checkout verification on 2026-09-03 is green through the separable 3D checkpoint:

```text
npm test -- --run tests/brepAiContext.test.ts tests/brepAiTool.test.ts tests/brepAiProject.test.ts tests/aiInstructionCatalog.test.ts tests/brepProjectArtifact.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
npm run build      PASS
git diff --check origin/master...HEAD  PASS (no output)
```

Earlier 3B/3C focused gates are also documented green in `docs/brep_phase3_status.md`.

Do not redo completed 3A-3C architecture unless current code contradicts the docs.

## Locked architecture

### Canonical source

AI edits the complete canonical `BrepProject` only.

Never use as editable source:

- build123d/Python;
- OCCT runtime objects;
- STEP;
- viewer mesh/tessellation;
- raw topology indices.

### Tool split

Keep legacy OpenSCAD:

```text
build_parametric_model
```

strictly OpenSCAD.

Native BRep uses:

```text
build_brep_project
```

Do not polymorphize legacy OpenSCAD tool semantics.

### Source authority

Successful BRep edits must converge to the existing immutable:

```text
data-brep-project
```

artifact lifecycle. A tool call is not a second source of truth.

### Identity

Follow-up validation uses `validateBrepAiFollowUp(previous, next)`:

- project ID must remain stable;
- continuing nodes/parameters should retain IDs;
- genuinely new objects get new IDs;
- invalid selectors/references/cycles fail closed;
- structural diff is derived diagnostics only.

## Critical identity distinction

Three IDs matter and must not be conflated.

### 1. Request leaf ID

`conversation.current_message_leaf_id` captured at generation start.

For an ordinary BRep follow-up this will normally be the new **user** message.

This is the expected leaf for stale-result activation.

### 2. Source revision message ID

Resolved by `resolveActiveBrepAiSource(branchMessages)` as the nearest preceding assistant `data-brep-project` revision.

Its project is the exact `previous` snapshot for `validateBrepAiFollowUp()`.

### 3. Response message ID

The new immutable assistant revision produced by the AI turn.

The accepted canonical `data-brep-project` should live on this assistant revision rather than in a separate parallel history model.

## Critical 3E database finding

Current repository trigger:

```sql
CREATE OR REPLACE FUNCTION public.update_conversation_leaf()
RETURNS trigger
...
UPDATE conversations
SET current_message_leaf_id = NEW.id
WHERE id = NEW.conversation_id;

CREATE TRIGGER update_leaf_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_leaf();
```

The trigger unconditionally advances the conversation leaf after every message insert.

Therefore this pattern is **not** a real stale guard:

```text
INSERT new message
then UPDATE conversations
WHERE current_message_leaf_id = expected_old_leaf
```

because the insert trigger has already changed the leaf before the conditional update runs.

Do not claim 3E stale safety using only that sequence.

### Recommended minimal atomic design

Prefer a focused transactional PostgreSQL function/RPC rather than rewriting the global trigger.

The function should, in one transaction:

1. identify/authorize the target conversation using existing RLS/function conventions;
2. lock its row with `SELECT ... FOR UPDATE`;
3. compare `current_message_leaf_id` with the expected **request leaf ID**;
4. if mismatched, return a stale/not-accepted result and do **not insert** the BRep revision;
5. if matched, insert the assistant response/source revision;
6. allow the existing `AFTER INSERT` trigger to advance the locked conversation to the new response ID;
7. return accepted/new-message identity.

Why this works:

- if another user/restore action wins first, the locked row exposes a different leaf and the AI revision is not inserted;
- if AI obtains the row lock first, concurrent leaf-changing inserts/updates serialize behind it;
- after AI commits, a genuinely later user message may advance the leaf and correctly wins;
- global existing message-insert behavior remains unchanged.

Reconcile exact SQL placement, migration naming, grants, RLS and generated type workflow with current repo conventions before implementing. `shared/database.ts` is generated; do not hand-edit it.

If a simpler equally atomic design exists in the actual local schema, document why it is safe under concurrent insert-trigger execution before using it.

## Remaining 3D implementation

### A. Resolve branch before Parametric tool routing

`src/server/aiChat.ts` currently constructs Parametric tools before it loads `branchMessages`.

For BRep, tool choice depends on the active branch source. Reorder narrowly so the loaded active branch is available before final Parametric tool selection.

Do not change Creative behavior.

### B. Resolve active BRep source

For Parametric conversations:

```ts
const activeBrepSource = resolveActiveBrepAiSource(branchMessages)
```

Fail closed if the helper reports a malformed nearest BRep source marker.

If no active BRep source exists, preserve the current OpenSCAD path exactly.

### C. Inject only the active BRep snapshot into model context

Do **not** blindly convert every historical `data-brep-project` data part through `convertToModelMessages()`. That would expose stale revisions as competing source authority.

Preferred direction:

- use `context.brep_project`;
- render it with `serializeBrepAiProjectContext(activeBrepSource.project)`;
- append/inject that rendered context into the resolved Parametric system/model context for the active turn only.

The model should receive the canonical project JSON but not source message IDs, database IDs, STEP, mesh or runtime objects.

### D. Source-kind-aware tools

For active BRep:

```text
build_brep_project + answer_user
```

For ordinary OpenSCAD Parametric:

```text
build_parametric_model + answer_user
```

Creative remains unchanged.

Load `tool.build_brep_project` through the existing instruction runtime/profile system, not hard-coded text.

### E. Dynamic build-tool forcing/checking

Current `prepareStep`, `stopWhen`, auto-tool-choice fallback and error logging hard-code `build_parametric_model`.

Refactor narrowly around a source-appropriate build tool name.

Normal-provider BRep should force/check:

```text
build_brep_project
```

OpenSCAD behavior must remain byte-for-byte/semantically compatible where practical.

### F. Keep 3F out

If the selected transport is OpenCode streaming/CLI or Codex/external agent while an active BRep source is present, do not silently run the OpenSCAD adapter.

Until 3F, return a clear bounded error such as native BRep external-agent editing not yet supported.

Do not extend `cliAgents.ts` or `opencodeAgentResult.ts` in this packet.

## Server-side BRep tool execution

The current client `ChatSession` only knows how to execute `build_parametric_model` and `answer_user`.

Do **not** broaden client OpenSCAD compilation logic merely to make BRep work before 3G.

For the normal-provider BRep path, prefer an `aiChat`-specific server execution wrapper around `chatTools.build_brep_project` that:

1. parses/normalizes the complete candidate;
2. validates it against `activeBrepSource.project` with `validateBrepAiFollowUp()`;
3. returns the strict `brepAiBuildOutputSchema` success result;
4. uses the canonical structural diff summary as the machine-derived success message;
5. does not execute build123d/OCCT or persist source inside the tool executor.

Persistence/activation should remain a separate finalization step so the canonical source is the assistant `data-brep-project` revision, not tool output.

If AI SDK semantics require a different narrow implementation, preserve the same authority separation and document it.

## 3E response finalization/persistence

For a successful normal-provider BRep turn:

1. identify the final/last successful `tool-build_brep_project` candidate in the assistant response;
2. re-run canonical candidate + previous→next identity validation before persistence; never trust the earlier tool result alone;
3. build the canonical artifact with `createBrepProjectArtifact({ title, version, source: { kind: 'brep', source: validatedProject } })`;
4. append one `data-brep-project` part to the same immutable assistant response message;
5. persist that assistant revision only through the atomic expected-request-leaf path described above;
6. if stale, do not activate or insert a source revision through a path that can move the active leaf;
7. keep structural diff/summary derived from the anchored previous snapshot and accepted next snapshot.

Avoid introducing another BRep source message if the existing assistant response can safely carry the canonical data part.

Do not evaluate native BRep geometry before validation/persistence merely to decide source validity. Native evaluation remains a derived runtime concern.

## Multi-build behavior

A model may call `build_brep_project` more than once in one normal-provider turn.

Only the final accepted build candidate should become the canonical `data-brep-project` source for that assistant revision.

Earlier tool calls may remain conversational/tool diagnostics but must not create competing source revisions.

## Stale behavior

Required minimum behavior:

- generation starts from request leaf `U2` and source revision `A1`;
- user restores/branches/edits so active leaf becomes something other than `U2` before generation commits;
- generated BRep may still be schema-valid against `A1`;
- atomic persistence detects expected request leaf mismatch;
- stale result does not become active and does not corrupt the newer branch.

Persisting stale branch evidence is optional for this first 3E implementation. Failing closed without inserting the stale source is acceptable and simpler, provided behavior is explicit and tested.

## Tests to add/adjust

At minimum cover:

### Normal-provider routing

- active BRep source selects `build_brep_project`, not `build_parametric_model`;
- no BRep source preserves existing OpenSCAD tools;
- BRep model context contains exactly the resolved active canonical snapshot, not older branch revisions;
- malformed nearest BRep source fails closed;
- BRep + external-agent transport fails clearly without entering OpenSCAD adapter code.

### Tool validation

- parameter-definition/default follow-up preserves project/node IDs;
- DAG edit/add node returns valid complete snapshot and diff summary;
- project ID replacement fails;
- raw topology selector fails;
- whole-node-ID churn fails according to shared policy.

### Persistence

- accepted BRep response carries one canonical `data-brep-project` part;
- persisted source corresponds to final successful BRep tool candidate;
- request leaf is passed as expected stale guard;
- source revision project is used as previous identity anchor;
- stale result does not advance active leaf;
- invalid result creates no active source revision.

### Database race

With real local Supabase if feasible, exercise the transactional helper under competing leaf changes. Prove the stale completion cannot win simply because `update_leaf_trigger` fires.

### Regression

Keep current OpenSCAD tests green, especially tool/recovery/import/multi-file behavior. Do not add BRep handling to OpenSCAD-only helpers such as `shared/parametricParts.ts` unless strictly necessary and reviewed.

## Verification gates

Run focused tests first, then:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

Run relevant Supabase/local SQL verification for the atomic stale guard.

Do not report 3E complete without concrete race evidence against the actual local DB behavior.

## Handoff result expected from Codex

Return:

- starting and final commit SHA;
- files changed;
- concise architecture summary;
- exact stale-guard implementation and why the insert trigger cannot defeat it;
- focused and full test/gate results;
- any local migration/reset/apply commands the user must run;
- remaining manual/browser checks;
- `git status --short`;
- branch ahead/behind state.

If the implementation reveals that 3D and 3E cannot be safely completed without entering 3F/3G, stop at the decision gate, document the blocker, and do not broaden scope.