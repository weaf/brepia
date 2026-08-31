# Multi-file OpenSCAD / project workspace status

Branch: `feature/multifile-openscad-workspace`

Plan: `docs/multifile_openscad_workspace_plan.md`

Draft PR: `#16` — WIP: Native multi-file OpenSCAD workspace.

## Current checkpoint

Step 1 is in final verification.

Completed foundation:

- product decision recorded: no persisted Brepia 1.0 Parametric artifact compatibility requirement;
- project-native OpenSCAD representation selected;
- `shared/openScadProject.ts` added with normalized project/file types and helpers;
- project paths are relative and canonicalized to `/`;
- absolute paths, drive paths, traversal segments, empty segments and control characters are rejected;
- duplicate paths and case-only collisions are rejected;
- `.scad` source-only schema established for the first phase;
- explicit bounds established: 64 files, 256,000 UTF-8 bytes per file, 1,048,576 UTF-8 bytes per project, 512 path characters, 128 characters per path segment and 16 path segments;
- the declared entrypoint must exist and contain source;
- project files normalize into deterministic path order;
- focused Vitest coverage added for validation and project file replacement;
- `ParametricArtifact` now stores `{ title, version, project }` and no longer stores a top-level `code` field;
- `build_parametric_model` now validates the project-native artifact schema;
- `isParametricArtifact` validates normalized project snapshots and intentionally rejects the old single-code shape;
- entrypoint access/replacement is centralized through `getParametricArtifactEntrypointCode` and `replaceParametricArtifactEntrypointCode`;
- single-file local/GitHub SCAD imports now persist as one-file project snapshots;
- current external OpenCode/Codex code-result adapters wrap returned source as a one-file `main.scad` project pending the full multi-file agent protocol in Step 5;
- imported-artifact and external-agent tests use project-native fixtures;
- the current conversation workspace revision mirror reads the project entrypoint while the full project snapshot mirror remains reserved for Step 6;
- Editor, Share, ChatSession, MessageBubble and VisualCard have been migrated away from direct persisted `artifact.code` access;
- streaming MessageBubble code display now reads the partial project's entrypoint content instead of looking for the removed top-level code field.

## Verification history

The project primitive checkpoint reached a fully green PR quality gate:

- 51 test files passed;
- 391 tests passed;
- typecheck passed;
- lint passed;
- build passed.

After the project-native artifact cutover, the next gate confirmed all 391 tests still passed and identified only four remaining UI TypeScript consumers of the removed `code` field. Those four consumers were then migrated. The current branch head now needs the final Step 1 full quality gate after that UI migration.

The local container available to this session cannot resolve GitHub, so repository-local `npm` commands have not been claimed as local verification. GitHub PR CI is the authoritative executable gate for this implementation session.

## Not completed yet

- browser OpenSCAD worker execution is still entrypoint-code-only and is not project-aware yet;
- local directory/multi-file import is not implemented yet;
- GitHub recursive project dependency resolution is not implemented yet;
- external agents still return one code string at their transport boundary and are wrapped into a one-file project;
- the local conversation workspace still mirrors entrypoint `.scad` revisions rather than complete project snapshots;
- STEP still accepts and sandboxes one source string/file;
- binary/relative asset support is not implemented.

## Next implementation checkpoint

If the full Step 1 quality gate is green, Step 1 is complete. Continue with Step 2 by changing browser OpenSCAD preview/export requests to carry the complete normalized project and execute `/project/<entrypointPath>` with all project source files mounted for every compile.
