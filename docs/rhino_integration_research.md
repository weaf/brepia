# Rhino / Grasshopper integration research

Status: strategic post-1.0 research.

Roadmap position: **the next major Brepia capability after multi-file OpenSCAD / normalized project workspaces**.

This document narrows the broader CAD backend research into a dedicated Rhino 8 integration direction. It does not authorize implementation. A dedicated implementation plan and branch should be created after roadmap item 1 is complete and reconciled against then-current `master`.

## Known project licensing

The project has access to a **Rhino 8 desktop license**.

That is an important advantage for development and testing, but it must not be confused with Rhino.Compute production/server licensing.

Current McNeel licensing guidance distinguishes these cases:

- Rhino.Compute running locally on a normal Windows computer can use the existing Rhino desktop license and does not add Compute usage charges.
- Windows Server and Linux Server Compute deployments use McNeel Core-Hour Billing rather than the desktop license.
- A Core-Hour Billing token must be treated as a secret because possession of the token can incur charges.

Official references:

- https://developer.rhino3d.com/en/guides/compute/compute-faq/
- https://developer.rhino3d.com/en/guides/compute/deploy-to-iis/
- https://developer.rhino3d.com/guides/compute/core-hour-billing/

## Recommended initial deployment topology

Because a Rhino 8 desktop license is already available, the preferred development path is:

```text
Brepia
  -> Rhino provider adapter
  -> Rhino.Compute on a normal Windows workstation
  -> existing Rhino 8 desktop license
  -> RhinoCommon / Grasshopper
  -> 3DM / STEP / preview geometry
```

This gives Brepia a realistic Rhino environment without committing to paid server Compute during early development.

The provider boundary should nevertheless be network/API based from the beginning so that the execution host can later be replaced by:

- another Windows workstation;
- Windows Server with Core-Hour Billing;
- Linux Rhino.Compute with Core-Hour Billing;
- a separately managed Rhino.Compute endpoint.

Brepia should therefore depend on a **Rhino provider contract**, not on Rhino being installed on the Brepia application host.

## Linux status

Rhino.Compute now has an official Linux route, including Ubuntu Server 24.04 and AmazonLinux 2023, but McNeel currently labels it work-in-progress and does not recommend it for production use yet.

Known current limitations include work in progress around:

- RhinoCode-enabled Grasshopper script components;
- file import/export beyond 3DM;
- third-party plug-in management.

For that reason, the existing Windows desktop Rhino 8 license is the better first integration environment even though Brepia itself is Linux-oriented.

Official reference:

- https://developer.rhino3d.com/guides/compute/compute-linux-getting-started/

## Strategic role in Brepia

Rhino should be treated as a first-class optional professional CAD provider, not simply another OpenSCAD syntax alternative.

The integration can add capabilities that materially extend Brepia:

- Rhino NURBS, curves, surfaces, meshes and solids;
- RhinoCommon geometry operations;
- Grasshopper parametric definitions;
- 3DM document interoperability;
- STEP and mesh exchange;
- advanced professional CAD workflows while preserving OpenSCAD as the default local/open Parametric path.

Conceptually:

```text
Brepia conversation/project
  -> Rhino provider adapter
  -> Rhino.Compute
     -> RhinoCommon operations
     -> Grasshopper definitions
  -> 3DM / STEP / preview mesh
  -> Brepia viewer + artifact history
```

## Recommended implementation sequence after item 1

### Rhino phase A — provider foundation

Create the smallest reliable provider contract before exposing advanced modeling features.

Scope:

- administrator-configured Rhino.Compute endpoint;
- server-side API-key/credential handling;
- health and capability detection;
- Rhino version reporting;
- explicit unavailable/disabled states;
- no OpenSCAD regression when Rhino is not configured;
- deployment topology documented separately from modeling features.

### Rhino phase B — Grasshopper definition execution

Start with execution of existing Grasshopper definitions rather than attempting to make an AI generate arbitrary binary `.gh` graphs immediately.

Scope candidates:

- project can contain a Grasshopper definition as an explicitly typed artifact;
- inspect/expose supported Grasshopper input parameters;
- send typed parameters to Rhino.Compute;
- receive geometry/results;
- produce preview geometry for the existing Brepia viewer;
- retain the definition + parameter state in conversation/project history;
- export useful results such as 3DM, STEP and mesh where supported by the workflow.

This produces a useful Rhino/Grasshopper product capability before solving AI graph authoring.

### Rhino phase C — AI-authored Rhino geometry

Evaluate source forms that are genuinely suitable for LLM generation and revision.

Candidates include:

- RhinoCommon operations through a constrained Brepia tool layer;
- Rhino Python scripts executed in a controlled Rhino context;
- C# scripting where appropriate;
- controlled generation/modification of Grasshopper definitions only after a reliable representation is selected.

The important product requirement is that follow-up turns edit an identifiable Rhino-backed artifact rather than regenerate unrelated geometry.

### Rhino phase D — richer interoperability

Later possibilities:

- 3DM import/export as a first-class project artifact;
- named layers/objects and metadata;
- richer document structures;
- Grasshopper plugin support with explicit allowlists and deployment checks;
- bidirectional workflows with desktop Rhino;
- receiving-CAD compatibility tests for STEP and 3DM.

## Relationship to roadmap item 1

The multi-file OpenSCAD work should avoid introducing a workspace model that is permanently `.scad`-specific.

A normalized Brepia project workspace should be able to evolve from something conceptually like:

```text
project
  entrypoint
  files[]
  assets[]
  metadata
```

into engine-specific projects such as:

```text
OpenSCAD project
  main.scad
  lib/*.scad
  assets/*

Rhino / Grasshopper project
  definition.gh or definition.ghx
  referenced assets
  parameter schema
  optional 3DM artifact
```

Item 1 should not implement Rhino support, but it should avoid architectural choices that make item 2 unnecessarily difficult.

## Artifact direction

Rhino should fit a future provider-neutral artifact model rather than overloading the current OpenSCAD `code` field.

Conceptually:

```text
ParametricArtifact
  backend
  representation
  entrypoint
  project files/assets
  parameter schema/state
  generated geometry references
  version
```

For Rhino, the representation may differ by workflow:

- Grasshopper definition + parameters;
- Rhino script/source + parameters;
- 3DM document/artifact;
- provider-generated geometry result.

The implementation plan should define explicit artifact types instead of pretending every Rhino workflow is a source-code file.

## Security and operational constraints

Required principles:

- Rhino endpoint credentials remain server-side;
- administrator explicitly enables/configures the provider;
- remote/external execution is visible in settings/status;
- requests and outputs are bounded and validated;
- plugin use is allowlisted rather than arbitrary;
- timeouts and output-size limits are enforced;
- no Rhino dependency is required for installations that only use OpenSCAD or Creative;
- licensing tokens and API keys never enter conversation artifacts or client-visible state.

## Current decision

The roadmap order is now:

1. **Multi-file OpenSCAD / normalized project workspace**.
2. **Rhino 8 / Grasshopper integration**, initially developed against Rhino.Compute on a normal Windows workstation using the existing Rhino 8 desktop license.
3. Other post-v1 capabilities and alternate CAD engines follow according to the active backlog.

RepliCAD, build123d, CadQuery and FreeCAD remain valuable future candidates, but they are not the next major integration ahead of Rhino.
