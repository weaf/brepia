# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Steps 1–7 are complete. Steps 1–4 retain their recorded manual acceptance, Steps 5–6 are project-native and automatically verified, and Step 7 explicit relative assets are implemented, automatically verified and manually accepted.

Current Step 7 implementation checkpoint:

`cc6fd347d2cda3a7f01c547ec223cddf61f37aed` — `Preserve first-turn OpenSCAD attachment assets`

Quality Gate run `314` (`33611457984`) on that exact checkpoint passed dependency audit, full test suite, typecheck, lint and production client/SSR/Nitro build.

Manual Step 7 acceptance passed on 2026-09-02, including the critical first-turn attached-STL path through `streaming-opencode`, follow-up editing and full reload.

Step 8 — project-aware STEP sandbox input — is next. Step 7 intentionally does not change the STEP sandbox contract.

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
- the former uploaded-STL compatibility bridge was superseded by the explicit Step 7 asset manifest and implicit basename cache mirroring is no longer used.

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
- folder paths are normalized and validated through the central project path model;
- project-local `include`/`use` dependencies are validated before persistence;
- missing dependencies and root escapes fail deterministically;
- entrypoint selection prefers an unambiguous root/main file and otherwise presents an explicit chooser;
- the complete project is baseline-compiled before persistence;
- after Step 7, folder import also accepts only statically referenced supported `.stl`, `.off`, `.dxf`, `.svg` and `.dat` assets, preserving their exact nested project paths while ignoring unrelated files.

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
- Gists intentionally remain exactly-one-`.scad` and source-only.

Step 7 extends repository blob import with exact same-ref resolution for statically referenced supported `import()`/`surface()` assets. It does not perform broad directory crawling.

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

- `shared/chatAi.ts` defines `build_parametric_model` with `{ title, version, project }`; no top-level artifact `code` was reintroduced;
- persisted AI tool parts carry the complete normalized `OpenScadProject`, so DB-style JSON reload, history restore, retry branches and active-branch follow-ups retain the selected full project snapshot;
- Customizer parameters intentionally remain entrypoint-focused; `metadata.originalCode` remains only the entrypoint reset/default baseline, while parameter changes replace the entrypoint content inside the existing complete project and preserve support files;
- built-in Parametric instructions require complete normalized project snapshots, preservation of unchanged support files, targeted entrypoint/support-file edits, stable `entrypointPath` when possible and safe relative `.scad` paths;
- OpenCode streaming and OpenCode/Codex CLI transports send `<current_pcad_artifact>` as the complete project rather than an `<openscad>` single-file wrapper;
- external-agent final results use `{ project, message }`, normalize the returned project and emit `build_parametric_model` with `project`; legacy `{ code, message }` results no longer create CAD tool calls;
- server-side external-agent validation materializes the complete normalized project into an isolated temporary directory and compiles its actual entrypoint.

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

The best-effort local conversation-workspace mirror stores complete normalized project snapshots instead of reducing Parametric revisions to one entrypoint string:

- `models/current/` contains `project.json` plus every materialized project `.scad` file under its normalized relative path;
- `models/revisions/NNN/` uses the same complete layout and numbered revision directories are immutable;
- revision metadata uses `projectSha256` and `entrypointPath`; the checksum covers the entire normalized project, not just the entrypoint;
- support-file-only changes therefore create distinct revisions, while normalization makes identity independent of input file ordering;
- the selected conversation branch controls `models/current/`, and current is replaced as one staged snapshot so stale support files are removed;
- Customizer parameter history reconstructs the original complete project by replacing only the entrypoint with `metadata.originalCode`, preserving all support files;
- generated legacy `current.scad`, `current.json` and numbered flat revision files are removed during synchronization;
- STL/DXF workspace persistence submits and normalizes the complete active project, resolves the exact revision by whole-project SHA and records `projectSha256` in export metadata. User-facing export generation itself is unchanged.

Regression coverage includes full two-file snapshots, immutable revisions, idempotence, active-branch switching, parameter edits with preserved support files, support-file-only revisions, stable normalized identity, nested entrypoints, stale-current cleanup, legacy-mirror cleanup and project-native imported-artifact discovery.

Primary Step 6 implementation checkpoint:

`90fd3cdeb698f926eafbe439a23d176339cfcf79` — `Finish Step 6 project identity wiring`

Quality Gate run `285` (`33547820131`) on that exact implementation checkpoint passed dependency audit, the full test suite, typecheck, lint and production client/SSR/Nitro build. The closeout also verifies the complete branch diff with `git diff --check` before recording Step 6 complete.

## Step 7 — complete

Explicit relative OpenSCAD assets are now normalized, bounded, privately stored and integrity-checked.

### Asset contract and references

`OpenScadProject` has an optional `assets` manifest. Source-only projects omit the property when empty, preserving their previous canonical normalized identity.

Each asset descriptor contains:

- exact normalized project-relative `path`;
- private `storagePath`;
- canonical `mediaType`;
- `byteLength`;
- lowercase SHA-256.

Supported static references are:

- `import()` with `.stl`, `.off`, `.dxf`, `.svg`;
- `surface()` with `.dat`.

Dynamic filenames, traversal, absolute paths, missing assets, source/asset path collisions and kind/extension mismatches are rejected. Limits are 32 assets, 16 MiB per asset and 32 MiB total.

### Storage and execution

The existing private `meshes` bucket remains authoritative for uploaded/project assets. Hydration validates conversation/user storage scope, exact byte length and SHA-256 before execution.

- browser worker mounts only manifest-declared assets at exact `/project/<path>` locations;
- the former implicit worker basename cache-mirroring path is removed;
- viewer and tool-worker execution hydrate declared assets before preview/export;
- native server validation resolves the conversation owner, downloads only authorized storage objects, verifies integrity and materializes exact nested paths before OpenSCAD compilation.

### Import paths

Local folder import now accepts supported binary/text assets while preserving the existing source entrypoint model:

- only statically referenced supported assets are retained;
- nested asset paths are preserved exactly;
- unrelated files are ignored;
- dynamic, missing, traversal and wrong-kind references fail clearly;
- single-file import with external `import()`/`surface()` remains rejected and directs the user to folder import.

GitHub repository import similarly resolves only exact static asset references from the same owner/repository/ref. It does not crawl the repository. Gists remain one-SCAD/source-only.

### AI and attachment authority

AI/external agents do not own storage metadata. Brepia reconciles generated project manifests against authoritative descriptors from previous completed artifacts and current user attachments:

- invented model-authored asset descriptors are discarded;
- unchanged referenced descriptors are restored even if the agent omits them;
- unreferenced assets drop from the normalized project;
- attachment filename aliases are remapped by Brepia to the exact resolved project path, including nested entrypoints;
- streaming OpenCode reconciles before server validation and emits the same reconciled project that passed validation;
- CLI-agent results are reconciled before `build_parametric_model` emission;
- direct/browser tool execution uses the same authoritative reconciliation path.

A first-turn gap found during manual acceptance was fixed in `cc6fd347...`: `PromptView` now downloads the already uploaded STL, creates the verified descriptor and persists/sends it before the first AI request. Later turns use the equivalent `ChatSession` path. This is required because streaming OpenCode performs server validation before browser tool execution.

### Step 7 checkpoints

Key commits:

- `a3e1968b63ae7386054396964b236c124845f707` — `Define explicit OpenSCAD asset manifest contract`;
- `9796a6c04bb9f6b3469f6bd64b140fdeefed1d64` — exact worker project asset mounting;
- `ee643ea7d26690524db77f10d7f1eba8ad5b4ab7` — verified asset hydration;
- `efe048b953df4a327179ac633d1f3b3fd38b27aa` — local relative asset import coverage;
- `89ccee33f4837abd9f7c95fcd9ee47a247de4d12` — exact GitHub relative asset resolution;
- `2b91f81eb913e1850064c2234932ebd5ff60bf4f` — server OpenSCAD asset materialization;
- `46333b51499dfcf413bf693d78eb9f46eedbb118` — authoritative asset-manifest reconciliation;
- `89d475201bb4953247a4a342208f761d070ca910` — authoritative runtime flow across browser/OpenCode/CLI;
- `cc6fd347d2cda3a7f01c547ec223cddf61f37aed` — first-turn attachment descriptor preservation.

### Automated verification — PASS

Quality Gate run `314` (`33611457984`) on `cc6fd347d2cda3a7f01c547ec223cddf61f37aed` passed:

- dependency audit: PASS;
- full test suite: PASS;
- typecheck: PASS;
- lint: PASS;
- production client/SSR/Nitro build: PASS.

The focused Step 7 tests also passed before the final first-turn fix, and the final Quality Gate verifies the completed branch state with that fix included.

### Manual acceptance — PASS 2026-09-02

Manual browser/runtime acceptance passed:

1. local folder with `main.scad`, nested support `.scad` and nested STL;
2. full reload/persistence of the asset-backed project;
3. AI follow-up modifying source while preserving the imported STL;
4. AI edit of a support file while keeping asset and entrypoint stable;
5. `surface()` using nested `.dat`;
6. deterministic rejection of dynamic and missing asset references;
7. normal/direct Parametric attached-STL generation and follow-up;
8. first-turn attached STL through `streaming-opencode`, followed by a source edit and full reload.

During item 8 the initial run exposed the missing `PromptView` descriptor noted above. After `cc6fd347...`, the retest successfully rendered a base plus `import("marker.stl")`, preserved the attachment on follow-up and restored it after reload.

Step 7 is formally complete.

## UX follow-up outside the current step

The orientation `ViewGizmo` remains desktop-only. Mobile should later receive at least a compact orientation control exposing deterministic Top/Front/Right views. This is a separate UX follow-up and must not be mixed into the project-workspace implementation steps.

## Not completed yet

- Step 8 project-aware STEP sandbox input, including Step 7 asset materialization inside the sandbox;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next — Step 8

Step 8 is the next bounded implementation step. Upgrade STEP export from a one-file `sourceCode` sandbox input to a normalized project-aware workspace that materializes the validated OpenSCAD sources and explicit Step 7 assets while preserving rootless Podman, `network=none`, read-only rootfs, dropped capabilities, no-new-privileges and existing resource/time limits.

Do not mix Step 9 project-file UX into Step 8.
