# Multi-file OpenSCAD / project workspace plan

Status: selected post-1.0 feature; architecture/reconciliation complete enough to begin implementation in bounded steps.

Branch: `feature/multifile-openscad-workspace`

Baseline: `master` at `9048df8131d9cd1ce24330727c39ee8da29f18fe`.

## Goal

Extend Brepia's working single-file OpenSCAD flow into a normalized project workspace that can safely preserve and execute multiple OpenSCAD source files and, in a later step of this feature, explicitly supported relative assets.

The feature must preserve existing single-file Parametric conversations, imports, parameter editing, preview/export behavior, conversation trees, stable runtime behavior and the STEP sandbox security model.

This is an OpenSCAD project-workspace feature. It must not become a premature generalized CAD-backend rewrite. The normalized project concepts should nevertheless avoid assumptions that would prevent a later Rhino/Grasshopper or other CAD integration from using similar workspace primitives.

## Non-goals

- Do not replace OpenSCAD.
- Do not add Rhino/Grasshopper in this branch.
- Do not add RepliCAD/build123d/CadQuery as generation backends.
- Do not redesign the conversation/version tree.
- Do not weaken rootless STEP sandbox isolation.
- Do not make the local filesystem workspace the authoritative persistence layer; it remains an operational mirror. Supabase/message/storage state remains authoritative.
- Do not require a migration of existing single-file Parametric messages.

## Reconciled current implementation

### Artifact/tool contract is single-source

`ParametricArtifact` is currently:

```ts
{
  title: string;
  version: string;
  code: string;
}
```

`parametricArtifactSchema` and `build_parametric_model` likewise accept one `code` string. Existing message history, restore/retry, parameter editing, share UI, preview and workspace revision extraction all depend on that shape.

### Local import explicitly rejects project dependencies

`src/lib/scadImport.ts` currently accepts one `.scad`/`.scad.txt` source and rejects non-bundled `include`/`use`, plus all `import()` and `surface()` dependencies. This was the correct v1 security boundary and should be evolved rather than bypassed.

### GitHub import resolves one file

`src/server/githubScadImport.ts` retrieves one normal repository file. Gists must currently contain exactly one `.scad` file.

### Browser OpenSCAD worker already contains useful multi-file machinery

`src/worker/openSCAD.ts` already has an in-memory `WorkspaceFile[]`, `FS_WRITE` support, directory creation and mounting of stored files into each fresh OpenSCAD WASM instance. However, normal preview/export messages contain only `code`, and `executeOpenscad()` always writes/executes `/input.scad`.

This means the geometry runtime does not need to be replaced; the request contract and safe project mounting need to be completed.

### Conversation workspace already persists Parametric revisions

The local conversation workspace already mirrors active Parametric source revisions as immutable `.scad` files plus metadata and maintains `models/current.scad`. This is useful compatibility infrastructure, but it only snapshots the entrypoint source today.

### STEP is intentionally one-input-only

`POST /api/export/step` accepts `sourceCode`. The STEP runner mounts exactly one read-only SCAD input file. `docs/step_export.md` already identifies normalized multi-file workspace input as the required design before arbitrary relative project files/assets can be supported.

## Product behavior

### Existing single-file project

Nothing changes for an existing artifact or imported `.scad` file. It remains valid with only `title`, `version`, and `code`.

### Multi-file project

A multi-file artifact has one explicit entrypoint and zero or more support files. The initial compatibility representation should extend, not replace, the existing artifact:

```ts
type ParametricProjectTextFile = {
  path: string;
  content: string;
};

type OpenScadProject = {
  schemaVersion: 1;
  entrypointPath: string;
  files: ParametricProjectTextFile[];
};

type ParametricArtifact = {
  title: string;
  version: string;
  code: string;
  project?: OpenScadProject;
};
```

Compatibility invariant:

- `code` remains the complete contents of `entrypointPath`.
- `project.files` contains support source files and MUST NOT duplicate the entrypoint.
- if `project` is absent, the artifact behaves exactly as it does in Brepia 1.0.

This keeps all existing consumers functional while allowing project-aware paths to mount the support files.

A future backend-neutral artifact is a separate project. Do not add `backend`, `language`, Rhino, RepliCAD or similar fields merely to solve multi-file OpenSCAD.

## Normalized project path model

Every project path must be normalized before it reaches the worker, local conversation workspace, STEP temporary workspace or a storage object path.

Required invariants:

- relative paths only;
- `/` is the canonical separator;
- reject absolute paths and Windows drive paths;
- reject empty segments, `.` and `..` segments;
- reject NUL/control characters;
- enforce bounded segment/path lengths and bounded nesting depth;
- enforce unique normalized paths, case-collision checks where appropriate, file-count limits, per-file limits and total-project byte limits;
- generated temporary workspaces contain only regular files created by Brepia from validated bytes; no user-provided symlinks/FIFOs/devices;
- bundled BOSL/BOSL2/MCAD libraries remain outside the user project namespace.

Centralize this in one shared project validator/normalizer rather than duplicating path checks in upload, GitHub, worker and STEP code.

## OpenSCAD path semantics

Preserve the user's directory hierarchy when mounting the project. OpenSCAD resolves non-fully-qualified `include`/`use` paths relative to the calling `.scad` file before library search paths. Therefore nested helpers must be mounted under the same relative path tree as the imported project.

The browser runtime should execute a normalized path such as:

```text
/project/<entrypointPath>
```

rather than rewriting the source to flatten includes or continuing to force every model into `/input.scad`.

## Implementation steps

### Step 1 — Project contracts and validation

Add project types and a central path/project validator with focused tests.

Requirements:

- optional `project` on `ParametricArtifact` and the Zod tool schema;
- backward-compatible `isParametricArtifact` handling;
- deterministic project normalization;
- explicit bounds/constants for file count, path depth, per-file source bytes and total source bytes;
- no DB migration solely for the optional JSON shape.

Do not change runtime compilation in this step.

Gate:

- old artifact fixtures remain valid;
- malformed project paths, duplicates, traversal attempts and oversized projects fail deterministically;
- `npm test`, typecheck and lint for touched code.

### Step 2 — Project-aware browser OpenSCAD execution

Extend the worker compile request to carry the normalized entrypoint path plus support files for that compile.

Important design decision: do not depend on state left in the singleton worker from a previous conversation/project. Each preview/export must be reproducible from the request itself and each fresh OpenSCAD instance.

Worker behavior:

1. create `/project`;
2. mount the entrypoint at `/project/<entrypointPath>`;
3. mount all support files under `/project/...`;
4. scan all active project source files for bundled BOSL/BOSL2/MCAD dependencies, not only the entrypoint;
5. execute the actual entrypoint path;
6. keep current manifold/color preview behavior and output limits.

Update the normal preview and STL/DXF export paths to pass the project when present.

Gate corpus:

- legacy one-file model;
- `main.scad -> include <lib/a.scad>`;
- nested `a.scad -> use <nested/b.scad>`;
- sibling and parent-directory traversal in source references only when the normalized target remains inside the project; attempts to escape the project must fail;
- bundled BOSL2 referenced from a support file;
- parameterized entrypoint with support modules;
- 2D DXF and 3D STL regression.

### Step 3 — Local directory/project import

Keep the current `Import SCAD` single-file action and add a separate project-folder path rather than changing the semantics of the existing button silently.

Modern browsers expose directory selection through `webkitdirectory` and preserve hierarchy in `File.webkitRelativePath`. Use that for the primary folder picker, with a graceful fallback/manual multi-file path if needed.

Import flow:

1. collect selected regular files and relative paths;
2. normalize/validate before reading them into the project;
3. identify `.scad` candidates;
4. choose the entrypoint deterministically when unambiguous; otherwise present an entrypoint choice to the user;
5. build the project artifact;
6. perform a baseline compile using the complete project;
7. persist the imported artifact through the existing conversation/message path.

Initial Step 3 supports `.scad` project sources. Binary/other assets remain explicitly rejected until Step 7 below.

Single-file import must continue to use the existing fast path.

### Step 4 — GitHub project dependency resolution

Do not download an arbitrary whole repository by default.

Extend the current GitHub file import so the selected `.scad` file remains the entrypoint and Brepia resolves its static project dependencies recursively relative to that entrypoint/ref.

For `include`/`use`:

- resolve relative to the calling file, matching OpenSCAD semantics;
- keep all resolved paths inside the selected repository/ref;
- deduplicate and cycle-protect;
- enforce project file/count/byte limits;
- reject submodules/symlinks or other non-regular-file cases rather than following them outside the normalized project model.

GitHub's tree/content APIs may be used as metadata/fetch primitives, but the import must remain bounded. Never recursively ingest an unlimited repository because one SCAD file was selected.

Gists can retain their existing exactly-one-SCAD behavior in the first implementation. Multi-file Gist support is optional after regular repository projects are stable.

### Step 5 — Project-aware AI editing and message persistence

`build_parametric_model` must treat the project snapshot as complete when `project` is present.

Rules for agent instructions:

- preserve unchanged support files across follow-up edits;
- change only files needed for the requested modification;
- keep `code` as the entrypoint content;
- keep `entrypointPath` stable unless the task explicitly restructures the project;
- never emit traversal/absolute paths.

Current parameter UI continues to derive Customizer parameters from the entrypoint `code`. Support-file variables are not promoted into the parameter panel in this feature unless there is a compelling compatibility-safe reason.

Parameter edits modify only the entrypoint code and preserve `artifact.project` unchanged. Existing `metadata.originalCode` behavior remains entrypoint-only.

The current conversation tree remains authoritative; project versions follow the same message branches and restore/retry semantics as single-file artifacts.

### Step 6 — Conversation workspace project snapshots

Extend the best-effort local conversation workspace without removing existing files.

Compatibility files stay:

```text
models/current.scad
models/revisions/001.scad
...
```

Add project-aware mirrors, for example:

```text
models/current-project/
  <entrypointPath>
  <support files...>
  project.json

models/project-revisions/001/
  <entrypointPath>
  <support files...>
  project.json
```

Exact naming can be adjusted during implementation, but these invariants matter:

- existing `current.scad` remains available to tooling;
- project snapshots are immutable per revision;
- identity/checksum covers the whole normalized project, not just entrypoint code;
- active conversation branch determines current project just as it determines current SCAD today;
- local workspace remains a mirror, not the only copy.

This also gives OpenCode/other local agents a coherent project tree to inspect later without inventing another transport.

### Step 7 — Explicit relative asset support

After multi-SCAD projects are stable, add controlled support for OpenSCAD file assets used by `import()`/`surface()`.

Do not enable arbitrary extensions. First verify the exact formats required by the current OpenSCAD build and choose an allowlist useful to Brepia. Each format receives:

- extension/MIME validation;
- per-file and total byte limits;
- regular-file/path validation;
- authoritative private storage;
- project manifest reference;
- worker mounting and STEP-sandbox mounting;
- test corpus coverage.

For local folder import, assets can originate from selected files. For GitHub, only literal bounded relative asset paths should be auto-resolved. Dynamic filenames that cannot be determined safely must produce a clear missing/unsupported dependency error rather than broad repository access.

Because the local conversation workspace is not authoritative, binary assets must be persisted in private Supabase storage (or an equivalent authoritative Brepia storage contract) and referenced by project metadata; do not store arbitrary binary blobs directly in message JSON.

A schema-first migration may be required for asset metadata/ownership. If so, follow the repository's Supabase workflow and regenerate types; do not hand-edit `shared/database.ts`.

### Step 8 — STEP project sandbox

Upgrade STEP from one-file input to one **normalized read-only project directory** input.

The security model remains the same in substance:

```text
validated project snapshot
        |
        v
server-created temporary project directory
        |
        v
rootless Podman
  network=none
  rootfs=read-only
  caps dropped
  no-new-privileges
  CPU/RAM/PID/time limits
  /input-project mounted read-only
  /output mounted read-write
        |
        v
OpenSCAD/scad123d on /input-project/<entrypoint>
```

Critical security difference from mounting user paths: the server constructs the temporary tree itself exclusively from normalized project bytes/storage objects. No host directory selected by the user is ever mounted into the sandbox.

Update `docs/step_export.md` when this step lands and replace the current single-file security invariant with the normalized-project equivalent.

STEP tests must cover includes, nested includes, project assets that the provider supports, missing dependency failure, path traversal rejection and analytic-surface regression from the existing corpus.

### Step 9 — Project file UX

A multi-file project must be inspectable, not invisible metadata.

Add a bounded project-file UI integrated with the existing Parametric editor rather than a broad redesign:

- show project file count and entrypoint;
- file tree/list preserving relative paths;
- select a `.scad` file to inspect/edit source;
- clearly mark the entrypoint;
- allow support-file edits to update the complete project artifact and recompile;
- parameter panel continues to target the entrypoint;
- mobile UX may use a sheet/dialog instead of permanently consuming preview space.

Do not build an IDE or a second conversation versioning model.

### Step 10 — Hardening and closeout

Run the focused and full gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

When STEP is touched also run the provider smoke/corpus tests documented in `docs/step_export.md`.

Manual acceptance corpus should include at least:

1. existing one-file Brepia-generated artifact;
2. existing one-file local import;
3. existing one-file GitHub import;
4. local multi-file SCAD folder;
5. GitHub entrypoint with nested repository-local includes;
6. bundled BOSL/BOSL2/MCAD from entrypoint and from helper file;
7. parameter edit followed by reload;
8. AI follow-up that edits entrypoint only;
9. AI follow-up that edits a support file;
10. restore/retry/branch switching of a project artifact;
11. STL and DXF project exports;
12. STEP project export;
13. malformed traversal and oversized-project rejection;
14. supported asset case after Step 7;
15. explicit missing/unsupported asset failure.

## Compatibility strategy

The key compatibility rule is additive evolution:

- old artifacts have no `project` and execute exactly as today;
- `code` remains the entrypoint for all artifacts in this feature;
- old persisted messages need no migration;
- old workspace `current.scad` and revision files remain;
- bundled libraries remain supported;
- STEP still runs in a networkless rootless sandbox;
- project-aware paths opt in only when `artifact.project` exists.

## Expected files/areas affected

Likely touch points include:

- `shared/types.ts`
- `shared/chatAi.ts`
- `shared/parametricParts.ts`
- new shared project normalization/limits module(s)
- `src/lib/scadImport.ts`
- `src/lib/githubScadImport.ts`
- `src/server/githubScadImport.ts`
- `src/components/ScadImportButton.tsx`
- `src/components/GithubScadImportButton.tsx`
- `src/services/scadProjectImportService.ts`
- `src/worker/types.ts`
- `src/worker/toolWorker.ts`
- `src/worker/openSCAD.ts`
- OpenSCAD viewer/export plumbing
- `src/views/EditorView.tsx`
- conversation workspace model snapshot code
- STEP API/server/runner scripts
- focused unit/integration tests and STEP corpus

The actual implementation must still reconcile each step against the then-current branch before editing.

## Recommended implementation order

Start with **Steps 1 and 2 only**. They establish the project contract and prove that the existing WASM runtime can compile a safe nested multi-file project without changing import, persistence or STEP yet.

Only after that gate is green should local/GitHub import and persistence be layered on. This avoids mixing browser-runtime uncertainty, import resolution, DB persistence and native sandbox changes in one change set.

## Current decision

Proceed with multi-file OpenSCAD as the selected feature. Rhino/Grasshopper remains intentionally deferred until this project-workspace work is complete and evaluated; no Rhino architecture decision is required by this branch.