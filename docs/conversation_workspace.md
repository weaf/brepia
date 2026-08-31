# Conversation workspace architecture

Brepia keeps persistent local conversation artifacts under a UUID-owned workspace instead of writing generated files into the repository root.

## Identity and root

The immutable conversation UUID is the filesystem identity. Human-readable conversation titles are metadata and may change without renaming the workspace.

The workspace root is configured with `PCAD_CONVERSATIONS_DIR` and defaults to:

```text
./conversations
```

`conversations/` is local runtime state and is ignored by Git.

## Layout

```text
conversations/<conversation-uuid>/
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

The server-side path authority is `src/server/conversationWorkspace.ts`. Conversation IDs and path segments are validated before filesystem paths are constructed.

## Ownership model

Supabase remains authoritative for data it already owns. The local workspace is a conversation-scoped mirror for durable local tooling, diagnostics and generated artifacts.

The main ownership rules are:

- user-uploaded images → `input/images/`
- user-uploaded meshes → `input/meshes/`
- generic file input → `input/files/` when a generic-file pipeline exists
- successful parametric OpenSCAD revisions → `models/revisions/`
- active parametric source → `models/current.scad` + `models/current.json`
- successful Creative generated meshes → `models/generated/<mesh-uuid>.<ext>`
- parametric preview/inspection renders → `renders/<revision>/`
- revision-bound exports → `exports/<format>/`
- safe OpenCode/Codex session indexes → `agents/`
- bounded agent event metadata → `logs/agent-events.jsonl`

Temporary compiler/validation scratch files stay in the system temporary directory and do not belong in the conversation workspace.

## Lifecycle

`src/server/conversationWorkspaceLifecycle.ts` synchronizes a workspace around authenticated chat generation requests.

The lifecycle is intentionally best-effort: a local workspace persistence failure is logged but must not break an otherwise valid CAD/Creative request.

For all conversations it:

1. verifies that the authenticated user owns the conversation,
2. initializes or updates `conversation.json`,
3. mirrors user inputs,
4. mirrors safe agent/session diagnostics.

For parametric conversations it additionally synchronizes active-branch OpenSCAD revisions and render artifacts.

For Creative conversations it mirrors successful generated meshes from authoritative Supabase mesh storage into `models/generated/`.

Local Creative generation also performs a post-success generated-mesh sync so a newly completed local mesh is available in the workspace immediately; the lifecycle path remains an idempotent backfill for existing conversations.

## Branch and revision semantics

Parametric model state follows the active persisted `parent_message_id` branch. Sibling/abandoned branches do not silently become the current model.

Successful `build_parametric_model` outputs and parameter edits become immutable numbered revisions. Source identity includes the tool-call identity and SHA-256 of the OpenSCAD source.

Creative generated mesh mirrors are identified by their authoritative mesh UUID and file type. Re-running synchronization does not create duplicate copies.

## Agent diagnostics

The workspace does not replace OpenCode or Codex native runtime/session stores. It stores a safe conversation-scoped index only.

Persisted metadata may include agent, transport, model, external session/thread ID, reuse state, safe timestamps/status/result category and bounded error metadata.

Raw prompts, raw stdout, raw stderr and full model output are not written into the workspace agent index.

## Repository-root invariant

Normal Brepia runtime must not create persistent generated artifacts in the repository root.

Known local/runtime directories are ignored explicitly rather than using broad patterns such as `*.png`, `*.scad` or `*.stl`. This keeps unexpected root artifacts visible during development.

Parametric and Creative controlled-run baseline tests have both been used to verify that normal workflows do not introduce unexplained root files/directories.

## Local Creative v1 boundary

The verified local Creative v1 path is image/text generation through the selected local mesh backend, persistence to Supabase, display in Brepia and mirroring into `models/generated/`.

Follow-up editing of an existing locally generated mesh is currently deferred. The stable local mesh entrypoint rejects `meshId` edit requests rather than silently regenerating a mesh or claiming an edit succeeded.

The following runtime work is separate from the conversation-workspace architecture and may be completed independently:

- local Creative follow-up/semantic mesh editing,
- Hunyuan3D-2.1 runtime validation,
- full llama-swap/local-mesh GPU arbitration validation.

## Operational invariants

- every persistent artifact operation is scoped by `conversationId`
- workspace paths are derived through the conversation workspace path helpers
- Supabase remains authoritative where it already owns the record/object
- synchronization is idempotent
- old conversations receive workspaces lazily
- one stale/broken mirrored artifact must not prevent unrelated artifacts from syncing
- workspace persistence failures must not break successful browser downloads or normal CAD generation
