# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Steps 1–6 are complete. Steps 1–4 have their recorded manual acceptance; Steps 5–6 are implemented and automatically verified.

The Parametric artifact is project-native, browser OpenSCAD execution is project-aware, local file/folder import is complete, and GitHub import resolves bounded repository-local static `include`/`use` dependencies recursively from the selected entrypoint. Step 4 browser acceptance passed on 2026-09-01 using normal `./start.sh`.

Primary Step 4 implementation checkpoint:

`e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`

Step 4 closeout documentation commits:

- `8b2cdbebd6b2c5d07fc54b6966b9ed31cea0e87f` — `Mark multi-file OpenSCAD Step 4 complete`;
- `030b24b8ef613f77913b59f08b8b0739f09cd5ab` — `Record Step 4 acceptance in multi-file plan`;
- `e67838fa1e3114fdf37acce82e6a50cb4c81a751` — `Record Step 5 fresh-chat handoff`;
- `dc3b18a985b296ff06ec36d9da86ad1d8954c884` — `Finalize Step 4 handoff checkpoint`.

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

The GitHub API/client transport is project-native: `{ filename, project, canonicalUrl }`. Complete projects baseline-compile before the imported conversation artifact is created.

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

The ordinary Quality Gate does not run `git diff --check`; this status does not claim that check for the Step 4 implementation checkpoint.

### Manual acceptance — PASS 2026-09-01

Stable-runtime browser checks with normal `./start.sh` passed:

1. standalone GitHub `.scad` regression;
2. repository-local dependency import using `bmsleight/lasercut/readme/example-001.scad`, automatically resolving `../lasercut.scad` from the same repository/ref;
3. reopen/reload persistence of the imported multi-file GitHub project;
4. bundled-library regression using the Keychain GitHub model with BOSL/BOSL2 dependencies.

The initial `expected string` / `code` error seen during manual testing came from a stale browser bundle after the server update. Reloading the page loaded the current project-native frontend; no compatibility path was added for stale client code.

Step 4 acceptance is complete.

## Step 5 — complete

AI editing and message persistence are project-native end to end:

- `shared/chatAi.ts` continues to define `build_parametric_model` with `{ title, version, project }`; no top-level artifact `code` was reintroduced;
- persisted AI tool parts carry the complete normalized `OpenScadProject`, so DB-style JSON reload, history restore, retry branches and active-branch follow-ups retain the selected full project snapshot;
- Customizer parameters intentionally remain entrypoint-focused; `metadata.originalCode` remains only the entrypoint reset/default baseline, while parameter changes replace the entrypoint content inside the existing complete project and preserve support files;
- built-in Parametric instructions now require complete normalized project snapshots, preservation of unchanged support files, targeted entrypoint/support-file edits, stable `entrypointPath` when possible and safe relative `.scad` paths;
- OpenCode streaming and OpenCode/Codex CLI transports now send `<current_pcad_artifact>` as the complete project rather than an `<openscad>` single-file wrapper;
- external-agent final results use `{ project, message }`, normalize the returned project and emit `build_parametric_model` with `project`; legacy `{ code, message }` results no longer create CAD tool calls;
- server-side external-agent validation materializes the complete normalized project into an isolated temporary directory and compiles its actual entrypoint, so project-local support-file references are validated together. This is validation-only and does not implement the Step 6 conversation-workspace mirror.

Step 5 regression coverage verifies multi-file follow-up context, unchanged support-file preservation, intentional support-file revision, stable entrypoint handling, project-only external-agent result parsing, DB-style persistence, Customizer entrypoint edits, retry branch isolation and restored-history project continuity.

Primary Step 5 implementation checkpoints:

- `4c7eb483be5b5aad93dc5ddb1ef92d912200c76f` — project-native external-agent result contract;
- `d15f54b` — project-native OpenCode/Codex transports, complete-project validation and multi-file transport regressions.

Automated Step 5 implementation verification before closeout:

- dependency audit: PASS, 0 vulnerabilities;
- 52 test files / 420 tests: PASS;
- typecheck: PASS;
- lint with zero warnings: PASS;
- production client/SSR/Nitro build: PASS;
- `git diff --check`: PASS.

## Step 6 — complete

The best-effort local conversation-workspace mirror now stores complete normalized project snapshots instead of reducing Parametric revisions to one entrypoint string:

- `models/current/` contains `project.json` plus every materialized project `.scad` file under its normalized relative path;
- `models/revisions/NNN/` uses the same complete layout and numbered revision directories are immutable;
- revision metadata uses `projectSha256` and `entrypointPath`; the checksum covers the entire normalized project, not just the entrypoint;
- support-file-only changes therefore create distinct revisions, while normalization makes identity independent of input file ordering;
- the selected conversation branch controls `models/current/`, and current is replaced as one staged snapshot so stale support files are removed;
- Customizer parameter history reconstructs the original complete project by replacing only the entrypoint with `metadata.originalCode`, preserving all support files;
- generated legacy `current.scad`, `current.json` and numbered flat revision files are removed during synchronization;
- STL/DXF workspace persistence now submits and normalizes the complete active project, resolves the exact revision by whole-project SHA and records `projectSha256` in export metadata. User-facing export generation itself is unchanged.

Regression coverage includes full two-file snapshots, immutable revisions, idempotence, active-branch switching, parameter edits with preserved support files, support-file-only revisions, stable normalized identity, nested entrypoints, stale-current cleanup, legacy-mirror cleanup and project-native imported-artifact discovery.

Primary Step 6 implementation checkpoint:

`90fd3cdeb698f926eafbe439a23d176339cfcf79` — `Finish Step 6 project identity wiring`

Quality Gate run `285` (`33547820131`) on that exact implementation checkpoint passed dependency audit, the full test suite, typecheck, lint and production client/SSR/Nitro build. The closeout also verifies the complete branch diff with `git diff --check` before recording Step 6 complete.

## UX follow-up outside the current step

The orientation `ViewGizmo` remains desktop-only. Mobile should later receive at least a compact orientation control exposing deterministic Top/Front/Right views. This is a separate UX follow-up and must not be mixed into the project-workspace implementation steps.

## Not completed yet

- Step 7 explicit normalized relative assets;
- Step 8 project-aware STEP sandbox input;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next — Step 7

Step 7 is now the next bounded implementation step: explicit normalized relative asset support for approved `import()`/`surface()` formats. Reconcile the completed project snapshot model before adding assets. Do not mix the Step 8 STEP sandbox migration or Step 9 project-file UX into Step 7.
