# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Step 1 is complete.

Step 2 implementation is complete and has passed the isolated full code quality gate. A real browser/WASM multi-file smoke test is still required before Step 2 is considered product-verified and closed.

Current project-native browser-runtime implementation commit:

`e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` — `Make OpenSCAD browser runtime project-native`

## Step 1 — completed

- product decision recorded: no persisted Brepia 1.0 Parametric artifact compatibility requirement;
- `ParametricArtifact` stores `{ title, version, project }` and has no duplicated top-level `code` field;
- `build_parametric_model` validates the project-native artifact schema;
- `shared/openScadProject.ts` defines normalized project/file types and helpers;
- project paths are relative and canonicalized to `/`;
- absolute paths, drive paths, traversal segments, empty segments and control characters are rejected;
- duplicate paths and case-only collisions are rejected;
- `.scad` source-only schema established for the first project phase;
- explicit bounds are enforced: 64 files, 256,000 UTF-8 bytes per file, 1,048,576 UTF-8 bytes per project, 512 path characters, 128 characters per path segment and 16 path segments;
- the declared entrypoint must exist and contain source;
- project files normalize into deterministic path order;
- entrypoint access/replacement is centralized through project helpers;
- single-file local/GitHub SCAD imports persist as one-file project snapshots;
- current external OpenCode/Codex code-result adapters wrap returned source as one-file `main.scad` projects pending the full multi-file agent protocol in Step 5;
- Editor, Share, ChatSession, MessageBubble, VisualCard, parameter editing and conversation-workspace entrypoint extraction no longer depend on persisted `artifact.code`.

Step 1 full PR quality gate:

- 51 test files passed;
- 391 tests passed;
- typecheck passed;
- lint passed;
- build passed.

## Step 2 — implementation complete, browser smoke pending

### Project reference resolution

`shared/openScadProjectReferences.ts` now provides shared OpenSCAD source-reference resolution and validation.

Implemented behavior:

- static `include` and `use` references are scanned across every project `.scad` source;
- comments and string literals do not create false dependencies;
- relative references resolve from the calling `.scad` file;
- `..` is accepted only when normalization remains inside the project root;
- attempts to escape the project root are rejected before OpenSCAD executes;
- missing project-local static dependencies fail deterministically;
- BOSL, BOSL2 and MCAD references are recognized as bundled-library references rather than project-local files;
- bundled-library detection scans support files as well as the entrypoint.

Focused reference tests cover nested dependencies, parent/sibling resolution, traversal rejection, missing files, comments/strings and support-file BOSL2 detection.

### Browser worker/runtime

Browser OpenSCAD preview/export requests now carry the complete normalized `OpenScadProject` snapshot instead of a single source string.

For every preview/export:

1. the worker normalizes and validates the complete project at the boundary;
2. a fresh OpenSCAD WASM instance gets a fresh `/project` tree;
3. every project source is mounted at `/project/<normalized-path>`;
4. the actual `/project/<entrypointPath>` is executed;
5. bundled libraries required anywhere in the project are loaded;
6. existing manifold/lazy-union colored STL + OFF preview behavior is preserved;
7. output limits and worker timeout/reset behavior remain in place.

The project source tree is reconstructed from each request. Project source left by a previous model, branch, conversation or compile cannot become an implicit dependency of the next compile.

### Runtime consumers

The following browser paths now preserve and render the complete project:

- live desktop/mobile Parametric viewer;
- tool-call compile/inspection preview;
- message thumbnails;
- history/VisualCard preview regeneration;
- share/GIF preview, including the mobile ChatTitle share path;
- STL/browser export path;
- DXF export path.

DXF keeps support files intact: Brepia wraps only the entrypoint with the projection source, replaces that entrypoint in a copy of the project, and exports the complete project snapshot.

### Existing uploaded mesh compatibility

General project asset support remains deferred to Step 7, but the existing v1 uploaded-mesh behavior must not regress merely because the entrypoint moved from `/input.scad` to `/project/<entrypointPath>`.

The existing external mesh cache is therefore still separate from the project artifact. During a compile, cached mesh basenames are mirrored beside the entrypoint inside the fresh WASM `/project` tree so existing `import("mesh.stl")` usage keeps its entrypoint-relative OpenSCAD semantics. Collisions with project source paths fail explicitly.

This is a compatibility bridge for the existing mesh-upload flow, not the generalized relative-asset architecture planned for Step 7.

## Step 2 automated verification

The isolated migration gate that produced `e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` passed all of the following after the complete runtime migration and mesh-compatibility fix:

- 52 test files passed;
- 400 tests passed;
- typecheck passed;
- lint passed;
- build passed;
- explicit checks confirmed that the migrated worker/runtime no longer uses the old code-only preview/export call paths;
- temporary migration scripts/workflow were removed before the production commit was created.

The bot-created commit could not itself satisfy the normal PR Actions policy (`action_required`), so this status update intentionally creates a normal branch commit and triggers the regular PR Quality Gate against the resulting branch HEAD.

The local container available to this ChatGPT session cannot resolve GitHub, so repository-local `npm` commands are not claimed as local verification. GitHub Actions is the executable code gate for this implementation session.

## Manual Step 2 browser/WASM smoke still required

Automated TypeScript/Vitest/build coverage does not prove that the vendored OpenSCAD WASM build resolves a real multi-file `/project` hierarchy correctly in the browser. Before Step 2 is closed, manually verify a real generated project containing at least:

```text
main.scad
parts/body.scad
parts/nested/rib.scad
```

Required smoke checks:

- visible 3D preview succeeds with nested `include`/`use`;
- an editable entrypoint parameter recompiles the same project without losing support files;
- conversation reload still renders the project;
- history/thumbnail regeneration works;
- STL export works;
- share/GIF preview works;
- one support file using BOSL2 proves whole-project bundled-library detection;
- existing uploaded mesh + `import("filename.stl")` remains functional.

A 2D corpus should also verify DXF after the 3D smoke.

## Not completed yet

- Step 2 manual browser/WASM smoke;
- Step 3 local directory/multi-file import;
- Step 4 recursive GitHub project dependency resolution;
- Step 5 full multi-file AI/external-agent editing protocol;
- Step 6 complete project snapshots in the local conversation-workspace mirror;
- Step 7 explicit normalized relative assets;
- Step 8 project-aware STEP sandbox input;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next checkpoint

1. confirm the regular PR Quality Gate is green on the status-update HEAD;
2. run the manual browser/WASM Step 2 corpus;
3. if the smoke passes, mark Step 2 complete and continue with Step 3 local file/folder project import.
