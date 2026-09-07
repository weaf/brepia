# Post-Phase 8 product UX and durable generation-status plan

Status: planned follow-up after the accepted Brepia-side Phase 8 GHX loop.

This document captures product/robustness work identified during real mobile and local-model acceptance. It is intentionally separate from installed Rhino/Grasshopper Phase 9 acceptance.

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

### Problem

The current prompt chrome uses one Mesh button as a mode toggle. This makes it visually ambiguous whether the control means "create a mesh" or "switch creation mode". Image and 3D-file attachment also occupy two separate buttons even though both are input attachments.

### Target interaction

Top-level creation mode is always explicit:

```text
Parametric | Mesh
```

When Parametric is selected, keep the existing source subtype:

```text
OpenSCAD | Native BRep
```

Replace the separate image and 3D-file buttons with one Attach control. The Attach menu exposes the input kinds valid for the active mode, for example:

```text
Attach
  Image
  3D model
```

Native BRep remains text-only until its attachment contract is deliberately expanded. In that mode Attach should either be hidden or disabled with a clear explanation; it must not silently inherit OpenSCAD asset semantics.

### Acceptance

- Parametric and Mesh are separate visible controls; no single button toggles between them implicitly.
- Parametric retains OpenSCAD/Native BRep as a second-level choice.
- one Attach entry point replaces the current image/STL button pair;
- existing paste and drag/drop behavior remains supported;
- file validation remains mode-aware and fail-closed;
- switching modes does not silently retain incompatible attachments.

---

## UX-2 — per-turn model and transport provenance

### Problem

The model selector shows the model that will be used for the next turn, but historical assistant iterations do not clearly show which model actually produced them. This becomes especially confusing when a project is created with one local model and then iterated with another model, OpenCode, or Codex.

### Existing authority

Assistant messages already persist model metadata. Creative turns additionally persist the actual controller/agent model separately from the 3D mesh backend. This existing per-message metadata, not the conversation's current/default model, must remain the authority for historical display.

### Target display

Each completed assistant iteration gets a small, unobtrusive provenance line, for example:

```text
Qwen3.6-35B Heretic
OpenCode · Streaming · Qwen3.8-27B
Codex CLI · <actual model>
Ornith
```

Creative/Mesh turns should distinguish the controller AI from the mesh backend when both exist:

```text
AI: Qwen3.8-27B
3D: TRELLIS.2
```

### Metadata contract

Forward-going assistant metadata should capture enough immutable turn-level provenance to render this without consulting current settings:

- requested model ID;
- actual model/agent ID used for the turn;
- transport kind where relevant (`direct`, `opencode`, `codex`, other CLI agent);
- OpenCode execution mode (`cli` or `streaming`) where relevant;
- Creative 3D backend separately from Creative controller AI.

Legacy messages should render whatever provenance is already available and omit unknown fields rather than inventing them.

### Acceptance

- changing the model for a later turn does not alter labels on earlier turns;
- OpenCode CLI and Streaming are distinguishable for new turns;
- Codex/other CLI-agent turns are distinguishable from direct provider calls;
- Creative history can show both AI controller and mesh backend;
- retry/branch history retains provenance per branch message.

---

## UX-3 — stable right-hand panel width and wrapping

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
Native evaluator queued
Evaluating build123d/OCCT geometry
Preparing viewer mesh
Preview ready
```

Transport-specific information can be included where useful, for example an OpenCode event-stream reconnect, without presenting a reconnect as a failed generation.

### Proposed persistence model

Introduce an authenticated generation-run record owned by the conversation/user. Exact naming should be reconciled with the existing Supabase schema before implementation, but the logical fields are:

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

For v1, one current persisted row with monotonic `sequence` is sufficient if the product only needs current progress plus final state. If audit/history of every transition proves useful, add an append-only `generation_events` table rather than embedding an unbounded event array in the run row.

### Security

- normal auth/user ownership/RLS applies;
- a user can only read generation runs for conversations they own;
- client writes to generation status are not authoritative;
- server transitions are validated/bounded;
- raw provider/OpenCode/Codex output and secrets must never be copied into status detail/error fields.

### Server lifecycle

The server creates/updates the generation run at real boundaries:

1. request accepted/input persisted;
2. model/agent transport selected;
3. generation dispatched/running;
4. final response received;
5. artifact/tool output validated;
6. immutable assistant/source revision persistence begins/completes;
7. BRep native evaluation queued/started/completed when applicable;
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

1. **UX-3 stable side-panel sizing** — small shared layout fix with immediate usability value.
2. **UX-4 revision names** — presentation-only persistence, low risk to canonical lineage.
3. **UX-1 Parametric/Mesh + Attach controls** — prompt chrome cleanup across creation modes.
4. **UX-2 per-turn model provenance** — expose already-persisted metadata first, then extend forward metadata for transport/execution mode.
5. **ROBUST-1 persisted generation status** — schema/server/client slice with real background/reload acceptance.

Keep installed Rhino/Grasshopper Phase 9 acceptance independent. None of these product UX/robustness items should weaken the strict GHX validation boundary or change the canonical BRep revision model.
