import {
  normalizeOpenScadProject,
  normalizeOpenScadProjectPath,
  type OpenScadProject,
} from './openScadProject.ts';

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;
const BUNDLED_LIBRARY_ROOTS = new Set(['BOSL', 'BOSL2', 'MCAD']);

export type OpenScadProjectSourceReference = {
  kind: 'include' | 'use';
  sourcePath: string;
  target: string;
  resolvedPath: string | null;
  bundledLibrary: boolean;
};

export class OpenScadProjectReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenScadProjectReferenceError';
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

export function stripOpenScadStringsAndComments(source: string): string {
  let out = '';
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '"') {
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

    if (character === '/' && next === '/') {
      out += '  ';
      index += 2;
      while (index < source.length && source[index] !== '\n') {
        out += ' ';
        index += 1;
      }
      continue;
    }

    if (character === '/' && next === '*') {
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

    out += character;
    index += 1;
  }

  return out;
}

export function resolveOpenScadProjectReference(
  sourcePath: string,
  target: string,
): string {
  const normalizedSource = normalizeOpenScadProjectPath(sourcePath);
  const trimmedTarget = target.trim();
  if (!trimmedTarget || hasControlCharacter(trimmedTarget)) {
    throw new OpenScadProjectReferenceError(
      `Invalid OpenSCAD project reference in ${normalizedSource}: ${target}`,
    );
  }
  if (
    trimmedTarget.startsWith('/') ||
    WINDOWS_DRIVE_PATTERN.test(trimmedTarget)
  ) {
    throw new OpenScadProjectReferenceError(
      `OpenSCAD project reference must stay relative to the project: ${target}`,
    );
  }

  const targetSegments = trimmedTarget.replace(/\\/g, '/').split('/');
  const sourceSegments = normalizedSource.split('/');
  sourceSegments.pop();
  const resolved = [...sourceSegments];

  for (const segment of targetSegments) {
    if (!segment || segment !== segment.trim()) {
      throw new OpenScadProjectReferenceError(
        `Invalid OpenSCAD project reference in ${normalizedSource}: ${target}`,
      );
    }
    if (segment === '.') continue;
    if (segment === '..') {
      if (resolved.length === 0) {
        throw new OpenScadProjectReferenceError(
          `OpenSCAD project reference escapes project root: ${target}`,
        );
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  if (resolved.length === 0) {
    throw new OpenScadProjectReferenceError(
      `OpenSCAD project reference does not resolve to a file: ${target}`,
    );
  }
  return normalizeOpenScadProjectPath(resolved.join('/'));
}

export function collectOpenScadProjectSourceReferences(
  project: OpenScadProject,
): OpenScadProjectSourceReference[] {
  const normalized = normalizeOpenScadProject(project);
  const references: OpenScadProjectSourceReference[] = [];

  for (const file of normalized.files) {
    const active = stripOpenScadStringsAndComments(file.content);
    const includeUseRegex = /\b(include|use)\s*<([^>\r\n]+)>/g;
    let match: RegExpExecArray | null;

    while ((match = includeUseRegex.exec(active)) !== null) {
      const kind = match[1] as 'include' | 'use';
      const target = match[2].trim();
      const root = target.replace(/\\/g, '/').split('/', 1)[0];
      const bundledLibrary = BUNDLED_LIBRARY_ROOTS.has(root);
      references.push({
        kind,
        sourcePath: file.path,
        target,
        resolvedPath: bundledLibrary
          ? null
          : resolveOpenScadProjectReference(file.path, target),
        bundledLibrary,
      });
    }
  }

  return references;
}

export function validateOpenScadProjectSourceReferences(
  project: OpenScadProject,
): OpenScadProjectSourceReference[] {
  const normalized = normalizeOpenScadProject(project);
  const projectPaths = new Set(normalized.files.map((file) => file.path));
  const references = collectOpenScadProjectSourceReferences(normalized);

  for (const reference of references) {
    if (reference.bundledLibrary) continue;
    if (!reference.resolvedPath || !projectPaths.has(reference.resolvedPath)) {
      throw new OpenScadProjectReferenceError(
        `${reference.kind} <${reference.target}> in ${reference.sourcePath} does not resolve to a project file.`,
      );
    }
  }

  return references;
}

export function openScadProjectUsesBundledLibrary(
  project: OpenScadProject,
  libraryName: string,
): boolean {
  return collectOpenScadProjectSourceReferences(project).some(
    (reference) =>
      reference.bundledLibrary &&
      reference.target.replace(/\\/g, '/').split('/', 1)[0] === libraryName,
  );
}
