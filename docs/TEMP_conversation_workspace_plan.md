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

**Status: READY FOR USER VALIDATION**

Create a single server-side path abstraction in `src/server/conversationWorkspace.ts`.

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

Important scope boundary:

- Step 2 defines and validates the workspace layer only.
- Normal runtime artifacts are **not routed into these directories yet**; that is Step 3.
- Temporary OpenSCAD validation data remains in the system temp directory.

Validation gate before Step 3:

- `npm run typecheck`
- `npx tsx --test src/server/conversationWorkspace.test.ts`
- `npx tsx --test src/server/*.test.ts`
- optionally set `PCAD_CONVERSATIONS_DIR` to a test path and inspect the resulting layout through the focused test

Do not begin Step 3 until the user confirms Step 2 passes validation.

## Step 3 — Route persistent artifacts into the conversation workspace

**Status: BLOCKED ON STEP 2 USER VALIDATION**

Move persistent/runtime artifacts behind the workspace abstraction incrementally:

1. initialize/lazily ensure the UUID-owned workspace from normal conversation runtime
2. user input images/files/meshes where local copies are required
3. generated OpenSCAD source (`current.scad` + revisions)
4. render/inspection images grouped by model revision/build
5. exports (STL/3MF/DXF as applicable)
6. agent-specific artifacts for OpenCode/Codex
7. useful conversation-scoped logs/diagnostics

Requirements:

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
