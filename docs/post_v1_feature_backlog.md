# Brepia post-1.0 feature backlog

This document is the active high-level backlog for product capabilities considered after Brepia 1.0.

It is intentionally separate from historical `*_plan.md`, `*_status.md`, checkpoint and handover documents. Those files remain historical evidence unless a future task explicitly selects them.

No item below is an implementation commitment. Selected capabilities should receive their own scoped plan and branch from the then-current `master`.

## Current roadmap priority

### 1 — Multi-file OpenSCAD / project workspaces

Extend the existing single-file OpenSCAD workflow into normalized project workspaces that can safely contain multiple `.scad` files and explicitly supported assets.

Potential value:

- support real-world `include` / `use` project structures beyond the bundled BOSL/BOSL2/MCAD libraries;
- support controlled `import()` / `surface()` assets;
- make local-file and GitHub project import more useful;
- give AI agents a coherent project-level editing context;
- provide the same normalized input to STEP conversion without widening sandbox access to arbitrary host paths.

This should be treated as a workspace/security architecture feature, not merely a file-picker enhancement.

The workspace abstraction should be designed so it can later carry non-OpenSCAD project files without forcing a second incompatible project model.

### 2 — Rhino / Grasshopper integration

Make Rhino/Grasshopper the next major Brepia capability after multi-file OpenSCAD.

The preferred integration direction is a provider architecture around Rhino Compute, RhinoCommon and Grasshopper rather than embedding Rhino-specific assumptions throughout the existing OpenSCAD path.

Target capabilities to investigate and scope in a dedicated plan:

- execute controlled Grasshopper definitions from Brepia with typed parameters;
- use RhinoCommon/Rhino Compute geometry operations for professional NURBS and B-Rep workflows;
- support 3DM as a first-class Rhino interchange artifact alongside STEP and mesh outputs;
- preview returned geometry in Brepia while preserving the Rhino/Grasshopper source artifact for follow-up edits;
- allow AI agents to create, parameterize and revise Rhino/Grasshopper-backed models through the existing conversation/session architecture;
- define local/server deployment, authentication, licensing and plugin constraints explicitly before implementation;
- keep Rhino optional so a normal Brepia installation does not require a commercial Rhino runtime.

This is a strategic product priority even though RepliCAD/build123d may remain technically attractive future local CAD engines.

### 3 — Local Creative semantic editing

Investigate genuine follow-up editing of locally generated Creative meshes, especially TRELLIS.2 output.

Target interaction examples:

- “make the legs longer but preserve the rest”;
- “remove this feature without changing the overall object”;
- “make this area thicker while retaining identity and material appearance”.

The feasibility study must distinguish true geometry/identity-preserving editing from merely changing the conditioning image and regenerating a different mesh.

### 4 — Revision and variant UX

Expose the existing conversation/message tree more clearly instead of inventing a second versioning model.

Potential capabilities:

- visual branch/variant navigation;
- compare two revisions;
- name or bookmark variants;
- explicit “branch from here” actions;
- easier restore and branch switching.

The current persistence tree remains authoritative.

### 5 — Multi-reference / multi-view Creative input

Investigate Creative generation using more than one reference image, for example front/side/back views or multiple contextual images.

This should only become an implementation plan after confirming backend support and expected quality improvements.

### 6 — Additional parametric/CAD engines beside OpenSCAD

Keep OpenSCAD as the stable existing Parametric engine while retaining research into additional geometry engines as parallel future backends.

The current research shortlist and integration strategy are documented in `docs/cad_backend_research.md`.

Technical candidates retained for later evaluation:

1. RepliCAD / OpenCascade.js for browser-native B-Rep CAD;
2. build123d for Python/OCCT server-side CAD-as-code;
3. CadQuery for mature Python/OCCT parametric CAD;
4. FreeCAD for broad desktop/native CAD interoperability and automation;
5. Blender as a complementary procedural/mesh/visual geometry engine;
6. JSCAD as a lightweight browser/Node code-CAD option;
7. Zoo KCL as an optional modern hosted code-CAD provider.

Rhino/Grasshopper is intentionally no longer buried in this generic engine shortlist: it is roadmap item 2 and should receive its own product/architecture plan after item 1.

Do not replace the working OpenSCAD path as part of evaluating these engines.

### 7 — Expanded CAD agent tools

Build future agent capability on top of the existing persistent OpenCode/Codex transport and Brepia artifact contracts rather than creating another agent transport.

Potential tools include controlled project-file operations, geometry validation, measurements, export checks and backend-specific build/validation adapters.

### 8 — Deeper STEP/CAD interoperability

Possible later work:

- assemblies and multiple bodies;
- part names / metadata;
- richer STEP structure;
- improved import/export round-tripping;
- receiving-CAD compatibility gates.

Multi-file/project workspace support is a prerequisite for several of these workflows.

## Selection rule

Before implementing any backlog item:

1. reconcile the idea against current `master` and current architecture docs;
2. perform any required technical feasibility research;
3. choose a bounded product scope;
4. create a dedicated plan document;
5. create a dedicated branch from updated `master`;
6. preserve stable OpenSCAD, Creative and runtime behavior unless the selected feature explicitly changes it.
