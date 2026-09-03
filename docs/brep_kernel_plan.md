# Brepia BRep kernel foundation plan

## Status

Planning only. No implementation has started.

This document records the currently preferred direction for Brepia's next CAD/parametric modeling phase after Brepia 1.0, multi-file OpenSCAD workspace, viewer orientation controls, and OpenSCAD editor intelligence.

Base checkpoint:

```text
68a89e238bb9b1da9ceebfd64a9dee0858e29321
```

Working branch:

```text
feature/brep-kernel-foundation
```

Do not treat this document as permission to implement the complete roadmap. The current task remains architecture and product evaluation until the discussion and scope are explicitly closed.

## Strategic recommendation

Brepia should add an open B-Rep CAD foundation based on OpenCascade/OCCT, preferably exposed initially through a constrained server-side build123d-based execution layer, while preserving OpenSCAD as a first-class modeling mode.

Rhino/Grasshopper should be treated as optional interoperability and compute providers rather than as Brepia's mandatory core runtime.

Target architecture:

```text
Brepia UI / AI
       |
       v
Brepia Parametric Model
feature graph / DAG / stable model schema
       |
       +--> OpenSCAD backend
       |
       +--> OCCT/build123d backend      primary new B-Rep path
       |
       +--> Rhino.Compute provider      optional later integration
              |
              +--> RhinoCommon
              +--> Grasshopper definitions
       |
       v
common geometry/result contract
       |
       +--> browser Three.js viewer
       +--> STEP
       +--> STL / mesh outputs
       +--> future 3DM interoperability
```

## Why this direction fits Brepia

Brepia is already browser/server oriented and already separates untrusted/native geometry work from the application process.

Relevant current architectural properties:

- React/TanStack Router/React Start browser and server application.
- Three.js/React Three Fiber browser viewer.
- Persistent conversations, revisions, parameters and project state.
- Complete normalized multi-file `OpenScadProject` snapshots.
- Existing server-side STEP conversion through a rootless, networkless, read-only Podman sandbox.
- Existing STEP stack already uses scad123d, build123d and OpenCascade/OCCT.
- OpenSCAD remains useful for code-centric constructive solid geometry and should not be removed merely because a B-Rep path is added.

This means Brepia can evolve toward a true feature/B-Rep CAD model without replacing the current product architecture.

## Product model

The preferred long-term product model is multiple first-class modeling modes that share the same workspace, viewer, persistence and AI concepts:

```text
OpenSCAD Project
BRep Project
Creative Project
```

A BRep project should not initially be arbitrary Python source. It should use a constrained, versioned Brepia-owned parametric representation.

Conceptually:

```json
{
  "nodes": [
    {
      "id": "base",
      "type": "box",
      "parameters": {
        "length": 100,
        "width": 60,
        "height": 12
      }
    },
    {
      "id": "hole",
      "type": "cylinder",
      "parameters": {
        "radius": 5,
        "height": 12
      }
    },
    {
      "id": "result",
      "type": "subtract",
      "inputs": ["base", "hole"]
    },
    {
      "id": "fillet",
      "type": "fillet",
      "input": "result",
      "selector": {
        "edges": "vertical"
      },
      "radius": 3
    }
  ]
}
```

The same underlying model should eventually support several interaction surfaces:

```text
parameter controls
      ^
      |
node graph <--> Brepia Parametric Model <--> AI editing
```

The node graph must therefore be a view/editor for the canonical model rather than an independent runtime.

## Core architectural principles

### 1. Kernel-neutral application contract

The application should not expose OCCT/build123d-specific implementation details as the persisted project contract unless necessary.

Define a Brepia-owned schema and provider interface so future kernels/providers can be added without rewriting persistence, UI or AI contracts.

### 2. Stable feature identity

Nodes/features need stable identifiers so parameters, AI edits, revisions and future topology references can survive ordinary edits.

### 3. Explicit dependency graph

The model should be a validated DAG with bounded input references and deterministic evaluation order.

### 4. No arbitrary Python in the first architecture

Direct build123d Python execution would greatly expand the security boundary. Initial BRep projects should compile from the constrained Brepia model into build123d/OCCT operations inside a hardened execution environment.

A future expert/code mode can be evaluated separately.

### 5. Preserve the current native-execution security posture

Geometry engines must not run directly inside the Brepia/Nitro application host when processing user-controlled model input.

The existing STEP sandbox establishes useful precedent:

- rootless containerization;
- network disabled;
- read-only container root;
- no-new-privileges;
- dropped capabilities;
- bounded CPU/RAM/PIDs/time;
- narrowly mounted inputs/outputs;
- validated server-side result contract.

The BRep runtime should preserve or improve this boundary.

### 6. Browser viewer remains presentation, not authoritative geometry

Initially, exact B-Rep evaluation should remain server-side. The browser should receive a renderable/tessellated representation plus metadata needed for interaction.

Browser-side OCCT/WASM can be considered later for low-latency previews or selected operations once memory, startup, mobile and cancellation behavior are understood.

## Rhino and Grasshopper position

### Rhino.Compute

Rhino.Compute is the Rhino integration that best matches Brepia's browser/server architecture because it provides HTTP-accessible RhinoCommon operations and Grasshopper definition solving.

Recommended role:

- optional provider;
- solve uploaded/known Grasshopper definitions;
- expose definition inputs as Brepia parameters;
- return geometry/results into the common Brepia result contract;
- potentially support advanced Rhino-specific operations not implemented by the native OCCT path.

Do not make Rhino.Compute mandatory for normal Brepia BRep projects.

Reasons:

- production Rhino runtime licensing/billing introduces an external commercial dependency;
- Linux Compute support must be evaluated against McNeel's current production guidance before adopting it as a deployment baseline;
- Compute solves Grasshopper definitions but does not provide the Grasshopper desktop canvas as a browser editor.

### Rhino.Inside

Do not use Rhino.Inside directly as the primary Brepia integration.

Rhino.Inside embeds Rhino into another native host process and is better suited to desktop/native host applications. Rhino.Compute already provides the server abstraction Brepia would need.

### Grasshopper

Treat Grasshopper compatibility and a Grasshopper-like Brepia graph as separate goals.

Potential future capabilities:

1. native Brepia node graph over the Brepia Parametric Model;
2. optional `.gh` execution through Rhino.Compute;
3. possible import/translation research for selected Grasshopper graphs, explicitly not assumed to be generally lossless.

### rhino3dm / openNURBS

Evaluate rhino3dm as a strong interoperability layer rather than as the modeling kernel.

Potential uses:

- `.3dm` read/write;
- object/layer/attribute inspection;
- NURBS/BRep transport;
- browser or Node-side 3DM tooling where Rhino is not installed.

Do not assume rhino3dm provides the full set of robust modeling, boolean, intersection and tessellation operations available in Rhino proper.

## Open alternatives

### build123d + OCCT

Current preferred first backend.

Advantages:

- true B-Rep modeling;
- already indirectly present in Brepia's STEP stack;
- strong primitives, booleans, sketches, extrusions, sweeps, lofts, fillets/chamfers and selectors;
- suitable for headless Linux execution;
- compatible with Brepia's existing sandbox strategy;
- open-source licensing suitable for Brepia's open architecture.

Risks/questions:

- Python runtime inside the geometry container;
- topology naming/stability across edits;
- deterministic selector semantics;
- tessellation and metadata contract for the browser;
- performance and caching strategy;
- library/version pinning.

### CadQuery

Keep as a reference/alternative but do not start with two Python CAD abstractions simultaneously.

Evaluate only if build123d exposes a material limitation for the Brepia feature model.

### RepliCAD / browser OCCT

Potential later browser-preview layer.

Advantages:

- TypeScript/JavaScript integration;
- OCCT in the browser;
- possible low-latency local recompute.

Do not make this the first authoritative kernel because of WASM startup/memory, mobile constraints, worker lifecycle and the need for deterministic server-side export.

### Cascade Studio / cascade-core / other OCCT-WASM wrappers

Useful architecture references and possible future frontend kernels.

Treat them as later evaluation targets rather than dependencies for Phase 1.

## File formats

### Existing formats to preserve

- `.scad` and multi-file OpenSCAD projects;
- STL;
- DXF;
- STEP;
- Creative GLB where supported.

### BRep project source format

Prefer a versioned Brepia-owned JSON-compatible schema rather than STEP or 3DM as the editable source of truth.

STEP and 3DM are interchange/result formats, not ideal persisted parametric feature graphs.

### STEP

STEP should remain the primary neutral exact-CAD interchange format for the native BRep path.

For native OCCT-backed BRep projects, STEP export should ideally avoid the OpenSCAD/scad123d conversion layer and export directly from the evaluated BRep backend while preserving the same application-level sandbox/security guarantees.

### 3DM

Add only after the BRep model/result contract is established.

Likely routes:

- rhino3dm/openNURBS for supported 3DM serialization/interchange;
- Rhino.Compute for Rhino-specific fidelity/features where required.

### Mesh outputs

Continue generating tessellated viewer/printing outputs independently of the exact BRep source representation.

## Phase roadmap

### Phase 0 — Architecture closure

Current phase.

Before implementation, decide and document:

- canonical BRep project/model schema;
- provider/kernel abstraction;
- initial operation set;
- selection/topology strategy;
- geometry result/viewer contract;
- persistence/versioning approach;
- sandbox boundary;
- deployment/runtime packaging;
- licensing inventory;
- performance goals;
- explicit non-goals.

No implementation should start until this scope is accepted.

### Phase 1 — Minimal vertical BRep slice

Goal: prove the complete architecture, not broad CAD functionality.

Suggested operation corpus:

```text
box
cylinder
transform
boolean subtract
fillet
```

Required vertical slice:

```text
BrepProject JSON
    -> schema validation
    -> server evaluation request
    -> isolated build123d/OCCT runner
    -> exact BRep result
    -> tessellated browser payload
    -> existing Three.js viewer
    -> direct STEP export
```

Acceptance should include at least one model with an analytic cylindrical hole and a filleted edge.

### Phase 2 — Native BRep project lifecycle

Integrate BRep projects with:

- conversations;
- revision persistence;
- restore/retry/branch behavior;
- parameter extraction/editing;
- import/export lifecycle;
- project type selection.

OpenSCAD behavior must remain unchanged.

### Phase 3 — AI-native BRep editing

Teach Brepia's AI contract to create and modify complete BRep project snapshots using structured operations rather than arbitrary geometry code.

Requirements:

- preserve stable node IDs where reasonable;
- validate graph structure before execution;
- distinguish parameter changes from topology-changing edits;
- retain revision history and meaningful diffs.

### Phase 4 — Grasshopper-like graph editor

Build a browser node editor over the same canonical Brepia Parametric Model.

Do not create a second graph runtime.

### Phase 5 — 3DM/rhino3dm interoperability

Add selected `.3dm` import/export and metadata support.

Scope should be based on explicit interoperability use cases rather than a promise of complete Rhino document parity.

### Phase 6 — Optional Rhino.Compute / Grasshopper provider

Add an operator-configured Rhino provider.

Potential first product feature:

- upload/select a `.gh` definition;
- discover supported exposed inputs;
- render them through Brepia parameter controls;
- execute through Rhino.Compute;
- display returned geometry in the Brepia viewer;
- preserve provider metadata with the project/revision.

Keep this isolated from the native BRep backend so Brepia remains fully usable without Rhino.

### Phase 7 — Browser-side OCCT evaluation

Only after server architecture is stable, evaluate RepliCAD/cascade-core/other OCCT-WASM options for:

- local previews;
- low-latency parameter changes;
- offline/local operation subsets;
- worker-based compute.

Authoritative server evaluation/export should remain available even if a browser kernel is introduced.

## Phase 1 preliminary technical shape

A likely structure, subject to further discussion:

```text
shared/brepProject.ts
  schema/types/versioning

src/server/brep/
  validation
  provider contract
  job/result mapping

scripts/brep-kernel/
  Containerfile
  sandbox runner
  constrained evaluator
  smoke/corpus tests

src/routes/api/brep/
  authenticated bounded evaluation endpoint

browser
  existing viewer receives standardized tessellated result
```

Names are intentionally provisional.

## Initial operation set candidates

Do not attempt full Rhino/Grasshopper parity in the first feature set.

Candidate primitive/features:

- box;
- cylinder;
- sphere;
- cone;
- sketch plane and basic profile primitives;
- extrude;
- revolve;
- transform;
- union/fuse;
- subtract/cut;
- intersect;
- fillet;
- chamfer;
- loft;
- sweep;
- shell/thickness.

Phase 1 should use only the minimal subset needed to prove architecture.

## Topology and selection problem

This is one of the most important unresolved technical areas.

Operations such as fillet/chamfer require a stable way to identify edges/faces. Raw OCCT topology indexes may change after upstream edits.

Research before implementation should compare:

- semantic selectors, e.g. orientation/type/location rules;
- query expressions;
- geometric signatures;
- feature provenance;
- persistent naming approaches;
- explicit handling when a selector becomes ambiguous or invalid.

Brepia should prefer deterministic failure/warnings over silently applying a feature to a different face/edge.

## Geometry result contract

The browser should not need to understand native OCCT objects.

Candidate result contract:

```text
model revision id
provider/kernel version
status + warnings
one or more bodies
body/object stable IDs
triangle mesh buffers or GLB-like render payload
material/color metadata
bounding boxes
optional face/edge picking metadata
exact-export availability
provider-specific diagnostics
```

The exact format remains undecided.

## Deployment

Preferred first deployment:

```text
Brepia host
   |
   v
bounded API request
   |
   v
rootless Podman BRep sandbox
   - network=none
   - read-only root
   - dropped capabilities
   - bounded resources/time
   - pinned Python/build123d/OCCT versions
   |
   v
validated result files / metadata
```

Reuse security patterns from STEP export but do not automatically reuse the same image/process if separation improves maintainability and least privilege.

## Licensing inventory to maintain

Before implementation, record exact versions and licenses for every introduced geometry dependency.

Expected categories:

- Brepia: GPLv3;
- build123d: verify exact selected release/license at pin time;
- OCCT: verify exact selected release and Open CASCADE exception terms at pin time;
- rhino3dm/openNURBS: verify current McNeel licensing before introduction;
- Rhino.Compute/Rhino runtime: commercial runtime deployment terms and billing are operational dependencies even where surrounding SDK/source is permissively licensed.

Do not rely on remembered license summaries at implementation time; verify against current upstream sources when pinning dependencies.

## Explicit non-goals for the first implementation

- replacing OpenSCAD;
- full Rhino parity;
- full Grasshopper parity;
- embedding Rhino desktop;
- Rhino.Inside host integration;
- arbitrary Python execution;
- complete sketch constraint solver;
- assembly workbench;
- browser-authoritative OCCT runtime;
- generic conversion of arbitrary Grasshopper graphs to native Brepia graphs;
- weakening the existing sandbox/security model for convenience.

## Open decisions for continued discussion

1. Should `BrepProject` be explicitly node/feature based from day one, or should Phase 1 use an even smaller operation-list intermediate representation that later becomes the node model?
2. How much sketching/2D constraint functionality belongs in the first useful product release?
3. Should the first BRep UX remain AI + parameter driven, or expose direct feature editing before a full graph editor exists?
4. What topology-selection semantics should become part of the persisted public project format?
5. How should a BRep revision store rendered/tessellated caches versus canonical source only?
6. Should Rhino.Compute support be designed into the provider interface during Phase 0 even if implementation waits until Phase 6?
7. Which 3DM use case matters first: import existing Rhino geometry, export Brepia geometry to Rhino, or Grasshopper execution?
8. Do we want a future expert mode exposing build123d code, and if so should it be a distinct project type/security boundary rather than part of normal BRep projects?

## Next action

Continue architecture/product discussion on this branch.

Do not implement Phase 1 until the user explicitly closes the discussion phase and approves the initial BRep scope.
