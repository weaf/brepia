# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Step 1 is complete.

Step 2 is complete. The project-native browser OpenSCAD runtime, full multi-file preview/export propagation, bundled-library detection, existing uploaded-STL compatibility bridge, and targeted mobile closeout fixes have all passed automated verification and the real browser/WASM acceptance corpus. The final mobile Share `Generate GIF` → `Download GIF` interaction was manually verified on 2026-09-01.

Current project-native browser-runtime implementation commit:

`e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` — `Make OpenSCAD browser runtime project-native`

Verified automated checkpoint:

`a614006e0491ff1bcf9da7ecdc8e72dabe8c05bf` — `Record project-native browser runtime checkpoint`

Initial mobile closeout fix:

`d98ec055a00acfb0d278dd4922a1021dfa7b954e` — `Fix mobile GIF download and STL picker`

Final GIF user-activation fix:

`af9157635cd0fef0e82e2b4986d1e7377b28760d` — `Make GIF download preserve mobile user activation`

Watermark/export hardening:

`210b98156c6363b718c0b8caee65f96db8311ad0` — `Fix GIF watermark asset handling`

The isolated gate that produced `af9157635cd0fef0e82e2b4986d1e7377b28760d` passed all 400 tests, typecheck, lint, build, explicit two-stage GIF-contract checks, and `git diff --check` before the production commit was created. The ordinary Quality Gate for `210b98156c6363b718c0b8caee65f96db8311ad0` also completed successfully after the final watermark-path/export hardening.

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

## Step 2 — completed: project-aware browser OpenSCAD runtime

### Project reference resolution

`shared/openScadProjectReferences.ts` provides shared OpenSCAD source-reference resolution and validation.

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

Browser OpenSCAD preview/export requests carry the complete normalized `OpenScadProject` snapshot instead of a single source string.

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

The following browser paths preserve and render the complete project:

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

### Mobile closeout fixes

The targeted browser corpus exposed issues outside the project snapshot model itself:

1. Parametric STL upload was already supported internally, but the same picker mixed image MIME types and `.stl`. Android could therefore route to its image picker and hide STL files. Image upload and 3D-file upload are now separate picker actions; the 3D-file action advertises STL MIME/extension variants in Parametric mode while existing post-selection validation remains authoritative. The user manually verified this revised STL upload path works.
2. Share/GIF preview rendered correctly, but mobile `Download GIF` remained a no-op after the first anchor/blob lifetime fix. The remaining failure matched transient user-activation loss: GIF generation is asynchronous and the synthetic anchor click happened several seconds after the original tap. `af9157635cd0fef0e82e2b4986d1e7377b28760d` changes GIF output to a two-stage interaction. The first tap is `Generate GIF` and creates/caches the GIF blob URL. Once generation completes the action becomes `Download GIF`; that second fresh tap performs the anchor click synchronously before any `await`, preserving mobile browser user activation. The prepared blob URL is released after download, model change, or unmount. The same contract is used by the existing Creative `DownloadMenu`, whose old `setTimeout` indirection was removed from the GIF action.
3. The Share preview exposed a malformed watermark asset URL when `BASE_URL` already ended in `/`. `210b98156c6363b718c0b8caee65f96db8311ad0` normalizes the Brepia watermark URL and makes GIF generation tolerate a watermark decode/load failure instead of allowing `drawImage()` to abort the export.

These fixes do not expand the Step 7 asset model. They only make the already-supported v1 mesh-context and GIF flows reachable and reliable on mobile.

## Step 2 automated verification

The isolated migration gate that produced `e26e7e0ee8619c42b3eacb5180e9b6d907ade29a` passed all of the following after the complete runtime migration and mesh-compatibility fix:

- 52 test files passed;
- 400 tests passed;
- typecheck passed;
- lint passed;
- build passed;
- explicit checks confirmed that the migrated worker/runtime no longer uses the old code-only preview/export call paths;
- temporary migration scripts/workflow were removed before the production commit was created.

Because the implementation commit was created by GitHub Actions, its immediate PR workflow required manual action. The subsequent normal branch checkpoint `a614006e0491ff1bcf9da7ecdc8e72dabe8c05bf` triggered the ordinary PR Quality Gate (`run 207`), which independently passed:

- dependency audit;
- all 400 tests;
- typecheck;
- lint;
- build.

The isolated initial mobile closeout gate that produced `d98ec055a00acfb0d278dd4922a1021dfa7b954e` also passed all 400 tests, typecheck, lint and build. Its STL-picker fix was manually verified, but its first GIF-download adjustment was insufficient on the tested mobile browser.

The follow-up isolated GIF user-activation gate that produced `af9157635cd0fef0e82e2b4986d1e7377b28760d` passed:

- all 400 tests;
- typecheck;
- lint;
- build;
- explicit two-stage GIF contract checks for Share and `DownloadMenu`;
- `git diff --check` before commit;
- cleanup of both temporary patch scripts and the one-off workflow before the production commit.

The ordinary Quality Gate for `210b98156c6363b718c0b8caee65f96db8311ad0` (`run 221`) completed successfully, covering dependency audit, tests, typecheck, lint and build after the final watermark/export hardening.

The local container available to this ChatGPT session cannot resolve GitHub, so repository-local `npm` commands are not claimed as local verification. GitHub Actions is the executable code gate for this implementation session.

## Manual Step 2 browser/WASM verification

### Primary multi-file smoke — PASS

The user manually verified a generated three-file Parametric project in the real Brepia browser runtime:

```text
main.scad
parts/body.scad
parts/nested/rib.scad
```

Verified PASS on 2026-09-01:

1. the visible 3D preview rendered successfully with nested `include`/`use` and no missing-file error;
2. changing the entrypoint `width` Customizer parameter updated the model without losing support files;
3. reloading the conversation preserved and re-rendered the project correctly;
4. the message/history thumbnail rendered correctly.

This confirms the real vendored OpenSCAD WASM runtime can mount and resolve the normalized multi-file `/project` hierarchy and that parameter edits/reload/history preserve the complete project snapshot.

### Targeted closeout results

Manual results reported on 2026-09-01:

1. **STL export — PASS.** Export from the working multi-file model succeeded.
2. **Share/GIF preview and download — PASS.** The preview renders correctly, the Brepia watermark loads through the normalized asset path, GIF generation completes, and the explicit `Generate GIF` → `Download GIF` two-tap mobile flow successfully downloads the GIF.
3. **Support-file BOSL2 — PASS.** The user verified a project whose `main.scad` only included `parts/body.scad`, while the support source used the benchmark implementation from `benchmarks/03-hex-bolt-and-nut.scad`. That benchmark imports both `BOSL2/std.scad` and `BOSL2/screws.scad` and rendered successfully, proving bundled-library detection works when BOSL2 is referenced from the support file rather than the entrypoint.
4. **Uploaded STL `import()` regression — PASS.** The separate 3D/STL picker works on the tested mobile browser and the existing Parametric STL flow is reachable again.
5. **Multi-file 2D + DXF export — PASS.** The user confirmed the multi-file DXF case works.

Step 2 acceptance is therefore complete.

## Not completed yet

- Step 3 local directory/multi-file import;
- Step 4 recursive GitHub project dependency resolution;
- Step 5 full multi-file AI/external-agent editing protocol;
- Step 6 complete project snapshots in the local conversation-workspace mirror;
- Step 7 explicit normalized relative assets;
- Step 8 project-aware STEP sandbox input;
- Step 9 project file UX;
- Step 10 final hardening/closeout.

## Next checkpoint

Begin Step 3: local file/folder project import. Reconcile the Step 3 plan against the now-closed Step 2 implementation before changing import behavior, then implement the bounded local directory/multi-file import path while keeping standalone `.scad` import on the same normalized project contract.
