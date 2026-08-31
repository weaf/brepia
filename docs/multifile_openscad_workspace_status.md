# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

## Current checkpoint

Step 1 is in progress.

Completed foundation:

- product decision recorded: no persisted Brepia 1.0 Parametric artifact compatibility requirement;
- project-native OpenSCAD representation selected;
- `shared/openScadProject.ts` added with the normalized project/file types;
- project paths are relative and canonicalized to `/`;
- absolute paths, drive paths, traversal segments, empty segments and control characters are rejected;
- duplicate paths and case-only collisions are rejected;
- `.scad` source-only schema established for the first phase;
- explicit bounds established: 64 files, 256,000 UTF-8 bytes per file, 1,048,576 UTF-8 bytes per project, 512 path characters, 128 characters per path segment and 16 path segments;
- the declared entrypoint must exist and contain source;
- project files normalize into deterministic path order;
- focused Vitest coverage added for the validation rules and project file replacement helper.

Not completed yet:

- `ParametricArtifact` still uses the old single `code` field in live application code;
- `build_parametric_model` still uses the old single-source schema;
- UI, agent, import, conversation workspace and export consumers still read `artifact.code`;
- browser OpenSCAD worker execution is not project-aware yet;
- local/GitHub multi-file import is not implemented yet;
- STEP still accepts one source string.

## Next implementation checkpoint

Finish Step 1 by replacing the live Parametric artifact/tool contract with the required project snapshot and migrating all entrypoint-code consumers to project helpers. Existing persisted test conversations are intentionally not a migration target; single `.scad` source imports will create one-file projects once the import path is migrated.

After Step 1 is green, continue with Step 2 project-aware browser OpenSCAD execution.

## Verification

The current execution environment could read/write the repository through the GitHub connector but could not resolve `github.com` from the local container, so repository-local `npm` gates could not be executed at this checkpoint. A draft PR was opened to obtain repository CI once Actions starts a pull-request run.
