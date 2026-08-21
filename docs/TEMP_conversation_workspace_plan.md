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
    │   │   ├── 001.scad
    │   │   ├── 001.json
    │   │   └── ...
    │   └── generated/
    ├── renders/
    │   ├── 001/
    │   │   ├── preview.png
    │   │   └── inspection.png
    │   └── ...
    ├── exports/
    │   ├── stl/
    │   │   ├── 001.stl
    │   │   └── 001.json
    │   ├── 3mf/
    │   └── dxf/
    │       ├── 001.dxf
    │       └── 001.json
    ├── agents/
    │   ├── opencode/
    │   └── codex/
    └── logs/
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

- `src/server/conversationWorkspaceInputs.ts`
- user-uploaded images mirror to `input/images/`
- user-uploaded meshes mirror to `input/meshes/`
- Supabase remains authoritative
- MIME-aware image extensions, atomic writes, idempotence, per-artifact failure isolation
- `input/files/` remains reserved until pCAD has a generic-file pipeline

### Step 3C — Generated OpenSCAD source

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- `src/server/conversationWorkspaceModels.ts`
- successful `build_parametric_model` sources on the active branch become immutable numbered revisions
- `models/current.scad` / `current.json` follow the current active source
- sibling branches cannot accidentally become current
- revision metadata records tool/message identity, title/version, source kind, SHA-256, and timestamp
- per-conversation serialization and atomic current writes protect concurrent/reconnect flows
- user confirmed revision/current behavior in the running app

Step 3D hardening added to the same model layer:

- revision identity is now `toolCallId + code SHA-256`, not only `toolCallId`
- parameter edits persisted into the same tool call therefore become a new immutable source revision instead of mutating old history
- when `message.metadata.originalCode` exists, the original model build is retained with `source: "build"` and the edited source becomes `source: "parameter-edit"`
- existing Step 3C sidecars without `source` remain readable as normal build revisions

### Step 3D — Renders and exports

**Status: READY FOR USER VALIDATION**

Render routing:

- new `src/server/conversationWorkspaceRenders.ts`
- lifecycle mirrors the already-generated private Supabase build artifacts after model revision sync
- build thumbnail → `renders/<revision>/preview.png`
- multi-view inspection sheet → `renders/<revision>/inspection.png`
- only revisions with `source: "build"` receive build-time render artifacts; parameter-edit revisions deliberately do not reuse stale screenshots
- mirroring is atomic, idempotent, and isolates missing/broken storage objects
- creative conversations do not run OpenSCAD render sync

Export routing:

- new `src/server/conversationWorkspaceExports.ts`
- STL/DXF downloads remain browser-first; local persistence is best-effort and cannot make a successful user download fail
- exact export revision is resolved from the OpenSCAD source SHA-256; exports are never attached to a guessed revision
- canonical files:
  - `exports/stl/<revision>.stl` + sidecar JSON
  - `exports/dxf/<revision>.dxf` + sidecar JSON
- sidecars record revision, format, source SHA-256, artifact SHA-256, byte length, and timestamp
- repeated identical export is a no-op; regenerated different bytes atomically replace the canonical export for that revision/format
- `.scad` downloads are not duplicated under `exports/` because the canonical source already lives in `models/`
- `exports/3mf/` and the server format contract are reserved; the current parametric UI does not expose 3MF export
- export persistence reuses the already-registered `/api/parametric-chat` route through the internal `X-PCAD-Workspace-Action: persist-export` action; no generated TanStack route-tree edit is required
- a parameter-edit persistence race retries once and otherwise fails only the workspace copy, never the browser download

Validation gate before Step 3E:

- `npm run typecheck`
- `npx tsx --test src/server/conversationWorkspaceModels.test.ts`
- `npx tsx --test src/server/conversationWorkspaceRenders.test.ts`
- `npx tsx --test src/server/conversationWorkspaceExports.test.ts`
- `npx tsx --test src/server/conversationWorkspaceLifecycle.test.ts`
- `npx tsx --test src/server/*.test.ts`
- manual build test: verify `renders/<build-revision>/preview.png` and, when uploaded successfully, `inspection.png`
- manual STL download: verify matching numbered `.stl` + `.json` under `exports/stl/`
- manual DXF download: verify matching numbered `.dxf` + `.json` under `exports/dxf/`
- parameter-edit test: change a parameter, allow persistence to settle, export STL, and verify a new `source: "parameter-edit"` model revision owns that export while the old build render remains attached only to the original build revision
- repeat the same export and verify no duplicate numbered export is created
- confirm normal pCAD generation, vision inspection, browser downloads, and branch behavior still work

Do not begin Step 3E until the user confirms Step 3D works in the running app.

### Step 3E — Agents and diagnostics

**Status: BLOCKED ON STEP 3D USER VALIDATION**

Route OpenCode/Codex conversation-scoped artifacts and useful diagnostics under `agents/` and `logs/`.

## Step 4 — Repository-root cleanup and guardrails

**Status: NOT STARTED**

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
