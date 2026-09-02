# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Steps 1–8 are complete. Step 8 project-aware STEP sandbox input is implemented, manually accepted and CI-verified. Step 9 has not started.

Current Step 8 implementation checkpoint:

`46a5e140aefc86fcf626490b8e40a0a36fa230cc` — `Complete project-aware STEP sandbox`

Quality Gate run `323` (`33640506570`) on that exact checkpoint passed dependency audit, full test suite, typecheck, lint and production client/SSR/Nitro build.

Step 8 manual/provider acceptance passed on 2026-09-02, including source-only STEP, the 16-case STEP corpus, multi-file/BOSL2, bounded non-planar `polyhedron()` fallback and explicit asset-backed STEP from the original project entrypoint inside the existing rootless Podman sandbox.

## Step 1 — complete

The Parametric artifact contract is project-native:

- `ParametricArtifact` stores `{ title, version, project }` with no duplicated top-level `code`;
- every model, including a standalone `.scad`, is an `OpenScadProject`;
- `shared/openScadProject.ts` owns normalized project paths, entrypoint validation and source bounds;
- paths are relative/canonical and traversal, absolute paths, drive paths, control characters, duplicates and case collisions are rejected;
- project limits are centralized and production consumers use project/entrypoint helpers instead of `artifact.code`.

## Step 2 — complete

Browser OpenSCAD execution is project-aware:

- every preview/export request carries the complete normalized project snapshot;
- fresh WASM execution mounts the complete project and runs its actual entrypoint;
- nested project-local `include`/`use`, bundled BOSL/BOSL2/MCAD, viewer/history/Share/STL/DXF and one-file behavior are preserved.

Manual acceptance passed the documented nested multi-file, Customizer, reload/history, STL, Share/GIF, bundled-library and DXF paths.

## Step 3 — complete

Local project import is complete:

- standalone `.scad` and folder import create normalized projects;
- hierarchy is preserved;
- project-local dependencies are validated;
- entrypoint selection is bounded and deterministic;
- the complete project is baseline-compiled before persistence;
- Step 7 later extended folder import with exact statically referenced supported assets.

Manual acceptance passed on 2026-09-01 with the normal stable `./start.sh` runtime.

## Step 4 — complete

GitHub project import remains entrypoint-driven and bounded:

- recursive static same-repository/same-ref `.scad` `include`/`use` dependencies are resolved;
- traversal is deduplicated and cycle-protected;
- bundled libraries are not fetched from GitHub;
- unsafe/non-regular responses fail closed;
- Step 7 later added exact static same-ref asset resolution without broad repository crawling.

Primary checkpoint:

`e285af99f3d0ba8be0e4361fc8a471dc559c9556` — `Test recursive GitHub OpenSCAD project import`

Quality Gate run `237` (`33532720138`) and manual acceptance passed.

## Step 5 — complete

AI editing and message persistence are project-native end to end:

- `build_parametric_model` carries complete normalized project snapshots;
- persisted message branches, retry/restore and follow-up edits retain the selected project snapshot;
- Customizer parameter edits replace only the entrypoint while preserving support files;
- OpenCode/CLI-agent transports and validation use complete project inputs/results;
- legacy top-level external-agent `{ code, ... }` results no longer create new project artifacts.

## Step 6 — complete

The local conversation-workspace mirror stores complete normalized project snapshots:

- `models/current/` and immutable numbered revisions include `project.json` and the materialized `.scad` hierarchy;
- revision identity is SHA-256 over the complete normalized project;
- support-file-only changes create distinct revisions;
- branch selection replaces current as a complete snapshot;
- STL/DXF workspace persistence resolves revisions using whole-project identity.

Primary checkpoint:

`90fd3cdeb698f926eafbe439a23d176339cfcf79` — `Finish Step 6 project identity wiring`

Quality Gate run `285` (`33547820131`) passed.

## Step 7 — complete

Explicit relative OpenSCAD assets are normalized, bounded, privately stored and integrity-checked.

Supported static references:

- `import()` with `.stl`, `.off`, `.dxf`, `.svg`;
- `surface()` with `.dat`.

The authoritative manifest stores exact normalized path, private storage path, canonical media type, byte length and SHA-256. Dynamic filenames, traversal, absolute paths, missing assets, collisions and kind/extension mismatches fail clearly.

Browser execution, local/GitHub import, native validation, direct/browser AI execution, streaming OpenCode and CLI-agent paths use the same authoritative asset model. Model-authored storage metadata is not trusted.

Final Step 7 checkpoint:

`cc6fd347d2cda3a7f01c547ec223cddf61f37aed` — `Preserve first-turn OpenSCAD attachment assets`

Quality Gate run `314` (`33611457984`) passed. Manual acceptance passed on 2026-09-02, including the first-turn attached-STL path through `streaming-opencode`, follow-up edit and full reload.

## Step 8 — complete

STEP export is now project-aware and keeps the existing sandbox security boundary.

### Request and server materialization

- `/api/export/step` accepts the complete normalized `OpenScadProject` rather than only entrypoint source;
- the route is authenticated and request size remains bounded;
- an asset-backed request supplies the owning conversation id so the server can create the existing conversation/user-scoped private asset resolver;
- a legacy `sourceCode` body is accepted only as compatibility for an already-open pre-Step-8 browser bundle and is immediately wrapped into a one-file project;
- the server normalizes and validates project references before execution;
- every source file is written into one server-owned temporary project directory at its exact normalized path;
- every explicit asset is resolved through private storage, verified against manifest byte length and SHA-256, and materialized at its exact project path.

### Asset-path preservation

scad123d may evaluate generated CSG from a temporary working directory, so a valid project-relative asset path can otherwise lose its original context. Step 8 therefore rewrites only already validated static `import()` / `surface()` string literals to their exact sandbox locations under `/input/project/<resolved-asset-path>`.

This rewrite does not broaden authority: the project reference validator and explicit Step 7 manifest remain authoritative, and arbitrary/dynamic/unmanifested paths are still rejected.

### Sandbox contract

The runner accepts the complete project directory plus normalized relative entrypoint and mounts the project read-only at `/input/project`.

The established security controls remain intact:

- rootless Podman;
- `network=none`;
- read-only container root filesystem;
- project input mounted read-only;
- no privileged mode/devices;
- `no-new-privileges`;
- all Linux capabilities dropped;
- caller uid/gid with user namespace isolation;
- bounded `nosuid,nodev,noexec` tmpfs;
- PID, RAM, CPU and container/Node execution time limits;
- container ID file outside all sandbox-visible mounts;
- only the dedicated output directory is host-mounted read-write;
- runner rejects symlinks and unsupported filesystem objects in the project input and verifies the entrypoint stays inside the project root;
- server accepts only bounded regular ISO 10303-21 Part 21 output.

### Fallback strategy

`scripts/step-export/pcad-scad2step-driver.py` keeps the pinned scad123d provider and adds two bounded compatibility paths.

1. **Source-only / ordinary project conversion** keeps scad123d `mesh_scope=minimal`, preserving analytic B-Rep where supported and limiting ordinary provider mesh fallback to unsupported subtrees.
2. **Non-planar `polyhedron()`**: when OCCT/scad123d specifically fails a `polyhedron` node with `wires not planar`, only that node is delegated to scad123d's existing mesh fallback. Other `ValueError` failures are rethrown.
3. **Explicit asset-backed projects** use `mesh_scope=hoist`. Pinned OpenSCAD renders a temporary 3MF from the original project entrypoint inside `/input/project`, preserving the original project/asset path context. build123d then carries the mesh-derived shape into STEP output. The driver emits a `MeshFallbackWarning`, treats OpenSCAD `can't open` diagnostics as failure and requires actual non-empty geometry.

The asset-backed hoist is intentionally degraded geometry rather than silent analytic B-Rep. The warning is part of the user-visible STEP quality contract.

### Automated verification — PASS

Implementation checkpoint:

`46a5e140aefc86fcf626490b8e40a0a36fa230cc` — `Complete project-aware STEP sandbox`

GitHub Quality Gate run `323` (`33640506570`) passed on that exact checkpoint:

- dependency audit: PASS;
- full test suite: PASS;
- typecheck: PASS;
- lint: PASS;
- production client/SSR/Nitro build: PASS.

Focused STEP regression coverage verifies complete nested project materialization, actual nested entrypoint selection, exact verified asset materialization, sandbox asset-literal rewrite, fail-closed behavior without an asset resolver, unsafe-reference rejection, warning capture, provider-unavailable mapping, output object/Part 21 validation and concurrency limits.

### Manual/provider acceptance — PASS 2026-09-02

1. source-only STEP export works;
2. STEP compatibility corpus: **16/16 PASS**;
3. multi-file/BOSL2 `key_ring.scad` works;
4. non-planar `polyhedron()` succeeds through the bounded scad123d subtree mesh fallback;
5. explicit asset-backed project with `marker.stl` works;
6. asset-backed STEP is rendered from the original project entrypoint inside the same rootless Podman sandbox, preserving relative asset authority;
7. rootless/networkless/read-only sandbox controls and existing PID/RAM/CPU/time bounds remain preserved.

Step 8 is formally complete. `docs/step_export.md` is the canonical live STEP architecture and operations reference.

## UX follow-up outside the current step

The orientation `ViewGizmo` remains desktop-only. Mobile should later receive at least a compact orientation control exposing deterministic Top/Front/Right views. This remains a separate UX follow-up and is not part of Step 8 closeout.

## Not completed yet

- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next — Step 9, not started

Step 9 is the next planned bounded implementation step: add project-file inspection/editing integrated with the existing Parametric editor without building a second IDE/versioning system.

Do not start Step 9 as part of this Step 8 documentation closeout. PR #16 remains draft and must not be merged yet.
