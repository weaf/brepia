# Brepia BRep kernel foundation plan

## Status

Approved direction. Phase 1 is active.

This document is the current plan for Brepia's next CAD/parametric modeling phase after Brepia 1.0, multi-file OpenSCAD workspace, viewer orientation controls, and OpenSCAD editor intelligence.

Base checkpoint:

```text
68a89e238bb9b1da9ceebfd64a9dee0858e29321
```

Working branch:

```text
feature/brep-kernel-foundation
```

Implementation must proceed phase-by-phase. Do not interpret approval of this plan as permission to collapse later Grasshopper, Rhino, graph-editor or interoperability phases into the Phase 1 kernel spike.

## Final product goal for this plan

The explicit end goal of this roadmap is:

```text
Brepia Parametric Model
        |
        v
smart parametric Grasshopper object / .gh workflow
        |
        v
Rhino / Grasshopper project model
```

A completed roadmap must therefore allow a Brepia-authored parametric component to be consumed in Grasshopper as a smart parametric object rather than merely as frozen STEP/3DM/BRep geometry.

The intended Grasshopper-side contract is that a Brepia component can expose meaningful inputs such as dimensions, options and placement plane, solve to Rhino geometry, and expose useful project metadata/auxiliary geometry where relevant.

For infrastructure/railway use this enables the product split:

```text
PROJECT / ALIGNMENT LEVEL
Rhino + Grasshopper
- track alignment and profile
- chainage / stationing
- placement planes and offsets
- corridor / clearance logic
- repeated placement and project composition
              |
              | consumes
              v
COMPONENT LEVEL
Brepia
- cabinets
- equipment rooms
- foundations
- cable pits
- posts / brackets / guards
- other reusable parametric project objects
```

Example target:

```text
Track alignment
      |
Station / chainage
      |
Placement plane
      |
[Brepia: Cabinet A42]
  Inputs:
    Width
    Height
    Depth
    Plinth height
    Door count
    Plane
  Outputs:
    Brep geometry
    Footprint
    Clearance envelope
    Maintenance envelope
    Connection / cable points
    Object metadata
      |
      v
Rhino project model
```

The first Grasshopper export does not have to expand every Brepia feature into a visible native Grasshopper node. The preferred first-class target is a smart Brepia Grasshopper component plus a generated `.gh` wrapper/workflow with exposed parameters. Native translation of selected Brepia operations to editable Grasshopper nodes can be added where it provides real value and has a well-defined mapping.

This distinction is important:

- STEP/3DM export transfers geometry;
- the final deliverable of this plan transfers a reusable parametric component contract.

## Strategic recommendation

Brepia should add an open B-Rep CAD foundation based on OpenCascade/OCCT, initially exposed through a constrained server-side build123d-based execution layer, while preserving OpenSCAD as a first-class modeling mode.

Rhino/Grasshopper are an interoperability and project-composition target, not Brepia's mandatory core geometry runtime.

Target architecture:

```text
Brepia UI / AI
       |
       v
Brepia Parametric Model
feature graph / DAG / stable model schema
       |
       +--> OCCT/build123d backend      primary exact B-Rep path
       |
       +--> OpenSCAD                    existing first-class mode
       |
       +--> Grasshopper exporter        roadmap destination
       |       |
       |       +--> smart Brepia GH component
       |       +--> generated .gh workflow
       |       +--> optional native-node mappings
       |
       +--> Rhino.Compute provider      optional solve/validation/provider path
       |
       v
common geometry/result contract
       |
       +--> browser Three.js viewer
       +--> STEP
       +--> STL / mesh outputs
       +--> 3DM interoperability
```

## Why this direction fits Brepia

Brepia is already browser/server oriented and separates user-controlled native geometry work from the application process.

Relevant current architecture:

- React/TanStack Router/React Start browser and server application;
- Three.js/React Three Fiber browser viewer;
- persistent conversations, revisions, parameters and project state;
- normalized multi-file OpenSCAD projects;
- server-side STEP conversion in a rootless, networkless, read-only Podman sandbox;
- STEP conversion already uses scad123d, build123d and OpenCascade/OCCT;
- OpenSCAD remains useful for code-centric CSG and must remain supported.

The BRep path is therefore an evolution of Brepia rather than a replacement of its current product architecture.

## Product model

Long-term modeling modes share workspace, viewer, persistence and AI infrastructure:

```text
OpenSCAD Project
BRep Project
Creative Project
```

A BRep project uses a constrained, versioned Brepia-owned parametric representation rather than arbitrary Python source.

The canonical model must support multiple interaction surfaces without creating separate runtimes:

```text
parameter controls
      ^
      |
node graph <--> Brepia Parametric Model <--> AI editing
      |
      v
Grasshopper export contract
```

## Core architectural principles

### 1. Brepia owns the persisted parametric contract

Do not persist build123d, OCCT or Rhino-specific implementation details as the source of truth unless unavoidable.

The persisted graph must remain kernel/provider neutral enough that Brepia can evaluate it with OCCT and later map it into Grasshopper semantics.

### 2. Published parameters are first-class

A BRep project must explicitly distinguish reusable public parameters from internal feature values.

Published parameter identity must be stable because these parameters will later become:

- Brepia controls;
- AI-editable values;
- Grasshopper component inputs;
- revision/diff anchors.

### 3. Stable feature identity

Nodes/features require stable IDs so AI edits, revisions, selections and future Grasshopper mappings can survive ordinary edits.

### 4. Explicit validated DAG

Dependencies must be explicit, bounded and acyclic with deterministic evaluation.

### 5. No arbitrary Python in the initial architecture

Initial projects compile from the constrained Brepia model into build123d/OCCT operations inside a hardened runtime. An expert code mode, if ever added, is a separate security/product decision.

### 6. Preserve native-execution isolation

User-controlled geometry engines must not execute directly inside the Brepia/Nitro host process.

Carry forward the accepted STEP security posture:

- rootless containerization;
- network disabled;
- read-only root;
- no-new-privileges;
- dropped capabilities;
- bounded CPU/RAM/PIDs/time;
- narrowly mounted inputs/outputs;
- validated result contracts.

### 7. Browser viewer is presentation, not authoritative geometry

Exact BRep evaluation remains server-side initially. Browser-side OCCT/WASM can be evaluated later for low-latency previews.

### 8. Grasshopper integration is an export contract, not a second source of truth

The Brepia model remains canonical. Grasshopper artifacts are generated/packaged interoperability products.

A smart GH component may internally call a Brepia-compatible evaluator or embed/export an evaluated contract, but the original Brepia project remains the authoritative editable model in Brepia.

## Grasshopper / Rhino target

### Smart Grasshopper object

The preferred first Grasshopper product is a reusable component representing one Brepia project object.

A component should eventually support:

- deterministic project/model identity;
- exposed Brepia parameters as typed GH inputs;
- placement `Plane` input;
- Rhino BRep output;
- optional footprint and project envelopes;
- optional connection/mounting/cable points;
- object classification and custom metadata;
- clear version/provider diagnostics.

### Generated `.gh`

Brepia should be able to export a Grasshopper workflow that instantiates the smart component with the correct exposed inputs and metadata.

The `.gh` artifact is intended to let a project team consume the Brepia object directly in normal Rhino/Grasshopper composition workflows.

### Native editable GH translation

Selected Brepia operations may later translate to native Grasshopper/Rhino nodes when mappings are stable and useful.

Do not promise generic lossless conversion of arbitrary Brepia graphs to arbitrary native GH graphs. The smart-component path is the compatibility baseline.

### Rhino.Compute

Rhino.Compute remains useful as an optional provider for:

- Grasshopper solve/compatibility validation;
- RhinoCommon-only operations;
- selected `.gh` execution in Brepia;
- integration tests of generated Grasshopper artifacts.

It must not be required for normal native BRep authoring/evaluation.

### Rhino.Inside

Do not use Rhino.Inside directly as Brepia's primary server integration. Rhino.Compute is the appropriate service boundary if Rhino execution is required.

### rhino3dm / openNURBS

Use rhino3dm primarily for 3DM/NURBS/BRep interoperability and document metadata. Do not treat it as the full modeling kernel.

## Native BRep backend

### build123d + OCCT

Current preferred first backend because it provides true BRep modeling, runs headlessly on Linux, fits the existing sandbox architecture and is already represented in the STEP toolchain.

Initial concerns to prove explicitly:

- pinned runtime packaging;
- topology naming/selection stability;
- deterministic evaluation;
- tessellation/result contract;
- performance/caching;
- direct STEP export.

### Browser OCCT alternatives

RepliCAD, cascade-core and other OCCT-WASM wrappers remain later candidates for preview/local recompute. They are not the authoritative Phase 1 kernel.

## Source and interchange formats

### Canonical source

Use a versioned Brepia-owned JSON-compatible `BrepProject` schema.

STEP, 3DM and GH are outputs/interoperability artifacts, not the canonical Brepia feature graph.

### STEP

Native BRep projects should eventually export STEP directly from the evaluated OCCT model without routing through OpenSCAD/scad123d.

### 3DM

Add selected 3DM import/export after the native BRep result contract is established.

### Grasshopper

The final roadmap output is a smart parametric GH object plus `.gh` workflow packaging, not only 3DM geometry.

## Phase roadmap

### Phase 0 — Architecture closure — complete

Decisions accepted:

- Brepia-owned versioned parametric DAG;
- published parameters and stable feature IDs are first-class;
- server-side OCCT/build123d is the first authoritative BRep backend;
- no arbitrary Python in the normal project format;
- native execution remains sandboxed;
- OpenSCAD remains first-class;
- final roadmap target is Brepia parametric model -> smart Grasshopper parametric object / `.gh` workflow.

Open design details that do not block Phase 1 should be resolved incrementally and documented before their dependent phase starts.

### Phase 1 — Minimal vertical BRep foundation — active

Goal: prove the kernel-neutral model contract before introducing a geometry runtime.

Step 1A — canonical project schema:

- schema versioning;
- bounded project/node/parameter counts;
- stable project, parameter and node IDs;
- explicit published numeric parameters;
- literal or parameter-referenced scalar values;
- minimal nodes: box, cylinder, transform, subtract, fillet;
- semantic edge selector sufficient for the first fillet corpus;
- explicit result node;
- reference validation and DAG/cycle validation;
- deterministic normalized representation;
- focused unit tests.

Step 1B — provider/result interfaces:

- kernel-neutral evaluation request;
- provider identity/version;
- exact BRep/result availability;
- tessellated viewer payload contract;
- warnings/errors/diagnostics;
- stable body/object identity.

Step 1C — isolated OCCT/build123d runtime:

```text
BrepProject JSON
    -> server validation
    -> rootless Podman sandbox
    -> constrained evaluator
    -> build123d / OCCT
    -> exact BRep
    -> tessellated viewer result
    -> direct STEP
```

Acceptance model must include at least an analytic cylindrical hole and a filleted edge.

### Phase 2 — Native BRep project lifecycle

Integrate with conversations, revisions, restore/retry/branch behavior, parameter editing, import/export and project-type selection without regressing OpenSCAD.

### Phase 3 — AI-native BRep editing

AI creates/modifies complete structured BRep snapshots, preserving stable IDs where reasonable and producing meaningful topology/parameter diffs.

### Phase 4 — Brepia graph/editor UX

Expose direct feature/node editing over the same canonical model. The graph is an editor/view, not another runtime.

### Phase 5 — Project-object contract and Rhino interoperability

Define the smart project-object outputs needed by infrastructure workflows:

- primary BRep;
- insertion/local coordinate system;
- footprint;
- clearance envelope;
- maintenance/access envelope;
- connection/mounting/cable points;
- typed metadata/classification.

Add the minimum 3DM/rhino3dm support needed by the Grasshopper path.

### Phase 6 — Grasshopper export contract

Map published Brepia parameters and project-object outputs to a stable Grasshopper-facing schema.

Required concepts:

- numeric/string/boolean/enumeration inputs as supported by Brepia;
- mandatory/standard placement `Plane` semantics;
- parameter IDs separate from display labels;
- units and defaults;
- project/model version identity;
- output typing and metadata;
- errors/warnings visible to the GH user.

### Phase 7 — Smart Brepia Grasshopper component

Provide the reusable Grasshopper-side component/runtime needed to consume a Brepia model as a smart parametric object.

Acceptance requires a representative component such as a cabinet to be parameterized from Grasshopper, placed on arbitrary planes along an alignment-derived workflow and returned as Rhino BRep geometry plus at least one auxiliary project output.

### Phase 8 — `.gh` export/package and end-to-end railway workflow — roadmap completion

Brepia exports a consumable Grasshopper artifact/workflow for a Brepia project object.

End-to-end acceptance scenario:

```text
1. Author a parametric cabinet/equipment-room object in Brepia.
2. Publish dimensions/options as Brepia parameters.
3. Export it for Grasshopper.
4. Open/use the generated .gh workflow in Grasshopper.
5. Feed placement planes derived from railway alignment/profile/chainage logic.
6. Vary Brepia parameters from Grasshopper.
7. Receive correctly placed Rhino BRep geometry.
8. Receive useful project metadata/auxiliary geometry.
9. Re-export a revised Brepia object without redesigning the project-level GH placement logic.
```

This acceptance scenario is the definition of done for this roadmap.

Native editable GH-node translation can continue after this baseline where useful, but it is not required to declare the smart-object interoperability goal achieved.

## Topology and selection

Topology persistence remains a major technical risk. Raw OCCT indices must not become public stable identities.

Research and implementation should prefer combinations of:

- semantic selectors;
- geometric signatures;
- feature provenance;
- persistent naming strategies;
- deterministic ambiguity/failure reporting.

Never silently move a fillet/chamfer to a different feature when a selector becomes ambiguous.

## Deployment

Preferred initial runtime:

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
   - no-new-privileges
   - dropped capabilities
   - bounded resources/time
   - pinned Python/build123d/OCCT
   |
   v
validated exact/render/export result
```

Reuse accepted STEP sandbox patterns while keeping the BRep runtime separately maintainable when least privilege benefits from separation.

## Licensing

Verify exact licenses and deployment terms at dependency pin time.

Inventory must cover at minimum:

- Brepia GPLv3;
- exact build123d release;
- exact OCCT release and Open CASCADE exception terms;
- rhino3dm/openNURBS if introduced;
- Grasshopper/Rhino SDK artifacts used to build the exporter/component;
- Rhino.Compute/Rhino runtime commercial deployment terms if used in CI, validation or production.

## Explicit non-goals for early phases

- replacing OpenSCAD;
- full Rhino parity;
- full Grasshopper parity;
- embedding Rhino desktop;
- Rhino.Inside as the normal host architecture;
- arbitrary Python execution;
- complete sketch constraint solver in Phase 1;
- assemblies in Phase 1;
- browser-authoritative OCCT in Phase 1;
- generic import/conversion of arbitrary Grasshopper graphs into Brepia;
- weakening sandbox/security boundaries.

## Current next action

Implement Phase 1A only: the canonical `BrepProject` model, normalization/validation and focused tests.

Do not introduce build123d/OCCT runtime dependencies until the Phase 1A contract has been reviewed against the final Grasshopper-export goal.