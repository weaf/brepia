# Multi-file OpenSCAD / project workspace plan

Status: selected post-1.0 feature; Steps 1–9 complete. Step 10 final hardening/closeout is next.

Branch: `feature/multifile-openscad-workspace`

Baseline: `master` at `9048df8131d9cd1ce24330727c39ee8da29f18fe`.

## Goal

Replace Brepia's former single-source Parametric artifact model with a normalized OpenSCAD project workspace that safely preserves and executes one or many OpenSCAD source files plus explicitly supported relative assets.

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

## Product artifact model

Every Parametric artifact is an OpenSCAD project, including a simple model containing only one `.scad` file.

```ts
type ParametricProjectTextFile = {
  path: string;
  content: string;
};

type OpenScadProjectAsset = {
  path: string;
  storagePath: string;
  mediaType:
    | 'model/stl'
    | 'text/plain'
    | 'application/dxf'
    | 'image/svg+xml';
  byteLength: number;
  sha256: string;
};

type OpenScadProject = {
  schemaVersion: 1;
  entrypointPath: string;
  files: ParametricProjectTextFile[];
  assets?: OpenScadProjectAsset[];
};

type ParametricArtifact = {
  title: string;
  version: string;
  project: OpenScadProject;
};
```

Core invariants:

- `project.files` contains all project source files, including the entrypoint;
- exactly one file path equals `entrypointPath`;
- there is no duplicated top-level `code` field;
- a normal one-file model uses the same project runtime as multi-file models;
- project identity/checksum is defined over the complete normalized project;
- `assets` is omitted when empty so source-only normalized project identity remains stable;
- asset descriptors are Brepia-authoritative metadata and AI/external agents must not invent or mutate `storagePath`, `mediaType`, `byteLength` or `sha256`.

## Normalized project path model

Every project path must be normalized before it reaches the worker, local conversation workspace, STEP temporary workspace or a storage object path.

Required invariants:

- relative paths only;
- `/` is the canonical separator;
- reject absolute paths and Windows drive paths;
- reject empty segments, `.` and `..` segments in stored normalized paths;
- reject NUL/control characters;
- enforce bounded segment/path lengths and bounded nesting depth;
- enforce unique normalized paths, case-collision checks, file-count limits, per-file limits and total-project byte limits;
- source and asset paths share the same normalized project namespace and may not collide;
- generated temporary workspaces contain only regular files created by Brepia from validated bytes;
- bundled BOSL/BOSL2/MCAD libraries remain outside the user project namespace.

Source references such as `../shared/foo.scad` may be valid only if resolution from the calling file normalizes back inside the project/repository root. Stored project paths never contain `..`.

## OpenSCAD path semantics

Preserve the user's directory hierarchy when mounting the project. Browser runtime executes `/project/<entrypointPath>` and mounts every normalized project source and every explicitly declared asset under its exact `/project/<path>` location.

STEP uses the corresponding server-owned project tree mounted read-only at `/input/project`, with the configured entrypoint executed from that hierarchy.

## Implementation steps

### Step 1 — Replace the artifact contract with project-native types — COMPLETE

Project types, accessors, normalization and bounds are implemented. The old top-level `ParametricArtifact.code` contract is removed for new project-native artifacts.

### Step 2 — Project-aware browser OpenSCAD execution — COMPLETE

Every browser preview/export request carries the complete normalized project. Nested project-local `include`/`use`, bundled BOSL/BOSL2/MCAD detection, viewer/history/Share/STL/DXF propagation and the one-file regression path are complete and manually accepted.

### Step 3 — Local file and directory/project import — COMPLETE

Standalone `.scad` import and folder import both create normalized projects. Folder import preserves hierarchy, validates local dependencies, chooses an entrypoint or asks the user, baseline-compiles the complete project and persists through the normal conversation path.

Manual acceptance passed on 2026-09-01 with normal `./start.sh`.

### Step 4 — GitHub project dependency resolution — COMPLETE

GitHub repository import remains entrypoint-driven rather than whole-repository ingestion. Brepia recursively resolves bounded same-repository/same-ref static `.scad` `include`/`use` dependencies, deduplicates/cycle-protects traversal, rejects unsafe/non-regular paths and leaves bundled libraries to the bundled runtime. Step 7 later added exact static same-ref asset resolution without directory crawling.

Checkpoint: `e285af99f3d0ba8be0e4361fc8a471dc559c9556`.

Quality Gate run `237` (`33532720138`) passed, and manual acceptance passed on 2026-09-01.

### Step 5 — Project-native AI editing and message persistence — COMPLETE

`build_parametric_model` emits complete project snapshots. AI and external-agent paths preserve unchanged support files, keep `entrypointPath` stable when possible, validate complete normalized projects and persist them through the existing conversation tree. Customizer parameter edits remain entrypoint-focused while preserving the rest of the project.

### Step 6 — Conversation workspace project snapshots — COMPLETE

The local Parametric mirror stores complete normalized project snapshots under `models/current/` and immutable numbered revisions. Revision identity is a deterministic SHA-256 over the whole normalized project. Branch selection replaces `models/current/` as a complete snapshot, removing stale support files. STL/DXF workspace metadata resolves revisions by complete-project hash.

Checkpoint: `90fd3cdeb698f926eafbe439a23d176339cfcf79`.

Quality Gate run `285` (`33547820131`) passed.

### Step 7 — Explicit relative asset support — COMPLETE

Step 7 added an explicit, normalized and integrity-checked asset contract without broad filesystem/repository access.

Supported static references:

- `import()` -> `.stl`, `.off`, `.dxf`, `.svg`;
- `surface()` -> `.dat`.

References must be static string literals and normalize inside project root. Dynamic filenames, traversal, absolute paths, missing assets and kind/extension mismatches fail clearly. The project contract bounds assets to 32 files, 16 MiB per asset and 32 MiB total. Hydration verifies user/conversation storage scope, byte length and SHA-256.

Browser, local folder import, GitHub blob import, server validation, direct/browser execution, streaming OpenCode and CLI-agent paths all use the authoritative asset manifest. Model-authored storage metadata is not trusted.

Final implementation checkpoint: `cc6fd347d2cda3a7f01c547ec223cddf61f37aed`.

Quality Gate run `314` (`33611457984`) passed. Manual acceptance passed on 2026-09-02, including first-turn attached STL through `streaming-opencode`, follow-up edit and full reload.

### Step 8 — STEP project sandbox — COMPLETE

STEP now consumes the complete normalized `OpenScadProject` instead of reducing export to one source string.

Implemented contract:

- authenticated `/api/export/step` accepts the complete project and an optional owning conversation id for asset-backed projects;
- the server normalizes and validates project references before execution;
- all source files are materialized under one server-owned temporary project root;
- explicit Step 7 assets are resolved through the existing conversation/user-scoped private storage contract, verified by byte length and SHA-256, and materialized at exact project paths;
- validated static asset literals are rewritten only to their exact `/input/project/<asset-path>` sandbox paths so scad123d temporary CSG directories cannot break project-relative asset resolution;
- the sandbox executes the configured project entrypoint from the complete project tree;
- rootless Podman, `network=none`, read-only rootfs/project mount, dropped capabilities, `no-new-privileges`, bounded tmpfs and existing PID/RAM/CPU/time limits are preserved;
- source-only projects keep normal scad123d `mesh_scope=minimal` behavior;
- non-planar `polyhedron()` faces use a narrowly scoped scad123d subtree mesh fallback only for the specific OCCT `wires not planar` failure;
- explicit asset-backed projects use `mesh_scope=hoist` and are rendered by pinned OpenSCAD from the **original project entrypoint inside `/input/project`** before mesh-derived STEP continuation, preserving relative asset authority;
- hoisted asset-backed conversion emits a mesh fallback warning, treats unresolved OpenSCAD file diagnostics as failure and requires real geometry.

Implementation checkpoint:

`46a5e140aefc86fcf626490b8e40a0a36fa230cc` — `Complete project-aware STEP sandbox`

Quality Gate run `323` (`33640506570`) on that checkpoint passed dependency audit, full tests, typecheck, lint and production build.

Manual/provider acceptance on 2026-09-02 passed:

1. source-only STEP;
2. STEP compatibility corpus 16/16 PASS;
3. multi-file/BOSL2 `key_ring.scad`;
4. non-planar `polyhedron()` bounded fallback;
5. explicit asset-backed project with `marker.stl`;
6. asset-backed STEP rendered from the original project entrypoint inside the same rootless Podman sandbox.

Step 8 is formally complete. See `docs/step_export.md` for the live converter architecture, fallback strategy, security invariants and validation contract.

### Step 9 — Project file UX — COMPLETE

Step 9 is a bounded extension of the existing Parametric editor rather than a second IDE/versioning system.

Current behavior:

- the existing desktop parameters panel and mobile preview sheet include a compact `Project files` section for every active Parametric artifact, including parameterless projects;
- the section shows normalized source-file count, explicit asset count when present, the bounded project source list and nested paths;
- the configured `entrypointPath` is clearly marked with an `Entrypoint` badge;
- clicking a source opens a focused source dialog rather than introducing tabs, a second editor shell or a new version tree;
- the entrypoint is intentionally read-only in this file editor because entrypoint parameter/default semantics remain owned by the existing Customizer and AI edit flows;
- non-entrypoint support `.scad` files are directly editable with explicit Save/Discard controls;
- support-file saves use `replaceOpenScadProjectFileContent`, so central normalized path/file/project byte limits remain authoritative and the complete asset manifest plus all untouched sources are preserved;
- saves replace the existing message's complete `build_parametric_model` artifact snapshot, so reload/branch history continues to use the established conversation persistence model;
- direct support-file editing is disabled while an AI turn is streaming so it cannot race the stream's tool-output persistence;
- before a support-file save, queued/in-flight parameter writes are drained and the latest cached assistant message parts are used, preventing stale whole-project writes from clobbering either edit;
- parts-only support-file persistence leaves existing message metadata such as `metadata.originalCode` untouched.

Implementation checkpoints:

- `9f01a481b963260a2d9fc54a1b53cc1a0e0338b8` — `Add bounded OpenSCAD project file inspector`;
- `f1089d97e1639923e63638ea406b272d8c95f9d9` — `Wire project file editing into Parametric editor`;
- `0afb813c57ed6446c03bd823f8eef4d7475efe7b` — `Record Step 9 implementation checkpoint`.

Automated verification passed:

- Quality Gate run `326` (`33657189062`) on the implementation checkpoint: PASS;
- Quality Gate run `327` (`33657581514`) on the documentation checkpoint: PASS.

Manual browser acceptance passed on 2026-09-02. The accepted paths covered one-file and multi-file inspection, nested path/entrypoint display, support-file editing and reload persistence, asset preservation, the parameter-edit/support-file-save race, branch/artifact switching, parameterless projects, stream-time editing lockout, mobile file UX and read-only entrypoint behavior.

Syntax highlighting and editor autocomplete/completion are deliberately deferred as non-blocking editor-polish follow-ups; they are not part of Step 9's bounded acceptance contract.

### Step 10 — Hardening and closeout

Run full gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

When STEP is touched, also run the provider smoke/corpus documented in `docs/step_export.md`.

Final manual acceptance should cover AI one-file generation, local/GitHub multi-file import, bundled libraries, parameter edits, AI entrypoint/support-file edits, restore/retry/branching, STL/DXF/STEP, malformed/oversize rejection and relative assets.

## Current decision

Continue the selected multi-file OpenSCAD feature with the project-native artifact contract and no legacy Parametric artifact compatibility requirement.

Steps 1–9 are complete. Step 10 final hardening/closeout is now the next active step. PR #16 remains draft and must not be merged until Step 10 is complete.

Rhino/Grasshopper remains intentionally deferred until the project-workspace work is complete and evaluated.
