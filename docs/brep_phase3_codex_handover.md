# BRep Phase 3F Codex handover

## Mission

Continue `weaf/brepia` on branch:

```text
feature/brep-ai-native-editing
```

Current handover checkpoint:

```text
e997f6f52583e934387b4f8e67757d7d15368e58
Tighten BRep agent result test narrowing
```

Phase 3A-3E are complete and accepted. 3D has live normal-provider/browser/native-runtime acceptance; 3E has real local Supabase stale/concurrency race evidence.

The only active product step is:

```text
3F — External-agent/OpenCode parity
```

Do not start 3G product creation/UI, Phase 4 graph UX, Rhino/3DM/GH interoperability, generic STEP reconstruction, or arbitrary Python/build123d authoring.

Use small forward commits. Never amend/rebase/squash/force-push already pushed shared history. Preserve unrelated local work.

## Read first

1. `AGENTS.md`
2. `docs/brep_phase3_execution.md`
3. `docs/brep_phase3_status.md`
4. this handover
5. `src/server/opencodeAgentResult.ts`
6. `src/server/cliAgents.ts`
7. `src/server/opencode.ts`
8. `src/server/aiChat.ts`
9. `shared/brepAiProject.ts`
10. `shared/brepAiContext.ts`
11. `src/server/brepAiTools.ts`
12. `tests/opencodeAgentResult.test.ts`
13. `tests/cliAgentPersistentSession.test.ts`
14. `tests/opencodePersistentSession.test.ts`
15. `src/server/opencodeStreamLifecycle.test.ts`
16. `docs/INTEGRATION.md`

Reconcile docs against the actual branch before editing.

## Completed 3F-A checkpoint

3F-A — source-aware external result/parser — is implemented and user-verified green.

Commits:

```text
eb0a063dd066c472115da0afdbed9ef480f89abf  Make external agent result contract BRep-aware
e56e6514b5977deb1588ddacfd25c950f62b26a0  Test external BRep result contract
e997f6f52583e934387b4f8e67757d7d15368e58  Tighten BRep agent result test narrowing
```

`src/server/opencodeAgentResult.ts` now has:

```ts
export type AgentParametricSourceKind = 'openscad' | 'brep';
```

Key contract:

- OpenSCAD remains the default source kind for backward compatibility.
- OpenSCAD `{ project, message }` parsing/emission remains `build_parametric_model`.
- BRep callers opt in explicitly with source kind `brep`.
- BRep `project` is normalized with `normalizeBrepAiProjectCandidate()`.
- valid BRep result emits `build_brep_project`.
- invalid BRep candidate fails closed and is never reinterpreted as OpenSCAD.
- BRep external result contract requires a complete canonical snapshot and forbids Python/build123d, STEP, viewer mesh and raw topology shortcuts.

User-reported gate after 3F-A:

```text
npm test -- --run tests/opencodeAgentResult.test.ts tests/brepAiProject.test.ts tests/brepAiTool.test.ts  PASS
npm run typecheck  PASS
npm run lint       PASS
git diff --check  PASS
```

Do not redesign 3F-A unless current tests/code prove a defect.

## Locked 3F architecture

### Source authority

External agents edit the same canonical source as normal providers:

```text
OpenSCAD -> complete OpenScadProject
BRep     -> complete BrepProject
```

No external-agent-only BRep schema/history/runtime is allowed.

### Tool split remains strict

```text
OpenSCAD -> build_parametric_model
BRep     -> build_brep_project
```

Do not make `build_parametric_model` polymorphic.

### Current BRep source must be explicit transport context

`aiChat.ts` already resolves the exact active BRep source with `resolveActiveBrepAiSource()`.

For external BRep transports, pass the source kind and exact canonical current `BrepProject` explicitly into the CLI/streaming adapter. Do not rely on reparsing arbitrary historical model messages or stale `data-brep-project` parts.

Every external BRep turn must receive the complete current canonical BRep snapshot, including persistent-session continuation turns.

Preferred transport block:

```text
<current_brep_project>
{canonical BrepProject JSON}
</current_brep_project>
```

Do not include source message IDs, database IDs, STEP, tessellation, OCCT objects or other runtime geometry.

### OpenSCAD asset path stays isolated

Current OpenSCAD external integration owns:

- `currentArtifact()` / `currentParametricArtifactFromPrompt()` OpenSCAD extraction;
- `resolveOpenScadAttachmentAssets()`;
- `reconcileOpenScadProjectAssetManifest()`;
- `validateOpenScadProject()` compiler validation/repair.

BRep must not enter those helpers.

Do not weaken or rewrite existing OpenSCAD asset reconciliation to make BRep fit.

### BRep validation path

External BRep structured JSON is schema-normalized in `opencodeAgentResult.ts` and then emitted as `build_brep_project`.

The existing BRep server tool in `src/server/brepAiTools.ts` remains the previous->next identity validator and accepted-candidate capture point. It uses the exact active source and `validateBrepAiFollowUp()`.

Do not add OCCT/build123d execution to the external adapter. Native geometry evaluation remains downstream derived runtime behavior.

## 3F-B — transport context and continuation

Implement source-aware CLI and streaming context while preserving existing OpenSCAD behavior.

### CLI (`src/server/cliAgents.ts`)

Add explicit source-aware options/context. For BRep:

- include the complete current `BrepProject` on every turn;
- use the BRep output contract (`buildAgentOutputContract('brep')`);
- parse final result with `parseAgentResult(text, 'brep')`;
- emit `build_brep_project` with the existing CLI session marker encoded in its tool-call ID;
- make build-result continuation detection source-aware (`build_brep_project` for BRep, existing tool for OpenSCAD);
- preserve current OpenCode/Codex session recovery semantics.

Session discovery already scans toolCallId markers and is not inherently tied to the OpenSCAD tool name. Keep that useful property.

### Streaming (`src/server/opencode.ts`)

Extend `OpenCodeRuntimeOptions` or an equally narrow transport-context object with source kind/current BRep project.

For BRep:

- persistent prompt includes the complete canonical current BRep snapshot every turn;
- final parser/channel resolution uses source kind `brep`;
- terminal emission is `build_brep_project`;
- skip OpenSCAD asset reconciliation and OpenSCAD compiler validation/repair;
- preserve deterministic conversation-scoped OpenCode session identity, cursor handling, cancellation and model switching.

OpenSCAD streaming behavior, validation retry semantics and assets must remain unchanged.

### Transport instructions

Current `transport.opencode` and `transport.codex` text is OpenSCAD-specific. Add BRep-specific transport instructions rather than making OpenSCAD wording ambiguous. Suggested manifest keys:

```text
transport.opencode_brep
transport.codex_brep
```

BRep transport instructions must:

- treat `<current_brep_project>` as the complete authoritative current snapshot;
- require stable project/node/parameter IDs on unchanged objects;
- require complete snapshot output, never patch output;
- forbid filesystem/shell/network/native-kernel authority for the CAD authoring task;
- not tell the agent to use OpenSCAD `pcad_validate`;
- tell the agent Brepia converts the structured result to `build_brep_project`.

The `.opencode/agents/pcad-builder.md` agent itself remains intentionally permission-bounded. Do not broaden its filesystem/shell permissions for BRep.

## 3F-C — aiChat routing

`src/server/aiChat.ts` currently has an intentional pre-3F guard:

```text
active BRep + external transport -> HTTP 400
```

Remove that guard only after both adapters are source-aware.

Pass to the selected external adapter:

- source kind `brep`;
- exact `activeBrepSource.project`;
- BRep-specific transport instruction;
- no OpenSCAD authoritative asset list as BRep source authority.

Keep normal-provider BRep behavior unchanged.

### Stop/continuation semantics

Current streaming OpenCode stop condition is hard-coded to:

```ts
hasToolCall('build_parametric_model')
```

That is correct for current OpenSCAD client-build continuation but not a generic Parametric rule.

Required direction:

- streaming OpenSCAD keeps its existing stop-on-`build_parametric_model` behavior;
- external BRep uses server-executed `build_brep_project` and must be allowed to complete the BRep server tool lifecycle safely;
- normal-provider BRep keeps its accepted `answer_user`/max-step behavior;
- CLI BRep must preserve external session continuation after the server tool result.

Do not accidentally cause the old duplicate/tool-only BRep persistence regression. The canonical accepted source still comes from request-local `onAcceptedBuild` capture and `finalizeBrepAiAssistantParts()`.

## 3F-D — tests and live acceptance

Add/extend focused tests for at least:

### Shared parser

Already covered in 3F-A; keep green.

### CLI

- BRep prompt contains exact complete current BRep snapshot;
- BRep continuation uses `build_brep_project` tool result;
- OpenSCAD prompt/artifact behavior remains unchanged;
- BRep CLI result emits `build_brep_project`;
- session ID survives through BRep tool-call IDs and later turns;
- Codex and OpenCode CLI share the same BRep result contract.

### Streaming OpenCode

- BRep persistent prompt contains complete current snapshot;
- BRep result emits exactly one terminal `build_brep_project` call;
- OpenSCAD validation/asset helpers are not entered for BRep;
- existing OpenSCAD stream lifecycle tests remain green;
- deterministic session reuse/cancellation still works.

### aiChat

- active BRep + CLI agent no longer hits the pre-3F 400;
- active BRep + streaming OpenCode no longer hits the pre-3F 400;
- both receive BRep source context and BRep output contract;
- OpenSCAD external routing remains unchanged;
- Creative external-agent block remains unchanged.

### Live acceptance

Use an existing native BRep conversation/source and perform a simple identity-preserving edit such as one numeric node/parameter change.

Acceptance requires:

```text
external OpenCode/Codex session
-> complete current BRep context
-> structured complete BRep result
-> build_brep_project
-> shared previous/next validation
-> one canonical data-brep-project source part
-> atomic immutable persistence
-> native BRep viewer/evaluator
```

First prove OpenCode streaming and/or CLI using the locally available model stack. Codex CLI parity can be tested afterward if Codex availability/tokens make it worthwhile; do not weaken the shared contract for a transport-specific convenience.

## Codex may delegate to local OpenCode

A separate experimental support branch now exists in:

```text
weaf/local-ai-orchestrator
branch: feature/codex-opencode-delegation
```

It adds Codex-facing local agents and documentation under `opencode/` without changing current `main` agents.

Suggested local delegation roles:

```text
codex-coder            -> llama-swap/qwen-coder-128k
codex-reasoner         -> llama-swap/qwen3.6-35b-mtp-128k
codex-reviewer         -> llama-swap/qwen3.6-35b-128k
codex-heretic-auditor  -> experimental read-only alternate opinion
qwen-build-todo-multi  -> existing larger planner/programmer/verifier workflow
```

Codex remains tech lead/integrator and owns git/final acceptance.

Use OpenCode when it materially reduces Codex context/reasoning burden. Work directly for trivial edits, cross-agent integration, architecture/product decisions, and final acceptance.

Typical invocation from the Brepia checkout after the support branch/config has been synced into the active OpenCode config:

```bash
opencode run --agent codex-reasoner --dir "$PWD" "<bounded analysis task>"
opencode run --agent codex-coder --dir "$PWD" "<bounded implementation task>"
opencode run --agent codex-reviewer --dir "$PWD" "<bounded review task>"
```

Prefer normal formatted output, not raw JSON event streams, unless session/event metadata is specifically needed. Keep delegated prompts bounded and require compact reports. Codex must inspect the diff itself before acceptance.

Do not use the experimental Heretic agent as sole authority; corroborate any material finding.

## Verification gates

Run focused tests after each substep, then before declaring 3F complete:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
git status --short
```

Also report branch HEAD and ahead/behind against `origin/master`.

## Expected Codex handoff result

Return:

- starting and final SHA;
- files changed;
- exact CLI/streaming source-kind design;
- how complete BRep context is supplied every continuation turn;
- why OpenSCAD asset/compiler semantics remain unchanged;
- session-continuity behavior for OpenCode CLI/streaming and Codex CLI;
- focused/full gate results;
- live acceptance evidence completed or exact manual commands/checks still required;
- remaining risks;
- `git status --short` and ahead/behind state.

If an implementation would require changing canonical BRep source semantics, weakening the atomic persistence guard, broadening external-agent execution authority, or entering 3G, stop and report the decision gate instead of expanding scope.
