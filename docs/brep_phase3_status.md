# BRep Phase 3 status

## Status

Phase 3 — AI-native BRep editing — is active on:

```text
feature/brep-ai-native-editing
```

Base:

```text
6e0ec92a439fb7e936a5d02001742df38a4c38d7
Merge pull request #20 from weaf/feature/brep-project-lifecycle
Phase 2: native BRep project lifecycle
```

Active execution contract:

```text
docs/brep_phase3_execution.md
```

Roadmap:

```text
docs/brep_kernel_plan.md
```

Phase 1/2 execution/status files are historical evidence after merge.

## 3A — Architecture reconciliation and contract lock

Status: **complete for architecture reconciliation; separable shared primitives are next.**

### Current ownership map

| Concern | Current implementation | Phase 3 direction |
| --- | --- | --- |
| Parametric project source | `shared/parametricProjectSource.ts` discriminates `openscad | brep`; absent discriminator is legacy OpenSCAD | Reuse unchanged as source-kind boundary. AI must target `kind: brep` with a complete normalized `BrepProject`. |
| Canonical BRep schema | `shared/brepProject.ts` owns versioning, bounds, stable IDs, DAG/reference/cycle validation, parameter units and current semantic fillet selector | Keep as the only authoring contract. AI validation must call this normalizer; do not introduce an AI-specific geometry schema. |
| Persisted BRep artifact | `shared/brepProjectArtifact.ts` validates `data-brep-project` containing `{ title, version, source: { kind: 'brep', source } }` | Reuse this payload for successful AI revisions. Do not introduce a second AI artifact/history model. |
| BRep lifecycle persistence | `src/services/brepProjectService.ts` creates immutable assistant revisions and uses current-leaf CAS for parameter edits; restore copies validated historical source to a new assistant leaf | AI edits must use the same immutable/CAS semantics, anchored to the exact source leaf used as generation context. |
| OpenSCAD AI tool | `shared/chatAi.ts` `build_parametric_model` is intentionally OpenSCAD-only; `parametricArtifactSchema` contains a complete normalized OpenSCAD project | Preserve historical/current OpenSCAD semantics. BRep must not be forced into this payload if doing so makes tool recovery/UI parsing ambiguous. |
| OpenSCAD artifact helpers | `shared/parametricParts.ts` searches `tool-build_parametric_model` and normalizes only OpenSCAD `ParametricArtifact` | Keep OpenSCAD helpers narrow. Add BRep-specific/shared source helpers rather than silently changing existing helper meaning. |
| Normal AI server | `src/server/aiChat.ts` loads Parametric instructions/tools, converts persisted branch messages to model messages and owns stream/tool persistence | Phase 3 must add source-kind-aware context/tool selection while preserving current Creative/OpenSCAD paths. |
| External-agent structured result | `src/server/opencodeAgentResult.ts` parses `{ project, message }` where `project` is OpenSCAD only and synthesizes `build_parametric_model` | Extend only after the shared BRep tool/result contract is fixed. The parser should discriminate project kind explicitly rather than infer from shape. |
| OpenCode/Codex continuation context | `src/server/cliAgents.ts` finds the latest `build_parametric_model` tool call and serializes `<current_pcad_artifact>` containing the complete OpenSCAD project | Needs BRep-aware current-source lookup. BRep continuation must receive the complete current canonical `BrepProject`; OpenSCAD asset reconciliation stays OpenSCAD-only. |
| OpenCode streaming continuation | `src/server/opencode.ts` mirrors the same current-artifact/user/build-result concept | Must reach semantic parity with CLI after the shared result contract is stable. |
| Previous/current artifact semantics | Existing OpenSCAD external-agent paths use the latest complete project artifact and latest user request/build feedback; Phase 2 BRep view resolves the active assistant leaf | For BRep, the exact active `data-brep-project` leaf at generation start is authoritative. A later restore/branch/edit must make an older completion stale. |
| Parameter edits vs full project edits | Phase 2 BRep parameter UI rewrites published defaults in a complete normalized source snapshot; OpenSCAD Customizer rewrites entrypoint source | AI parameter edits and DAG edits both return complete BRep snapshots. Internal optimization must not create patch persistence semantics. |
| Selector/topology semantics | `BrepProject` v1 exposes semantic `parallelToAxis`; tests reject invented `edgeIndex` selectors | AI instructions must enumerate supported selectors only. Unsupported topology requests fail closed rather than creating raw indices. |
| Runtime boundary | `/api/brep/evaluate` and STEP export use the accepted rootless Podman build123d/OCCT runtime | Preserve exactly. AI never receives Python/native execution authority. |

### Reconciliation conclusions

1. **Phase 2 already created the correct persistence seam.** No new conversation type or database history model is needed.
2. **The existing OpenSCAD AI tool contract should remain narrow until proven safe to generalize.** `build_parametric_model`, `ParametricArtifact` and `parametricParts` have substantial historical/recovery/OpenCode assumptions.
3. **A BRep AI result must be a complete snapshot.** This mirrors the successful multi-file OpenSCAD project-native design while using `BrepProject` rather than source files.
4. **BRep AI persistence must be source-leaf anchored.** Phase 2 parameter CAS already demonstrates the correct stale-write policy; AI completion must not reactivate a branch that ceased to be current while generation was running.
5. **Structural diff is derived diagnostics, not persistence authority.** It should be computed from normalized previous/next snapshots and keyed by stable IDs.
6. **Identity preservation needs explicit validation beyond schema validity.** `normalizeBrepProject` correctly validates each snapshot but cannot know whether a follow-up AI edit unnecessarily replaced all IDs. Phase 3 therefore needs a previous-vs-next identity policy.
7. **Topology safety is currently strong.** The v1 schema has only a semantic axis selector and already rejects index selectors; Phase 3 should preserve that constraint rather than widening it for AI convenience.
8. **External agents are a later integration layer, not the first contract owner.** Their current protocol is OpenSCAD-specific and should be extended only after shared/native provider semantics are stable.

### Canonical Phase 3 AI snapshot direction

Creation candidate:

```text
{
  title,
  version,
  source: {
    kind: 'brep',
    source: <complete BrepProject>
  }
}
```

Follow-up candidate uses the same complete shape. Validation additionally compares `previous.source.source` with the next normalized project to enforce project identity and compute structural diff.

The final structured tool shape may wrap these fields differently for AI SDK ergonomics, but persistence authority remains the existing `BrepProjectArtifactData` semantics.

### Stable-ID policy locked for first implementation

- project ID must remain identical on ordinary follow-up edits;
- unchanged node/parameter IDs should remain identical;
- existing IDs may carry changed content to represent a modification;
- genuinely new nodes/parameters get new IDs;
- removed nodes/parameters disappear only when references remain valid;
- obvious whole-project ID churn should fail closed or trigger a decision gate;
- display labels/names are not identity;
- raw topology/viewer/OCCT indices are never IDs.

The first implementation does not require semantic graph-isomorphism detection. It does require enough churn detection to reject clearly destructive all-new-ID rewrites.

### Initial structural diff vocabulary

Derived diff should report:

```text
project fields changed
parameters: added / removed / changed / unchanged count
nodes:      added / removed / changed / unchanged count
changed entries keyed by stable id
concise summary
```

Canonical normalization sorts parameters/nodes by ID, so comparisons can be deterministic without array-order noise.

### Primary regression risks

- making `build_parametric_model` polymorphic and breaking historical OpenSCAD tool parts, dangling-tool recovery or imported artifact logic;
- external agents accidentally selecting a historical instead of active BRep snapshot;
- stale AI completion moving `current_message_leaf_id` after restore/branch/parameter edit;
- whole-project ID churn that still passes standalone schema validation;
- teaching AI unsupported topology selector forms;
- duplicating the BRep source into tool data and `data-brep-project` with divergent authority;
- OpenSCAD asset reconciliation being applied to BRep data;
- native evaluator invocation before AI result normalization/identity validation;
- persisting diff/runtime diagnostics as editable source;
- Phase 4 graph UX leaking into Phase 3.

### Decision gates

Stop before implementation broadening if:

- a BRep tool cannot be added without changing historical OpenSCAD message semantics;
- project-ID continuity or stale-parent anchoring cannot be enforced at the existing message-tree boundary;
- a requested topology edit needs selectors outside canonical schema;
- provider/external-agent parity would require arbitrary Python/build123d execution;
- broad database changes appear necessary merely for AI editing.

## Current next action

Implement **3B — Shared BRep AI snapshot schema and structural diff** as a provider-independent shared contract with focused tests. This work does not require Codex, local native runtime or browser interaction.

After 3B is reviewed and green, 3C–3G become the point where a single Codex thread is valuable because `aiChat`, AI SDK tool streaming/persistence, OpenCode CLI/streaming parity and product state must be changed coherently.