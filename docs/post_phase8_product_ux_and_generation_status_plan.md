# Post-Phase 8 product UX and durable generation-status plan

Status: active follow-up after the accepted Brepia-side Phase 8 GHX loop.

This document captures product/robustness work identified during real mobile and local-model acceptance. It is intentionally separate from installed Rhino/Grasshopper Phase 9 acceptance.

## Current implementation checkpoint — 2026-09-08

Repository implementation is now complete for the four UX tracks and the first durable-generation robustness slice on `feature/brep-grasshopper-gh-packaging`:

- **UX-1 explicit creation modes and unified Attach** — repository complete;
- **UX-2 per-turn model/transport provenance** — repository complete;
- **UX-3 stable resizable side-panel width** — implemented before this checkpoint;
- **UX-4 user-defined BRep revision names** — implemented before this checkpoint;
- **ROBUST-1 persisted server-side generation status** — durable schema/server/client lifecycle implemented, including request-aware retry correlation and reload-safe BRep edit exclusion; browser/live-model acceptance remains open.

Latest exact-head repository evidence before the ROBUST-1 request-correlation hardening:

```text
a53165efdfd1d1abd47aaf9c61f124d4a2071c47
Assert current BRep creation UX in GHX acceptance
```

ROBUST-1 request-correlation hardening repository evidence on `e83d7df49aaad241655a048d8ffce09f5f9b3f9d`: Quality Gate #632 / run `34248181725` — PASS; Grasshopper Build #205 / run `34248181695` — PASS. This documentation-only reconciliation follows those gates.

Evidence boundary: repository gates prove tests/typecheck/lint/build/diff-check and retained Grasshopper build compatibility. They do **not** replace the still-open manual visual/browser check of the prompt hierarchy, Attach behavior, provenance labels, panel width, revision-name presentation, or durable edit-lock recovery in the user's real local runtime.

The current implementation preserves the existing authority boundaries:

- `conversation.type = 'parametric'` remains unchanged for Native BRep;
- Native BRep is still selected explicitly through `parametricSourceKind = 'brep'`;
- Native BRep attachments remain fail-closed/text-only;
- per-turn provenance is persisted on assistant messages and is not reconstructed from later conversation settings;
- BRep revision names remain presentation metadata outside immutable source/message lineage;
- `generation_runs` is server-written and owner-readable through RLS; the browser observes durable state rather than owning generation progress;
- installed Rhino/Grasshopper host acceptance remains Phase 9 and is not part of this product robustness slice.

---

## Goals

The next product pass should make Brepia easier to understand during creation and iteration without changing the canonical OpenSCAD/BRep/Mesh authority model.

The work is grouped into five bounded tracks:

1. explicit Parametric/Mesh creation controls and one attachment entry point;
2. per-iteration AI/model provenance in conversation history;
3. stable resizable side-panel width with content wrapping;
4. user-defined BRep revision names without mutating immutable revision lineage;
5. persisted server-side generation status/progress that survives browser reload/backgrounding.

The tracks may ship independently, but the durable generation-status work should remain an explicit robustness slice rather than being approximated with client timers.

---

## UX-1 — explicit creation modes and unified Attach control

### Status

**Repository complete on 2026-09-07.** Manual visual/browser acceptance remains open.

Implemented behavior:

- the home prompt shows separate top-level `Parametric` and `Mesh` controls;
- `OpenSCAD | Native BRep` remains a Parametric-only second level;
- the separate image and 3D-file buttons are replaced by one `Attach` entry point;
- the selected files still flow through the existing mode-aware validation instead of trusting the file picker filter;
- Parametric image attachment remains conditional on the selected model's vision capability;
- Native BRep disables picker, paste and drag/drop attachment ingress and retains the existing submit-time text-only guard;
- disabled/generating prompt state also blocks attachment ingress;
- switching from Mesh to Parametric is blocked when incompatible attachments would otherwise be carried silently; a completed STL may remain when the target is compatible OpenSCAD.

### Problem

The previous prompt chrome used one Mesh button as a mode toggle. This made it visually ambiguous whether the control meant "create a mesh" or "switch creation mode". Image and 3D-file attachment also occupied two separate buttons even though both are input attachments.

### Target interaction

Top-level creation mode is always explicit:

```text
Parametric | Mesh
```

When Parametric is selected, keep the existing source subtype:

```text
OpenSCAD | Native BRep
```

Replace the separate image and 3D-file buttons with one Attach control. The control accepts the input kinds valid for the active mode and lets the existing validation contract determine the selected file type.

Native BRep remains text-only until its attachment contract is deliberately expanded. In that mode Attach is disabled with a clear explanation; it must not silently inherit OpenSCAD asset semantics.

### Acceptance

- Parametric and Mesh are separate visible controls; no single button toggles between them implicitly.
- Parametric retains OpenSCAD/Native BRep as a second-level choice.
- one Attach entry point replaces the current image/STL button pair;
- existing paste and drag/drop behavior remains supported where attachments are allowed;
- file validation remains mode-aware and fail-closed;
- switching modes does not silently retain incompatible attachments.

---

## UX-2 — per-turn model and transport provenance

### Status

**Repository complete on 2026-09-07.** Manual browser presentation/real-model acceptance remains open.

Forward-going assistant metadata now persists immutable turn-level provenance:

- requested/product model in the existing `metadata.model` field;
- `metadata.actualModel` for the actual AI/controller/underlying model;
- `metadata.transportKind` as `direct`, `opencode`, `codex` or generic `cli-agent`;
- `metadata.openCodeExecutionMode` for OpenCode CLI vs Streaming;
- Creative retains `metadata.agentModel` and the mesh backend separately.

The same resolved metadata is attached to the live AI SDK message stream and to the persisted assistant message, so the label shown immediately after generation matches the label after reload.

OpenCode compatibility covers both current `agent/opencode/...` IDs and legacy persisted `opencode/...` IDs. Legacy messages that predate execution-mode persistence display only the provenance that can be proven from their own metadata; CLI vs Streaming is not invented retroactively.

### Problem

The model selector shows the model that will be used for the next turn, but historical assistant iterations did not clearly show which model actually produced them. This becomes especially confusing when a project is created with one local model and then iterated with another model, OpenCode, or Codex.

### Existing authority

Assistant messages already persist model metadata. Creative turns additionally persist the actual controller/agent model separately from the 3D mesh backend. This existing per-message metadata, not the conversation's current/default model, remains the authority for historical display.

### Target display

Each completed assistant iteration gets a small, unobtrusive provenance line, for example:

```text
Qwen3.6-35B Heretic
OpenCode · Streaming · Qwen3.8-27B
Codex CLI · <actual model>
Ornith
```

Creative/Mesh turns distinguish the controller AI from the mesh backend when both exist:

```text
AI: Qwen3.8-27B
3D: TRELLIS.2
```

### Metadata contract

Forward-going assistant metadata captures enough immutable turn-level provenance to render this without consulting current settings:

- requested model ID;
- actual model/agent ID used for the turn;
- transport kind where relevant (`direct`, `opencode`, `codex`, other CLI agent);
- OpenCode execution mode (`cli` or `streaming`) where relevant;
- Creative 3D backend separately from Creative controller AI.

Legacy messages render whatever provenance is already available and omit unknown fields rather than inventing them.

### Acceptance

- changing the model for a later turn does not alter labels on earlier turns;
- OpenCode CLI and Streaming are distinguishable for new turns;
- Codex/other CLI-agent turns are distinguishable from direct provider calls;
- Creative history can show both AI controller and mesh backend;
- retry/branch history retains provenance per branch message.

---

## UX-3 — stable right-hand panel width and wrapping

### Status

**Implemented.** Static reconciliation confirms the content-containment contract; manual resize/browser acceptance remains open for the latest checkpoint.

### Problem

The right-hand Parameters/BRep editor panel can appear to grow according to its content instead of preserving the user's selected resizable width. Long labels/IDs and nested editor content should wrap or truncate inside the selected width, not push the pane wider.

`ConversationView` already constrains the Parameters panel nominally to a 320–384 px range. The follow-up therefore needs to harden the *content sizing contract*, not simply add another larger panel-size cap.

### Implementation boundary

- the `Panel` flex item and its immediate content root must use `min-width: 0` and clip/contain horizontal overflow;
- scroll/content roots must also be `min-w-0`;
- labels, status text and long IDs should use `break-words`, `overflow-wrap:anywhere`, truncation with title/tooltip, or an explicit horizontal code area where raw code truly requires it;
- avoid viewport-breakpoint grids that assume a wide content area inside a narrow resizable panel. Prefer single-column/narrow-safe layouts or container-aware layout for panel-local editors;
- user-resized width stored by `react-resizable-panels` must remain authoritative when content changes.

### Acceptance

Resize the Parameters pane to a chosen width and then exercise:

- long project names;
- long parameter labels/IDs;
- feature IDs and metadata values;
- revision names;
- error/status text;
- project-object/feature editor summaries.

None may expand the pane. Text adapts inside the selected width and the preview pane does not shift because of min-content pressure.

---

## UX-4 — user-defined BRep revision names

### Status

**Implemented.** Static reconciliation confirms presentation-only persistence outside immutable source lineage; manual reload/reopen/browser acceptance remains open for the latest checkpoint.

### Problem

`Revision 1`, `Revision 2`, etc. are deterministic but become difficult to understand after several parameter, AI, GHX, restore and manual feature edits.

### Authority model

Revision names are presentation metadata only. Renaming a revision must **not** mutate the immutable `messages` revision node, canonical BRep source, revision ID, parent lineage, GHX provenance or export identity.

Store user names in conversation settings keyed by immutable revision message ID, for example:

```ts
brepRevisionLabels?: Record<string, string>
```

The system ordinal remains available independently:

```text
Moved doorway
Revision 4 · Active
```

or, without a custom label:

```text
Revision 4 · Active
```

### Product behavior

- add Rename next to revision actions;
- trimmed bounded label, initially max 80 characters;
- blank/reset removes the custom label and returns to the system ordinal;
- rename is allowed for active and inactive revisions because it changes presentation only;
- hiding/deleting a revision from product history never physically deletes the immutable lineage node;
- restoring a revision creates a new immutable revision as today. A later enhancement may offer an automatic label such as `Restored from Moved doorway`, but this is not required for v1 rename.

### Acceptance

- name survives reload/reopen;
- source/message IDs and canonical artifact bytes are unchanged by rename;
- GHX/STEP/3DM/BRep export authority is unaffected;
- active/select/restore/delete behavior is unchanged;
- long labels obey the stable-panel wrapping contract from UX-3.

---

## ROBUST-1 — persisted server-side generation status/progress

### Status / implementation reconciliation — 2026-09-08

**Repository implementation complete for the current browser/server lifecycle; manual live-runtime acceptance remains open.**

The implemented authority model is now:

1. `generation_runs` persists one immutable run identity per generation attempt, with monotonic per-run `sequence`, truthful status/phase, requested/actual model and transport provenance, bounded details/errors, and request/response message correlation.
2. Ordinary authenticated clients have owner-scoped RLS `SELECT`; generation-run creation and transitions remain server/service-role owned. There is no ordinary authenticated write policy.
3. AI/agent generation in `src/server/aiChat.ts` owns the durable transitions from `request_saved` through `revision_saved`.
4. Authenticated `/api/brep/evaluate` correlates the current conversation/revision server-side and advances the same run through `evaluation_requested`, `evaluating_native`, `preparing_viewer` and `preview_ready`; the browser never supplies a trusted generation-run ID.
5. The BRep client reads durable run state with polling/reload fallback. A new send/edit/retry captures the latest run for that exact `request_message_id` immediately before AI dispatch and uses its run ID as a baseline cursor. The old terminal attempt is therefore treated as a missing-row handoff until a different, newer run ID appears. This is required because retry/regenerate may legitimately reuse the same user request message ID.
6. On reload, where no local attempt cursor survives, the latest owned BRep run remains authoritative. A queued/running AI phase can therefore recover the edit exclusion even though the prior React/AI-SDK stream state is gone.
7. Source-write exclusion is intentionally narrower than the full native-preview lifecycle. `request_saved`, `model_dispatched`, `generating`, `response_received`, `validating_artifact` and `saving_revision` lock BRep Parameters/source writes. The lock ends at `revision_saved`; `evaluation_requested`, `evaluating_native`, `preparing_viewer` and `preview_ready` are preview work and must not keep the immutable source editor locked. Terminal `completed`, `failed` and `cancelled` runs never own the edit lock.
8. Initial browser creation progress still uses the same durable server phases and keeps the existing fail-closed missing-row handoff while the first run row is being created.

The shared contract in `shared/generationRun.ts` and focused tests in `tests/generationRun.test.ts` / `tests/generationRunClient.test.ts` cover:

- explicit run statuses `queued`, `running`, `waiting_for_preview`, `completed`, `failed`, `cancelled`;
- truthful ordered phases from `request_saved` through `preview_ready`;
- `waiting_for_preview` as the boundary after a BRep revision is persisted but before/while a real evaluate request takes over;
- monotonic `sequence` as an idempotency/state-version field, explicitly not a percentage;
- no phase regression even if a stale writer has a newer wall-clock timestamp;
- same-phase detail updates for events such as an OpenCode reconnect without fabricating forward progress;
- bounded detail/error fields and terminal immutability;
- request-ID + baseline-run correlation for retries that reuse a request message;
- the BRep edit-lock boundary ending at `revision_saved` rather than at `preview_ready`.

### Why this is separate

Durable progress is server data, not a browser animation. React mutation/stream state may improve immediacy, but it is not authoritative for whether generation is still running or which server phase has completed.

Do not replace persisted state with fake percentages or client timers.

### User experience

A creation/iteration can display real server-owned stages such as:

```text
Request saved
Model dispatched
AI/agent generating
Response received
Validating canonical artifact
Saving immutable revision
Native evaluation requested
Evaluating build123d/OCCT geometry
Preparing viewer mesh
Preview ready
```

`Native evaluator queued` remains reserved for a future implementation that actually owns a server-side queue/job dispatch boundary.

Transport-specific information can be included where useful, for example an OpenCode event-stream reconnect, without presenting a reconnect as a failed generation.

### Persistence model

The implemented generation-run row contains:

```text
generation_run
  id
  user_id
  conversation_id
  request_message_id
  response_message_id?
  kind
  requested_model_id
  actual_model_id?
  transport_kind
  execution_mode?
  status
  phase
  detail?
  sequence
  created_at
  started_at?
  updated_at
  completed_at?
  error_code?
  error_message?
```

Separate rows per attempt prevent one attempt from overwriting another. `sequence` orders state transitions *within* a run; it is not used as a cross-run cursor. Cross-attempt client correlation uses the request message plus the previously observed run ID.

### Security

- normal auth/user ownership/RLS applies to reads;
- a user can only read generation runs for conversations they own;
- ordinary authenticated clients receive no direct generation-run write policy;
- server-only service-role code owns run creation/transitions;
- server transitions are validated/bounded;
- raw provider/OpenCode/Codex output and secrets must never be copied into status detail/error fields.

### Server lifecycle

The server creates/updates the generation run at real boundaries:

1. request accepted/input already persisted;
2. model/agent transport selected;
3. generation dispatched/running;
4. final response received;
5. artifact/tool output validated;
6. immutable assistant/source revision persistence begins/completes;
7. authenticated BRep evaluate request starts/completes when applicable;
8. terminal `completed`, `failed` or `cancelled`.

The stream sent to the browser is an observer of generation, not the owner of its lifecycle.

### Client delivery

The current client uses persisted state as authority with bounded polling/refetch fallback. Realtime/SSE status delivery may be added later as an optimization; it is not required for correctness.

For a fresh BRep AI attempt, the client first captures the latest run ID for that request message. While the latest request-scoped row is still that baseline row, the query deliberately exposes no current run and continues the short handoff poll. A new run is accepted only after its ID differs from the baseline. This prevents stale terminal cache data from falsely completing a retry before the server creates its new run row.

On reload/reopen there is no local cursor, so the client reads the latest persisted BRep run for the conversation and derives recovery/edit exclusion from its durable phase.

### Browser/background contract

- leaving or backgrounding the browser does not cancel generation unless the user explicitly requests Cancel;
- returning to the project rehydrates the latest persisted progress;
- queued/running BRep AI source work restores source-write exclusion after reload;
- once `revision_saved` is durable, native evaluation/viewer work does not keep Parameters/source editing locked;
- completion while the browser is absent yields the final persisted project/revision on return;
- browser disconnect and OpenCode event-stream reconnect are distinguished from user cancellation;
- terminal failure is persisted and visible after reload instead of degrading into an ambiguous empty project.

### Cancellation

Cancel must target the server-owned generation run and transition it explicitly to `cancelled` when cancellation succeeds. Closing the page is not cancellation.

### Process-restart boundary

Persisted status alone makes browser reconnect/reload durable. It does not automatically make an in-process generation survive a Brepia server process crash. If crash/restart survival becomes a requirement, add a real queued worker/job executor as a separate robustness slice instead of implying that the status table provides job durability by itself.

### Acceptance scenarios

Repository tests cover the state contract and request/baseline correlation. Manual/live acceptance should still verify, with direct llama-swap, OpenCode and Codex/CLI-agent where supported:

1. start a later BRep AI edit and remain on page;
2. retry/regenerate the same user request after a previous terminal run and confirm the old run is not accepted as the new attempt;
3. edit an earlier user turn and confirm the new request branch gets its own current run;
4. hard reload during `queued`/`running` AI source generation and confirm `AI editing…`/write exclusion recovers;
5. reach `revision_saved` and confirm Parameters/source editing unlocks while native evaluation/viewer preparation continues;
6. background mobile Chrome for 30–60 seconds and return;
7. navigate to home and reopen the running project from the sidebar;
8. generation completes while no project tab is open;
9. OpenCode event SSE disconnect/reconnect while agent continues;
10. explicit user cancel and provider/agent/native-evaluation failure paths.

The UI must always show a truthful persisted stage or terminal result; it must never infer completion merely because a browser stream ended.

---

## Recommended implementation order

1. **UX-3 stable side-panel sizing** — implemented; browser acceptance pending.
2. **UX-4 revision names** — implemented; browser acceptance pending.
3. **UX-1 Parametric/Mesh + Attach controls** — repository complete; browser acceptance pending.
4. **UX-2 per-turn model provenance** — repository complete; browser/real-model acceptance pending.
5. **ROBUST-1 persisted generation status** — repository implementation complete for durable browser/server lifecycle; request-aware retry/reload acceptance remains to be run in the real runtime.

Keep installed Rhino/Grasshopper Phase 9 acceptance independent. None of these product UX/robustness items should weaken the strict GHX validation boundary or change the canonical BRep revision model.
