# Brepia post-1.0 feature backlog

This document is the active high-level backlog for product capabilities considered after Brepia 1.0.

It is intentionally separate from historical `*_plan.md`, `*_status.md`, checkpoint and handover documents. Those files remain historical evidence unless a future task explicitly selects them.

No item below is an implementation commitment. Selected capabilities should receive their own scoped plan and branch from the then-current `master`.

## Current priorities

### A — Multi-file OpenSCAD / project workspaces

Extend the existing single-file OpenSCAD workflow into normalized project workspaces that can safely contain multiple `.scad` files and explicitly supported assets.

Potential value:

- support real-world `include` / `use` project structures beyond the bundled BOSL/BOSL2/MCAD libraries;
- support controlled `import()` / `surface()` assets;
- make local-file and GitHub project import more useful;
- give AI agents a coherent project-level editing context;
- provide the same normalized input to STEP conversion without widening sandbox access to arbitrary host paths.

This should be treated as a workspace/security architecture feature, not merely a file-picker enhancement.

### A — Local Creative semantic editing

Investigate genuine follow-up editing of locally generated Creative meshes, especially TRELLIS.2 output.

Target interaction examples:

- “make the legs longer but preserve the rest”;
- “remove this feature without changing the overall object”;
- “make this area thicker while retaining identity and material appearance”.

The feasibility study must distinguish true geometry/identity-preserving editing from merely changing the conditioning image and regenerating a different mesh.

### B — Revision and variant UX

Expose the existing conversation/message tree more clearly instead of inventing a second versioning model.

Potential capabilities:

- visual branch/variant navigation;
- compare two revisions;
- name or bookmark variants;
- explicit “branch from here” actions;
- easier restore and branch switching.

The current persistence tree remains authoritative.

### B — Multi-reference / multi-view Creative input

Investigate Creative generation using more than one reference image, for example front/side/back views or multiple contextual images.

This should only become an implementation plan after confirming backend support and expected quality improvements.

### B — Additional parametric/CAD engines beside OpenSCAD

Keep OpenSCAD as the stable existing Parametric engine while investigating additional geometry engines as parallel backends.

The current research shortlist and integration strategy are documented in `docs/cad_backend_research.md`.

Initial leading candidates:

1. RepliCAD / OpenCascade.js for browser-native B-Rep CAD;
2. build123d for Python/OCCT server-side CAD-as-code;
3. CadQuery for mature Python/OCCT parametric CAD;
4. FreeCAD for broad desktop/native CAD interoperability and automation;
5. Rhino/Grasshopper Compute as an optional commercial remote/local service;
6. Blender as a complementary procedural/mesh/visual geometry engine;
7. JSCAD as a lightweight browser/Node code-CAD option;
8. Zoo KCL as an optional modern hosted code-CAD provider.

Do not replace the working OpenSCAD path as part of evaluating these engines.

### B/C — Expanded CAD agent tools

Build future agent capability on top of the existing persistent OpenCode/Codex transport and Brepia artifact contracts rather than creating another agent transport.

Potential tools include controlled project-file operations, geometry validation, measurements, export checks and backend-specific build/validation adapters.

### C — Deeper STEP/CAD interoperability

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
