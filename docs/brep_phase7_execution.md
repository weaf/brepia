# BRep Phase 7 — Smart Brepia Grasshopper component

## Status

Phase 7 is active on `feature/brep-grasshopper-smart-component` from the accepted Phase 6 merge checkpoint:

```text
a56e73fdc5966a2fec3319ee5d204479790bf2ac
Merge pull request #34 — Phase 6: Grasshopper export contract
```

Current implementation is authoritative. `docs/brep_kernel_plan.md` remains roadmap context; completed Phase 1–6 execution/status documents are evidence, not independent source authority.

Phase 7A–7C are repository-complete. Phase 7D real Rhino/Grasshopper runtime acceptance remains before the PR can leave draft.

## Product boundary

Brepia is the AI-native parametric CAD orchestration layer for this workflow. It is not intended to replace Rhino, Grasshopper or OpenSCAD as their full manual authoring environments.

The core product loop is:

```text
AI-assisted Brepia authoring
        |
        v
canonical BrepProject + validation/revisions
        |
        +--> Brepia preview / published parameters
        |
        +--> exact interoperability to Rhino / Grasshopper
                    |
                    v
          project-level composition and manual work
                    |
                    v
          later identity-aware reconciliation back to Brepia
```

Existing Brepia BRep graph, feature editing and project-definition editing remain useful expert/inspection/manual-correction surfaces because they operate on the same canonical `BrepProject`. They should not be discarded merely because AI is the primary authoring path. They must, however, remain views/editors over the canonical model rather than becoming a second CAD runtime or an attempt to clone Grasshopper in the browser.

Round-trip work in later phases must distinguish Brepia-owned identity from external project additions. Brepia project/revision/parameter/node/semantic identities should survive export where possible. Geometry or Grasshopper logic created outside Brepia remains external/opaque until an explicit mapping or reconciliation rule exists; Phase 7 does not claim generic lossless conversion of arbitrary Rhino/Grasshopper work into a `BrepProject`.

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

Phase 7 consumes the existing contract without widening its canonical authority:

- `kind = brepia-grasshopper-contract`;
- `schemaVersion = 1`;
- canonical normalized `BrepProject` snapshot plus immutable `sourceRevisionId`;
- current published numeric parameters only (`mm | deg | none`), ordered by stable parameter ID;
- standard `placement` Plane input after the published parameters;
- fixed outputs in order: `result`, `footprint`, `clearanceEnvelope`, `maintenanceEnvelope`, `connectionPoints`, `mountingPoints`, `cablePoints`, `metadata`;
- component-local source geometry transformed consistently to the connected target Plane, or to resolved project placement when Plane is unconnected;
- warnings/errors surfaced as Grasshopper runtime messages.

No Phase 7 implementation may silently return tessellated mesh on an output contractually typed as Rhino Brep.

## Exact-geometry handoff

Phase 7A extends the accepted Phase 5 3DM interoperability document without changing its visible-object truthfulness:

- 3DM visible project-object geometry remains explicitly tagged `tessellated-mesh` for viewer/interoperability use;
- the document embeds deterministic exact STEP artifacts for every configured Brep role;
- `result` always maps to `brepia-primary.step`;
- optional configured roles map to `brepia-footprint.step`, `brepia-clearance-envelope.step` and `brepia-maintenance-envelope.step`;
- `brepia.exactBrepArtifacts` records canonical role/node/file identity;
- `brepia.placement`, `brepia.projectObject`, optional `brepia.metadata` and `brepia.warnings` carry evaluated semantic data;
- the native sandbox reopens the produced 3DM, extracts every expected embedded STEP and revalidates the STEP header before returning the document.

The Grasshopper runtime fails closed if an expected exact artifact is missing, duplicated, malformed or identity-mismatched. It never promotes the tessellated 3DM viewer meshes to Brep output.

The existing accepted STEP and 3DM download behavior remains available; the additional document strings/embedded exact role artifacts are additive interoperability data.

## Component ownership and persistence

The component is one reusable `Brepia Project` Grasshopper component.

The component persists an embedded normalized Phase 6 contract in its Grasshopper component state. Loading/replacing a contract is an explicit component action; an external file path is not canonical runtime state.

Phase 7C uses Grasshopper-native custom component attributes so double-clicking the component opens Rhino's cross-platform `OpenFileDialog` to load or replace a `*.brepia-grasshopper.json` contract. This avoids a `System.Windows.Forms` dependency and keeps the plugin on plain .NET 8 rather than forcing a Windows-only target.

From the embedded contract the component reconstructs:

- one `Param_Number` item input per published numeric parameter;
- stable Brepia parameter IDs persisted separately from mutable labels;
- published unit/default/min/max/step information in the parameter description/runtime contract;
- the standard optional item `Plane` input with stable ID `placement`;
- the fixed v1 output port order.

When replacing a contract, compatible existing input parameters are reused by stable Brepia ID so their Grasshopper wire sources can survive ordinary label/contract refreshes. Removed/incompatible ports are isolated normally rather than silently rebound to another identity.

The component persists only canonical contract/input identity. Evaluator URL/token configuration is process configuration and is never written into the Grasshopper document.

Phase 8 may generate `.gh` files that instantiate this component with an embedded contract. `.gh` generation is not part of Phase 7.

## Evaluator boundary

The component does not reimplement the Brepia feature DAG in C#.

For each solve it sends the canonical contract source plus validated current parameter values to the existing Brepia evaluator boundary:

```text
POST /api/brep/export/step
Accept: model/vnd.3dm
```

The evaluator remains responsible for constrained OCCT/build123d evaluation and exact artifact generation.

Initial Phase 7 connection configuration is explicit environment configuration:

```text
BREPIA_GRASSHOPPER_BASE_URL
BREPIA_GRASSHOPPER_TOKEN
```

The token is optional at the client type level but the accepted Brepia API remains authenticated; a missing/invalid token therefore fails as an evaluator error. A durable account/API-token distribution flow is a later product/security concern and is not embedded in `.gh` documents.

The client bounds the 3DM response to 64 MiB and bounds error responses before surfacing them.

## Rhino 8 exact import

The plugin targets `.NET 8` and pins a matching stable Rhino 8 SDK pair:

```text
RhinoCommon 8.34.26223.11001
Grasshopper 8.34.26223.11001
```

Runtime assets are excluded from the plugin package because Rhino supplies them.

For each expected exact role the plugin:

1. opens the returned 3DM through `File3dm`;
2. validates project/schema/result-node/exact-manifest identity;
3. validates the embedded filename set against the canonical contract;
4. extracts the embedded STEP to a temporary isolated path;
5. validates `ISO-10303-21`;
6. creates a headless `RhinoDoc`;
7. imports with `FileStp.Read`;
8. requires exactly one native Rhino `Brep` for contract v1;
9. duplicates that Brep out of the temporary document;
10. cleans temporary files.

There is no mesh-to-Brep fallback.

## Placement semantics

The evaluator returns geometry in Brepia component-local coordinates. The local source basis is the canonical component basis (`WorldXY` in Rhino terms); the persisted project placement is an insertion target, not the source basis of already-transformed geometry.

The component resolves exactly one target Plane for each solve:

- when the Grasshopper Plane input has no supplied Plane data, use the project placement resolved under the current parameter values;
- when the Plane input supplies a Plane, that Plane replaces the project placement.

Before geometry placement, target axes are normalized/orthogonalized. The component then applies:

```text
Transform.PlaneToPlane(Plane.WorldXY, targetPlane)
```

Axis magnitudes therefore remain orientation semantics only and cannot introduce geometry scale.

The same rigid transform applies to primary geometry, optional project-object geometry and semantic point positions. Semantic point directions receive the transform's vector/orientation part only, never translation.

## Outputs and identity

Fixed v1 outputs are populated in this order:

1. `Result` — required exact native Rhino Brep;
2. `Footprint` — optional exact native Rhino Brep;
3. `Clearance` — optional exact native Rhino Brep;
4. `Maintenance` — optional exact native Rhino Brep;
5. `Connections` — transformed semantic connection points;
6. `Mounting` — transformed semantic mounting points;
7. `Cable` — transformed semantic cable points;
8. `Metadata` — compact JSON interoperability envelope.

The metadata envelope retains:

- Brepia project ID/name/schema;
- immutable source revision ID;
- exact role -> canonical node identity;
- transformed semantic point IDs/kinds/positions/directions/labels;
- project metadata when present.

This lets the simple point outputs remain convenient Grasshopper geometry while preserving the stronger Brepia identity needed by later reconciliation work.

Evaluator warnings carried in the 3DM become Grasshopper `Warning` runtime messages. Contract/evaluator/import/placement failures become Grasshopper `Error` runtime messages.

## Phase 7 slices

### 7A — Exact solve transport and role manifest — repository complete

Implemented:

- deterministic exact-artifact manifest for fixed Brep outputs;
- required `result` plus optional role artifacts conditional on canonical project-object role IDs;
- stable project/node/role identity and deterministic filenames;
- exact STEP generation for every emitted Brep role;
- native 3DM embedding and independent sandbox round-trip validation;
- existing STEP/3DM behavior retained.

Real local native smoke remains part of runtime evidence if not already run on the final Phase 7 branch.

### 7B — Rhino 8 C#/.gha contract client — complete

Implemented and CI-compiled:

- modern SDK-style Rhino 8 Grasshopper plugin under `grasshopper/Brepia.Grasshopper`;
- independent C# v1 contract validation/reconstruction;
- canonical contract persistence;
- authenticated bounded 3DM evaluator client;
- exact embedded STEP -> headless RhinoDoc -> native Rhino Brep import;
- fail-closed identity/artifact checks;
- no tessellated mesh fallback.

### 7C — Dynamic inputs, Plane, outputs and diagnostics — complete

Implemented and CI-compiled:

- stable-ID dynamic numeric inputs and optional Plane input;
- source-preserving input reuse on compatible contract replacement;
- fixed v1 outputs;
- rigid WorldXY -> target Plane placement without scale;
- transformed semantic points and identity-preserving metadata envelope;
- evaluator warning transport and Grasshopper warning/error mapping;
- explicit evaluator environment configuration without persisted secrets;
- cross-platform Grasshopper double-click contract load/replace action;
- `.gha` artifact publication from CI for Phase 7D acceptance.

### 7D — Real Rhino/Grasshopper acceptance — active next

Acceptance must use an installed Rhino 8 / Grasshopper runtime, not only static source tests or SDK compilation.

Representative acceptance:

1. install the CI-built `Brepia.Grasshopper.gha` in Rhino 8 / Grasshopper;
2. configure an authenticated reachable Brepia evaluator;
3. place one `Brepia Project` component and load a saved representative cabinet contract;
4. verify published numeric inputs appear with expected labels/defaults while identity survives document save/reload;
5. vary at least two dimensions and observe exact native Rhino Brep geometry change;
6. leave Plane unsupplied and verify resolved project placement;
7. supply arbitrary placement Planes, including an alignment-style derived Plane, and verify position/orientation without scale distortion;
8. verify `Result` is a native Rhino Brep, not a mesh;
9. verify at least one auxiliary exact role when configured and semantic points/metadata;
10. verify invalid evaluator/auth/contract conditions surface as Grasshopper errors;
11. save/reopen the Grasshopper document and verify embedded contract/project/revision identity plus compatible input wiring survives;
12. ordinary Brepia operation remains independent of Rhino.

## CI evidence before 7D

Repository checkpoint before installed-runtime acceptance:

```text
83eddcecbb16cb83be9efb2534fc0a8496e7dd9f
Publish Grasshopper plugin acceptance artifact
```

On that exact head:

- Grasshopper Build #12 / run `34027757462` — PASS;
- `dotnet restore` — PASS;
- `dotnet build --configuration Release --no-restore --warnaserror` — PASS;
- CI artifact `brepia-grasshopper` — published;
- Quality Gate #436 / run `34027757460` — PASS;
- tests/typecheck/lint/build/diff check — PASS.

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
- Phase 7 uses current Rhino 8 SDK/project conventions instead of inheriting its build system.

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

The C# plugin additionally requires the Rhino 8 SDK build gate and then real Rhino/Grasshopper acceptance in 7D. A generic npm CI pass cannot substitute for the installed Rhino runtime acceptance.
