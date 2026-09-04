# BRep Phase 3 execution contract

## Purpose

This document is the active execution contract for Phase 3 of `docs/brep_kernel_plan.md`.

Phase 1 and Phase 2 are complete and merged. Phase 3 adds AI-native creation and editing of canonical `BrepProject` snapshots without introducing a second BRep runtime, a second history model, arbitrary Python execution or Phase 4+ UX/interoperability scope.

## Base

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
Phase 2: native BRep project lifecycle
```

Working branch:

```text
feature/brep-ai-native-editing
```

## Final roadmap target

All Phase 3 decisions must preserve:

```text
Brepia Parametric Model
        -> smart Grasshopper parametric object/component
        -> generated/usable .gh workflow
        -> Rhino / Grasshopper project model
```

Stable project, node and parameter IDs; parameter semantics; placement; metadata; deterministic revisions and selector semantics are therefore architectural invariants.

## Authority

Use this order when reconciling ambiguity:

1. current implementation on the Phase 3 branch;
2. `AGENTS.md`;
3. `docs/brep_kernel_plan.md`;
4. this execution contract;
5. `docs/brep_phase3_status.md`.

Phase 1/2 execution/status documents are historical evidence after merge.

## Phase 3 objective

AI must be able to create and revise complete canonical native BRep projects through Brepia's existing Parametric conversation infrastructure.

An accepted AI result is always:

```text
complete normalized BrepProject snapshot
    -> structural validation
    -> stable-identity policy validation
    -> stale/current-leaf guard
    -> immutable source revision persistence
    -> existing native BRep evaluation sandbox
```

AI must never author or persist build123d/Python source, OCCT objects, STEP, tessellation or raw topology indices as editable source.

## Current architecture inherited from Phase 2

- `ParametricProjectSource` discriminates `openscad | brep`.
- Native BRep source is a normalized `BrepProject`.
- BRep source revisions are `data-brep-project` artifacts on ordinary assistant messages.
- `current_message_leaf_id` selects the active source revision.
- parameter edits create immutable assistant leaves and use compare-and-set activation.
- restore/branch reuse the same message tree.
- exact STEP and viewer geometry are derived outputs.
- OpenSCAD AI still uses the OpenSCAD-only `build_parametric_model` tool contract.
- OpenCode/Codex adapters currently parse and carry complete OpenSCAD project snapshots only.

## Core Phase 3 rules

- Reuse the existing Parametric conversation and message tree; do not add a `brep` conversation type.
- Reuse the Phase 2 `data-brep-project` source artifact; do not create a parallel AI history payload.
- AI results are complete snapshots, never patches.
- Normalize and validate every returned snapshot before persistence or native execution.
- Preserve project ID on follow-up edits.
- Preserve unchanged node and published-parameter IDs.
- New IDs are allowed only for genuinely new nodes/parameters.
- Removing an object removes its ID; later accidental reuse must not be treated as continuity without explicit semantics.
- Raw OCCT/topology indices are forbidden in prompts, tool schemas and persisted source.
- AI may only use selector forms represented by `BrepProject` schema.
- Invalid, unsupported, stale or identity-destructive results fail closed and must not move the active leaf.
- The accepted Phase 1/2 BRep sandbox remains the only native execution boundary.
- OpenSCAD AI behavior must remain backward compatible.
- Small forward commits only; never amend/rebase/squash already pushed shared history.

## AI edit classes

Phase 3 distinguishes two intents but uses one canonical snapshot contract:

### Published-parameter edit

Examples: change a parameter default, min/max/step, label or description; publish a new parameter; remove a parameter that is no longer referenced.

The result is still a complete `BrepProject`. The AI must not emit a parameter patch object as source authority.

### Full project edit

Examples: add/remove/modify feature nodes, rewire DAG dependencies, change placement/metadata, introduce or remove published parameters.

The result is a complete `BrepProject` and must pass all graph/reference/cycle/selector validation.

The implementation may optimize parameter-only handling internally, but persistence remains snapshot-based and must not create divergent semantics.

## Structural diff contract

Every accepted follow-up edit must have a deterministic diff between previous and next normalized snapshots. The initial shared diff vocabulary should cover:

- project-level fields: name, placement, metadata, result node;
- parameters: added, removed, changed, unchanged count;
- nodes: added, removed, changed, unchanged count;
- changed entries keyed by stable ID;
- machine-readable field paths for changed entries where practical;
- concise human summary suitable for diagnostics/UI/logging.

The diff is diagnostic/derived data. It is not another source-of-truth and need not be persisted if it can be deterministically recomputed.

Diff generation must compare canonical normalized snapshots so array ordering does not create false changes.

## Identity policy

For follow-up edits:

- `next.id !== previous.id` is rejected unless the operation is explicitly project creation/import, not ordinary editing;
- an unchanged semantic node/parameter should retain its ID;
- changed content under an existing ID is allowed and represents modification;
- new semantic objects require new IDs;
- deleting nodes/parameters is allowed only if the normalized next snapshot remains valid;
- project name/labels are display semantics, not identity;
- the validator should detect obvious whole-project ID churn and fail closed rather than silently accepting an AI rewrite with all-new IDs.

A first implementation does not need semantic graph isomorphism. It must at minimum enforce project ID continuity and provide churn diagnostics/thresholds that prevent clearly destructive all-ID rewrites.

## Selector/topology policy

Current v1 BRep supports semantic `parallelToAxis` fillet selection. AI instructions must enumerate only supported selector forms.

If the requested edit requires selection semantics not representable by the schema, the AI/runtime must report that limitation. It must not invent fields such as `edgeIndex`, `faceIndex`, OCCT hash/index values or viewer triangle identifiers.

Any future selector expansion belongs in the canonical schema first, with deterministic evaluator behavior and tests, before AI is taught to emit it.

## Stale/concurrent edit policy

AI generation can outlive a user parameter edit, restore or branch action. The request leaf captured at generation start and the nearest preceding BRep source revision are distinct identities and must remain separate.

Before activating an AI-produced revision:

1. validate/normalize the returned project;
2. validate identity policy against the exact anchored previous BRep project;
3. lock the target conversation row in the persistence transaction;
4. verify `current_message_leaf_id` still equals the request leaf captured at generation start;
5. only when it matches, insert the immutable assistant/source revision in the same transaction and let the existing insert trigger advance the leaf;
6. when it does not match, return stale and insert nothing.

The accepted implementation is `public.persist_brep_ai_revision(...)` using `SELECT ... FOR UPDATE`. A stale candidate is not persisted by this activation RPC and must never overwrite or reactivate a newer branch. Any future requirement to retain stale candidates as branch evidence would need an explicit separate lifecycle contract rather than weakening this guard.

## Execution sequence

### 3A — Architecture reconciliation and contract lock

Map the actual AI/tool/external-agent lifecycle against the Phase 2 BRep source path.

Inspect at least:

- `shared/chatAi.ts` tool/data schemas;
- `shared/parametricParts.ts` OpenSCAD artifact helpers;
- `src/server/aiChat.ts` prompt/tool/persistence flow;
- OpenCode streaming and CLI/Codex adapters;
- `src/server/opencodeAgentResult.ts` structured result parser;
- `src/services/brepProjectService.ts` immutable source revision/CAS semantics;
- `shared/brepProjectArtifact.ts` source validation;
- restore/retry/branch behavior and active-leaf anchoring;
- external session continuity and previous-artifact selection.

Acceptance:

- ownership map recorded in `docs/brep_phase3_status.md`;
- one canonical AI BRep snapshot shape selected;
- diff and stable-ID rules documented;
- no broad transport/runtime implementation before contract lock.

### 3B — Shared BRep AI snapshot schema and structural diff

Add kernel-neutral shared primitives independent of provider/runtime transport.

Acceptance:

- an AI candidate can be normalized as a complete BRep snapshot;
- project-creation and follow-up-edit validation are distinguishable;
- follow-up validation enforces project ID continuity;
- deterministic structural diff covers project fields, parameters and nodes by stable ID;
- invalid selector/reference/DAG results fail through canonical normalization;
- focused tests cover unchanged, parameter-only, node modification, add/remove and invalid-ID cases;
- no `aiChat`, OpenCode or browser wiring required yet.

### 3C — Native AI tool/source contract

Introduce the minimum discriminated AI tool/result contract needed for BRep while preserving the existing OpenSCAD `build_parametric_model` behavior.

Preferred direction: avoid changing the meaning of legacy OpenSCAD tool payloads. A BRep-specific structured tool or a safely discriminated shared source tool is acceptable only if UI/persistence/recovery semantics remain explicit.

Acceptance:

- providers can return a complete BRep snapshot through a strongly validated structured tool path;
- OpenSCAD historical/current artifacts still parse exactly as before;
- BRep tool inputs cannot contain runtime geometry/Python/STEP;
- tool-result validation fails closed;
- tests prove OpenSCAD compatibility.

Decision gate: if making `build_parametric_model` polymorphic would make historical tool-part recovery or UI assumptions ambiguous, use a separate BRep tool rather than weakening the existing contract.

### 3D — Prompting and native provider generation/follow-up context

Teach normal AI SDK providers to edit existing canonical BRep snapshots. Product routing for creating a new BRep project through AI belongs to 3G and must not be inferred here.

Acceptance:

- follow-up receives the exact current canonical BRep snapshot plus user request;
- instructions explicitly require stable IDs and supported selectors only;
- provider output is validated before persistence;
- parameter-only and DAG edits both work through the same snapshot lifecycle;
- unsupported requests return a clear limitation instead of invented topology semantics;
- live normal-provider acceptance proves a real BRep follow-up can traverse context -> tool -> validated complete snapshot -> persistence -> native evaluation.

### 3E — Immutable AI revision persistence and stale guards

Connect successful BRep AI results to the Phase 2 lifecycle.

Acceptance:

- accepted AI edits create immutable source revisions;
- current leaf moves only after a transactional expected-leaf check while the conversation row is locked;
- restore/branch during generation cannot be overwritten by stale AI completion;
- stale rejection inserts no AI revision through the activation RPC;
- failed validation creates no active source corruption;
- retry/branch preserves the exact source snapshot used as AI context;
- diff/summary corresponds to previous vs accepted next snapshot;
- a real local concurrency gate proves both stale-first and AI-lock-first orderings against the existing leaf trigger.

### 3F — External-agent/OpenCode parity

Extend OpenCode CLI, OpenCode streaming and Codex adapter protocol only after the shared/native tool contract is stable.

Acceptance:

- adapters detect whether the current Parametric source is OpenSCAD or BRep;
- BRep continuation receives the complete current `BrepProject`, not OpenSCAD wrappers;
- external structured result parser validates BRep snapshots through the same shared normalizer;
- session continuity remains intact;
- OpenSCAD asset reconciliation remains OpenSCAD-only and unchanged;
- external agents cannot gain arbitrary filesystem/Python/native execution authority from the BRep path;
- CLI/streaming semantic parity tests cover BRep and existing OpenSCAD.

### 3G — Product AI editing integration

Expose AI interaction from the existing BRep project lifecycle without implementing Phase 4 graph UX.

Acceptance:

- a BRep project can issue a follow-up AI edit and receive a new source revision;
- creation flow can create a BRep project from AI where product routing supports it;
- loading/error/progress state cannot confuse derived evaluation with source persistence;
- structural change summary is visible or otherwise inspectable enough for acceptance;
- parameter controls continue to edit the active canonical source;
- no graph editor is introduced.

### 3H — Browser/runtime and regression acceptance

Run real local auth and the accepted native BRep Podman runtime.

Minimum acceptance:

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

### 3I — Phase 3 closeout

Run relevant focused suites plus:

```bash
scripts/brep/smoke-test.sh
npm test
npm run typecheck
npm run lint
npm run build
git diff --check origin/master...HEAD
```

Update `docs/brep_phase3_status.md` with exact evidence and final commit. Prepare a draft PR against `master` when coherent and green. Do not merge without explicit approval.

## Decision gates / stop conditions

Stop and report rather than guessing if Phase 3 would require:

- changing `BrepProject` in a way that weakens stable future Grasshopper identities;
- raw topology indices or viewer/OCCT identifiers as persistent selectors;
- arbitrary Python/build123d execution from AI output;
- weakening the native BRep sandbox;
- a second AI-specific revision/history model;
- destructive database migration merely to distinguish BRep AI edits;
- broad polymorphic changes to `build_parametric_model` that break historical OpenSCAD tool parts/recovery;
- accepting whole-project ID churn as a normal follow-up edit;
- starting Phase 4 graph UX or Phase 5+ Rhino/Grasshopper work early.

Ordinary type/test/lint/build failures and narrow refactors are not decision gates; fix them and continue.

## Handoff/checkpoint format

For each meaningful pushed checkpoint report:

- starting and final commit;
- completed Phase 3 step(s);
- shared contracts changed;
- focused/broad test evidence;
- runtime/browser evidence or remaining acceptance;
- worktree and ahead/behind state;
- next active step or explicit decision gate.