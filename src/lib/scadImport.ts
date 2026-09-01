import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';
import {
  OPENSCAD_PROJECT_MAX_FILES,
  OPENSCAD_PROJECT_MAX_TOTAL_BYTES,
  normalizeOpenScadProject,
  normalizeOpenScadProjectPath,
  type OpenScadProject,
  type OpenScadProjectFile,
} from '@shared/openScadProject';
import { validateOpenScadProjectSourceReferences } from '@shared/openScadProjectReferences';

export type ScadImportErrorCode =
  | 'invalid_extension'
  | 'too_large'
  | 'invalid_utf8'
  | 'binary_source'
  | 'source_too_short'
  | 'unsupported_dependency'
  | 'too_many_files'
  | 'project_too_large'
  | 'missing_relative_path'
  | 'mixed_folder'
  | 'no_scad_files'
  | 'invalid_entrypoint';

export class ScadImportError extends Error {
  constructor(
    public readonly code: ScadImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ScadImportError';
  }
}

export type ScadDependencyIssue = {
  kind: 'include' | 'use' | 'import' | 'surface';
  target: string;
  message: string;
};

export type ScadFolderSourceInput = {
  name: string;
  relativePath: string;
  bytes: Uint8Array;
};

export type PendingScadFolderImport = {
  title: string;
  filename: string;
  files: OpenScadProjectFile[];
  entrypointCandidates: string[];
};

export type ScadFolderImportResult =
  | {
      kind: 'project';
      title: string;
      filename: string;
      project: OpenScadProject;
    }
  | {
      kind: 'entrypoint-required';
      pending: PendingScadFolderImport;
    };

const BUNDLED_LIBRARY_ROOTS = new Set(['BOSL', 'BOSL2', 'MCAD']);
const MAX_RETAINED_COMPILE_ERROR_CHARS = 12_000;
const SCAD_FILENAME = /\.scad(?:\.txt)?$/i;

export function isSupportedScadFilename(filename: string): boolean {
  return SCAD_FILENAME.test(filename.trim());
}

function assertScadFilename(filename: string): void {
  if (!isSupportedScadFilename(filename)) {
    throw new ScadImportError(
      'invalid_extension',
      'Choose an OpenSCAD .scad file.',
    );
  }
}

/**
 * Blank comments and string literals while preserving line breaks. This lets
 * dependency detection inspect only active OpenSCAD syntax without matching
 * `include`, `use` or `import(` examples that merely occur in prose/strings.
 */
export function stripScadStringsAndComments(source: string): string {
  let out = '';
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      out += ' ';
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === '\n') out += '\n';
        if (current === '\\') {
          out += ' ';
          index += Math.min(2, source.length - index);
          continue;
        }
        if (current === '"') {
          out += ' ';
          index += 1;
          break;
        }
        out += current === '\n' ? '' : ' ';
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      out += '  ';
      index += 2;
      while (index < source.length && source[index] !== '\n') {
        out += ' ';
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      out += '  ';
      index += 2;
      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        out += source[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      if (index < source.length) {
        out += '  ';
        index += 2;
      }
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

export function findUnsupportedScadDependencies(
  source: string,
): ScadDependencyIssue[] {
  const active = stripScadStringsAndComments(source);
  const issues: ScadDependencyIssue[] = [];

  const includeUseRegex = /\b(include|use)\s*<([^>\r\n]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = includeUseRegex.exec(active)) !== null) {
    const kind = match[1] as 'include' | 'use';
    const target = match[2].trim();
    const root = target.split(/[\\/]/, 1)[0];
    if (!BUNDLED_LIBRARY_ROOTS.has(root)) {
      issues.push({
        kind,
        target,
        message: `${kind} <${target}> is not supported by single-file import. V1 only resolves bundled BOSL, BOSL2 and MCAD libraries.`,
      });
    }
  }

  if (/\bimport\s*\(/.test(active)) {
    issues.push({
      kind: 'import',
      target: 'external asset',
      message:
        'import(...) asset dependencies are not supported by single-file SCAD import yet.',
    });
  }

  if (/\bsurface\s*\(/.test(active)) {
    issues.push({
      kind: 'surface',
      target: 'external asset',
      message:
        'surface(...) file dependencies are not supported by single-file SCAD import yet.',
    });
  }

  return issues;
}

export function assertSupportedScadDependencies(source: string): void {
  const issues = findUnsupportedScadDependencies(source);
  if (issues.length === 0) return;

  throw new ScadImportError(
    'unsupported_dependency',
    issues.map((issue) => issue.message).join('\n'),
  );
}

function decodeScadSourceBytes(
  filename: string,
  bytes: Uint8Array,
  options: { singleFile: boolean },
): string {
  assertScadFilename(filename);

  if (bytes.byteLength > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new ScadImportError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }

  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ScadImportError(
      'invalid_utf8',
      'The .scad file is not valid UTF-8 text.',
    );
  }

  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (source.includes('\0')) {
    throw new ScadImportError(
      'binary_source',
      'The .scad file contains binary/NUL data and cannot be imported.',
    );
  }
  if (options.singleFile && source.length < 20) {
    throw new ScadImportError(
      'source_too_short',
      'The .scad source is too short to form a Brepia parametric artifact.',
    );
  }

  if (options.singleFile) assertSupportedScadDependencies(source);
  return source;
}

export function decodeScadImportBytes(
  filename: string,
  bytes: Uint8Array,
): string {
  return decodeScadSourceBytes(filename, bytes, { singleFile: true });
}

export async function readScadImportFile(file: File): Promise<string> {
  assertScadFilename(file.name);
  if (file.size > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new ScadImportError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }

  return decodeScadImportBytes(
    file.name,
    new Uint8Array(await file.arrayBuffer()),
  );
}

export function scadImportTitle(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? filename;
  const withoutExtension = basename.replace(/\.scad(?:\.txt)?$/i, '').trim();
  return withoutExtension || 'Imported OpenSCAD model';
}

export function scadImportProjectPath(filename: string): string {
  assertScadFilename(filename);
  const basename = (filename.split(/[\\/]/).at(-1) ?? filename).trim();
  return basename.replace(/\.scad\.txt$/i, '.scad');
}

function folderSourcePath(relativePath: string): {
  root: string;
  projectPath: string;
} {
  if (!relativePath.trim()) {
    throw new ScadImportError(
      'missing_relative_path',
      'The browser did not provide a relative path for the selected folder.',
    );
  }

  const normalizedSeparators = relativePath.replace(/\\/g, '/');
  const segments = normalizedSeparators.split('/');
  if (segments.length < 2) {
    throw new ScadImportError(
      'missing_relative_path',
      `Folder import cannot preserve the path for ${relativePath}.`,
    );
  }

  // Validate the picker root separately so a malicious/invalid first segment
  // cannot disappear merely because Brepia strips the selected root folder.
  const root = normalizeOpenScadProjectPath(segments[0]);
  const sourcePath = segments.slice(1).join('/').replace(/\.scad\.txt$/i, '.scad');
  const projectPath = normalizeOpenScadProjectPath(sourcePath);
  return { root, projectPath };
}

function assertFolderProjectDependencies(project: OpenScadProject): void {
  for (const file of project.files) {
    const assetIssue = findUnsupportedScadDependencies(file.content).find(
      (issue) => issue.kind === 'import' || issue.kind === 'surface',
    );
    if (assetIssue) {
      throw new ScadImportError(
        'unsupported_dependency',
        `${assetIssue.kind}(...) in ${file.path} requires an external asset. Folder import currently supports .scad source trees only.`,
      );
    }
  }

  try {
    validateOpenScadProjectSourceReferences(project);
  } catch (error) {
    throw new ScadImportError(
      'unsupported_dependency',
      error instanceof Error
        ? error.message
        : 'The OpenSCAD project contains an invalid source dependency.',
    );
  }
}

function buildFolderProject(
  files: OpenScadProjectFile[],
  entrypointPath: string,
): OpenScadProject {
  const project = normalizeOpenScadProject({
    schemaVersion: 1,
    entrypointPath,
    files,
  });
  assertFolderProjectDependencies(project);
  return project;
}

function chooseAutomaticEntrypoint(project: OpenScadProject): string | null {
  const nonEmptyFiles = project.files.filter((file) => file.content.trim());
  if (nonEmptyFiles.length === 1) return nonEmptyFiles[0].path;

  const topLevelMain = nonEmptyFiles.filter(
    (file) =>
      !file.path.includes('/') && file.path.toLocaleLowerCase('en-US') === 'main.scad',
  );
  if (topLevelMain.length === 1) return topLevelMain[0].path;

  const topLevelFiles = nonEmptyFiles.filter((file) => !file.path.includes('/'));
  if (topLevelFiles.length === 1) return topLevelFiles[0].path;

  const references = validateOpenScadProjectSourceReferences(project);
  const referencedPaths = new Set(
    references.flatMap((reference) =>
      reference.bundledLibrary || !reference.resolvedPath
        ? []
        : [reference.resolvedPath],
    ),
  );
  const dependencyRoots = nonEmptyFiles.filter(
    (file) => !referencedPaths.has(file.path),
  );
  return dependencyRoots.length === 1 ? dependencyRoots[0].path : null;
}

export function decodeScadFolderImportEntries(
  entries: readonly ScadFolderSourceInput[],
): ScadFolderImportResult {
  const sourceEntries = entries.filter((entry) =>
    isSupportedScadFilename(entry.name),
  );
  if (sourceEntries.length === 0) {
    throw new ScadImportError(
      'no_scad_files',
      'The selected folder does not contain any .scad files.',
    );
  }
  if (sourceEntries.length > OPENSCAD_PROJECT_MAX_FILES) {
    throw new ScadImportError(
      'too_many_files',
      `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_FILES} source files.`,
    );
  }

  let totalBytes = 0;
  let root: string | null = null;
  const files: OpenScadProjectFile[] = [];

  for (const entry of sourceEntries) {
    totalBytes += entry.bytes.byteLength;
    if (totalBytes > OPENSCAD_PROJECT_MAX_TOTAL_BYTES) {
      throw new ScadImportError(
        'project_too_large',
        `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_TOTAL_BYTES} UTF-8 bytes.`,
      );
    }

    const resolved = folderSourcePath(entry.relativePath);
    if (root === null) root = resolved.root;
    if (root !== resolved.root) {
      throw new ScadImportError(
        'mixed_folder',
        'Folder import received files from more than one root folder.',
      );
    }

    files.push({
      path: resolved.projectPath,
      content: decodeScadSourceBytes(entry.name, entry.bytes, {
        singleFile: false,
      }),
    });
  }

  const nonEmpty = files.filter((file) => file.content.trim());
  if (nonEmpty.length === 0) {
    throw new ScadImportError(
      'source_too_short',
      'The selected folder has no non-empty OpenSCAD source file to use as an entrypoint.',
    );
  }

  // The reference validator is entrypoint-independent, but project
  // normalization requires one. Use a temporary non-empty source solely to
  // validate the complete tree and derive dependency roots.
  const validationProject = buildFolderProject(files, nonEmpty[0].path);
  const automaticEntrypoint = chooseAutomaticEntrypoint(validationProject);
  const title = root?.trim() || 'Imported OpenSCAD project';
  const filename = title;

  if (automaticEntrypoint) {
    return {
      kind: 'project',
      title,
      filename,
      project: buildFolderProject(files, automaticEntrypoint),
    };
  }

  return {
    kind: 'entrypoint-required',
    pending: {
      title,
      filename,
      files: validationProject.files,
      entrypointCandidates: nonEmpty
        .map((file) => file.path)
        .sort((left, right) => left.localeCompare(right, 'en-US')),
    },
  };
}

export async function readScadImportFolder(
  selectedFiles: readonly File[],
): Promise<ScadFolderImportResult> {
  const sourceFiles = selectedFiles.filter((file) =>
    isSupportedScadFilename(file.name),
  );
  if (sourceFiles.length === 0) {
    throw new ScadImportError(
      'no_scad_files',
      'The selected folder does not contain any .scad files.',
    );
  }
  if (sourceFiles.length > OPENSCAD_PROJECT_MAX_FILES) {
    throw new ScadImportError(
      'too_many_files',
      `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_FILES} source files.`,
    );
  }

  const declaredBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
  if (declaredBytes > OPENSCAD_PROJECT_MAX_TOTAL_BYTES) {
    throw new ScadImportError(
      'project_too_large',
      `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_TOTAL_BYTES} UTF-8 bytes.`,
    );
  }

  const entries = await Promise.all(
    sourceFiles.map(async (file) => ({
      name: file.name,
      relativePath: file.webkitRelativePath,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  return decodeScadFolderImportEntries(entries);
}

export function finalizeScadFolderImport(
  pending: PendingScadFolderImport,
  entrypointPath: string,
): OpenScadProject {
  const normalizedEntrypoint = normalizeOpenScadProjectPath(entrypointPath);
  if (!pending.entrypointCandidates.includes(normalizedEntrypoint)) {
    throw new ScadImportError(
      'invalid_entrypoint',
      'Choose one of the OpenSCAD source files from the selected folder as the entrypoint.',
    );
  }
  return buildFolderProject(pending.files, normalizedEntrypoint);
}

export function isBlockingScadCompileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:timed out after|output exceeds|source exceeds|worker error|worker message error|worker terminated|failed to post message)/i.test(
    message,
  );
}

export function boundedScadCompileError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(-MAX_RETAINED_COMPILE_ERROR_CHARS);
}
