# Multi-file OpenSCAD / project workspace plan

Status: selected post-1.0 feature; Steps 1–4 complete and manually accepted. Step 5 is next.

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

## Product artifact model

Every Parametric artifact is an OpenSCAD project, including a simple model containing only one `.scad` file.

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

- `project.files` contains all project source files, including the entrypoint;
- exactly one file path equals `entrypointPath`;
- there is no duplicated top-level `code` field;
- a normal one-file model uses the same project runtime as multi-file models;
- project identity/checksum is defined over the complete normalized project.

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
- generated temporary workspaces contain only regular files created by Brepia from validated bytes;
- bundled BOSL/BOSL2/MCAD libraries remain outside the user project namespace.

Source references such as `../shared/foo.scad` may be valid only if resolution from the calling file normalizes back inside the project/repository root. Stored project paths never contain `..`.

## OpenSCAD path semantics

Preserve the user's directory hierarchy when mounting the project. Browser runtime executes:

```text
/project/<entrypointPath>
```

and mounts every normalized project source under `/project/<path>`.

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
- `import()`/`surface()` remain Step 7;
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

### Step 5 — Project-native AI editing and message persistence — NEXT

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

Before implementation, inspect current `shared/chatAi.ts`, Parametric tool schemas/instructions, AI message persistence, `metadata.originalCode` or equivalent baseline handling, OpenCode/external-agent transport, and current conversation restore/retry behavior.

### Step 6 — Conversation workspace project snapshots

Replace the Parametric local mirror with project-native snapshots such as:

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

A revision is an immutable normalized project snapshot whose identity covers the whole project. The local workspace remains a best-effort mirror; Supabase/message/storage state remains authoritative.

### Step 7 — Explicit relative asset support

After multi-SCAD projects are stable, add controlled relative assets for supported `import()`/`surface()` formats with explicit allowlists, MIME/extension checks, byte limits, authoritative private storage, project-manifest references, worker mounting and STEP-sandbox mounting.

Dynamic filenames that cannot be resolved safely must fail clearly rather than triggering broad repository access.

### Step 8 — STEP project sandbox

Upgrade STEP from one-file input to a normalized read-only project directory built by the server from validated project bytes/storage objects. Preserve rootless Podman, `network=none`, read-only rootfs, dropped capabilities, no-new-privileges and bounded CPU/RAM/PID/time.

### Step 9 — Project file UX

Add bounded project-file inspection/editing integrated with the existing Parametric editor: file count, entrypoint, file tree/list, support-file editing and clear entrypoint marking. Do not build a second IDE/versioning system.

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

Final manual acceptance should cover AI one-file generation, local/GitHub multi-file import, bundled libraries, parameter edits, AI entrypoint/support-file edits, restore/retry/branching, STL/DXF/STEP, malformed/oversize rejection and relative assets after Step 7.

## Current decision

Continue the selected multi-file OpenSCAD feature with the project-native artifact contract and no legacy Parametric artifact compatibility requirement.

Steps 1–4 are complete. Start Step 5 in a fresh chat after reconciling the current branch implementation against this plan and `docs/multifile_openscad_workspace_status.md`.

Rhino/Grasshopper remains intentionally deferred until the project-workspace work is complete and evaluated.
