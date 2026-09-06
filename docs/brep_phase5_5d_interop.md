# BRep Phase 5D — minimum Rhino/3DM interoperability

## Status

Complete and accepted on PR #33 from accepted Phase 5C merge checkpoint:

```text
e7b679cfa0b89478f0ce8d016dc374ab60d423ab
Merge pull request #32 — Phase 5C: BRep project-object authoring
```

The final Phase 5 `master` checkpoint is defined by the PR #33 merge commit rather than a pre-merge branch SHA.

The implementation and `docs/brep_phase5_execution.md` remain the architectural authority. This document records the dependency/conversion findings, the intentionally narrow 5D contract and its acceptance evidence.

## Dependency decision

5D pins `rhino3dm==8.32.1` inside the existing Python 3.12 native BRep sandbox.

Selection criteria verified before implementation:

- stable rhino3dm 8.32.1 release rather than a beta release;
- CPython 3.12 manylinux wheels for the Linux architectures relevant to the native sandbox;
- headless 3DM read/write through openNURBS without requiring Rhino desktop, RhinoCommon or Rhino.Compute;
- rhino3dm upstream license is MIT; the built image retains applicable rhino3dm/openNURBS notices.

`rhino3dm` is an interoperability/document library here, not Brepia's modeling kernel.

The slim native image also includes `fontconfig` so rhino3dm's headless font initialization has a valid default configuration. The image's base pip version is intentionally not upgraded solely for 5D because it installs all pinned wheels successfully and is not part of the runtime interoperability contract.

## Geometry fidelity decision

There is no direct rhino3dm conversion from Brepia's OCCT shape/STEP result to an exact Rhino `Brep`. `rhino3dm.Brep.CreateFromMesh(...)` would convert tessellation into a faceted BRep and therefore must not be described or exposed as an exact OCCT-BRep conversion.

5D consequently uses an explicit two-representation contract:

1. native 3DM mesh objects carry viewable Result and project-object geometry plus Rhino/openNURBS object metadata;
2. the exact primary OCCT STEP artifact is embedded in the same 3DM as `brepia-primary.step`.

This preserves CAD fidelity without making Rhino/openNURBS authoritative or misrepresenting a mesh-derived Brep as exact geometry.

## 3DM document contract

`model.3dm` is emitted by the same isolated native evaluation that already produces `result.json` and `model.step`.

The document contains:

- millimetre model units;
- one tessellated Rhino Mesh for each unique canonical node used as Result and/or Footprint / Clearance envelope / Maintenance envelope;
- object user strings preserving canonical project ID, node ID, all assigned semantic roles and the explicit `tessellated-mesh` representation marker;
- real Rhino point objects for resolved semantic connection/mounting/cable points;
- point user strings preserving point ID, kind, optional label and optional resolved direction;
- document user strings for schema/project/result identity, provider, units, resolved placement, canonical metadata when present, compact project-object role/point semantics and representation/fidelity markers;
- the exact primary STEP file embedded as `brepia-primary.step`.

Geometry remains in the component-local coordinate system. `placement` is transported as semantic insertion-plane data and is not silently applied as a geometry transform.

If one node carries multiple roles, the 3DM contains one mesh object for that canonical node with all roles attached rather than duplicate coincident geometry.

## Sandbox and host boundary

The existing rootless Podman sandbox remains authoritative. Runtime networking stays disabled and rhino3dm is installed only in the pinned native image.

The driver fails closed before success if its own 3DM cannot be independently re-opened with rhino3dm, if millimetre units or project/placement identity fail to round trip, or if the embedded STEP cannot be extracted with its ISO-10303-21 signature intact.

The host additionally accepts 3DM bytes only from a regular non-symlink file below the existing artifact-size cap and with a valid `3D Geometry File Format ` header.

The Python binding uses `File3dmStringTable` mapping syntax (`model.Strings[key] = value`) for document user strings. A real native smoke exposed and corrected the initially assumed non-Python `SetString` spelling before acceptance.

## HTTP/product transport

The existing authenticated native export route remains backward-compatible for STEP. 5D uses HTTP content negotiation on that same hardened boundary:

- ordinary/default request -> `model/step` exact STEP;
- `Accept: model/vnd.3dm` -> `model/vnd.3dm` interoperability artifact.

This avoids introducing a second execution or authorization path solely for an output format. A future Grasshopper packaging API may introduce its own higher-level endpoint in Phase 6+.

The existing BRep download selector exposes `.STEP`, `.3DM` and `.BREP JSON`. STEP and 3DM use current preview parameter values; the canonical Brepia package continues to require saved source state.

## Explicit non-goals

5D does not add:

- Rhino desktop or RhinoCommon;
- Rhino.Compute;
- Grasshopper execution or `.gh` generation;
- 3DM as editable/canonical project source;
- 3DM import/round-trip authoring;
- a mesh-derived object advertised as exact NURBS/BRep geometry;
- placement transforms of Brepia local geometry;
- multi-result STEP semantics;
- changes to OpenSCAD workflows.

## Acceptance closeout

Phase 5D is accepted and closes Phase 5.

Evidence on 2026-09-06:

- the rebuilt native image successfully installed the pinned build123d/OCCT stack plus `rhino3dm==8.32.1` and the required headless font configuration;
- real rootless-Podman smoke completed successfully with primary result `cut`, 732 triangles, semantic roles `footprint`, `clearanceEnvelope` and `maintenanceEnvelope`, and `cableEntry` resolved to position `[50,10,0]` with direction `[0,0,1]`;
- the same smoke emitted both `model.step` and `model.3dm`;
- because success is written only after the driver's internal verification, that smoke also proves rhino3dm independently re-opened the generated 3DM, verified millimetre units/project/placement identity, extracted `brepia-primary.step` and verified its STEP signature;
- browser acceptance confirmed ordinary Model/Graph behavior, parameter-driven native preview, STEP export, 3DM export and canonical BRep JSON behavior remained green;
- 3DM files from both tested cases were independently opened successfully in a separate mobile application;
- host-side malformed/oversized/header validation is regression-covered before artifact exposure;
- the user-facing `.3DM` export uses current preview parameter values like STEP without changing canonical source/revision semantics;
- Quality Gate #397 passed after the real-runtime binding/fontconfig correction with tests, typecheck, lint, build and diff check green;
- a final Quality Gate must pass on the exact documentation closeout head before PR #33 is merged.

PR #33 is the Phase 5 closeout vehicle. Its merge commit becomes the final Phase 5 `master` checkpoint.
