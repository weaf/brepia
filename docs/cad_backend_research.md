# CAD backend research for Brepia

Status: active architecture/product research after Brepia 1.0.

Purpose: identify CAD and geometry engines that could be connected to Brepia **beside** the working OpenSCAD path. This document does not authorize implementation and does not propose replacing OpenSCAD.

## Evaluation criteria

Candidates are assessed for:

- parametric/code-driven modeling;
- exact B-Rep/NURBS geometry versus mesh-only geometry;
- headless/API/CLI automation;
- browser compatibility;
- suitability for AI-generated/editable source;
- local-first deployment and sandboxability;
- import/export, especially STEP;
- assemblies and richer CAD structure;
- licensing/cost;
- integration effort with Brepia's current React/TanStack, worker, conversation-artifact and agent architecture.

## Current Brepia constraints and opportunities

The current Parametric artifact is OpenSCAD-specific at the product layer: it stores `title`, `version` and `code`, while rendering/parameters/export are wired around OpenSCAD semantics. A second engine therefore should not be bolted into the existing artifact by pretending non-SCAD code is SCAD. A future engine-neutral artifact contract should identify the backend/language and let each backend provide validation, preview, parameter extraction and export capabilities.

The current browser OpenSCAD worker already demonstrates a useful pattern: geometry computation is isolated in a Web Worker and the result is rendered in the Brepia viewer. Server-side native STEP conversion already demonstrates the other relevant pattern: untrusted user geometry/code is executed in a constrained rootless Podman sandbox.

Those two patterns should be reused for additional engines.

---

## Tier 1 — strongest candidates

### 1. RepliCAD + OpenCascade.js

**What it is**

RepliCAD is a JavaScript/TypeScript code-CAD library built on OpenCascade through WebAssembly. Its own documentation explicitly positions it as a library for building custom browser CAD editors/configurators, recommends running OpenCascade computation in a Web Worker, integrates with Three.js, and can export STEP and STL.

**Why it fits Brepia unusually well**

- runs in the browser like the current OpenSCAD WASM worker;
- JavaScript/TypeScript is native to Brepia's application stack;
- OpenCascade provides real B-Rep geometry, fillets, chamfers and STEP instead of requiring SCAD -> converter fallback;
- direct Three.js integration is compatible with the existing viewer ecosystem;
- source is plain code and therefore suitable for AI generation, diffing, versioning and project workspaces;
- MIT-licensed RepliCAD; underlying OpenCascade.js is an LGPL OpenCascade port.

**Potential Brepia architecture**

```text
Parametric conversation
  -> backend = replicad
  -> AI emits TypeScript/JavaScript CAD source
  -> dedicated RepliCAD Web Worker
  -> OCCT B-Rep
  -> tessellated preview for viewer
  -> direct STEP/STL export from OCCT
```

A server-side sandboxed runner could later be added for authoritative exports or workloads too large for browser WASM.

**Strengths over OpenSCAD**

- exact B-Rep as the native representation;
- direct STEP output;
- richer fillet/chamfer/surface operations;
- potentially better foundation for assemblies and CAD interchange;
- modern JS/TS source language.

**Weaknesses / risks**

- smaller ecosystem and user base than FreeCAD/OpenSCAD;
- OpenCascade WASM payload and memory use need measurement;
- Brepia would need its own parameter/schema convention rather than OpenSCAD Customizer syntax;
- source/API stability and project maintenance should be validated before committing to a long-lived product backend.

**Assessment:** **Excellent technical fit. Highest-priority prototype candidate for a second native Parametric engine.**

Sources:
- https://replicad.xyz/
- https://replicad.xyz/docs/use-as-a-library
- https://replicad.xyz/docs/api/functions/exportSTEP
- https://github.com/sgenoud/replicad
- https://ocjs.org/

### 2. build123d

**What it is**

A Python parametric B-Rep CAD-as-code framework on OpenCascade/OCCT. It offers modern Python APIs, strong typing/composition, STEP import/export, STL export and assembly support.

**Potential Brepia architecture**

```text
Parametric conversation
  -> backend = build123d
  -> AI emits Python source
  -> sandboxed Python/build123d runner
  -> OCCT B-Rep
  -> STEP + tessellated preview
```

It should run server-side in a sandbox rather than execute arbitrary Python in the Brepia host.

**Strengths**

- exact B-Rep and direct STEP;
- expressive modern Python, very attractive for AI coding agents;
- supports assemblies and richer CAD constructs;
- close to tooling already present in Brepia's STEP provider stack, which uses build123d/OCCT to inspect converted STEP files;
- active documentation and modern design.

**Weaknesses / risks**

- arbitrary Python requires a strict sandbox and controlled filesystem/network policy;
- no browser-native path comparable to RepliCAD;
- parameter UI needs a Brepia schema/convention;
- preview requires tessellation/serialization back to the browser.

**Assessment:** **Excellent server-side CAD-as-code candidate; likely strongest Python option for new work.**

Sources:
- https://build123d.readthedocs.io/en/stable/
- https://build123d.readthedocs.io/en/stable/import_export.html

### 3. CadQuery

**What it is**

A mature Python parametric CAD-as-code framework using OpenCascade. Supports STEP, DXF, STL, 3MF, glTF and other exports; assemblies can be exported as STEP.

**Strengths**

- mature and widely used code-CAD ecosystem;
- exact B-Rep;
- strong STEP and assembly support;
- extensive examples and AI-training exposure, which may help code generation quality;
- straightforward sandboxed CLI/Python execution model.

**Weaknesses / risks**

- arbitrary Python sandboxing requirement;
- server-side only for realistic Brepia integration;
- API style is somewhat more state/workplane-oriented than build123d;
- choosing both build123d and CadQuery as first-class engines would duplicate much of the same OCCT/Python capability.

**Assessment:** **Excellent candidate, but for a first Python B-Rep backend choose build123d or CadQuery after a focused code-generation benchmark rather than supporting both immediately.**

Sources:
- https://cadquery.readthedocs.io/en/latest/quickstart.html
- https://cadquery.readthedocs.io/en/latest/importexport.html

### 4. FreeCAD

**What it is**

A full open-source desktop CAD system built around OpenCascade with Python scripting, Part/PartDesign/Sketcher workbenches, STEP support and a large interoperability ecosystem.

**Best Brepia role**

FreeCAD is more attractive as a **native CAD automation/interoperability backend** than as the first replacement code language for OpenSCAD.

Possible integrations:

- sandboxed/headless FreeCAD Python execution;
- import/export and healing of STEP/FCStd assets;
- creation or modification of FreeCAD documents through controlled Python scripts;
- external “open/edit in FreeCAD” workflows;
- future conversion from Brepia project artifacts into richer CAD documents.

**Strengths**

- full CAD application rather than just a geometry library;
- exact B-Rep and constraints;
- broad format interoperability;
- Python automation;
- open source and local-first;
- can preserve document-level CAD concepts that simpler code-CAD libraries do not expose.

**Weaknesses / risks**

- much heavier runtime footprint;
- headless workflows can still pull in substantial application/runtime complexity;
- scripting API and workbench/document semantics are more complex for an LLM than a narrowly designed CAD-as-code DSL;
- version/plugin compatibility needs careful pinning.

**Assessment:** **Very valuable integration target, especially for interoperability and advanced CAD documents, but probably not the first second-engine implementation.**

---

## Tier 2 — valuable complementary engines

### 5. Rhino + Grasshopper + Rhino Compute

Rhino Compute exposes Rhino/Grasshopper geometry through a stateless REST API. Current McNeel documentation states that Compute can run on Windows and Linux servers, execute Grasshopper definitions, manipulate 3DM and other file types, and expose 2400+ RhinoCommon geometry operations. Developer APIs are MIT-licensed, but the Rhino runtime itself has commercial licensing/deployment requirements.

**Possible Brepia role**

```text
Brepia
  -> optional Rhino provider
  -> Rhino Compute REST
  -> RhinoCommon or Grasshopper definition
  -> 3DM / STEP / mesh results
```

This could enable extremely capable NURBS/surface and Grasshopper workflows without making Rhino mandatory for normal Brepia installs.

**Strengths:** world-class NURBS/surface tooling, Grasshopper ecosystem, Linux Compute support, broad professional CAD adoption.

**Risks:** commercial licensing and deployment management; plugins may add their own licensing; not suitable as Brepia's mandatory local open-source core.

**Assessment:** **Excellent optional professional provider.**

Sources:
- https://developer.rhino3d.com/en/guides/compute/features/
- https://developer.rhino3d.com/en/license/

### 6. Blender

Blender provides mature Python scripting and official background/headless execution (`--background`). Geometry Nodes adds powerful procedural modeling.

**Best role in Brepia:** complement, not substitute, for engineering B-Rep CAD.

Potential uses:

- procedural/organic mesh generation;
- geometry-node pipelines;
- remeshing, modifiers, decimation and mesh repair;
- material/UV/render operations;
- conversion and post-processing of Creative output;
- scripted scene/assembly visualization.

**Strengths:** huge ecosystem, excellent mesh/procedural tools, local/open-source, strong Python automation.

**Weaknesses:** mesh-first workflow is not equivalent to exact mechanical B-Rep/STEP modeling; arbitrary Python requires sandboxing; Blender runtime is heavy.

**Assessment:** **High-value Creative/mesh companion backend, not the primary replacement for OpenSCAD.**

Source:
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html

### 7. JSCAD

JSCAD is an open-source modular JavaScript code-CAD system that runs in browser, Node.js and CLI. It supports parameterized reproducible designs and multiple output formats.

**Strengths:** easy JS integration, browser/Node execution, MIT license, very natural AI/code workflow, multiple files supported.

**Weaknesses:** primarily polygonal/CSG output rather than a native OCCT B-Rep model; weaker professional CAD/STEP path than RepliCAD/build123d/CadQuery.

**Assessment:** **Technically easy and useful, but RepliCAD offers a more compelling browser-native second engine because it adds B-Rep/STEP capability rather than mostly overlapping OpenSCAD's CSG niche.**

Sources:
- https://jscad.app/docs/
- https://jscad.app/docs/tutorial-01_gettingStarted.html

### 8. Zoo KCL

KCL is a modern text-based parametric CAD language. It supports named dimensions, formulas, constraints, modules/multi-file projects and version-control-friendly text. Zoo's CLI can export KCL to STEP, STL, OBJ, GLB, glTF, FBX and PLY.

**Strengths:** purpose-built modern CAD DSL; very attractive syntax for AI generation; first-class project/module model; direct STEP export; API/CLI tooling.

**Important caveat:** the normal CLI execution/export path uses Zoo's API/geometry infrastructure rather than providing the same local, fully self-contained geometry kernel model as OpenSCAD/RepliCAD/build123d.

**Assessment:** **Interesting optional hosted code-CAD provider, especially for benchmarking language ergonomics, but not ideal as Brepia's default local second engine.**

Sources:
- https://zoo.dev/docs/kcl
- https://docs.zoo.dev/docs/kcl-lang/modules
- https://zoo.dev/docs/developer-tools/cli/manual/zoo_kcl_export

---

## Tier 3 — specialist / exploratory candidates

### OpenCascade.js directly

OpenCascade.js exposes OCCT to JavaScript/WASM. Brepia could theoretically build directly on it, but RepliCAD provides a much more ergonomic code-CAD abstraction. Direct OCCT bindings make sense only for operations not exposed by RepliCAD or for a custom lower-level geometry service.

### libfive

Functional-representation/implicit solid modeling with C/C++ infrastructure plus language bindings. Its feature-preserving manifold meshing is interesting for smooth procedural/implicit shapes.

Best role: specialist implicit modeling or Creative-to-procedural experiments, not mainstream exact B-Rep CAD.

Source: https://github.com/libfive/libfive

### BRL-CAD

Long-lived open-source CSG system with extensive command-line tools, libraries and scripting. Robust and technically capable, but its workflow/ecosystem is less aligned with Brepia's modern browser and AI-CAD UX than newer code-CAD options.

Best role: specialist CSG/interoperability research rather than priority product backend.

Source: https://brl-cad.github.io/docs/wiki/Overview.html

### SolveSpace

Constraint-based parametric CAD with a compact native core and useful sketch/constraint concepts. Worth monitoring for constrained sketch workflows or solver reuse, but less straightforward as a modern server/browser scripting backend than OCCT-based candidates.

### Manifold

High-performance manifold mesh boolean library. OpenSCAD itself already uses the Manifold backend in Brepia's browser worker. Manifold is therefore better considered a geometry primitive/acceleration component than a separate user-facing CAD language.

### Raw OCCT / pythonOCC

Maximum control over B-Rep and STEP, but a very low-level API for AI-generated models. Prefer build123d/CadQuery/FreeCAD/RepliCAD unless Brepia needs operations unavailable through those abstractions.

### Fornjot / Truck / newer Rust CAD kernels

Interesting long-term projects for native/WASM CAD kernels, but currently higher ecosystem/maturity risk than OCCT-based choices. Monitor rather than prioritize.

### Autodesk Fusion / Inventor automation and Onshape

Potential professional cloud/integration providers through vendor APIs, but proprietary accounts, licensing, cloud dependency and API constraints make them better future interoperability connectors than Brepia core geometry engines.

---

## Recommended architecture: engine registry, not replacement

If Brepia adds another Parametric engine, the architecture should become explicit rather than adding backend-specific conditionals throughout the OpenSCAD flow.

Suggested conceptual contract:

```text
ParametricBackend
  id
  sourceLanguage
  executionLocation: browser | sandbox | remote
  validate(project)
  build(project, parameters)
  extractParameters(project)
  preview(result)
  export(result, format)
  capabilities
```

Possible capability flags:

```text
exactBrep
mesh
step
stl
dxf
scad
assemblies
multiFile
externalAssets
constraints
colors
materials
browserExecution
```

A future artifact should identify its backend explicitly, for example conceptually:

```text
ParametricArtifact
  backend: openscad | replicad | build123d | ...
  language
  entrypoint
  project files
  parameters/schema
  version
```

This must be designed carefully during a dedicated implementation plan; it is not a request to change the existing v1 contract now.

## Security model

### Browser engines

RepliCAD/JSCAD-style code should run in a dedicated Worker with bounded resources and a deliberately narrow API. Avoid evaluating arbitrary application JavaScript with DOM/network access.

### Python/native engines

build123d, CadQuery, FreeCAD and Blender scripts must never execute directly inside the Brepia/Nitro host. Reuse the STEP sandbox principles:

- rootless container;
- no network by default;
- read-only root filesystem;
- capability drop / no-new-privileges;
- strict CPU/RAM/PID/time limits;
- normalized project input only;
- dedicated output directory;
- validate output before ingesting it.

### Remote commercial/cloud engines

Rhino Compute, Zoo, Autodesk/Onshape-style providers should use explicit provider adapters with server-only credentials, bounded request contracts and clear indication to the user that geometry is sent to an external service.

## Recommended priority

For a future second Parametric engine investigation:

1. **RepliCAD proof-of-concept** — best architectural fit with Brepia's existing browser worker/viewer stack and adds native B-Rep/STEP.
2. **build123d vs CadQuery benchmark** — compare LLM code-generation reliability, editability, performance and failure recovery in an isolated server runner.
3. **FreeCAD interoperability prototype** — focus on document/STEP/FCStd exchange rather than trying to make FreeCAD the default source language.
4. **Blender companion adapter** — investigate Creative mesh/post-processing workflows separately from engineering Parametric CAD.
5. **Rhino/Grasshopper Compute provider** — optional professional integration if licensing/deployment is acceptable.
6. **KCL provider experiment** — evaluate modern CAD-language ergonomics and quality while retaining local-first core engines.

## Suggested benchmark before choosing an engine

Use the same model corpus for OpenSCAD, RepliCAD, build123d and CadQuery:

- simple bracket with holes/fillets;
- enclosure with lid and tolerance parameters;
- threaded or repeated geometry;
- lofted/curved object;
- multi-body/assembly-like object;
- model imported/exported through STEP;
- multi-file reusable library example.

Measure:

- first-pass AI success rate;
- number of repair turns;
- compile/build time;
- memory footprint;
- exact STEP quality;
- parameter extraction effort;
- source readability and editability;
- ability to preserve identity across follow-up edits;
- sandbox complexity;
- viewer integration effort.

This benchmark is more useful than choosing an engine from feature lists alone.

## Current conclusion

OpenSCAD should remain Brepia's stable Parametric engine.

The strongest **new** engine opportunity is not FreeCAD or Blender directly. It is **RepliCAD/OpenCascade.js** because it provides browser-native CAD-as-code with exact B-Rep and STEP while matching Brepia's existing Web Worker/Three.js architecture unusually well.

For a server-side engine, **build123d and CadQuery** are the strongest candidates and should be benchmarked against each other before choosing one. **FreeCAD** is especially valuable as a broad interoperability/document backend. **Blender** is best treated as a Creative/mesh companion. **Rhino/Grasshopper** is a strong optional professional provider rather than a core dependency.
