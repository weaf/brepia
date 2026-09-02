# Multi-file OpenSCAD / project workspace plan

Status: selected post-1.0 feature; Steps 1–7 complete. Step 8 is next.

Branch: `feature/multifile-openscad-workspace`

Baseline: `master` at `9048df8131d9cd1ce24330727c39ee8da29f18fe`.

## Goal

Replace Brepia's current single-source Parametric artifact model with a normalized OpenSCAD project workspace that safely preserves and executes one or many OpenSCAD source files plus explicitly supported relative assets.

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

Preserve the user's directory hierarchy when mounting the project. Browser runtime executes:

```text
/project/<entrypointPath>
```

and mounts every normalized project source and every explicitly declared Step 7 asset under its exact `/project/<path>` location.

## Implementation steps

### Step 1 — Replace the artifact contract with project-native types — COMPLETE

Project types, accessors, normalization and bounds are implemented. The old top-level `ParametricArtifact.code` contract is removed for new project-native artifacts.

### Step 2 — Project-aware browser OpenSCAD execution — COMPLETE

Every browser preview/export request carries the complete normalized project. Nested project-local `include`/`use`, bundled BOSL/BOSL2/MCAD detection, viewer/history/Share/STL/DXF propagation and the one-file regression path are complete and manually accepted.

### Step 3 — Local file and directory/project import — COMPLETE

Standalone `.scad` import and folder import both create normalized projects. Folder import preserves hierarchy via browser relative paths, validates local dependencies, chooses an unambiguous entrypoint automatically or presents a chooser, baseline-compiles the complete project and persists through the normal conversation path.

Step 3 manual acceptance passed on 2026-09-01 with normal `./start.sh`.

### Step 4 — GitHub project dependency resolution — COMPLETE

GitHub repository import remains entrypoint-driven rather than whole-repository ingestion.

The selected `.scad` remains the project entrypoint and Brepia recursively resolves bounded static repository-local `.scad` `include`/`use` dependencies:

- resolution is relative to the calling file and stays inside repository root;
- every dependency uses the same owner/repository/ref;
- recursion is deduplicated and cycle-protected;
- normalized project file/count/byte limits apply;
- symlink/submodule/non-regular responses are rejected;
- bundled BOSL/BOSL2/MCAD references remain bundled and are not fetched from GitHub;
- `import()`/`surface()` asset resolution was intentionally deferred to Step 7;
- Gists remain exactly-one-`.scad` for now.

Automated Step 4 checkpoint:

`e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`

Quality Gate run `237` (`33532720138`) passed dependency audit, 52 test files / 418 tests, 20 focused GitHub import tests, typecheck, lint and production client/SSR/Nitro build.

Manual Step 4 acceptance passed on 2026-09-01:

1. standalone GitHub `.scad` regression;
2. repository-local recursive dependency import using `bmsleight/lasercut/readme/example-001.scad` -> `../lasercut.scad`;
3. reopen/reload persistence of that imported multi-file project;
4. bundled BOSL/BOSL2 regression using the Keychain GitHub model.

Step 4 is formally complete.

### Step 5 — Project-native AI editing and message persistence — COMPLETE

`build_parametric_model` must always emit a complete project snapshot.

Rules for agent instructions:

- emit an entrypoint and complete required source-file set;
- preserve unchanged files across follow-up edits;
- change only files needed for the requested modification;
- keep `entrypointPath` stable unless restructuring is required;
- never emit traversal/absolute stored paths;
- never omit a support file required by generated source.

Current Customizer parameter UI continues to derive parameters from the entrypoint. Parameter edits update the entrypoint file inside the complete project snapshot.

Reconcile and replace any remaining entrypoint-only baseline/original-source assumptions needed by reset/default semantics without reintroducing the old top-level artifact contract.

The existing conversation tree remains authoritative. Project versions follow the same message branches, restore/retry semantics and active-branch behavior.

Step 5 closeout confirms `shared/chatAi.ts` and persisted `build_parametric_model` parts already use full project artifacts; retry/branch/restore keep the selected message-tree project snapshot; Customizer `metadata.originalCode` remains an entrypoint-only reset baseline while parameter edits replace only the entrypoint inside the full project; and OpenCode/Codex now receive, validate and return complete normalized projects rather than `{code,...}` payloads. New external-agent writes reject the legacy top-level `code` contract.

### Step 6 — Conversation workspace project snapshots — COMPLETE

The Parametric local mirror is project-native:

```text
models/current/
  project.json
  <entrypointPath>
  <support files...>

models/revisions/001/
  project.json
  <entrypointPath>
  <support files...>
```

Each snapshot contains the complete normalized `OpenScadProject`, its materialized `.scad` hierarchy and revision metadata. Revision identity is a deterministic SHA-256 over the whole normalized project rather than only the entrypoint, so a support-file-only change creates a distinct revision while reordered input files normalize to the same identity. Numbered revision directories are immutable; `models/current/` follows the selected conversation branch and is replaced as a complete snapshot so removed or renamed support files cannot linger.

Customizer `metadata.originalCode` remains entrypoint-only by design: when reconstructing its original revision, only the entrypoint is replaced and all support files are retained. The generated legacy flat mirror (`current.scad` plus numbered `.scad`/`.json` files) is cleaned during synchronization. Browser STL/DXF workspace persistence also resolves its source revision by the complete project hash, preventing support-file-only changes from being attached to the wrong revision.

The local workspace remains a best-effort operational mirror; Supabase/message/storage state remains authoritative.

### Step 7 — Explicit relative asset support — COMPLETE

Step 7 adds an explicit, normalized and integrity-checked asset contract without broad filesystem/repository access.

Supported static references are:

- `import()` -> `.stl`, `.off`, `.dxf`, `.svg`;
- `surface()` -> `.dat`.

Asset media types are canonical by extension, references must be static string literals, resolution is relative to the calling `.scad` source and must normalize inside the project root. Dynamic filenames, traversal, absolute paths, missing assets and kind/extension mismatches fail clearly.

The project contract bounds assets to 32 files, 16 MiB per asset and 32 MiB total. Each descriptor carries exact project path, private storage path, canonical media type, byte length and SHA-256. Hydration verifies storage scope, byte length and SHA-256 before materializing bytes.

Runtime/import behavior:

- browser worker mounts only explicit manifest assets at exact nested project paths; the old implicit basename cache-mirroring fallback is removed;
- viewer/tool-worker preview and export hydrate declared assets from private storage before OpenSCAD execution;
- local folder import accepts only statically referenced supported assets, preserves exact nested paths and ignores unrelated files;
- GitHub blob import fetches only exact statically referenced assets from the same owner/repository/ref; it does not crawl directories; Gists remain source-only;
- server-side OpenSCAD validation resolves private assets under the owning conversation, verifies integrity and materializes exact nested paths before native compilation.

AI/external-agent behavior:

- previous artifact assets and current attachment assets are the only authoritative descriptors;
- model-authored/invented storage metadata is discarded rather than trusted;
- attachment descriptors are remapped by Brepia from the uploaded filename to the exact resolved project path when the candidate project uses a nested entrypoint;
- direct/browser, streaming OpenCode and CLI-agent paths reconcile the candidate manifest against authoritative descriptors before execution;
- first-turn Parametric STL attachments are verified and persisted with their descriptor before AI execution in both `PromptView` and later `ChatSession` turns, so streaming server validation can resolve `import("<filename>.stl")` on the first turn.

Important Step 7 checkpoints include:

- `a3e1968b63ae7386054396964b236c124845f707` — explicit asset manifest contract;
- `89ccee33f4837abd9f7c95fcd9ee47a247de4d12` — exact same-ref GitHub asset resolution;
- `2b91f81eb913e1850064c2234932ebd5ff60bf4f` — server validation asset materialization;
- `89d475201bb4953247a4a342208f761d070ca910` — authoritative asset flow across browser/OpenCode/CLI runtime;
- `cc6fd347d2cda3a7f01c547ec223cddf61f37aed` — preserve first-turn OpenSCAD attachment assets.

Quality Gate run `314` (`33611457984`) on `cc6fd347d2cda3a7f01c547ec223cddf61f37aed` passed dependency audit, full test suite, typecheck, lint and production client/SSR/Nitro build.

Manual Step 7 acceptance passed on 2026-09-02:

1. local folder with nested support `.scad` and nested STL;
2. reload/persistence and AI follow-up preserving the imported STL;
3. AI edit of a support file while preserving asset and stable entrypoint;
4. `surface()` with nested `.dat`;
5. dynamic and missing asset rejection;
6. normal/direct Parametric attached STL flow;
7. GitHub/static relative asset behavior from the Step 7 import path;
8. first-turn attached STL through `streaming-opencode`, followed by AI edit and full reload.

The manual streaming test exposed one first-turn gap: `PromptView` originally persisted the STL mesh context before attaching its authoritative descriptor. `cc6fd347...` closes that gap; the retest rendered `import("marker.stl")` successfully, preserved it through follow-up and restored it after reload.

STEP export remains intentionally unchanged in Step 7. Project-aware STEP sandbox input and asset mounting belong to Step 8 so the sandbox contract changes in one bounded step.

### Step 8 — STEP project sandbox

Upgrade STEP from one-file input to a normalized read-only project directory built by the server from validated project bytes/storage objects, including the explicit Step 7 asset manifest needed by the OpenSCAD entrypoint. Preserve rootless Podman, `network=none`, read-only rootfs, dropped capabilities, no-new-privileges and bounded CPU/RAM/PID/time.

### Step 9 — Project file UX

Add bounded project-file inspection/editing integrated with the existing Parametric editor: file count, entrypoint, file tree/list, support-file editing and clear entrypoint marking. Do not build a second IDE/versioning system.

### Step 10 — Hardening and closeout

Run full gates:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
git diff --check
```

When STEP is touched, also run the provider smoke/corpus documented in `docs/step_export.md`.

Final manual acceptance should cover AI one-file generation, local/GitHub multi-file import, bundled libraries, parameter edits, AI entrypoint/support-file edits, restore/retry/branching, STL/DXF/STEP, malformed/oversize rejection and relative assets.

## Current decision

Continue the selected multi-file OpenSCAD feature with the project-native artifact contract and no legacy Parametric artifact compatibility requirement.

Steps 1–7 are complete. Step 8 is next and must make STEP export consume the normalized project plus explicit assets while preserving the existing rootless sandbox security model. Do not mix Step 9 project-file UX into Step 8.

Rhino/Grasshopper remains intentionally deferred until the project-workspace work is complete and evaluated.
