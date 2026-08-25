import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';

export type ScadImportErrorCode =
  | 'invalid_extension'
  | 'too_large'
  | 'invalid_utf8'
  | 'binary_source'
  | 'source_too_short'
  | 'unsupported_dependency';

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

const BUNDLED_LIBRARY_ROOTS = new Set(['BOSL', 'BOSL2', 'MCAD']);
const MAX_RETAINED_COMPILE_ERROR_CHARS = 12_000;

function assertScadFilename(filename: string): void {
  if (!/\.scad$/i.test(filename.trim())) {
    throw new ScadImportError(
      'invalid_extension',
      'Choose a single OpenSCAD .scad file.',
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

export function decodeScadImportBytes(
  filename: string,
  bytes: Uint8Array,
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
  if (source.length < 20) {
    throw new ScadImportError(
      'source_too_short',
      'The .scad source is too short to form a pCAD parametric artifact.',
    );
  }

  assertSupportedScadDependencies(source);
  return source;
}

export async function readScadImportFile(file: File): Promise<string> {
  assertScadFilename(file.name);
  if (file.size > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new ScadImportError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }

  return decodeScadImportBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}

export function scadImportTitle(filename: string): string {
  const basename = filename.split(/[\\/]/).at(-1) ?? filename;
  const withoutExtension = basename.replace(/\.scad$/i, '').trim();
  return withoutExtension || 'Imported OpenSCAD model';
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
