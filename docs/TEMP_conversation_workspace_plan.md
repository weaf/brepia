# Temporary plan: conversation naming and workspace layout

> Temporary implementation plan for the local pCAD development branch. Remove this file when the work is complete and the resulting architecture is documented permanently.

## Goal

Keep the repository root clean and make each pCAD conversation the owner of its persistent local artifacts. Conversation identity is the immutable conversation UUID; the human-readable title is metadata and may change without renaming the workspace directory.

Target layout:

```text
conversations/
└── <conversation-uuid>/
    ├── conversation.json
    ├── input/
    │   ├── images/
    │   ├── meshes/
    │   └── files/
    ├── models/
    │   ├── current.scad
    │   ├── current.json
    │   ├── revisions/
    │   └── generated/
    ├── renders/
    │   └── <revision>/
    │       ├── preview.png
    │       └── inspection.png
    ├── exports/
    │   ├── stl/
    │   ├── 3mf/
    │   └── dxf/
    ├── agents/
    │   ├── opencode/
    │   │   ├── session.json
    │   │   └── turns/
    │   └── codex/
    │       ├── session.json
    │       └── turns/
    └── logs/
        └── agent-events.jsonl
```

Temporary compile/validation scratch files stay in the system temp directory. The conversation workspace is for persistent or diagnostically useful artifacts.

## Step 1 — Conversation titles

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- deterministic local titles from first prompt
- image/mesh-aware fallback titles
- optional hosted title refinement remains best-effort
- naming never blocks prompt creation
- UUID remains technical conversation identity

## Step 2 — Conversation workspace abstraction

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- canonical server-side path ownership in `src/server/conversationWorkspace.ts`
- configurable root via `PCAD_CONVERSATIONS_DIR`, default `./conversations`
- strict UUID/path-containment validation
- idempotent full directory initialization and atomic `conversation.json`
- root is gitignored

Validation: full server suite passed with 167 tests / 57 suites / 0 failures at the Step 2 gate.

## Step 3 — Route persistent artifacts into the conversation workspace

### Step 3A — Conversation lifecycle

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- parametric and creative chat routes initialize/update the owned workspace
- authenticated Supabase conversation row remains authoritative
- request cloning preserves the stable AI request path
- old conversations get workspaces lazily
- persistence failures remain non-fatal
- user confirmed isolated UUID workspaces and correct manifests

### Step 3B — Conversation inputs

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- user-uploaded images mirror to `input/images/`
- user-uploaded meshes mirror to `input/meshes/`
- Supabase remains authoritative
- MIME-aware image extensions, atomic writes, idempotence, per-artifact failure isolation
- `input/files/` remains reserved until pCAD has a generic-file pipeline

### Step 3C — Generated OpenSCAD source

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- successful active-branch `build_parametric_model` sources become immutable numbered revisions
- `models/current.scad` / `current.json` follow the active source
- source identity uses tool-call identity plus source SHA-256
- parameter edits become new immutable `source: "parameter-edit"` revisions
- sibling branches cannot accidentally become current
- user confirmed revision/current behavior in the running app

### Step 3D — Renders and exports

**Status: COMPLETE — USER VALIDATED 2026-08-22**

- build preview → `renders/<revision>/preview.png`
- multi-view inspection → `renders/<revision>/inspection.png`
- parameter-edit revisions do not reuse stale build screenshots
- STL/DXF browser downloads remain primary and working
- workspace export copies are revision-bound by source SHA-256
- repeated identical exports are idempotent
- `.scad` is not duplicated under `exports/`
- export persistence reuses the existing parametric route via an internal action header; generated route tree remains untouched
- user confirmed render/export layout and parameter-edit behavior in the running app
- production build completed successfully; the Shiki/Oniguruma `unwasm` fallback warning was reviewed separately and is non-blocking

### Step 3E — Agents and diagnostics

**Status: READY FOR USER VALIDATION**

Conversation-scoped agent metadata is indexed from the authoritative persisted active conversation branch without moving or replacing OpenCode/Codex native session stores.

Implemented on `local-dev-next`:

- canonical workspace paths:
  - `agents/opencode/session.json`
  - `agents/opencode/turns/<stable-turn-id>.json`
  - `agents/codex/session.json`
  - `agents/codex/turns/<stable-turn-id>.json`
  - `logs/agent-events.jsonl`
- OpenCode Streaming recognizes existing `stream-*` tool calls and derives the same deterministic `ses_pcad_<conversation>` session ID already used by pCAD
- OpenCode/Codex CLI recognizes the existing persisted `cli-agent-session.<agent>.<encoded-session>...` marker and recovers the external session/thread ID
- active `parent_message_id` branch only; abandoned sibling branches are not indexed as current agent history
- current `session.json` stores agent, transport, model, external session ID, reuse state, and safe connection metadata
- Streaming OpenCode `session.json` includes the exact attach command built by the existing OpenCode transport
- immutable per-turn JSON stores only identifiers/status/timestamps/result category and bounded safe error metadata
- no raw prompt, raw stdout, or raw stderr is written to the conversation workspace
- turn IDs are deterministic from persisted message/tool-call identity; repeated lifecycle runs are idempotent
- conflicting rewrites of an existing immutable agent turn are rejected instead of silently changing history
- `agent-events.jsonl` records only actual session/turn additions or changes and is serialized for concurrent append safety
- old agent conversations can be backfilled lazily on the next generation request without a DB migration
- agent-history sync runs after existing input/model/render sync and remains inside the non-fatal workspace lifecycle guard
- OpenCode CLI continues running from the pCAD repository root so `.opencode/agents/pcad-builder.md` and plugins keep loading
- Codex retains its existing isolated runtime working directory; native external session ownership is unchanged

Validation gate before Step 4/completeness audit:

- `npm run typecheck`
- `npx tsx --test src/server/conversationWorkspaceAgents.test.ts`
- `npx tsx --test src/server/conversationWorkspaceAgentHistory.test.ts`
- `npx tsx --test src/server/conversationWorkspaceLifecycle.test.ts`
- `npx tsx --test src/server/conversationWorkspace.test.ts`
- `npx tsx --test src/server/*.test.ts`
- `npm run lint`
- `npm run build`
- manual OpenCode Streaming test: use at least two agent turns, then trigger one additional lifecycle pass and verify `agents/opencode/session.json`, immutable turn files, and `logs/agent-events.jsonl`
- if convenient, repeat with OpenCode CLI or Codex and verify its recovered external session ID under the corresponding agent directory
- verify diagnostics contain no raw prompt/stdout/stderr and normal agent/CAD generation remains unchanged

Do not start repository cleanup until Step 3E is user validated and the final completeness audit has checked remaining creative/generated model artifacts.

## Step 4 — Repository-root cleanup and guardrails

**Status: BLOCKED ON STEP 3E + COMPLETENESS AUDIT**

After production paths are fixed, classify and clean current root artifacts instead of merely moving the mess into generic top-level folders. Add `.gitignore`/test-output guardrails where appropriate.

## Global requirements

- every persistent artifact operation carries a `conversationId`
- persistent conversation paths come from `conversationWorkspace.ts`
- Supabase remains authoritative where it already owns records; local workspace copies complement it
- temporary validation scratch data stays outside the persistent conversation workspace
- old conversations remain usable through lazy workspace creation/backfill
- workspace persistence failures must not break normal CAD generation or successful browser downloads

## Completion criteria

- no normal conversation runtime writes persistent artifacts into the repository root
- each conversation has a stable UUID-owned workspace
- human-readable titles are independent of filesystem identity
- old conversations remain usable
- root contains only project/source/config/documentation files and explicitly owned test/development directories
- this temporary plan is removed after final documentation is updated
