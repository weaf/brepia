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
    ├── exports/
    │   ├── stl/
    │   ├── 3mf/
    │   └── dxf/
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

`src/server/conversationWorkspace.ts` owns all persistent workspace paths.

- configurable root via `PCAD_CONVERSATIONS_DIR`, default `./conversations`
- default root is gitignored
- strict UUID/path-containment validation
- canonical helpers for inputs, models, renders, exports, agents, and logs
- idempotent workspace initialization
- versioned `conversation.json`
- atomic manifest writes
- ownership mismatch rejection

Validation: full server suite passed with 167 tests / 57 suites / 0 failures at the Step 2 gate.

## Step 3 — Route persistent artifacts into the conversation workspace

### Step 3A — Conversation lifecycle

**Status: COMPLETE — USER VALIDATED 2026-08-21**

- both parametric and creative chat routes run the workspace lifecycle
- request body is cloned; the existing chat handler receives the untouched request
- authenticated Supabase conversation row is authoritative
- old conversations get workspaces lazily
- workspace failures are non-fatal to the stable chat path
- user confirmed two conversations produced two isolated UUID workspaces with correct manifests

### Step 3B — Conversation inputs

**Status: COMPLETE — USER ACCEPTED 2026-08-21**

- `src/server/conversationWorkspaceInputs.ts`
- successful user-uploaded images mirror to `input/images/`
- successful user-uploaded meshes mirror to `input/meshes/`
- Supabase storage remains authoritative
- MIME type determines image extension
- input mirroring is idempotent
- missing/broken individual storage objects are skipped without stopping later artifacts
- generated mesh preview derivatives remain reserved for Step 3D
- `input/files/` remains reserved until pCAD has a generic-file upload pipeline

### Step 3C — Generated OpenSCAD source

**Status: READY FOR USER VALIDATION**

Persist successful `build_parametric_model` sources from the active conversation branch.

Implemented on `local-dev-next`:

- new `src/server/conversationWorkspaceModels.ts`
- lifecycle loads `current_message_leaf_id` and runs model-source sync for parametric conversations only
- the active message branch is reconstructed through `parent_message_id`; abandoned sibling branches cannot become `current.scad`
- only `tool-build_parametric_model` parts with `state=output-available` and `output.status=success` are revisioned
- each unique tool call receives an immutable numbered source revision:
  - `models/revisions/001.scad`
  - `models/revisions/001.json`
  - `models/revisions/002.scad`
  - etc.
- revision metadata records revision number, tool call ID, message ID/timestamp, model title/version, SHA-256, and save time
- revision replay is idempotent by `toolCallId`; reconnect recovery cannot create duplicate revisions
- immutable revision checksum/replay mismatches are rejected instead of silently rewriting history
- `models/current.scad` always follows the newest successful build on the currently selected active branch
- `models/current.json` records which immutable revision `current.scad` represents
- switching to an older branch updates `current.scad` without rewriting or deleting newer immutable revisions
- legacy conversations lazily backfill successful builds on their active branch when next used
- per-conversation serialization prevents same-process concurrent revision races
- orphaned `.scad` revision numbers are included when selecting the next revision number
- model-sync failures remain inside the existing non-fatal workspace lifecycle guard and cannot block the normal chat response
- focused tests cover active-branch selection, failed-build exclusion, numbered revisions, metadata, repeat-run idempotence, branch switching, immutable replay protection, revision path validation, creative-conversation exclusion, and non-fatal lifecycle failure

Validation gate before Step 3D:

- `npm run typecheck`
- `npx tsx --test src/server/conversationWorkspaceModels.test.ts`
- `npx tsx --test src/server/conversationWorkspaceLifecycle.test.ts`
- `npx tsx --test src/server/*.test.ts`
- manual UI: create a parametric conversation and let at least one build complete; verify `models/current.scad` and `models/revisions/001.scad`
- make a second CAD change in the same conversation; verify `002.scad` appears and `current.scad` matches it
- send another normal turn without a new successful build and verify no duplicate revision appears
- if convenient, switch/retry to an older branch and verify `current.scad` follows that branch while immutable revisions remain intact
- confirm normal pCAD generation still works

Do not begin Step 3D until the user confirms Step 3C works in the running app.

### Step 3D — Renders and exports

**Status: BLOCKED ON STEP 3C USER VALIDATION**

Persist render/inspection assets by revision/build and exports under the corresponding format directory.

### Step 3E — Agents and diagnostics

**Status: NOT STARTED**

Route OpenCode/Codex conversation-scoped artifacts and useful diagnostics under `agents/` and `logs/`.

## Step 4 — Repository-root cleanup and guardrails

**Status: NOT STARTED**

After production paths are fixed, classify and clean current root artifacts instead of merely moving the mess into generic top-level folders. Add `.gitignore`/test-output guardrails where appropriate.

## Global requirements

- every artifact operation carries a `conversationId`
- no production code constructs persistent conversation artifact paths outside `conversationWorkspace.ts`
- Supabase remains authoritative where it already owns records; the local workspace complements it
- temporary validation scratch data stays outside the persistent conversation workspace
- old conversations remain usable through lazy workspace creation/backfill

## Completion criteria

- no normal conversation runtime writes persistent artifacts into the repository root
- each conversation has a stable UUID-owned workspace
- human-readable titles are independent of filesystem identity
- old conversations remain usable
- root contains only project/source/config/documentation files and explicitly owned test/development directories
- this temporary plan is removed after final documentation is updated
