# BRep Phase 7 — Smart Brepia Grasshopper component

## Status

Phase 7 is active on `feature/brep-grasshopper-smart-component` from the accepted Phase 6 merge checkpoint:

```text
a56e73fdc5966a2fec3319ee5d204479790bf2ac
Merge pull request #34 — Phase 6: Grasshopper export contract
```

Current implementation is authoritative. `docs/brep_kernel_plan.md` is historical roadmap context under `AGENTS.md`; this execution document records the current Phase 7 interpretation and product boundary.

Phase 7A is repository-complete at:

```text
25a12e28440499a1801ed7bafd151ec0849f088a
```

Quality Gate #415 / run `34024621886` passed on that exact head. Real local native smoke remains part of runtime acceptance and must not be replaced by repository CI.

## Product invariant

Brepia is an **AI-native parametric CAD orchestration layer**, not a replacement CAD application.

OpenSCAD, Rhino and Grasshopper are first-class external authoring/runtime environments. Brepia should create, understand, validate, preview and parametrically modify models with AI, allow continued work in the native CAD environment, and later read/reconcile that work so the user can continue with AI.

The intended long-term loop is:

```text
Brepia AI
   |
   v
canonical validated project
   |
   +--> parameter controls + preview + optional advanced inspection/editing
   |
   v
OpenSCAD / Rhino / Grasshopper
   |
   v
continued native CAD work
   |
   v
Brepia import / identity recovery / reconcile
   |
   v
validation + AI-assisted continuation
```

Consequences:

- AI-assisted creation and modification are the primary authoring path in Brepia;
- validation, preview, parameters, revisions and interoperability are core product capabilities;
- direct BRep feature/project editing and the BRep graph may remain as useful advanced inspection, debugging and manual-correction surfaces because they operate on the same canonical model;
- those advanced surfaces must not become a second geometry runtime or drive a goal of reproducing Rhino/Grasshopper in the browser;
- functionality already implemented should be retained when it does not compromise this boundary and may be positioned as an optional/advanced capability rather than removed;
- Rhino/Grasshopper interoperability is eventually bidirectional: export is the first boundary, round-trip identity/reconciliation is the follow-on goal.

## Phase 7 goal

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

The Grasshopper component is a bridge into the normal Rhino/Grasshopper workflow. It is not a second source of truth and not a translation of the Brepia feature DAG into an editable clone of the Grasshopper graph.

## Round-trip direction

Phase 7 establishes the identity-preserving smart-component boundary required for later Rhino/Grasshopper round-trip work.

A Brepia-authored component must retain stable project, revision, parameter and semantic-role identity so a later `.gh`/`.3dm` import can identify the Brepia-owned portion of the model.

Later round-trip work should distinguish two cases:

1. **Brepia-native round trip** — a Brepia-generated component/model returns with its stable identity and can be re-associated with its canonical Brepia project with high confidence.
2. **External Rhino/GH additions** — arbitrary native Rhino geometry or Grasshopper nodes added around the Brepia object are analyzed and preserved as external/opaque interoperability content until a deliberate mapping exists. Brepia must not claim a generic lossless arbitrary-GH-graph -> `BrepProject` conversion.

Phase 7 does not implement that general re-import/reconciliation pipeline, but it must not make later round trip impossible by discarding identity.

## Reconciled current product surfaces

A drift audit of the current BRep implementation found no feature that needs removal:

- `BrepProjectView` keeps the AI conversation as the primary authoring surface and composes preview/workspace and parameter panels around it;
- parameter changes evaluate the same canonical project and persist immutable revisions, which is directly aligned with the product invariant;
- `BrepProjectWorkspacePanel` exposes Model preview and a feature dependency Graph. The graph is acceptable as an advanced inspection/editing surface because it does not own a separate runtime or persisted model;
- direct feature editing and project-definition/project-object editing persist new canonical `BrepProject` revisions and remain useful expert/manual-correction tools;
- STEP, 3DM, Brepia project and Grasshopper contract exports are aligned interoperability surfaces;
- the browser viewer remains presentation geometry, not authoritative exact geometry.

Therefore Phase 7 should not delete or rewrite these surfaces. Future UI work may reduce the prominence of expert graph/direct-edit controls if product usability benefits, but that is presentation scope rather than an architectural correction.

Features that would conflict with the invariant if introduced as core product direction include a browser Grasshopper clone, a second graph runtime, generic lossless arbitrary GH graph conversion claims, or browser-authoritative exact CAD that duplicates Rhino without a concrete interoperability need.

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

## Exact-geometry transport — Phase 7A

Phase 7A closed the exact optional-role transport gap without changing accepted user downloads.

The native evaluator now creates a deterministic exact-artifact manifest:

- `result` -> `brepia-primary.step`;
- `footprint` -> `brepia-footprint.step` when configured;
- `clearanceEnvelope` -> `brepia-clearance-envelope.step` when configured;
- `maintenanceEnvelope` -> `brepia-maintenance-envelope.step` when configured.

Each emitted role is exported as exact STEP, embedded in the 3DM hand-off document, declared in `brepia.exactBrepArtifacts`, extracted again after 3DM write and independently revalidated as STEP. The visible 3DM document objects remain intentionally tessellated preview/interoperability meshes and remain labelled as such. There is no mesh-to-Brep fallback.

This allows the existing authenticated `POST /api/brep/export/step` endpoint with `Accept: model/vnd.3dm` to serve as the first smart-component hand-off without creating a second evaluator API.

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

The first implementation may reuse the accepted authenticated 3DM export endpoint because its 3DM response now embeds the exact role artifacts plus identity/semantic document strings.

Initial connection configuration may be explicit/local-development configuration. A durable account/API-token distribution flow is a separate product/security concern unless it becomes necessary for Phase 7 acceptance.

All remote/evaluator failures must fail closed and appear as Grasshopper runtime errors. Provider warnings become Grasshopper warnings.

## Placement semantics

The evaluator returns geometry in Brepia component-local coordinates. The local source basis is the canonical component basis (`WorldXY` in Rhino terms); the persisted project placement is an insertion target, not the source basis of already-transformed geometry.

The component resolves exactly one target Plane for each solve:

- when the Grasshopper Plane input is unconnected, use the project placement resolved under the current parameter values;
- when the Plane input is connected, the connected Plane replaces the project placement.

The component then applies a RhinoCommon plane-to-plane transform from component-local `WorldXY` to that target Plane. Axis magnitudes from the Brepia placement are orientation semantics only and must not introduce geometry scale.

The same rigid placement transform applies to primary geometry, optional project-object geometry and semantic point positions. Semantic point directions receive the transform's vector/orientation part only, never translation.

## Rhino 8 SDK baseline for 7B

Current official Rhino 8 APIs confirm the required local import path:

- `Rhino.FileIO.File3dm.EmbeddedFiles` is available since Rhino 8;
- embedded entries expose `Filename` and `SaveToFile(...)`;
- `Rhino.FileIO.FileStp.Read(path, RhinoDoc, FileStpReadOptions)` is available since Rhino 8;
- `RhinoDoc.CreateHeadless(...)` provides an isolated document for code-driven file I/O.

As of 2026-09-06, the current stable McNeel NuGet pair is `RhinoCommon` / `Grasshopper` `8.34.26223.11001`. Phase 7B should pin the pair together and exclude Rhino runtime assets from plugin output. A newer Rhino 9 beta is not a reason to move this Rhino 8 target.

## Phase 7 slices

### 7A — Exact solve transport and role manifest — repository complete

- deterministic exact-artifact manifest for fixed Brep outputs;
- required primary and conditional optional role artifacts;
- stable project/node/role identity;
- deterministic filenames independent of display labels;
- exact STEP per emitted Brep role;
- validation before and after the embedded 3DM round trip;
- existing STEP/3DM export behavior preserved;
- Quality Gate #415 PASS at `25a12e28440499a1801ed7bafd151ec0849f088a`.

Real native smoke remains required as runtime evidence.

### 7B — Rhino 8 C#/.gha contract client — active

- add a modern SDK-style Rhino 8 Grasshopper plugin project under `grasshopper/`;
- reference matching official RhinoCommon and Grasshopper SDK packages without copying Rhino runtime assemblies into the plugin;
- parse/validate contract v1 independently in C# and rebuild trusted derived runtime fields from canonical source;
- persist the normalized contract in component state;
- call the Brepia-compatible evaluator;
- verify response model/exact-artifact identity before import;
- extract exact STEP role artifacts from 3DM;
- import exact STEP through RhinoCommon code-driven file I/O in a headless document;
- return native Rhino Breps to the component runtime;
- never consume tessellated 3DM document objects as Brep output fallback.

### 7C — Dynamic inputs, Plane, outputs and diagnostics

- rebuild dynamic numeric input ports from stable parameter IDs;
- preserve fixed v1 output order;
- support connected/unconnected Plane semantics;
- transform exact Breps and semantic point data consistently;
- expose metadata without discarding stable project/point identity;
- map evaluator warnings/errors to Grasshopper runtime messages;
- preserve useful component/project/revision identity in the Grasshopper document;
- provide the explicit contract-load/replace UX needed for manual use before generated `.gh` packaging exists.

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

- component catalog/search and Grasshopper metadata;
- a small gateway around Rhino.Compute `/grasshopper` solves;
- GH-to-JSON / JSON-to-GH experiments that may be useful for later `.gh` generation and round-trip analysis.

Boundaries:

- its editable React Flow Grasshopper graph is not Brepia's product direction;
- Liveblocks/collaborative graph state is not needed for the smart-component runtime;
- Rhino.Compute remains optional;
- its browser graph should not replace Brepia's canonical model or become a reason to build Grasshopper parity in Brepia.

The repository LICENSE file is MIT. If code is ever copied rather than independently reimplemented, preserve its required copyright/license notice.

### mitevpi/gh-web-ui

Useful patterns:

- historical `GH_Component` and `.gha` packaging examples;
- examples of a Grasshopper/web bridge.

Boundaries:

- its direction is primarily Grasshopper -> embedded web UI;
- it targets Rhino 7-era .NET Framework/install paths and an old WebView2 stack;
- it is not an exact geometry/evaluator architecture;
- Phase 7 uses current Rhino 8 SDK/project conventions instead.

The repository is GPL-3.0. Direct code reuse is unnecessary for the planned component.

## Explicit non-goals

Phase 7 does not add:

- generated `.gh` workflow packaging (Phase 8);
- a browser clone of the Grasshopper editor;
- Liveblocks or collaborative GH graph editing;
- generic GH graph import as canonical Brepia source;
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

The C# plugin additionally requires an SDK build against the pinned Rhino 8 packages and then real Rhino/Grasshopper acceptance in 7D. Generic npm CI cannot substitute for installed Rhino runtime acceptance.
