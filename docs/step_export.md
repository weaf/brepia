# STEP export

## Product goal

STEP is the 3D CAD interchange export for Brepia. Existing STL and DXF exports remain unchanged:

- STL: broad mesh/3D-printing compatibility.
- DXF: 2D projection/CAD exchange.
- STEP: continued work in external 3D CAD systems with B-Rep geometry where the converter can preserve analytic surfaces.

The STEP path must not silently degrade every model into a tessellated STL-in-a-STEP-container. `scad123d` warnings about mesh fallback are surfaced to the UI as a degraded-quality warning.

## Conversion architecture

```text
current complete SCAD artifact
        |
        v
POST /api/export/step
        |
        v
server temporary workspace
        |
        v
PCAD_STEP_EXPORT_RUNNER
        |
        v
rootless Podman sandbox
  - network=none
  - read-only root filesystem
  - no-new-privileges
  - all Linux capabilities dropped
  - PID / RAM / CPU limits
  - input SCAD mounted as one read-only file
  - empty output directory mounted read-write
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

The native OpenSCAD/scad123d process must never run directly inside the Brepia/Nitro host process. Brepia accepts user-imported SCAD and native OpenSCAD can access host paths, so conversion remains isolated from the application host.

## Provider image

The repository supplies:

- `scripts/step-export/Containerfile`
- `scripts/step-export/build-image.sh`
- `scripts/step-export/pcad-scad2step-sandbox`
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

The Node-side outer timeout remains 45 seconds, so the container timeout should stay below that value to guarantee container cleanup before the HTTP request is aborted.

## Security invariants

Do not weaken these without an explicit security review:

1. No direct native OpenSCAD execution in the application host.
2. Runtime container has no network.
3. Root filesystem is read-only.
4. No added devices or privileged mode.
5. `no-new-privileges` is enabled and all Linux capabilities are dropped.
6. Only the input SCAD file is mounted read-only.
7. Only a dedicated temporary output directory is writable.
8. Podman's container-ID file stays outside all directories visible to the sandbox.
9. The server rejects symlink/FIFO/device output and only reads a regular file after the sandbox exits.
10. The server validates that the result is an ISO 10303-21 Part 21 file before returning it.
11. Source/output sizes and execution time remain bounded.
12. Sandbox image/tool versions are operator-controlled; no runtime package downloads.

## Validation

After building the image, run the smoke test:

```bash
export PCAD_STEP_EXPORT_RUNNER="$PWD/scripts/step-export/pcad-scad2step-sandbox"
./scripts/step-export/smoke-test.sh
```

The smoke test verifies that a STEP Part 21 file is produced and that a cylindrical hole remains an analytic `CYLINDRICAL_SURFACE` rather than being reduced to mesh triangles.

The repository also provides a representative compatibility corpus:

```bash
./scripts/step-export/corpus-test.sh
```

The v1 corpus covers exact-B-Rep and expected-fallback cases, including primitives, boolean operations, extrusions, hull/minkowski cases, bundled BOSL/BOSL2/MCAD usage and colored multi-body geometry. `inspect-step.py` validates produced files through the provider image's build123d/OpenCascade stack.

For application changes that affect STEP, also run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

STEP must remain a separate export path; STL/DXF behavior must not change incidentally.

## Known boundary

STEP v1 transfers the complete SCAD source into the sandbox, but it does not transfer arbitrary relative project files or `import()` mesh/assets. Models depending on those files must fail explicitly rather than widening the sandbox to arbitrary host paths.

Supporting multi-file/project assets requires an explicit normalized workspace-input design that preserves the sandbox security invariants above.

Receiving-CAD checks in applications such as FreeCAD, Rhino, AutoCAD or MicroStation are useful compatibility tests but are not part of the runtime conversion contract.