# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Step 1 is complete.

Step 2 is complete. The project-native browser OpenSCAD runtime, full multi-file preview/export propagation, bundled-library detection, existing uploaded-STL compatibility bridge, and targeted mobile closeout fixes all passed automated verification and the real browser/WASM acceptance corpus. The final mobile Share `Generate GIF` → `Download GIF` interaction was manually verified on 2026-09-01.

Step 3 is complete. Local folder import constructs a bounded normalized `OpenScadProject`, preserves nested `.scad` paths, validates project-local `include`/`use` dependencies, chooses an unambiguous entrypoint automatically, and presents an explicit entrypoint chooser when several independent model roots exist. The real browser acceptance corpus passed on 2026-09-01 using the stable `./start.sh` runtime.

Step 4 implementation and automated verification are complete. A selected repository `.scad` remains the entrypoint while Brepia recursively resolves bounded repository-local static `include`/`use` dependencies at the same Git ref. Real browser acceptance is still required before Step 4 is formally closed.

Current Step 4 implementation head:

`e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`

## Step 1 — completed

The Parametric artifact contract is project-native:

- `ParametricArtifact` stores `{ title, version, project }` with no duplicated top-level `code`;
- even a standalone `.scad` is represented as a one-file `OpenScadProject`;
- `shared/openScadProject.ts` owns path/project normalization and bounds;
- paths are relative and canonicalized to `/`;
- absolute paths, drive paths, traversal segments, empty segments, control characters, duplicate paths and case-only collisions are rejected;
- source limits are 64 files, 256,000 UTF-8 bytes per file, 1,048,576 UTF-8 bytes per project, 512 characters per path, 128 per segment and 16 path segments;
- the declared entrypoint must exist and contain source;
- project files normalize into deterministic path order;
- Editor, Share, ChatSession, MessageBubble, VisualCard, parameter editing and conversation-workspace entrypoint extraction use the project contract rather than persisted `artifact.code`.

Step 1 quality gate passed 51 test files / 391 tests, typecheck, lint and build.

## Step 2 — completed

`shared/openScadProjectReferences.ts` provides shared project-local OpenSCAD source-reference resolution. Static `include` and `use` references resolve relative to the calling source file, may use `..` only while remaining inside project root, and distinguish bundled BOSL/BOSL2/MCAD references from project-local files.

Browser OpenSCAD preview/export requests carry the complete normalized project. Each request reconstructs a fresh `/project` tree in the WASM filesystem, mounts every project source, and executes `/project/<entrypointPath>`. Live preview, tool preview, thumbnails/history, Share/GIF, STL and DXF all preserve the complete project snapshot.

The existing uploaded-mesh flow remains a bounded compatibility bridge until generalized relative assets are implemented in Step 7.

Important Step 2 implementation/closeout commits:

- `e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` — `Make OpenSCAD browser runtime project-native`;
- `a614006e0491ff1bcf9da7ecdc8e72dabe8c05bf` — `Record project-native browser runtime checkpoint`;
- `d98ec055a00acfb0d278dd4922a1021dfa7b954e` — `Fix mobile GIF download and STL picker`;
- `af9157635cd0fef0e82e2b4986d1e7377b28760d` — `Make GIF download preserve mobile user activation`;
- `210b98156c6363b718c0b8caee65f96db8311ad0` — `Fix GIF watermark asset handling`;
- `23808d4ef194c4a8a003d1fd1962460b2a735147` — `Mark multi-file OpenSCAD Step 2 complete`.

Manual Step 2 acceptance passed:

1. nested three-file preview;
2. entrypoint Customizer parameter edit without losing support files;
3. conversation reload and history thumbnail;
4. STL export;
5. Share/GIF preview and mobile GIF download;
6. BOSL2 referenced only from a support source;
7. existing uploaded STL `import()` flow;
8. multi-file 2D + DXF export.

## Step 3 — completed

### Local folder acquisition

`ScadImportButton` exposes separate local actions for `Import SCAD` and `Import folder`, alongside the GitHub import action.

Folder selection uses the browser directory picker attributes (`webkitdirectory` plus `directory`) and consumes `File.webkitRelativePath` so source hierarchy is preserved. Non-SCAD files are ignored during this source-only phase. `.scad.txt` aliases are accepted and normalized to `.scad` paths.

The file picker remains the simple original Step 3 implementation with `accept=".scad,.scad.txt"`. Temporary wildcard/re-key troubleshooting workarounds were removed after the earlier picker failure was traced to running with `PCAD_ENABLE_HMR=1`; stable acceptance uses normal `./start.sh`.

### Project construction and safety

`src/lib/scadImport.ts` builds a complete normalized project from the selected folder:

- strips only the selected root folder while preserving nested source paths;
- validates the picker root separately before stripping it;
- rejects malformed/traversing picker paths instead of flattening them;
- requires all accepted source files to belong to one selected root;
- reuses the central project limits and path validator;
- enforces the 64-file and 1,048,576-byte project limits before expensive work;
- decodes every accepted source as UTF-8 and rejects NUL/binary-like data;
- validates project-local `include`/`use` using the Step 2 resolver;
- rejects missing source dependencies and references escaping project root;
- continues to allow bundled BOSL/BOSL2/MCAD references;
- rejects `import()` and `surface()` dependencies because generalized relative assets remain Step 7.

Standalone `.scad` import intentionally retains its existing stricter one-file dependency checks.

### Entrypoint selection

Folder import chooses an entrypoint deterministically when possible:

1. the only non-empty source;
2. a unique top-level `main.scad`;
3. the only top-level source;
4. otherwise the unique non-referenced root in the local `include`/`use` dependency graph.

If more than one plausible independent root remains, Brepia opens an entrypoint dialog listing the non-empty project sources. The selected entrypoint is validated against that candidate set before persistence.

### Persistence and baseline compile

`createImportedScadProject` accepts either the existing single-file `{ filename, code }` input or a complete `{ filename, title, project }` input. This preserves standalone callers while letting local folder and project-aware GitHub import persist complete normalized projects through the same conversation/artifact path.

The complete project is baseline-compiled through the project-aware browser worker before persistence. Synthetic `tool_import_...` revisions are excluded from Supabase render mirroring because their baseline render is local and no corresponding private Storage object exists.

### Step 3 automated verification

GitHub Actions Quality Gate run `223` (`33476451763`) for `2a710ac7d35a4f907c0074e1a866ed3d8f30a7df` passed:

- dependency audit: PASS, 0 vulnerabilities;
- 52 test files: PASS;
- 410 tests: PASS;
- `tests/scadImport.test.ts`: 23 tests PASS;
- typecheck: PASS;
- lint with zero warnings: PASS;
- production build, including client, SSR and Nitro: PASS.

The final picker-restoration commit `7b5811c77710a07695962126baf8309611948033` also passed Quality Gate run `231` (`33529279483`).

The ordinary Quality Gate does not run `git diff --check`; this status does not claim that check for the Step 3 commits.

### Step 3 manual acceptance — PASS 2026-09-01

The stable browser/runtime acceptance passed with normal `./start.sh`:

1. standalone `.scad` import works;
2. multi-file folder import works and renders the complete project;
3. imported project persists and renders again after reopening/reload;
4. ambiguous folders show the explicit entrypoint chooser and the chosen source renders correctly;
5. Customizer parameters remain functional on an imported multi-file project;
6. the parameterless mobile Parametric preview no longer expands to an oversized sheet.

The temporary inability to pick `.scad` files was reproduced only while running `PCAD_ENABLE_HMR=1 ./start.sh`; it is not treated as a stable-runtime product regression.

Step 3 acceptance is complete.

## Step 4 — implementation complete, manual acceptance pending

### Entrypoint-driven repository resolution

GitHub repository import remains entrypoint-driven rather than ingesting an arbitrary repository tree. The pasted GitHub blob/raw `.scad` URL identifies both the selected repository/ref and the project entrypoint. `src/server/githubScadImport.ts` then fetches only the transitive static `.scad` source dependencies required by that entrypoint.

Repository source behavior:

- the selected repository path is preserved as `project.entrypointPath`;
- static non-bundled `include`/`use` targets resolve relative to the calling source using the shared Step 2 path semantics;
- every dependency is fetched from the same owner/repository/ref through the fixed GitHub contents API host;
- dependency traversal is deduplicated and cycle-protected;
- bundled BOSL/BOSL2/MCAD references are left to the existing bundled-library runtime and are never fetched from the repository;
- root-escaping, invalid or non-`.scad` source references fail before an outbound dependency fetch;
- missing repository-local source files fail with a dependency-specific error;
- symlink/submodule/non-regular responses are rejected rather than followed;
- `import()` and `surface()` remain explicitly unsupported until Step 7 relative assets;
- Gists intentionally remain exactly-one-`.scad` and now return the same one-file project-native response shape.

### Bounds and transport

Resolution reuses the normalized project limits: 64 source files, 256,000 UTF-8 bytes per source and 1,048,576 UTF-8 bytes total. Source payloads must be valid UTF-8 and may not contain NUL/binary data. In addition to the existing 10-second per-request timeout, repository project discovery has a bounded overall resolution budget.

The client/API response is now `{ filename, project, canonicalUrl }` instead of `{ filename, code, canonicalUrl }`. `GithubScadImportButton` persists the returned complete project through `createImportedScadProject`, records file count/import kind telemetry and still baseline-compiles the complete project before creating the imported conversation artifact.

Important Step 4 commits:

- `5473e914b069504f416498db91e39feef6f78d44` — `Resolve GitHub OpenSCAD project dependencies`;
- `443d9f4b1234b99dd668db0847ef7a0a3c35b2e2` — `Import resolved GitHub OpenSCAD projects`;
- `e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`.

### Step 4 automated verification

GitHub Actions Quality Gate run `237` (`33532720138`) for `e285af99f3d0ba8be0e4361fc8a471dc559c9556` passed:

- dependency audit: PASS, 0 vulnerabilities;
- 52 test files: PASS;
- 418 tests: PASS;
- `tests/githubScadImport.test.ts`: 20 tests PASS;
- typecheck: PASS;
- lint with zero warnings: PASS;
- production build, including client, SSR and Nitro: PASS.

Focused GitHub import coverage includes standalone project-native import, percent-encoded paths, nested same-ref dependency resolution, parent/sibling references, cycle deduplication, bundled-library skipping, missing dependencies, root escape rejection, non-regular-file rejection, deferred relative assets, file-count bounds, per-file source bounds, Gist behavior and fixed-host transport failure behavior.

The ordinary Quality Gate does not run `git diff --check`; this status does not claim that check for the Step 4 checkpoint.

### Step 4 manual acceptance to run

Use the stable `./start.sh` runtime, not HMR.

1. **Standalone GitHub regression:** import a normal standalone GitHub `.scad`; it should render as a one-file project as before.
2. **Repository-local dependency:** import `https://github.com/bmsleight/lasercut/blob/master/readme/example-001.scad`. It contains `include <../lasercut.scad>`; Brepia should automatically fetch `lasercut.scad` from the same repository/ref and render without asking for a folder.
3. **Persistence:** reopen/reload the multi-file GitHub-imported conversation and confirm it still renders.
4. **Bundled-library regression:** import a GitHub SCAD that uses bundled BOSL/BOSL2/MCAD; bundled libraries should continue to resolve through the browser runtime rather than repository fetching.
5. **Failure path:** a repository entrypoint with a missing local `.scad` dependency should fail clearly and must not create a broken imported conversation.

If these real browser checks pass, Step 4 can be marked complete.

## UX follow-up outside Step 3

The orientation `ViewGizmo` is currently desktop-only (`!initialIsMobile`). Mobile still exposes the projection and rotation controls, but not a direct Top/Front/Right orientation control. Add at least a compact mobile orientation button that opens or exposes the same deterministic orientation actions; a permanently visible full-size cube is optional. This is a later UX follow-up and is not part of the completed Step 3 scope.

## Not completed yet

- Step 4 real browser acceptance;
- Step 5 full multi-file AI/external-agent editing protocol;
- Step 6 complete project snapshots in the local conversation-workspace mirror;
- Step 7 explicit normalized relative assets;
- Step 8 project-aware STEP sandbox input;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next checkpoint

Pull the latest feature branch and run the Step 4 browser acceptance corpus above. If it is green, mark Step 4 complete and continue to Step 5 project-native AI/external-agent editing.
