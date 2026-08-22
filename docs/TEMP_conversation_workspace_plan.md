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

**Status: COMPLETE — USER VALIDATED 2026-08-22**

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
- repeated lifecycle runs are idempotent
- OpenCode/Codex native runtime/session ownership is unchanged
- user confirmed the resulting agent workspace behavior in the running app

## Step 4 — Repository-root cleanup and final completeness audit

### Step 4A — Clean root baseline and parametric runtime regression

**Status: COMPLETE — USER VALIDATED 2026-08-22**

- removed known generated root artifacts (`b9-report`, `.output`, `test-results`)
- removed tracked local runtime state/directories that do not belong in Git (`.omo/`, `.playwright-cli/`, `.playwright-mcp/`, `.tanstack/`)
- added narrow `.gitignore` guardrails without broad `*.png`, `*.scad`, or `*.stl` rules
- captured clean root file/directory baseline
- ran controlled parametric workflow including generation, modification, parameter edit and export
- root before/after diffs produced no output
- `git status --short --untracked-files=all` produced no runtime artifact drift at the validation gate

### Step 4B — Creative/generated-mesh completeness audit

**Status: IN PROGRESS — NEXT GATE**

The Creative runtime detour established a working local image-to-3D path before this audit continues:

- local Creative model selection is available in pCAD alongside legacy fal.ai backends
- local mesh gateway is installed and healthy
- `local/hunyuan3d-2` image → GLB → pCAD viewer has been manually validated
- Creative image aliases such as `image-1.png` are resolved to authoritative stored image UUIDs before mesh generation
- local runtime installation/toolchain work is separate from the conversation-workspace ownership goal
- follow-up mesh editing (`make it wider`, semantic/localized edits) is explicitly **DEFERRED**; it is not a Step 4B completion requirement
- TRELLIS runtime repair, Hunyuan3D-2.1 validation, Stable Fast 3D gated weights and full GPU arbitration validation are also separate runtime follow-ups and do not block the workspace audit

Step 4B now verifies the original workspace objective for Creative mode:

1. run one successful Creative image-to-3D generation
2. identify the corresponding conversation UUID/workspace
3. enumerate the workspace files after the successful generation
4. verify the original uploaded image is present under `input/images/`
5. determine whether the generated GLB is persisted under the intended `models/generated/` ownership path
6. verify no Creative runtime artifact appears in the repository root
7. if generated mesh persistence is missing, implement the smallest authoritative-storage → workspace mirror needed for successful Creative meshes
8. repeat the Creative run / lifecycle sync and confirm idempotence

Expected durable ownership is:

```text
conversations/<uuid>/
├── input/images/<source-image-id>.<ext>
└── models/generated/<generated-mesh-id>.glb
```

Supabase remains authoritative; the local generated mesh is a conversation-owned mirror, not a replacement for storage/database ownership.

### Step 4C — Final validation and documentation cleanup

**Status: PENDING**

After Step 4B is complete:

- repeat root baseline diff after the Creative workflow
- run focused workspace tests and full server test suite
- run `npm run typecheck`
- run production build if the Step 4B implementation touches runtime/build paths
- reconcile any intentionally deferred Creative runtime work into permanent docs/issues rather than this temporary workspace plan
- update permanent architecture documentation
- remove this temporary plan only after all workspace completion criteria are satisfied

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
- generated Creative meshes are mirrored into their owning conversation workspace
- root contains only project/source/config/documentation files and explicitly owned test/development directories
- clean-baseline → controlled-run diff produces no unexplained persistent root artifacts
- this temporary plan is removed after final documentation is updated
