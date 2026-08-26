# STEP export

Branch: `feature/step-export`
Base master: `9cc16da0088a48e2d4144254b57c09f403507589`

## Product goal

STEP is the 3D CAD interchange export for pCAD. Existing STL and DXF exports remain unchanged:

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
scad123d 0.5.0 + build123d/OCCT
        |
        v
STEP Part 21 file
```

The native OpenSCAD/scad123d process must never run directly inside the pCAD/Nitro host process. pCAD accepts user-imported SCAD and upstream scad123d explicitly warns that native OpenSCAD can access host paths.

## Provider image

The repository supplies:

- `scripts/step-export/Containerfile`
- `scripts/step-export/build-image.sh`
- `scripts/step-export/pcad-scad2step-sandbox`
- `scripts/step-export/smoke-test.sh`

Build the default image:

```bash
./scripts/step-export/build-image.sh
```

Default image tag:

```text
localhost/pcad-step-export:scad123d-0.5.0
```

The image pins scad123d to upstream commit:

```text
c5d126ac30e8f170e2082aa14ad4a44c6d70513e
```

That immutable commit reports package version 0.5.0 and adopted `solid123d 0.5.0`. The image uses the OpenSCAD `2026.08.13` x86_64 AppImage snapshot, matching the OpenSCAD generation used by scad123d's differential CI when this feature was introduced. The AppImage is extracted during image build; runtime has no network and does not require FUSE.

The OpenSCAD snapshot service retains a rolling set of development builds. If the pinned snapshot eventually disappears, deliberately update the pin and rerun the smoke and CAD compatibility gates rather than adding a floating "latest" fallback to the production image build.

The image also bakes in the exact `public/libraries/BOSL.zip`, `BOSL2.zip`, and `MCAD.zip` files from pCAD so server conversion resolves the same bundled libraries as browser OpenSCAD.

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

## Smoke test

After building the image:

```bash
export PCAD_STEP_EXPORT_RUNNER="$PWD/scripts/step-export/pcad-scad2step-sandbox"
./scripts/step-export/smoke-test.sh
```

The smoke test verifies:

- a STEP file is produced;
- it is an ISO-10303-21 Part 21 file;
- a cylindrical hole remains an analytic `CYLINDRICAL_SURFACE` rather than being reduced to mesh triangles.

## Current limitations / next gate

The first live compatibility gate should exercise representative pCAD/OpenSCAD models:

- cube / cylinder / sphere;
- boolean hole/difference;
- linear and rotate extrude;
- hull and minkowski;
- BOSL, BOSL2 and MCAD;
- imported SCAD;
- colored multi-body geometry;
- models that intentionally trigger scad123d mesh fallback.

Relative/custom project files and `import()` assets are not yet transferred into the STEP sandbox. Models depending on those should fail explicitly rather than exposing additional host paths.

For each successful export verify dimensions, units, body count, holes and curved surfaces in at least FreeCAD/Rhino first, then AutoCAD and MicroStation when available.

Required regression gate before merge:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

STEP must remain a separate export path; no STL/DXF behavior should be changed as part of this feature.
