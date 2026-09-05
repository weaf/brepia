# BRep Phase 5D — minimum Rhino/3DM interoperability

## Status

Active on `feature/brep-rhino3dm-interoperability` from accepted Phase 5C merge checkpoint:

```text
e7b679cfa0b89478f0ce8d016dc374ab60d423ab
Merge pull request #32 — Phase 5C: BRep project-object authoring
```

The implementation and `docs/brep_phase5_execution.md` remain the architectural authority. This document records the dependency/conversion findings and the intentionally narrow 5D execution contract.

## Dependency decision

5D pins `rhino3dm==8.32.1` inside the existing Python 3.12 native BRep sandbox.

Selection criteria verified before implementation:

- stable rhino3dm 8.32.1 release rather than a beta release;
- CPython 3.12 manylinux wheels for the Linux architectures relevant to the native sandbox;
- headless 3DM read/write through openNURBS without requiring Rhino desktop, RhinoCommon or Rhino.Compute;
- rhino3dm upstream license is MIT; the built image must retain applicable rhino3dm/openNURBS notices.

`rhino3dm` is an interoperability/document library here, not Brepia's modeling kernel.

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

The driver must fail closed before success if its own 3DM cannot be independently re-opened with rhino3dm, if millimetre units or project/placement identity fail to round trip, or if the embedded STEP cannot be extracted with its ISO-10303-21 signature intact.

The host additionally accepts 3DM bytes only from a regular non-symlink file below the existing artifact-size cap and with a valid `3D Geometry File Format ` header.

## HTTP/product transport

The existing authenticated native export route remains backward-compatible for STEP. 5D uses HTTP content negotiation on that same hardened boundary:

- ordinary/default request -> `model/step` exact STEP;
- `Accept: model/vnd.3dm` -> `model/vnd.3dm` interoperability artifact.

This avoids introducing a second execution or authorization path solely for an output format. A future Grasshopper packaging API may introduce its own higher-level endpoint in Phase 6+.

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

## Acceptance

5D can close Phase 5 only after all of the following are true:

1. the pinned native image builds with build123d/OCCT plus `rhino3dm==8.32.1`;
2. real rootless-Podman smoke emits valid `result.json`, exact `model.step` and `model.3dm`;
3. the driver re-opens the 3DM headlessly and verifies millimetre units, project/placement identity and embedded exact STEP extraction;
4. a representative project preserves primary Result, FP/CL/MT roles and semantic points in the 3DM contract without duplicate meshes for one multi-role node;
5. host validation rejects malformed/oversized 3DM artifacts before bytes are exposed;
6. authenticated STEP export remains unchanged and 3DM export returns the negotiated media type/artifact;
7. a user-facing BRep download path exposes 3DM without changing canonical source/revision semantics;
8. ordinary Model/Graph, parameter evaluation, immutable revisions, STEP and BRep JSON regressions remain green;
9. OpenSCAD behavior remains unchanged;
10. repository tests, typecheck, lint, build and diff checks are green;
11. Phase 5 execution documentation is reconciled and Phase 5 is marked complete.
