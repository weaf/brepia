# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Steps 1–4 are complete.

The Parametric artifact is project-native, browser OpenSCAD execution is project-aware, local file/folder import is complete, and GitHub import now resolves bounded repository-local static `include`/`use` dependencies recursively from the selected entrypoint. The real browser acceptance corpus for Step 4 passed on 2026-09-01 using the stable `./start.sh` runtime.

Primary Step 4 implementation checkpoint:

`e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`

Step 4 closeout status commit follows that implementation checkpoint and records the final manual acceptance.

## Step 1 — complete

The Parametric artifact contract is project-native:

- `ParametricArtifact` stores `{ title, version, project }` with no duplicated top-level `code`;
- every model, including a standalone `.scad`, is an `OpenScadProject`;
- `shared/openScadProject.ts` owns normalized project paths, entrypoint validation and source bounds;
- paths are relative/canonical and traversal, absolute paths, drive paths, control characters, duplicates and case collisions are rejected;
- project limits are centralized: 64 source files, 256,000 UTF-8 bytes per source, 1,048,576 UTF-8 bytes total, bounded path length/depth;
- production consumers use project/entrypoint helpers instead of `artifact.code`.

## Step 2 — complete

Browser OpenSCAD execution is project-aware:

- every preview/export request carries the complete normalized project snapshot;
- each fresh WASM execution mounts `/project/<path>` and runs `/project/<entrypointPath>`;
- nested project-local `include`/`use`, parent/sibling references inside project root, and bundled BOSL/BOSL2/MCAD references work;
- live preview, history thumbnails, Share/GIF, STL and DXF preserve the complete project;
- the existing uploaded-STL compatibility bridge remains until generalized relative assets in Step 7.

Important Step 2 commits:

- `e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` — `Make OpenSCAD browser runtime project-native`;
- `a614006e0491ff1bcf9da7ecdc8e72dabe8c05bf` — `Record project-native browser runtime checkpoint`;
- `d98ec055a00acfb0d278dd4922a1021dfa7b954e` — `Fix mobile GIF download and STL picker`;
- `af9157635cd0fef0e82e2b4986d1e7377b28760d` — `Make GIF download preserve mobile user activation`;
- `210b98156c6363b718c0b8caee65f96db8311ad0` — `Fix GIF watermark asset handling`;
- `23808d4ef194c4a8a003d1fd1962460b2a735147` — `Mark multi-file OpenSCAD Step 2 complete`.

Manual Step 2 acceptance passed nested multi-file preview, Customizer editing, reload/history thumbnail, STL, Share/GIF preview/download, support-file BOSL2, uploaded STL import and multi-file DXF export.

## Step 3 — complete

Local project import is complete:

- `Import SCAD` preserves standalone one-file import;
- `Import folder` uses the browser directory picker and `File.webkitRelativePath` to preserve source hierarchy;
- `.scad.txt` aliases normalize to `.scad` project paths;
- non-SCAD files are ignored during the source-only phase; relative binary assets remain Step 7;
- folder paths are normalized and validated through the central project path model;
- project-local `include`/`use` dependencies are validated before persistence;
- missing dependencies and root escapes fail deterministically;
- entrypoint selection prefers an unambiguous root/main file and otherwise presents an explicit chooser;
- the complete project is baseline-compiled before persistence.

Primary implementation:

`2a710ac7d35a4f907c0074e1a866ed3d8f30a7df` — `Add local OpenSCAD folder project import`

Step 3 closeout fixes:

- `53e8cbc8c3dc4e43af17d3ff542593c6ce93e9fc` — skip render mirroring for synthetic imported SCAD revisions;
- `ae4e89fbc201dcc34b5e56da283b78feaa02d98d` — constrain parameterless mobile OpenSCAD preview height;
- `7b5811c77710a07695962126baf8309611948033` — restore the original `.scad,.scad.txt` picker behavior after tracing the temporary picker failure to HMR.

Step 3 manual acceptance passed standalone `.scad`, folder import, project persistence/reload, ambiguous entrypoint chooser, Customizer behavior and mobile viewer sizing. Stable acceptance uses normal `./start.sh`, not `PCAD_ENABLE_HMR=1`.

## Step 4 — complete

GitHub repository import is entrypoint-driven and bounded rather than whole-repository ingestion.

### Repository dependency resolution

The pasted GitHub blob/raw `.scad` remains the project entrypoint. Brepia recursively resolves only transitive static project-source dependencies required by that entrypoint:

- static non-bundled `include`/`use` targets resolve relative to the calling source;
- every dependency is fetched from the same owner/repository/ref;
- dependency traversal is deduplicated and cycle-protected;
- bundled BOSL/BOSL2/MCAD references are not fetched from GitHub and continue through the bundled browser runtime;
- root escape, invalid/non-`.scad` source references and missing repository-local files fail deterministically;
- symlink/submodule/non-regular GitHub content responses are rejected rather than followed;
- `import()` and `surface()` remain deferred to Step 7;
- Gists intentionally remain exactly-one-`.scad` and return the same one-file project-native artifact.

Project/source size limits reuse the normalized project bounds, and repository resolution has bounded request and overall discovery time.

The GitHub API/client transport is project-native: `{ filename, project, canonicalUrl }`. `GithubScadImportButton` persists the complete project through the normal imported-project path and baseline-compiles it before creating the conversation artifact.

Important Step 4 commits:

- `5473e914b069504f416498db91e39feef6f78d44` — `Resolve GitHub OpenSCAD project dependencies`;
- `443d9f4b1234b99dd668db0847ef7a0a3c35b2e2` — `Import resolved GitHub OpenSCAD projects`;
- `e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`.

### Automated verification

Quality Gate run `237` (`33532720138`) for `e285af99f3d0ba8be0e4361fc8a471dc559c9556` passed:

- dependency audit: PASS, 0 vulnerabilities;
- 52 test files: PASS;
- 418 tests: PASS;
- `tests/githubScadImport.test.ts`: 20 tests PASS;
- typecheck: PASS;
- lint with zero warnings: PASS;
- production client/SSR/Nitro build: PASS.

Focused coverage includes standalone project-native import, percent-encoded paths, nested same-ref dependencies, parent/sibling references, cycle deduplication, bundled-library skipping, missing dependencies, root escape rejection, non-regular responses, deferred relative assets, file/source bounds, Gist behavior and fixed-host transport failure behavior.

The ordinary Quality Gate does not run `git diff --check`; this status does not claim that check for the Step 4 implementation checkpoint.

### Manual acceptance — PASS 2026-09-01

Stable-runtime browser checks with normal `./start.sh` passed:

1. standalone GitHub `.scad` regression;
2. repository-local dependency import using `bmsleight/lasercut/readme/example-001.scad`, automatically resolving `../lasercut.scad` from the same repository/ref;
3. reopen/reload persistence of the imported multi-file GitHub project;
4. bundled-library regression using the Keychain GitHub model with BOSL/BOSL2 dependencies.

The initial `expected string` / `code` error seen during manual testing came from a stale browser bundle after the server update. Reloading the page loaded the current project-native frontend; no compatibility path was added for stale client code.

Step 4 acceptance is complete.

## UX follow-up outside the current step

The orientation `ViewGizmo` remains desktop-only. Mobile should later receive at least a compact orientation control exposing deterministic Top/Front/Right views. This is a separate UX follow-up and must not be mixed into the project-workspace implementation steps.

## Not completed yet

- Step 5 full multi-file AI/external-agent editing protocol and message persistence;
- Step 6 complete project snapshots in the local conversation-workspace mirror;
- Step 7 explicit normalized relative assets;
- Step 8 project-aware STEP sandbox input;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next checkpoint

Start a fresh chat before Step 5. Reconcile `docs/multifile_openscad_workspace_plan.md`, this status document, `shared/chatAi.ts`, Parametric tool schemas/instructions, current AI message persistence, parameter reset/original-source handling and external-agent/OpenCode integration before editing.

Step 5 must make AI/external-agent editing project-native: complete project snapshots, unchanged-file preservation across follow-ups, support-file edits, stable entrypoint semantics, and project-aware message persistence without reintroducing the removed top-level `artifact.code` compatibility model.
