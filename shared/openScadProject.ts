export const OPENSCAD_PROJECT_SCHEMA_VERSION = 1 as const;
export const OPENSCAD_PROJECT_MAX_FILES = 64;
export const OPENSCAD_PROJECT_MAX_PATH_CHARS = 512;
export const OPENSCAD_PROJECT_MAX_SEGMENT_CHARS = 128;
export const OPENSCAD_PROJECT_MAX_DEPTH = 16;
export const OPENSCAD_PROJECT_MAX_FILE_BYTES = 256_000;
export const OPENSCAD_PROJECT_MAX_TOTAL_BYTES = 1_048_576;

export type OpenScadProjectFile = {
  path: string;
  content: string;
};

export type OpenScadProject = {
  schemaVersion: typeof OPENSCAD_PROJECT_SCHEMA_VERSION;
  entrypointPath: string;
  files: OpenScadProjectFile[];
};

export type OpenScadProjectErrorCode =
  | 'invalid_schema'
  | 'invalid_path'
  | 'invalid_file_type'
  | 'too_many_files'
  | 'file_too_large'
  | 'project_too_large'
  | 'duplicate_path'
  | 'case_collision'
  | 'missing_entrypoint'
  | 'empty_entrypoint';

export class OpenScadProjectError extends Error {
  constructor(
    public readonly code: OpenScadProjectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OpenScadProjectError';
  }
}

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;
const SCAD_EXTENSION_PATTERN = /\.scad$/i;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

export function normalizeOpenScadProjectPath(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    throw new OpenScadProjectError(
      'invalid_path',
      'OpenSCAD project paths must be non-empty relative paths.',
    );
  }
  if (hasControlCharacter(input)) {
    throw new OpenScadProjectError(
      'invalid_path',
      'OpenSCAD project paths cannot contain control characters.',
    );
  }
  if (WINDOWS_DRIVE_PATTERN.test(input) || input.startsWith('/')) {
    throw new OpenScadProjectError(
      'invalid_path',
      'OpenSCAD project paths must be relative.',
    );
  }

  const normalized = input.replace(/\\/g, '/');
  if (normalized.length > OPENSCAD_PROJECT_MAX_PATH_CHARS) {
    throw new OpenScadProjectError(
      'invalid_path',
      `OpenSCAD project path exceeds ${OPENSCAD_PROJECT_MAX_PATH_CHARS} characters.`,
    );
  }

  const segments = normalized.split('/');
  if (segments.length > OPENSCAD_PROJECT_MAX_DEPTH) {
    throw new OpenScadProjectError(
      'invalid_path',
      `OpenSCAD project path exceeds ${OPENSCAD_PROJECT_MAX_DEPTH} segments.`,
    );
  }

  for (const segment of segments) {
    if (
      segment.length === 0 ||
      segment === '.' ||
      segment === '..' ||
      segment !== segment.trim()
    ) {
      throw new OpenScadProjectError(
        'invalid_path',
        `Invalid OpenSCAD project path: ${input}`,
      );
    }
    if (segment.length > OPENSCAD_PROJECT_MAX_SEGMENT_CHARS) {
      throw new OpenScadProjectError(
        'invalid_path',
        `OpenSCAD project path segment exceeds ${OPENSCAD_PROJECT_MAX_SEGMENT_CHARS} characters.`,
      );
    }
  }

  return normalized;
}

function normalizeProjectFile(file: OpenScadProjectFile): OpenScadProjectFile {
  if (!file || typeof file !== 'object' || Array.isArray(file)) {
    throw new OpenScadProjectError(
      'invalid_file_type',
      'OpenSCAD project files must be text files.',
    );
  }
  if (typeof file.content !== 'string') {
    throw new OpenScadProjectError(
      'invalid_file_type',
      'OpenSCAD project file contents must be UTF-8 text.',
    );
  }

  const path = normalizeOpenScadProjectPath(file.path);
  if (!SCAD_EXTENSION_PATTERN.test(path)) {
    throw new OpenScadProjectError(
      'invalid_file_type',
      `OpenSCAD project source must use the .scad extension: ${path}`,
    );
  }

  const bytes = utf8ByteLength(file.content);
  if (bytes > OPENSCAD_PROJECT_MAX_FILE_BYTES) {
    throw new OpenScadProjectError(
      'file_too_large',
      `OpenSCAD project file ${path} exceeds ${OPENSCAD_PROJECT_MAX_FILE_BYTES} UTF-8 bytes.`,
    );
  }

  return { path, content: file.content };
}

export function normalizeOpenScadProject(
  project: OpenScadProject,
): OpenScadProject {
  if (
    !project ||
    typeof project !== 'object' ||
    Array.isArray(project) ||
    project.schemaVersion !== OPENSCAD_PROJECT_SCHEMA_VERSION ||
    !Array.isArray(project.files)
  ) {
    throw new OpenScadProjectError(
      'invalid_schema',
      `OpenSCAD project schemaVersion must be ${OPENSCAD_PROJECT_SCHEMA_VERSION}.`,
    );
  }

  if (project.files.length === 0) {
    throw new OpenScadProjectError(
      'missing_entrypoint',
      'OpenSCAD projects must contain at least one source file.',
    );
  }
  if (project.files.length > OPENSCAD_PROJECT_MAX_FILES) {
    throw new OpenScadProjectError(
      'too_many_files',
      `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_FILES} files.`,
    );
  }

  const entrypointPath = normalizeOpenScadProjectPath(project.entrypointPath);
  if (!SCAD_EXTENSION_PATTERN.test(entrypointPath)) {
    throw new OpenScadProjectError(
      'invalid_file_type',
      'OpenSCAD project entrypoint must be a .scad file.',
    );
  }

  const files = project.files.map(normalizeProjectFile);
  const exactPaths = new Set<string>();
  const foldedPaths = new Map<string, string>();
  let totalBytes = 0;

  for (const file of files) {
    if (exactPaths.has(file.path)) {
      throw new OpenScadProjectError(
        'duplicate_path',
        `Duplicate OpenSCAD project path: ${file.path}`,
      );
    }
    exactPaths.add(file.path);

    const folded = file.path.toLocaleLowerCase('en-US');
    const existing = foldedPaths.get(folded);
    if (existing && existing !== file.path) {
      throw new OpenScadProjectError(
        'case_collision',
        `OpenSCAD project paths differ only by case: ${existing} and ${file.path}`,
      );
    }
    foldedPaths.set(folded, file.path);

    totalBytes += utf8ByteLength(file.content);
    if (totalBytes > OPENSCAD_PROJECT_MAX_TOTAL_BYTES) {
      throw new OpenScadProjectError(
        'project_too_large',
        `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_TOTAL_BYTES} UTF-8 bytes.`,
      );
    }
  }

  const entrypoint = files.find((file) => file.path === entrypointPath);
  if (!entrypoint) {
    throw new OpenScadProjectError(
      'missing_entrypoint',
      `OpenSCAD project entrypoint is missing: ${entrypointPath}`,
    );
  }
  if (!entrypoint.content.trim()) {
    throw new OpenScadProjectError(
      'empty_entrypoint',
      'OpenSCAD project entrypoint cannot be empty.',
    );
  }

  files.sort((left, right) => left.path.localeCompare(right.path, 'en-US'));
  return {
    schemaVersion: OPENSCAD_PROJECT_SCHEMA_VERSION,
    entrypointPath,
    files,
  };
}

export function getOpenScadProjectFile(
  project: OpenScadProject,
  path: string,
): OpenScadProjectFile {
  const normalized = normalizeOpenScadProject(project);
  const normalizedPath = normalizeOpenScadProjectPath(path);
  const file = normalized.files.find((candidate) => candidate.path === normalizedPath);
  if (!file) {
    throw new OpenScadProjectError(
      'missing_entrypoint',
      `OpenSCAD project file is missing: ${normalizedPath}`,
    );
  }
  return file;
}

export function getOpenScadEntrypoint(project: OpenScadProject): OpenScadProjectFile {
  const normalized = normalizeOpenScadProject(project);
  return normalized.files.find((file) => file.path === normalized.entrypointPath)!;
}

export function replaceOpenScadProjectFileContent(
  project: OpenScadProject,
  path: string,
  content: string,
): OpenScadProject {
  const normalized = normalizeOpenScadProject(project);
  const normalizedPath = normalizeOpenScadProjectPath(path);
  let replaced = false;
  const files = normalized.files.map((file) => {
    if (file.path !== normalizedPath) return file;
    replaced = true;
    return { ...file, content };
  });
  if (!replaced) {
    throw new OpenScadProjectError(
      'missing_entrypoint',
      `OpenSCAD project file is missing: ${normalizedPath}`,
    );
  }
  return normalizeOpenScadProject({ ...normalized, files });
}
