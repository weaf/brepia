# Post-Phase 8 product UX and durable generation-status plan

Status: active follow-up after the accepted Brepia-side Phase 8 GHX loop.

This document captures product/robustness work identified during real mobile and local-model acceptance. It is intentionally separate from installed Rhino/Grasshopper Phase 9 acceptance.

## Current implementation checkpoint — 2026-09-07

Repository implementation is now complete for the first four UX tracks on `feature/brep-grasshopper-gh-packaging`:

- **UX-1 explicit creation modes and unified Attach** — repository complete;
- **UX-2 per-turn model/transport provenance** — repository complete;
- **UX-3 stable resizable side-panel width** — implemented before this checkpoint;
- **UX-4 user-defined BRep revision names** — implemented before this checkpoint;
- **ROBUST-1 persisted server-side generation status** — reconciled below; implementation remains next.

Latest exact-head repository evidence for UX-1/UX-2:

```text
8d32d07110dccd8753399632ddc6821396be01bd
Test disabled attachment ingress guard
```

- Quality Gate #597 — PASS;
- Grasshopper Build #170 — PASS.

Evidence boundary: these gates prove repository tests/typecheck/lint/build/diff-check and retained Grasshopper build compatibility. They do **not** replace the still-open manual visual/browser check of the new prompt hierarchy, Attach behavior, provenance labels, panel width and revision-name presentation in the user's real local runtime.

The current implementation preserves the existing authority boundaries:

- `conversation.type = 'parametric'` remains unchanged for Native BRep;
- Native BRep is still selected explicitly through `parametricSourceKind = 'brep'`;
- Native BRep attachments remain fail-closed/text-only;
- per-turn provenance is persisted on assistant messages and is not reconstructed from later conversation settings;
- BRep revision names remain presentation metadata outside immutable source/message lineage.

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

### Status / implementation reconciliation — 2026-09-07

The repository now has enough server infrastructure to implement this without making the browser authoritative, but two boundaries matter:

1. `src/server/supabaseClient.ts` already exposes a server-only service-role Supabase client. ROBUST-1 should use that for status mutations while ordinary authenticated clients receive read-only RLS access to their own run rows. Do not add broad authenticated INSERT/UPDATE policies merely to make status writes convenient.
2. AI/agent generation is server-owned in `src/server/aiChat.ts`, so request acceptance, transport selection, generation, response receipt, validation and immutable-message persistence can all truthfully update a durable run from the server.
3. Native BRep evaluation itself is server-executed by `/api/brep/evaluate`, but the initial preview request is currently initiated by the browser. Therefore `Native evaluator queued` must not be claimed at AI completion unless the product actually schedules that evaluation server-side. V1 may instead link the authenticated evaluate request to the generation run and persist `evaluation_started`/`preview_ready` when that request occurs. A later queued-worker slice can remove the remaining browser initiation entirely.
4. Existing `persist_brep_ai_revision` demonstrates the desired ownership/CAS discipline for immutable BRep state. Generation runs should use independent run IDs and monotonic per-run sequence/state transitions so an older run cannot overwrite a newer run's presentation state.
5. Repository database changes are schema-first by `AGENTS.md`: edit `supabase/schemas/`, generate/review the migration with local `npx supabase db diff`, apply it locally, and regenerate `shared/database.ts`. `shared/database.ts` must not be hand-edited. This database slice therefore must be generated in a real local Supabase checkout rather than fabricated through a remote file-only edit.

Recommended v1 authority model after this reconciliation:

```text
authenticated browser
  -> persists/owns user message through existing conversation policy
  -> calls chat/evaluate endpoints
  -> READS generation_runs for owned conversations

Brepia server
  -> service-role INSERT/UPDATE generation_runs
  -> bounded state-transition helper
  -> never stores raw provider output/secrets as progress detail

Supabase RLS
  -> owner SELECT only for ordinary authenticated clients
  -> no ordinary client INSERT/UPDATE/DELETE policy
```

### Why this is separate

The current BRep pending UI can infer useful coarse state from persisted conversation/messages and now recovers much better after mobile backgrounding. It still cannot truthfully expose every server step, because intermediate generation state is not persisted as first-class server data.

Do not replace this with fake percentages or client timers. The next step is a real durable progress channel.

### Desired user experience

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

`Native evaluator queued` is reserved for a future implementation that actually owns a server-side queue/job dispatch boundary.

Transport-specific information can be included where useful, for example an OpenCode event-stream reconnect, without presenting a reconnect as a failed generation.

### Proposed persistence model

Introduce an authenticated generation-run record owned by the conversation/user. Exact SQL is generated through the schema-first local workflow, but the logical fields are:

```text
generation_run
  id
  user_id
  conversation_id
  request_message_id
  response_message_id?      // once known
  kind                      // parametric / brep / creative
  requested_model_id
  actual_model_id?
  transport_kind
  execution_mode?
  status                    // queued/running/completed/failed/cancelled
  phase                     // current truthful server phase
  detail?                   // bounded machine/UI-safe detail
  sequence                  // monotonic progress version
  created_at
  started_at?
  updated_at
  completed_at?
  error_code?
  error_message?            // bounded/sanitized
```

For v1, one current persisted row with monotonic `sequence` is sufficient if the product only needs current progress plus final state. Separate rows per run mean an old run never overwrites a newer run row; the client selects the newest relevant run for its conversation/turn. If audit/history of every transition proves useful, add an append-only `generation_events` table rather than embedding an unbounded event array in the run row.

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

The stream sent to the browser becomes an *observer* of the generation, not the owner of its lifecycle.

### Client delivery

Use persisted state as the authority with two delivery paths:

- live updates through Supabase Realtime or an application SSE/status endpoint;
- bounded polling/refetch fallback for mobile browsers, reconnects and environments where a live subscription is suspended.

On reload/reopen, the client reads the persisted generation run first and renders the correct stage immediately. It must not depend on the old React mutation state still existing.

### Browser/background contract

- leaving or backgrounding the browser does not cancel generation unless the user explicitly requests Cancel;
- returning to the project rehydrates the latest persisted progress;
- completion while the browser is absent yields the final persisted project/revision on return;
- browser disconnect and OpenCode event-stream reconnect are distinguished from user cancellation;
- terminal failure is persisted and visible after reload instead of degrading into an ambiguous empty project.

### Cancellation

Cancel must target the server-owned generation run and transition it explicitly to `cancelled` when cancellation succeeds. Closing the page is not cancellation.

### Process-restart boundary

Persisted status alone makes browser reconnect/reload durable. It does not automatically make an in-process generation survive a Brepia server process crash. If crash/restart survival becomes a requirement, add a real queued worker/job executor as a separate robustness slice instead of implying that the status table provides job durability by itself.

### Acceptance scenarios

At minimum verify each with direct llama-swap, OpenCode and Codex/CLI-agent where supported:

1. start generation and remain on page;
2. background mobile Chrome for 30–60 seconds and return;
3. hard reload while generation is running;
4. navigate to home and reopen the running project from the sidebar;
5. generation completes while no project tab is open;
6. OpenCode event SSE disconnect/reconnect while agent continues;
7. explicit user cancel;
8. provider/agent failure before artifact creation;
9. failure during BRep validation/native evaluation;
10. successful terminal state followed by reload.

The UI must always show a truthful persisted stage or terminal result; it must never infer completion merely because a browser stream ended.

---

## Recommended implementation order

1. **UX-3 stable side-panel sizing** — implemented; browser acceptance pending.
2. **UX-4 revision names** — implemented; browser acceptance pending.
3. **UX-1 Parametric/Mesh + Attach controls** — repository complete; browser acceptance pending.
4. **UX-2 per-turn model provenance** — repository complete; browser/real-model acceptance pending.
5. **ROBUST-1 persisted generation status** — next schema/server/client slice; database artifacts must be generated with the repository's local schema-first Supabase workflow.

Keep installed Rhino/Grasshopper Phase 9 acceptance independent. None of these product UX/robustness items should weaken the strict GHX validation boundary or change the canonical BRep revision model.
