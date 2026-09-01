from pathlib import Path
import re


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    found = text.count(old)
    if found != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences, found {found}: {old[:80]!r}")
    text = text.replace(old, new)
    p.write_text(text)


def regex_exact(path: str, pattern: str, replacement: str, expected: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    text, found = re.subn(pattern, replacement, text, flags=re.MULTILINE | re.DOTALL)
    if found != expected:
        raise RuntimeError(f"{path}: expected {expected} regex matches, found {found}: {pattern[:80]!r}")
    p.write_text(text)


# Tool execution and imported baseline now send the complete project.
replace_exact(
    'src/components/chat/ChatSession.tsx',
    "        const code = getParametricArtifactEntrypointCode(input);\n        const { stl, off } = await previewScadColoredViaToolWorker(code);",
    "        const { stl, off } = await previewScadColoredViaToolWorker(\n          input.project,\n        );",
)
replace_exact(
    'src/services/scadProjectImportService.ts',
    "    // Step 1 stores the project-native artifact. Browser execution becomes\n    // project-aware in Step 2; until then a one-file import can compile through\n    // the existing code-only worker path without changing its behavior.\n    await previewScadColoredViaToolWorker(code);",
    "    await previewScadColoredViaToolWorker(project);",
)

# Message thumbnails retain entrypoint text for display, but render the full project.
replace_exact(
    'src/components/chat/MessageBubble.tsx',
    "                      <ParametricImagePreview\n                        toolCallId={part.toolCallId}\n                        code={artifactCode}\n                      />",
    "                      <ParametricImagePreview\n                        toolCallId={part.toolCallId}\n                        project={artifact.project}\n                      />",
)
replace_exact(
    'src/components/chat/MessageBubble.tsx',
    "function ParametricImagePreview({\n  toolCallId,\n  code,\n}: {\n  toolCallId: string;\n  code: string;\n}) {",
    "function ParametricImagePreview({\n  toolCallId,\n  project,\n}: {\n  toolCallId: string;\n  project: ParametricArtifact['project'];\n}) {",
)
replace_exact(
    'src/components/chat/MessageBubble.tsx',
    "      const { stl, off } = await previewScadColoredViaToolWorker(code);",
    "      const { stl, off } = await previewScadColoredViaToolWorker(project);",
)

# History thumbnails carry the complete artifact project.
replace_exact(
    'src/components/history/VisualCard.tsx',
    "  getBuildParametricModelOutput,\n  getParametricArtifactEntrypointCode,\n} from '@shared/parametricParts';",
    "  getBuildParametricModelOutput,\n} from '@shared/parametricParts';",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "import type { MeshFileType } from '@shared/types';",
    "import type { MeshFileType, ParametricArtifact } from '@shared/types';",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "  | { type: 'artifact'; key: string; code: string }",
    "  | { type: 'artifact'; key: string; project: ParametricArtifact['project'] }",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "  const { previewScadColored } = useOpenSCAD();",
    "  const { previewProjectColored } = useOpenSCAD();",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "      const { stl, off } = await previewScadColored(preview.code);",
    "      const { stl, off } = await previewProjectColored(preview.project);",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "        const code = getParametricArtifactEntrypointCode(artifact);\n        const key =",
    "        const key =",
)
replace_exact(
    'src/components/history/VisualCard.tsx',
    "        return { type: 'artifact', key, code };",
    "        return { type: 'artifact', key, project: artifact.project };",
)

# GIF preview renders the complete project.
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "import { useOpenSCAD } from '@/hooks/useOpenSCAD';",
    "import { useOpenSCAD } from '@/hooks/useOpenSCAD';\nimport type { OpenScadProject } from '@shared/openScadProject';",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "  code: string;",
    "  project: OpenScadProject;",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "  code,",
    "  project,",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "  const { previewScadColored } = useOpenSCAD();",
    "  const { previewProjectColored } = useOpenSCAD();",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "    if (!code) return;",
    "    if (!project) return;",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "    previewScadColored(code)",
    "    previewProjectColored(project)",
)
replace_exact(
    'src/components/viewer/OpenSCADGifPreview.tsx',
    "  }, [code, previewScadColored]);",
    "  }, [project, previewProjectColored]);",
)

# Share popover passes the project to GIF rendering.
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "import { ActivityIndicator } from '@/components/brand';",
    "import { ActivityIndicator } from '@/components/brand';\nimport type { OpenScadProject } from '@shared/openScadProject';",
)
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "  openscadCode?: string;",
    "  openscadProject?: OpenScadProject;",
)
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "  openscadCode,",
    "  openscadProject,",
)
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "        ) : openscadCode ? (",
    "        ) : openscadProject ? (",
)
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "                code={openscadCode}",
    "                project={openscadProject}",
)
replace_exact(
    'src/components/ui/ShareContent.tsx',
    "      {readyToDownload && (meshId || openscadCode) ? (",
    "      {readyToDownload && (meshId || openscadProject) ? (",
)

# Live OpenSCAD viewer consumes a project. External mesh cache stays separate.
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "import { ActivityIndicator } from '@/components/brand';",
    "import { ActivityIndicator } from '@/components/brand';\nimport {\n  getOpenScadEntrypoint,\n  replaceOpenScadProjectFileContent,\n  type OpenScadProject,\n} from '@shared/openScadProject';",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "  scadCode: string | null;",
    "  project: OpenScadProject | null;",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "  scadCode,",
    "  project,",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "    compileScad,\n    exportScad,",
    "    compileProject,\n    exportProject,",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "    async (code: string) => {\n      // Extract any import() filenames from the code\n      const importedFiles = extractImportFilenames(code);",
    "    async (projectValue: OpenScadProject) => {\n      // Asset transfer remains the existing external mesh cache until the\n      // explicit project-asset phase. Preserve current single-file behavior\n      // by scanning the entrypoint while all .scad sources live in the project.\n      const entrypoint = getOpenScadEntrypoint(projectValue);\n      const importedFiles = extractImportFilenames(entrypoint.content);",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "  // Recompile the preview whenever the current SCAD code changes.\n  useEffect(() => {\n    if (!scadCode) return;\n\n    const compileWithMeshFiles = async () => {\n      try {\n        await prepareMeshFiles(scadCode);\n        compileScad(scadCode);",
    "  // Recompile the preview whenever the current OpenSCAD project changes.\n  useEffect(() => {\n    if (!project) return;\n\n    const compileWithMeshFiles = async () => {\n      try {\n        await prepareMeshFiles(project);\n        await compileProject(project);",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "  }, [scadCode, compileScad, prepareMeshFiles]);",
    "  }, [project, compileProject, prepareMeshFiles]);",
)
replace_exact(
    'src/components/viewer/OpenSCADViewer.tsx',
    "  // Register a parent-owned DXF exporter for the current SCAD code. The export\n  // runs only when the user chooses DXF from the download menu.\n  useEffect(() => {\n    if (!scadCode || !onDxfExportChange) return;\n\n    onDxfExportChange(async () => {\n      await prepareMeshFiles(scadCode);\n      return exportScad(createDXFProjectionCode(scadCode), 'dxf');\n    });\n\n    return () => onDxfExportChange(null);\n  }, [scadCode, exportScad, onDxfExportChange, prepareMeshFiles]);",
    "  // Register a parent-owned DXF exporter for the current project. Only the\n  // entrypoint is wrapped in the projection module; support files remain intact.\n  useEffect(() => {\n    if (!project || !onDxfExportChange) return;\n\n    onDxfExportChange(async () => {\n      await prepareMeshFiles(project);\n      const entrypoint = getOpenScadEntrypoint(project);\n      const projectionProject = replaceOpenScadProjectFileContent(\n        project,\n        project.entrypointPath,\n        createDXFProjectionCode(entrypoint.content),\n      );\n      return exportProject(projectionProject, 'dxf');\n    });\n\n    return () => onDxfExportChange(null);\n  }, [project, exportProject, onDxfExportChange, prepareMeshFiles]);",
)

# Editor and public share viewer pass project snapshots to the renderer.
replace_exact(
    'src/views/EditorView.tsx',
    "                    openscadCode={shareArtifactCode}",
    "                    openscadProject={\n                      sharePreview?.type === 'artifact'\n                        ? sharePreview.artifact.project\n                        : undefined\n                    }",
)
replace_exact(
    'src/views/EditorView.tsx',
    "              scadCode={activeArtifactCode ?? ''}",
    "              project={activePreview.artifact.project}",
    expected=2,
)
replace_exact(
    'src/views/ShareView.tsx',
    "              scadCode={activePreview.artifact.code}",
    "              project={activePreview.artifact.project}",
    expected=2,
)

# The worker validates complete projects at the boundary.
replace_exact(
    'src/worker/worker.ts',
    "import {\n  assertOpenScadOutputWithinLimit,\n  assertOpenScadSourceWithinLimit,\n} from '@/lib/openScadLimits';",
    "import { assertOpenScadOutputWithinLimit } from '@/lib/openScadLimits';\nimport { normalizeOpenScadProject } from '@shared/openScadProject';\nimport { validateOpenScadProjectSourceReferences } from '@shared/openScadProjectReferences';",
)
replace_exact(
    'src/worker/worker.ts',
    "        assertOpenScadSourceWithinLimit(openScadData.code);\n        result = await openscad.preview(openScadData);",
    "        const project = normalizeOpenScadProject(openScadData.project);\n        validateOpenScadProjectSourceReferences(project);\n        result = await openscad.preview({ ...openScadData, project });",
)
replace_exact(
    'src/worker/worker.ts',
    "        assertOpenScadSourceWithinLimit(openScadData.code);\n        result = await openscad.exportFile(openScadData);",
    "        const project = normalizeOpenScadProject(openScadData.project);\n        validateOpenScadProjectSourceReferences(project);\n        result = await openscad.exportFile({ ...openScadData, project });",
)

# OpenSCAD WASM mounts each normalized request under an immutable /project tree.
replace_exact(
    'src/worker/openSCAD.ts',
    "import { libraries } from '@/lib/libraries.ts';",
    "import { libraries } from '@/lib/libraries.ts';\nimport {\n  getOpenScadEntrypoint,\n  normalizeOpenScadProject,\n  type OpenScadProject,\n} from '@shared/openScadProject';\nimport { validateOpenScadProjectSourceReferences } from '@shared/openScadProjectReferences';",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "    return await this.executeOpenscad(data.code, data.fileType, parameters);",
    "    return await this.executeOpenscad(data.project, data.fileType, parameters);",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "      data.code,\n      data.fileType,",
    "      data.project,\n      data.fileType,",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "        data.code,\n        'svg',",
    "        data.project,\n        'svg',",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "  async executeOpenscad(\n    code: string,",
    "  async executeOpenscad(\n    project: OpenScadProject,",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "    const inputFile = '/input.scad';",
    "    const normalizedProject = normalizeOpenScadProject(project);\n    const references = validateOpenScadProjectSourceReferences(normalizedProject);\n    const bundledLibraryNames = new Set(\n      references\n        .filter((reference) => reference.bundledLibrary)\n        .map((reference) => reference.target.replace(/\\\\/g, '/').split('/', 1)[0]),\n    );\n    const entrypoint = getOpenScadEntrypoint(normalizedProject);\n    const projectRoot = '/project';\n    const inputFile = `${projectRoot}/${normalizedProject.entrypointPath}`;",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "    // Write the code to a file\n    instance.FS.writeFile(inputFile, code);",
    "    // Mount exactly this request's normalized project into the fresh WASM FS.\n    // Persistent external mesh files are loaded by getInstance() separately;\n    // project source never relies on state from an earlier compile.\n    this.createDirectoryRecursive(instance, projectRoot);\n    for (const file of normalizedProject.files) {\n      const projectPath = `${projectRoot}/${file.path}`;\n      const pathParts = projectPath.split('/');\n      pathParts.pop();\n      const dir = pathParts.join('/');\n      if (dir && !this.fileExists(instance, dir)) {\n        this.createDirectoryRecursive(instance, dir);\n      }\n      instance.FS.writeFile(projectPath, file.content);\n    }",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "    const activeCode = stripStringsAndComments(code);",
    "    // Project reference validation already strips comments/strings and scans\n    // every source file, so bundled libraries used only by support files are\n    // loaded just like libraries referenced by the entrypoint.",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "      const libraryStatement = new RegExp(`(include|use)\\\\s*<${library.name}/`);\n      if (\n        libraryStatement.test(activeCode) &&\n        !importLibraries.includes(library.name)\n      ) {",
    "      if (\n        bundledLibraryNames.has(library.name) &&\n        !importLibraries.includes(library.name)\n      ) {",
)
replace_exact(
    'src/worker/openSCAD.ts',
    "        code,\n        this.log.stdErr,",
    "        entrypoint.content,\n        this.log.stdErr,",
    expected=2,
)

print('Applied Step 2 project-runtime migration.')
