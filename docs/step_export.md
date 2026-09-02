# STEP export

## Product goal

STEP is the 3D CAD interchange export for Brepia. Existing STL and DXF exports remain unchanged:

- STL: broad mesh/3D-printing compatibility.
- DXF: 2D projection/CAD exchange.
- STEP: continued work in external 3D CAD systems with B-Rep geometry where the converter can preserve analytic surfaces.

The STEP path must not silently degrade every model into a tessellated STL-in-a-STEP-container. `scad123d` mesh-fallback warnings are surfaced to the UI as degraded-quality warnings.

## Project-aware conversion architecture

STEP consumes the complete normalized `OpenScadProject`, not only the entrypoint source. The authenticated API accepts the project snapshot and, when assets are present, the owning conversation id used for conversation/user-scoped private asset resolution.

```text
complete normalized OpenScadProject
        |
        v
POST /api/export/step
  - bounded JSON request
  - authenticated user
  - optional conversation-scoped asset resolver
        |
        v
server temporary workspace
  input/
    <entrypointPath>
    <support .scad files...>
    <verified explicit assets...>
  output/
        |
        v
PCAD_STEP_EXPORT_RUNNER
  --project <input-dir>
  --entrypoint <entrypointPath>
        |
        v
rootless Podman sandbox
  - network=none
  - read-only root filesystem
  - no-new-privileges
  - all Linux capabilities dropped
  - PID / RAM / CPU / time limits
  - complete project directory mounted read-only at /input/project
  - compatibility driver mounted read-only
  - dedicated output directory mounted read-write
        |
        v
pinned OpenSCAD source build
        |
        v
scad123d 0.5.0 + build123d/OCCT
        |
        v
STEP Part 21 file
```

The native OpenSCAD/scad123d process never runs directly inside the Brepia/Nitro host process. Brepia accepts user-controlled OpenSCAD projects and native OpenSCAD can access filesystem paths, so conversion remains isolated from the application host.

The server normalizes and validates the project before materialization. Source files are written from validated text. Explicit assets are resolved only through the existing Brepia asset manifest/storage contract, checked for conversation/user scope, exact byte length and SHA-256, and then written to their exact normalized project paths.

The legacy `sourceCode` request shape remains only as compatibility for an already-open pre-Step-8 browser bundle. It is wrapped into a one-file project and still goes through the project-directory sandbox path.

## Project and asset path handling

Source-only projects preserve normal OpenSCAD relative `include`/`use` semantics because the complete normalized directory hierarchy is mounted read-only under `/input/project` and the configured entrypoint is executed from that tree.

For explicit Step 7 assets, Brepia first validates the static `import()` / `surface()` references against the normalized manifest. Before STEP conversion, those exact string literals are rewritten to their absolute sandbox location under `/input/project/<asset-path>`. This is intentionally limited to already validated, statically resolved manifest assets; it does not expose arbitrary host paths.

The rewrite is needed because scad123d may create temporary CSG working directories during conversion. An asset reference that is valid relative to the original project file could otherwise be evaluated from the temporary directory and lose its project-relative meaning.

## Provider image

The repository supplies:

- `scripts/step-export/Containerfile`
- `scripts/step-export/build-image.sh`
- `scripts/step-export/pcad-scad2step-sandbox`
- `scripts/step-export/pcad-scad2step-driver.py`
- `scripts/step-export/smoke-test.sh`
- `scripts/step-export/corpus-test.sh`
- `scripts/step-export/inspect-step.py`

Build the default image:

```bash
./scripts/step-export/build-image.sh
```

Default image tag:

```text
localhost/pcad-step-export:scad123d-0.5.0
```

The `pcad-*` image/script naming is retained as a technical compatibility identifier.

The image pins scad123d to upstream commit:

```text
c5d126ac30e8f170e2082aa14ad4a44c6d70513e
```

That immutable commit reports package version 0.5.0 and adopted `solid123d 0.5.0`.

OpenSCAD is built from source. The current OpenSCAD source pin is:

```text
1ee676b0ea2e23a86553a931ff1d805fae7bbe7c
```

The pin is immutable and intentionally not a floating branch or `latest` build.

The builder mirrors the required Linux build shape for this source generation:

- Qt6 dependencies;
- CMake/Ninja build;
- `HEADLESS=ON`;
- `ENABLE_MANIFOLD=ON`;
- tests disabled inside the provider image build because Brepia has its own smoke/compatibility gates.

The build is multi-stage. Compiler and development packages remain in the discarded builder stage. After OpenSCAD is built, the builder resolves the Debian packages owning the shared libraries reported by `ldd` for the exact resulting binary. The final runtime image installs that derived package set rather than maintaining a hand-written runtime library list. The final stage reruns `ldd`, `openscad --version`, and a real headless CSG compile before installing scad123d.

The image also bakes in the exact `public/libraries/BOSL.zip`, `BOSL2.zip`, and `MCAD.zip` files from Brepia so server conversion resolves the same bundled libraries as browser OpenSCAD.

Runtime remains networkless. Source checkout and package installation happen only while the operator builds the image.

## Compatibility driver and fallback strategy

`scripts/step-export/pcad-scad2step-driver.py` keeps the pinned scad123d provider and adds only two bounded Brepia compatibility fallbacks.

### Normal source-only path

Source-only one-file and multi-file projects use scad123d's normal `mesh_scope=minimal` behavior. Analytic geometry remains B-Rep where the provider supports it; ordinary scad123d mesh fallback remains local to unsupported subtrees and is surfaced through warnings.

### Non-planar `polyhedron()` faces

Some valid OpenSCAD `polyhedron()` models contain faces that OCCT cannot construct as planar wires. When scad123d raises the specific `wires not planar` error for a `polyhedron` node, the driver delegates only that node to scad123d's existing mesh fallback. Other `ValueError` failures are not swallowed.

This is a deliberately narrow fallback: it preserves analytic conversion for the rest of the model rather than hoisting the complete source-only project to mesh.

### Explicit asset-backed projects

Projects containing explicit assets are invoked with `--mesh-scope hoist`. In that mode the compatibility driver renders a 3MF mesh with the pinned OpenSCAD binary **from the original project entrypoint inside `/input/project`**, then loads that mesh through build123d and continues STEP output.

This avoids scad123d's temporary CSG directory breaking relative asset access. It is an intentionally degraded path: the resulting STEP geometry is mesh-derived and analytic face selectors/fillets are unavailable for that hoisted shape. A `MeshFallbackWarning` is emitted so the UI can report the quality downgrade.

OpenSCAD can exit successfully while reporting an unresolved file. The hoisted path therefore treats `can't open` diagnostics as conversion failure and also requires actual non-empty 3MF geometry.

## Updating OpenSCAD

Do not replace the source pin with a floating branch. To update OpenSCAD:

1. choose and record an upstream commit SHA;
2. update `OPENSCAD_COMMIT` in both stages of `scripts/step-export/Containerfile`;
3. rebuild the image;
4. run the sandbox smoke test;
5. run the representative Brepia STEP corpus and application regression gate before merging the converter change.

A new OpenSCAD source pin is a converter-version change even when the scad123d version remains unchanged.

## Server configuration

Set:

```bash
export PCAD_STEP_EXPORT_RUNNER="$PWD/scripts/step-export/pcad-scad2step-sandbox"
```

Optional sandbox overrides:

```bash
PCAD_STEP_EXPORT_IMAGE=localhost/pcad-step-export:scad123d-0.5.0
PCAD_PODMAN_BIN=podman
PCAD_STEP_EXPORT_MEMORY=4g
PCAD_STEP_EXPORT_CPUS=2
PCAD_STEP_EXPORT_PIDS_LIMIT=256
PCAD_STEP_EXPORT_CONTAINER_TIMEOUT_SECONDS=40
PCAD_STEP_EXPORT_TMPFS_SIZE=512m
```

The Node-side outer timeout remains 45 seconds, so the container timeout stays below it to guarantee cleanup before the HTTP request is aborted.

Application-level STEP concurrency is separately bounded by `PCAD_STEP_EXPORT_MAX_CONCURRENT`; the default is one conversion at a time and configured values are capped by the server.

## Security invariants

Do not weaken these without an explicit security review:

1. No direct native OpenSCAD/scad123d execution in the application host.
2. Runtime uses rootless Podman and has no network (`network=none`).
3. The container root filesystem is read-only.
4. No added devices or privileged mode.
5. `no-new-privileges` is enabled and all Linux capabilities are dropped.
6. Only the server-created normalized project directory is mounted as input, and it is mounted read-only at `/input/project`.
7. The project tree may contain only regular files/directories; the runner rejects symlinks and unsupported filesystem objects and verifies that the entrypoint stays inside the mounted project root.
8. The compatibility driver itself is mounted read-only.
9. Only a dedicated temporary output directory is host-mounted read-write; `/tmp` is a bounded container tmpfs with `nosuid,nodev,noexec`.
10. Podman's container-ID file stays outside all directories visible to the sandbox.
11. PID, RAM, CPU and execution time remain bounded; the outer Node timeout remains an additional bound.
12. The server rejects symlink/FIFO/device output and only reads a regular file after the sandbox exits.
13. The server validates that the result is an ISO 10303-21 Part 21 file and enforces an output-size limit before returning it.
14. Asset bytes are resolved through the authenticated conversation/user scope and verified against manifest byte length and SHA-256 before materialization.
15. Sandbox image/tool versions are operator-controlled; no runtime package downloads are allowed.

## Validation

After building the image, run the smoke test:

```bash
export PCAD_STEP_EXPORT_RUNNER="$PWD/scripts/step-export/pcad-scad2step-sandbox"
./scripts/step-export/smoke-test.sh
```

The smoke test verifies that a STEP Part 21 file is produced and that a cylindrical hole remains an analytic `CYLINDRICAL_SURFACE` rather than being reduced to mesh triangles.

Run the representative compatibility corpus:

```bash
./scripts/step-export/corpus-test.sh
```

The v1 corpus contains 16 cases and covers primitives, boolean operations, extrusions, hull/minkowski cases, bundled BOSL/BOSL2/MCAD usage, colored multi-body geometry and expected fallback cases. `inspect-step.py` validates produced files through the provider image's build123d/OpenCascade stack.

For application changes that affect STEP, also run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

STEP must remain a separate export path; STL/DXF behavior must not change incidentally.

## Step 8 verification checkpoint

Step 8 project-aware STEP sandbox implementation is complete at:

```text
46a5e140aefc86fcf626490b8e40a0a36fa230cc — Complete project-aware STEP sandbox
```

GitHub Quality Gate run `33640506570` (#323) passed on that exact checkpoint, including dependency audit, full tests, typecheck, lint and production build.

Provider/runtime verification and manual acceptance on 2026-09-02 covered:

- source-only STEP export;
- STEP corpus: **16/16 PASS**;
- multi-file/BOSL2 `key_ring.scad` conversion;
- non-planar `polyhedron()` through the bounded scad123d subtree mesh fallback;
- explicit asset-backed project using `marker.stl`;
- asset-backed STEP rendered from the original project entrypoint inside the same sandbox so project-relative asset paths remain authoritative.

The rootless/networkless/read-only sandbox boundary and existing PID/RAM/CPU/time limits remain part of the accepted Step 8 contract.

## Current boundary

STEP now supports complete normalized source projects and the explicit Step 7 asset manifest. It still does **not** expose arbitrary relative host files, arbitrary repository crawling, dynamic asset filenames or unmanifested filesystem access.

Asset-backed projects deliberately use the documented hoisted mesh fallback. Improving analytic reconstruction of imported mesh/file assets would be a future converter capability, not a reason to weaken the sandbox or broaden filesystem authority.

Receiving-CAD checks in applications such as FreeCAD, Rhino, AutoCAD or MicroStation remain useful compatibility tests but are not part of the runtime conversion contract.
