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
    │   ├── revisions/
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

Temporary scratch files used only during isolated compilation/validation should stay in the system temp directory and be removed after use. The conversation workspace is for persistent or diagnostically useful artifacts.

## Step 1 — Conversation titles

**Status: COMPLETE — USER VALIDATED 2026-08-21**

New conversations receive a useful title from the first user request instead of remaining `New Conversation`.

Implemented on `local-dev-next`:

- deterministic title generation from the first user text
- image/mesh-aware fallback titles when there is no text
- existing `/api/title-generator` returns the local deterministic title when Anthropic is not configured
- optional Anthropic refinement remains best-effort and non-blocking
- title generation is kept off the critical prompt path; legacy `New Conversation` is retained as an insert fallback
- optional refined titles update Supabase asynchronously and refresh conversation queries
- focused title-generation tests added
- Supabase-style non-`Error` failures now surface their actual message in the UI

Validation result:

- user confirmed new conversation creation and naming work in the running app on 2026-08-21

## Step 2 — Conversation workspace abstraction

**Status: COMPLETE — USER VALIDATED 2026-08-21**

The canonical server-side path abstraction lives in `src/server/conversationWorkspace.ts`.

Implemented on `local-dev-next`:

- configurable workspace root via `PCAD_CONVERSATIONS_DIR`
- default root is `./conversations`
- default `conversations/` directory is gitignored
- strict UUID validation for conversation ownership boundaries
- path-containment checks prevent escaping the configured root
- safe agent workspace names prevent traversal through agent subdirectories
- canonical path helpers for:
  - conversation root and `conversation.json`
  - input images / meshes / generic files
  - models / revisions / generated model files
  - renders
  - exports (`stl`, `3mf`, `dxf`)
  - agent directories
  - logs
- idempotent `initializeConversationWorkspace()` creates the complete directory tree
- `conversation.json` uses a versioned manifest and preserves existing extra metadata on reinitialization
- manifest ownership mismatch is rejected rather than silently reusing another conversation's directory
- manifest writes use a temporary file + rename so readers do not observe partially written JSON
- focused server tests cover path safety, initialization, idempotence, metadata preservation, ownership mismatch, and isolation between two conversations

Validation result:

- full server suite passed: 167 tests, 57 suites, 0 failures

Important scope boundary:

- Step 2 defines and validates the workspace layer only.
- Temporary OpenSCAD validation data remains in the system temp directory.

## Step 3 — Route persistent artifacts into the conversation workspace

### Step 3A — Conversation lifecycle

**Status: READY FOR USER VALIDATION**

Initialize/update a UUID-owned local workspace when a real conversation is used for generation.

Implemented on `local-dev-next`:

- new `src/server/conversationWorkspaceLifecycle.ts`
- both `/api/parametric-chat` and `/api/creative-chat` run the lifecycle hook before the existing AI handler
- the lifecycle hook clones the request, so the downstream AI handler receives the untouched original body
- only normal POST generation requests participate; GET/OPTIONS/cancel/malformed requests do not create workspaces
- the authenticated Supabase conversation row remains authoritative for `id`, title, type, and timestamps
- only conversations owned by the authenticated user can initialize a workspace
- existing conversations without a workspace are handled lazily the next time they generate
- `initializeConversationWorkspace()` remains the only directory/manifest writer
- lifecycle failures are logged but are deliberately non-fatal to the stable chat path
- focused tests cover request parsing, metadata synchronization, request-body preservation, inaccessible conversations, and non-fatal filesystem failure behavior

Expected manual result for a normal new conversation:

```text
conversations/
└── <conversation-uuid>/
    ├── conversation.json
    ├── input/
    │   ├── images/
    │   ├── meshes/
    │   └── files/
    ├── models/
    │   ├── revisions/
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

Validation gate before Step 3B:

- `npm run typecheck`
- `npx tsx --test src/server/conversationWorkspaceLifecycle.test.ts`
- `npx tsx --test src/server/*.test.ts`
- manual UI test: create two conversations and confirm two isolated UUID directories appear under `conversations/`
- inspect each `conversation.json` and confirm its `id`, title, type, `createdAt`, and `updatedAt` match the corresponding conversation
- confirm normal pCAD generation still works

Do not begin Step 3B until the user confirms Step 3A works in the running app.

### Step 3B — Conversation inputs

**Status: BLOCKED ON STEP 3A USER VALIDATION**

Route user input images/files/meshes, where local persistent copies are required, through the workspace abstraction.

### Step 3C — Generated OpenSCAD source

**Status: NOT STARTED**

Persist `models/current.scad` plus immutable/revisioned source snapshots.

### Step 3D — Renders and exports

**Status: NOT STARTED**

Persist render/inspection assets by revision/build and exports under the corresponding format directory.

### Step 3E — Agents and diagnostics

**Status: NOT STARTED**

Route OpenCode/Codex conversation-scoped artifacts and useful diagnostics under `agents/` and `logs/`.

Step 3 requirements:

- every artifact operation carries a `conversationId`
- no production code constructs persistent conversation artifact paths ad hoc; all paths come from `conversationWorkspace.ts`
- Supabase remains the authoritative application data store where it already owns records; the local workspace complements it rather than silently replacing database ownership
- temporary validation scratch data remains outside the persistent conversation workspace
- existing conversations without a workspace continue to load; create workspace lazily where appropriate

## Step 4 — Repository-root cleanup and guardrails

**Status: NOT STARTED**

After production paths are fixed, classify and clean the current root artifacts instead of merely moving the mess into generic top-level folders.

Likely categories:

- manual/debug screenshots (`b9-*.png`, `debug-settings*.png`, etc.)
- generated model/render/export artifacts (`parametric_box*`, ad-hoc `.scad`, `.stl`)
- test fixtures/results that belong under `tests/`, `test-results/`, or another explicit test-artifact directory
- obsolete one-off files that can be deleted after review

Add further `.gitignore`/test-output rules where appropriate so the root stays clean going forward.

## Completion criteria

- no normal conversation runtime writes persistent artifacts into the repository root
- each conversation has a stable UUID-owned workspace
- human-readable titles work independently of filesystem identity
- old conversations remain usable
- root contains only project/source/config/documentation files and explicitly owned test/development directories
- temporary plan is removed after final documentation is updated
