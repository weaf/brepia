# BRep Phase 7 — Smart Brepia Grasshopper component

## Status

Phase 7 is active on `feature/brep-grasshopper-smart-component` from the accepted Phase 6 merge checkpoint:

```text
a56e73fdc5966a2fec3319ee5d204479790bf2ac
Merge pull request #34 — Phase 6: Grasshopper export contract
```

Current implementation is authoritative. `docs/brep_kernel_plan.md` remains roadmap context; completed Phase 1–6 execution/status documents are evidence, not independent source authority.

## Goal

Provide the reusable Grasshopper-side component/runtime that consumes the versioned Phase 6 `brepia-grasshopper-contract` while keeping canonical `BrepProject` state authoritative in Brepia.

Target runtime boundary:

```text
saved Brepia BRep revision
        |
        v
brepia-grasshopper-contract v1
        |
        v
Brepia Grasshopper component
  - dynamic published-number inputs
  - standard Plane input
  - fixed standard outputs
        |
        v
Brepia-compatible exact evaluator
        |
        v
exact STEP role artifacts + semantic result data
        |
        v
RhinoCommon exact Breps + transformed project outputs
```

The Grasshopper component is an interoperability consumer, not a second source of truth and not a translation of the Brepia feature DAG into editable native Grasshopper nodes.

## Reconciled Phase 6 contract

Phase 7 consumes the existing contract without widening it:

- `kind = brepia-grasshopper-contract`;
- `schemaVersion = 1`;
- canonical normalized `BrepProject` snapshot plus immutable `sourceRevisionId`;
- current published numeric parameters only (`mm | deg | none`), ordered by stable parameter ID;
- standard `placement` Plane input after the published parameters;
- fixed outputs in order: `result`, `footprint`, `clearanceEnvelope`, `maintenanceEnvelope`, `connectionPoints`, `mountingPoints`, `cablePoints`, `metadata`;
- component-local source geometry transformed consistently to the connected target Plane, or to resolved project placement when Plane is unconnected;
- warnings/errors surfaced as Grasshopper runtime messages.

No Phase 7 implementation may silently return tessellated mesh on an output contractually typed as Rhino Brep.

## Reconciled exact-geometry gap

The Phase 5 3DM artifact is intentionally an interoperability document, not yet the full Phase 7 solve payload:

- the primary native shape has an embedded exact STEP artifact;
- 3DM document objects for primary and optional project-object roles are tessellated meshes;
- optional footprint/clearance/maintenance geometry is therefore not yet available as exact Rhino Brep data from the 3DM document alone;
- semantic points, placement and metadata are already available in the evaluated project-object contract.

Phase 7 must close this gap before advertising optional role outputs as Breps. The preferred transport is deterministic exact STEP per emitted Brep role, produced by the existing constrained OCCT/build123d evaluator. Rhino 8 can then import STEP through RhinoCommon code-driven file I/O into an isolated/headless document and return native Rhino Breps to Grasshopper.

The existing accepted STEP and 3DM download behavior remains unchanged.

## Component ownership and persistence

The first component is one reusable `Brepia Project` Grasshopper component.

The component persists an embedded normalized Phase 6 contract in its Grasshopper component state. Loading/replacing a contract is an explicit component action; an external file path is not canonical runtime state.

From the embedded contract the component reconstructs:

- one item input per published numeric parameter, preserving stable parameter ID separately from mutable label;
- unit/default/min/max/step metadata where Grasshopper supports it;
- the standard item `Plane` input;
- the fixed v1 output port order.

Phase 8 may generate `.gh` files that instantiate this component with an embedded contract. `.gh` generation is not part of Phase 7.

## Evaluator boundary

The component must not reimplement the Brepia feature DAG in C#.

For each solve it sends the canonical contract source plus validated current parameter values to a Brepia-compatible evaluator boundary. The evaluator remains responsible for constrained OCCT/build123d evaluation and exact artifact generation.

Initial connection configuration may be explicit/local-development configuration. A durable account/API-token distribution flow is a separate product/security concern unless it becomes necessary for Phase 7 acceptance.

All remote/evaluator failures must fail closed and appear as Grasshopper runtime errors. Provider warnings become Grasshopper warnings.

## Placement semantics

The evaluator returns geometry in Brepia component-local coordinates.

The component constructs the source Plane from the resolved project placement under the current parameter values. It then applies one RhinoCommon plane-to-plane transform from that source Plane to:

- the connected Grasshopper Plane when supplied; or
- the same resolved project Plane when the input is unconnected, yielding the canonical insertion placement.

The same transform applies to primary geometry, optional project-object geometry, semantic point positions and semantic point directions. Placement axes represent orientation, never scale.

## Phase 7 slices

### 7A — Exact solve transport and role manifest

Goal: close the exact-output boundary before adding the Grasshopper UI.

- define one deterministic exact-artifact manifest for the fixed Brep outputs;
- keep `result` required and optional role artifacts conditional on the canonical project-object role IDs;
- preserve stable project/node/role identity in the manifest;
- use deterministic artifact names independent of display labels;
- extend the isolated evaluator so every emitted Brep role has an exact STEP artifact;
- bound and validate every exact artifact before it crosses the server boundary;
- preserve existing STEP/3DM export behavior and tests.

### 7B — Rhino 8 C#/.gha contract client

- add a modern SDK-style Rhino 8 Grasshopper plugin project under `grasshopper/`;
- reference official RhinoCommon and Grasshopper SDK packages without copying Rhino runtime assemblies into the plugin;
- parse/validate contract v1 independently in C#;
- persist the normalized contract in component state;
- call the Brepia-compatible evaluator;
- import exact STEP role artifacts through RhinoCommon code-driven file I/O;
- never consume the Phase 5 tessellated 3DM meshes as Brep output fallback.

### 7C — Dynamic inputs, Plane, outputs and diagnostics

- rebuild dynamic numeric input ports from stable parameter IDs;
- preserve fixed v1 output order;
- support connected/unconnected Plane semantics;
- transform exact Breps and semantic point data consistently;
- expose metadata without discarding stable project/point identity;
- map evaluator warnings/errors to Grasshopper runtime messages;
- preserve useful component/project/revision identity in the Grasshopper document.

### 7D — Real Rhino/Grasshopper acceptance

Acceptance must use an installed Rhino 8 / Grasshopper runtime, not only static source tests.

Representative acceptance:

1. load a saved Brepia cabinet contract into the component;
2. verify published numeric inputs appear with stable identity and expected defaults;
3. vary at least two dimensions in Grasshopper and observe native Rhino Brep geometry change;
4. connect arbitrary placement Planes, including planes derived from an alignment-style workflow;
5. verify output placement/orientation without scale distortion;
6. verify `Result` is a native Rhino Brep, not a mesh;
7. verify at least one auxiliary project output (semantic point/metadata and, when present in the fixture, exact optional role Brep);
8. verify invalid contract/evaluator failures surface as Grasshopper errors and warnings map to warnings;
9. reload the Grasshopper document and verify embedded contract/model/revision identity survives;
10. ordinary Brepia operation remains independent of Rhino.

## External repository assessment

Two external projects were reviewed as references; neither becomes a Phase 7 runtime dependency.

### GH-on-Web/GH-Web-App

Useful patterns:

- React Flow based Grasshopper-like node visualization and component catalog/search;
- browser Rhino/Three.js conversion patterns;
- a small gateway around Rhino.Compute `/grasshopper` solves;
- GH-to-JSON / JSON-to-GH experiments that may be useful when Phase 8 investigates generated `.gh` workflows.

Boundaries:

- its editable Grasshopper graph is its primary web artifact, whereas Brepia must keep `BrepProject` canonical;
- Liveblocks/collaborative graph state is not needed for the Phase 7 smart-component runtime;
- Rhino.Compute is optional in the Brepia roadmap and is not required for the first component;
- its NodeParser overlaps with Brepia's existing BRep graph editor and should not replace that editor;
- the repository is a hackathon-oriented reference and should be treated as inspiration rather than imported architecture.

The repository LICENSE file is MIT. If code is ever copied rather than independently reimplemented, preserve its required copyright/license notice.

### mitevpi/gh-web-ui

Useful patterns:

- concrete historical examples of `GH_Component` implementation and `.gha` packaging;
- demonstrates a bridge between Grasshopper and web/native DOM UI.

Boundaries:

- its direction is primarily Grasshopper -> embedded web UI, not Brepia web -> smart Grasshopper project object;
- the project targets .NET Framework 4.8 / Rhino 7-era install paths and an old WebView2 stack;
- it is not an exact geometry/evaluator architecture;
- Phase 7 should use current Rhino 8 SDK/project conventions instead of inheriting its build system.

The repository is GPL-3.0. Its license is compatible with Brepia's GPLv3 direction, but direct code reuse is unnecessary for the planned component.

## Explicit non-goals

Phase 7 does not add:

- generated `.gh` workflow packaging (Phase 8);
- a browser clone of the Grasshopper editor;
- Liveblocks or collaborative GH graph editing;
- generic GH graph import as Brepia source;
- native translation of arbitrary Brepia features to editable GH nodes;
- Rhino.Compute as a mandatory Brepia runtime;
- Rhino.Inside as the Brepia host architecture;
- new canonical BRep parameter types;
- OpenSCAD changes;
- mesh fallback for contractually typed Brep outputs.

## Validation

Repository-facing TypeScript/server changes keep the normal Brepia gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

The C# plugin additionally requires a Rhino 8 SDK build and then real Rhino/Grasshopper acceptance in 7D. A generic npm CI pass cannot substitute for the installed Rhino runtime acceptance.
