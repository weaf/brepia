# Multi-file OpenSCAD / project workspace plan

Status: selected post-1.0 feature; architecture/reconciliation complete enough to begin implementation in bounded steps.

Branch: `feature/multifile-openscad-workspace`

Baseline: `master` at `9048df8131d9cd1ce24330727c39ee8da29f18fe`.

## Goal

Replace Brepia's current single-source Parametric artifact model with a normalized OpenSCAD project workspace that safely preserves and executes one or many OpenSCAD source files and, in a later step of this feature, explicitly supported relative assets.

Backward compatibility with existing pre-project Parametric artifacts is **not a product requirement** for this post-1.0 change. Existing models are primarily test data and can be re-imported from their `.scad` source files when needed.

The feature must preserve current product behavior for newly created/imported models: parameter editing, preview/export behavior, conversation trees, stable runtime behavior and the STEP sandbox security model. The implementation may deliberately replace the internal artifact shape used by existing persisted test conversations.

This is an OpenSCAD project-workspace feature. It must not become a premature generalized CAD-backend rewrite. The normalized project concepts should nevertheless avoid assumptions that would prevent a later Rhino/Grasshopper or other CAD integration from reusing workspace primitives where appropriate.

## Non-goals

- Do not replace OpenSCAD as part of this feature.
- Do not add Rhino/Grasshopper in this branch.
- Do not add RepliCAD/build123d/CadQuery as generation backends.
- Do not redesign the conversation/version tree.
- Do not weaken rootless STEP sandbox isolation.
- Do not make the local filesystem workspace the authoritative persistence layer; it remains an operational mirror. Supabase/message/storage state remains authoritative.
- Do not build a compatibility adapter solely to keep old Parametric test messages executable.
- Do not migrate old Parametric messages solely for backward compatibility.

## Reconciled current implementation

### Artifact/tool contract is single-source today

`ParametricArtifact` is currently:

```ts
{
  title: string;
  version: string;
  code: string;
}
```

`parametricArtifactSchema` and `build_parametric_model` likewise accept one `code` string. Current message rendering, restore/retry, parameter editing, sharing, preview and workspace revision extraction read that field directly.

Because backward compatibility is not required, this feature should migrate those current consumers to a project-native accessor/model rather than preserving `code` as a duplicate compatibility field.

### Local import explicitly rejects project dependencies

`src/lib/scadImport.ts` currently accepts one `.scad`/`.scad.txt` source and rejects non-bundled `include`/`use`, plus all `import()` and `surface()` dependencies. This was the correct v1 security boundary and should be evolved rather than bypassed.

### GitHub import resolves one file

`src/server/githubScadImport.ts` retrieves one normal repository file. Gists must currently contain exactly one `.scad` file.

### Browser OpenSCAD worker already contains useful multi-file machinery

`src/worker/openSCAD.ts` already has an in-memory `WorkspaceFile[]`, `FS_WRITE` support, directory creation and mounting of stored files into each fresh OpenSCAD WASM instance. However, normal preview/export messages contain only `code`, and `executeOpenscad()` always writes/executes `/input.scad`.

This means the geometry runtime does not need to be replaced; the request contract and safe project mounting need to be completed.

### Conversation workspace already persists Parametric revisions

The local conversation workspace already mirrors active Parametric source revisions as immutable `.scad` files plus metadata and maintains `models/current.scad`. It currently snapshots only the single source string.

Because old local workspace compatibility is not required for the test-era Parametric data, this feature can replace the model revision layout with project snapshots instead of maintaining two permanent parallel representations.

### STEP is intentionally one-input-only

`POST /api/export/step` accepts `sourceCode`. The STEP runner mounts exactly one read-only SCAD input file. `docs/step_export.md` already identifies normalized multi-file workspace input as the required design before arbitrary relative project files/assets can be supported.

## Product artifact model

Every Parametric artifact becomes an OpenSCAD project, including a simple model containing only one `.scad` file.

Initial source-only contract:

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
  project: OpenScadProject;
};
```

Core invariants:

- `project.files` contains **all** project source files, including the entrypoint;
- exactly one file path equals `entrypointPath`;
- there is no duplicated top-level `code` field;
- a normal one-file model is simply `entrypointPath: 'main.scad'` plus one file in `files`;
- all source-reading consumers use shared helpers such as `getProjectEntrypoint()` rather than reaching into array structure themselves;
- project equality/checksum is defined over the complete normalized project, not only the entrypoint.

This removes the risk of `code` and `project.files[entrypoint]` diverging and gives AI editing, history, imports and exports one authoritative artifact representation.

A future backend-neutral artifact is still a separate architectural decision. Do not add Rhino, RepliCAD or generic backend identifiers merely to solve OpenSCAD project support.

## Existing persisted Parametric data

No migration is required for existing test-era Parametric conversations.

Expected behavior after the project-native contract lands:

- new AI generations use the project contract;
- new local imports use the project contract;
- new GitHub imports use the project contract;
- old models that matter can be imported again from `.scad` source;
- old incompatible Parametric message history may be discarded/reset in development rather than forcing permanent compatibility code into the product.

Any required database cleanup should be explicit and development-safe. Do not introduce hidden fallback paths that keep the old artifact shape alive indefinitely.

## Normalized project path model

Every project path must be normalized before it reaches the worker, local conversation workspace, STEP temporary workspace or a storage object path.

Required invariants:

- relative paths only;
- `/` is the canonical separator;
- reject absolute paths and Windows drive paths;
- reject empty segments, `.` and `..` segments in stored normalized paths;
- reject NUL/control characters;
- enforce bounded segment/path lengths and bounded nesting depth;
- enforce unique normalized paths, case-collision checks where appropriate, file-count limits, per-file limits and total-project byte limits;
- generated temporary workspaces contain only regular files created by Brepia from validated bytes; no user-provided symlinks/FIFOs/devices;
- bundled BOSL/BOSL2/MCAD libraries remain outside the user project namespace.

Centralize this in one shared project validator/normalizer rather than duplicating path checks in upload, GitHub, worker and STEP code.

Source references such as `../shared/foo.scad` may be valid only if resolution from the calling file normalizes back inside the project root. The stored project path itself never contains `..`.

## OpenSCAD path semantics

Preserve the user's directory hierarchy when mounting the project. Nested helpers must be mounted under the same relative path tree as the imported project so OpenSCAD resolves relative `include`/`use` and later relative assets correctly.

The browser runtime should execute:

```text
/project/<entrypointPath>
```

rather than rewriting source to flatten includes or continuing to force every model into `/input.scad`.

## Implementation steps

### Step 1 — Replace the artifact contract with project-native types

Create project types, shared accessors and central path/project validation with focused tests.

Requirements:

- replace top-level `code` in `ParametricArtifact` with required `project`;
- replace the Zod `build_parametric_model` input schema accordingly;
- update `isParametricArtifact` for the new required contract;
- provide shared helpers to resolve the entrypoint file/content;
- deterministic project normalization;
- explicit bounds/constants for file count, path depth, per-file source bytes and total source bytes;
- a one-file helper for AI/import call sites that need to construct the simplest project;
- no compatibility branch for the old `{ title, version, code }` shape.

In the same step, migrate compile/parameter/share/viewer call sites enough for the application to typecheck against the new artifact contract, but do not implement multi-file execution yet.

Gate:

- one-file project artifact validates and exposes its entrypoint deterministically;
- malformed/missing entrypoint, traversal paths, duplicates, case collisions and oversized projects fail deterministically;
- no remaining production consumer assumes `artifact.code`;
- focused tests, `npm run typecheck`, lint for touched code.

### Step 2 — Project-aware browser OpenSCAD execution

Extend the worker compile request to carry the normalized project snapshot and entrypoint path for every compile.

Important design decision: do not depend on state left in the singleton worker from a previous conversation/project. Each preview/export must be reproducible from the request itself and each fresh OpenSCAD instance.

Worker behavior:

1. create `/project`;
2. mount every project file under `/project/<path>`;
3. scan all active project source files for bundled BOSL/BOSL2/MCAD dependencies, not only the entrypoint;
4. execute `/project/<entrypointPath>`;
5. keep current manifold/color preview behavior and output limits.

The one-file project path goes through this same runtime. There is no separate legacy single-file compiler path.

Gate corpus:

- one-file `main.scad` project;
- `main.scad -> include <lib/a.scad>`;
- nested `a.scad -> use <nested/b.scad>`;
- sibling/parent references that resolve inside the project;
- attempts to escape the project fail;
- bundled BOSL2 referenced from a support file;
- parameterized entrypoint with support modules;
- 2D DXF and 3D STL regression.

### Step 3 — Local file and directory/project import

Unify import around the project contract.

A selected single `.scad` file becomes a one-file project automatically. A selected folder becomes a multi-file project while preserving relative hierarchy.

Modern browsers expose directory selection through `webkitdirectory` and preserve hierarchy in `File.webkitRelativePath`. Use that for the primary folder picker, with a graceful fallback/manual multi-file path if needed.

Import flow:

1. collect selected regular files and relative paths;
2. normalize/validate before constructing the project;
3. identify `.scad` candidates;
4. for a single-file import, use that file as the entrypoint;
5. for a folder import, choose the entrypoint deterministically when unambiguous; otherwise present an entrypoint choice;
6. build the complete project artifact;
7. perform a baseline compile using the complete project;
8. persist the imported artifact through the normal conversation/message path.

Initial Step 3 supports `.scad` project sources. Binary/other assets remain explicitly rejected until Step 7 below.

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

A GitHub URL to a standalone SCAD still returns the same project-native shape with a single file.

Gists can retain exactly-one-SCAD support initially. Multi-file Gist support is optional after normal repository projects are stable.

### Step 5 — Project-native AI editing and message persistence

`build_parametric_model` always emits a complete project snapshot.

Rules for agent instructions:

- emit an entrypoint and complete required source-file set;
- preserve unchanged files across follow-up edits;
- change only files needed for the requested modification;
- keep `entrypointPath` stable unless restructuring is required;
- never emit traversal/absolute stored paths;
- never omit a support file required by the generated source.

Current Customizer parameter UI derives parameters from the entrypoint content returned by the shared project helper. Support-file variables are not promoted into the parameter panel in this feature unless a later explicit product decision changes that.

Parameter edits update the entrypoint file inside the project snapshot. The entire updated project remains the artifact persisted in the assistant message.

Replace entrypoint-only `metadata.originalCode` with project-aware baseline handling where needed. At minimum, Reset/default parameter semantics need an immutable original **entrypoint source** associated with that message; avoid retaining the old top-level artifact contract just for this purpose.

The existing conversation tree remains authoritative. Project versions follow the same message branches and restore/retry semantics.

### Step 6 — Conversation workspace project snapshots

Replace the Parametric model mirror with project-native snapshots rather than permanently maintaining `current.scad` plus a second project hierarchy.

Recommended layout:

```text
models/current/
  project.json
  <entrypointPath>
  <support files...>

models/revisions/001/
  project.json
  <entrypointPath>
  <support files...>

models/revisions/002/
  ...
```

Invariants:

- a revision is an immutable normalized project snapshot;
- checksum/identity covers the whole normalized project;
- `project.json` records schema version, entrypoint, title/version metadata, source/tool/message identity and checksums;
- active conversation branch determines `models/current/`;
- local workspace remains a best-effort mirror, not the authoritative database;
- OpenCode/other local agents receive a coherent real project tree instead of a synthetic one-file representation.

Old `models/current.scad` and one-file revision layout do not need permanent compatibility support. Development workspaces may be cleared/rebuilt after this migration.

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

The source-only `files: { path, content }[]` contract may need to evolve at this step into a discriminated source/asset representation. Make that change when the actual asset persistence contract is known rather than over-generalizing Step 1.

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

Change the STEP API from `sourceCode` to a bounded normalized project request; do not keep both transports solely for compatibility with test-era artifacts.

Update `docs/step_export.md` when this step lands and replace the current single-file security invariant with the normalized-project equivalent.

STEP tests must cover includes, nested includes, project assets that the provider supports, missing dependency failure, path traversal rejection and analytic-surface regression from the existing corpus.

### Step 9 — Project file UX

A project must be inspectable, not invisible metadata.

Add a bounded project-file UI integrated with the existing Parametric editor rather than a broad redesign:

- show project file count and entrypoint;
- file tree/list preserving relative paths;
- select a `.scad` file to inspect/edit source;
- clearly mark the entrypoint;
- allow support-file edits to update the complete project artifact and recompile;
- parameter panel continues to target the entrypoint;
- a one-file project should not feel more cumbersome than today's single-file model;
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

1. newly AI-generated one-file project;
2. re-imported standalone `.scad` file;
3. standalone GitHub `.scad` import;
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

Existing pre-project test conversations are not an acceptance requirement.

## Migration strategy

This is a deliberate contract replacement rather than additive compatibility evolution:

- `ParametricArtifact.code` is removed;
- `ParametricArtifact.project` becomes required;
- every new model, even one source file, uses the same project execution path;
- current production code is migrated to shared project-entrypoint helpers;
- old Parametric test history does not define the new architecture;
- models worth keeping can be re-imported from `.scad`;
- old local conversation workspaces can be regenerated/cleared;
- bundled libraries remain supported;
- STEP remains a networkless rootless sandbox but receives a normalized project instead of one source string.

This intentionally reduces permanent branching and duplicated state in the codebase.

## Expected files/areas affected

Likely touch points include:

- `shared/types.ts`
- `shared/chatAi.ts`
- `shared/parametricParts.ts`
- new shared project normalization/accessor/limits module(s)
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

Start with **Steps 1 and 2 only**.

Step 1 is now a clean cut-over to the project-native artifact shape, not an additive compatibility layer. Step 2 then proves that both one-file and nested multi-file projects compile through the same WASM runtime.

Only after that gate is green should local/GitHub import, AI persistence, conversation-workspace persistence and STEP be layered on. This avoids mixing browser-runtime uncertainty, import resolution, persistent-storage changes and native sandbox changes in one change set.

## Current decision

Proceed with multi-file OpenSCAD as the selected feature using a **project-native artifact contract with no legacy Parametric artifact compatibility requirement**.

Rhino/Grasshopper remains intentionally deferred until this project-workspace work is complete and evaluated; no Rhino architecture decision is required by this branch.
