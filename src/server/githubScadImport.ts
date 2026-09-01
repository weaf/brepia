import { Buffer } from 'node:buffer';
import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';
import {
  decodeScadImportBytes,
  findUnsupportedScadDependencies,
} from '@/lib/scadImport';
import {
  normalizeGithubScadUrl,
  type GithubScadSource,
} from '@/lib/githubScadImport';
import {
  OPENSCAD_PROJECT_MAX_FILES,
  OPENSCAD_PROJECT_MAX_TOTAL_BYTES,
  normalizeOpenScadProject,
  normalizeOpenScadProjectPath,
  type OpenScadProject,
  type OpenScadProjectFile,
} from '@shared/openScadProject';
import {
  resolveOpenScadProjectReference,
  stripOpenScadStringsAndComments,
  validateOpenScadProjectSourceReferences,
} from '@shared/openScadProjectReferences';
import { env } from './env';

export type ResolvedGithubScadImport = {
  filename: string;
  project: OpenScadProject;
  canonicalUrl: string;
};

export type GithubScadResolveErrorCode =
  | 'github_not_found'
  | 'github_rate_limited'
  | 'github_fetch_failed'
  | 'github_invalid_response'
  | 'github_dependency_missing'
  | 'github_dependency_invalid'
  | 'github_non_regular_file'
  | 'gist_ambiguous'
  | 'gist_truncated'
  | 'too_large'
  | 'too_many_files';

export class GithubScadResolveError extends Error {
  constructor(
    public readonly code: GithubScadResolveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GithubScadResolveError';
  }
}

const FETCH_TIMEOUT_MS = 10_000;
const PROJECT_RESOLVE_BUDGET_MS = 30_000;
const BUNDLED_LIBRARY_ROOTS = new Set(['BOSL', 'BOSL2', 'MCAD']);
const SCAD_EXTENSION_PATTERN = /\.scad$/i;

function githubHeaders(): Headers {
  const headers = new Headers({
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pCAD-SCAD-import',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  const token = env('GITHUB_TOKEN').trim();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function githubFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: githubHeaders(),
      signal: controller.signal,
      redirect: 'error',
    });
    if (response.status === 404) {
      throw new GithubScadResolveError(
        'github_not_found',
        'The GitHub SCAD file or Gist could not be found.',
      );
    }
    if (response.status === 403 || response.status === 429) {
      throw new GithubScadResolveError(
        'github_rate_limited',
        'GitHub temporarily refused the import request. Try again later.',
      );
    }
    if (!response.ok) {
      throw new GithubScadResolveError(
        'github_fetch_failed',
        `GitHub import failed with HTTP ${response.status}.`,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof GithubScadResolveError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GithubScadResolveError(
        'github_fetch_failed',
        'GitHub import timed out.',
      );
    }
    throw new GithubScadResolveError(
      'github_fetch_failed',
      'Could not retrieve the SCAD source from GitHub.',
    );
  } finally {
    clearTimeout(timer);
  }
}

function encodedContentPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function decodeGithubBase64(content: unknown): Uint8Array {
  if (typeof content !== 'string') {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub returned an invalid file payload.',
    );
  }
  try {
    return new Uint8Array(Buffer.from(content.replace(/\s+/g, ''), 'base64'));
  } catch {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub returned invalid base64 file data.',
    );
  }
}

function decodeProjectSource(path: string, bytes: Uint8Array): string {
  if (bytes.byteLength > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source ${path} exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }

  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new GithubScadResolveError(
      'github_dependency_invalid',
      `OpenSCAD source ${path} is not valid UTF-8 text.`,
    );
  }
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (source.includes('\0')) {
    throw new GithubScadResolveError(
      'github_dependency_invalid',
      `OpenSCAD source ${path} contains binary/NUL data.`,
    );
  }
  return source;
}

type RepositoryFile = {
  path: string;
  content: string;
  bytes: number;
};

async function fetchRepositoryScadFile({
  owner,
  repo,
  ref,
  path,
  requestedBy,
}: {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  requestedBy: string | null;
}): Promise<RepositoryFile> {
  const endpoint =
    `https://api.github.com/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}/contents/${encodedContentPath(path)}` +
    `?ref=${encodeURIComponent(ref)}`;

  let response: Response;
  try {
    response = await githubFetch(endpoint);
  } catch (error) {
    if (
      requestedBy &&
      error instanceof GithubScadResolveError &&
      error.code === 'github_not_found'
    ) {
      throw new GithubScadResolveError(
        'github_dependency_missing',
        `OpenSCAD dependency ${path} referenced from ${requestedBy} could not be found at the selected GitHub ref.`,
      );
    }
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload || Array.isArray(payload)) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      `GitHub did not return a single file for ${path}.`,
    );
  }

  const size = payload['size'];
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      `GitHub file size metadata is invalid for ${path}.`,
    );
  }
  if (size > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source ${path} exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }

  if (
    payload['type'] !== 'file' ||
    payload['encoding'] !== 'base64' ||
    typeof payload['submodule_git_url'] === 'string'
  ) {
    throw new GithubScadResolveError(
      'github_non_regular_file',
      `GitHub dependency ${path} must resolve to a normal repository file. Symlinks and submodules are not followed.`,
    );
  }

  const bytes = decodeGithubBase64(payload['content']);
  return {
    path,
    content: decodeProjectSource(path, bytes),
    bytes: bytes.byteLength,
  };
}

function collectStaticSourceTargets(
  sourcePath: string,
  content: string,
): string[] {
  const assetIssue = findUnsupportedScadDependencies(content).find(
    (issue) => issue.kind === 'import' || issue.kind === 'surface',
  );
  if (assetIssue) {
    throw new GithubScadResolveError(
      'github_dependency_invalid',
      `${assetIssue.kind}(...) in ${sourcePath} requires an external asset. GitHub project import currently resolves .scad include/use dependencies only.`,
    );
  }

  const active = stripOpenScadStringsAndComments(content);
  const includeUseRegex = /\b(?:include|use)\s*<([^>\r\n]+)>/g;
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = includeUseRegex.exec(active)) !== null) {
    const target = match[1].trim();
    const root = target.replace(/\\/g, '/').split('/', 1)[0];
    if (BUNDLED_LIBRARY_ROOTS.has(root)) continue;

    let resolvedPath: string;
    try {
      resolvedPath = resolveOpenScadProjectReference(sourcePath, target);
    } catch (error) {
      throw new GithubScadResolveError(
        'github_dependency_invalid',
        error instanceof Error
          ? error.message
          : `Invalid OpenSCAD dependency ${target} in ${sourcePath}.`,
      );
    }

    if (!SCAD_EXTENSION_PATTERN.test(resolvedPath)) {
      throw new GithubScadResolveError(
        'github_dependency_invalid',
        `OpenSCAD dependency ${target} in ${sourcePath} must resolve to a .scad project source.`,
      );
    }
    targets.push(resolvedPath);
  }
  return targets;
}

function normalizeRepositoryProjectPath(path: string): string {
  try {
    return normalizeOpenScadProjectPath(path);
  } catch (error) {
    throw new GithubScadResolveError(
      'github_dependency_invalid',
      error instanceof Error
        ? error.message
        : `Invalid GitHub OpenSCAD project path: ${path}.`,
    );
  }
}

async function resolveGithubFileProject(
  source: Extract<GithubScadSource, { kind: 'file' }>,
): Promise<ResolvedGithubScadImport> {
  const startedAt = Date.now();
  const entrypointPath = normalizeRepositoryProjectPath(source.path);
  const pending: Array<{ path: string; requestedBy: string | null }> = [
    { path: entrypointPath, requestedBy: null },
  ];
  const scheduled = new Set([entrypointPath]);
  const files: OpenScadProjectFile[] = [];
  let totalBytes = 0;

  while (pending.length > 0) {
    if (Date.now() - startedAt > PROJECT_RESOLVE_BUDGET_MS) {
      throw new GithubScadResolveError(
        'github_fetch_failed',
        'GitHub OpenSCAD project resolution exceeded the import time budget.',
      );
    }

    const current = pending.shift()!;
    const resolved = await fetchRepositoryScadFile({
      owner: source.owner,
      repo: source.repo,
      ref: source.ref,
      path: current.path,
      requestedBy: current.requestedBy,
    });

    totalBytes += resolved.bytes;
    if (totalBytes > OPENSCAD_PROJECT_MAX_TOTAL_BYTES) {
      throw new GithubScadResolveError(
        'too_large',
        `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_TOTAL_BYTES} UTF-8 bytes.`,
      );
    }
    files.push({ path: resolved.path, content: resolved.content });

    for (const dependencyPath of collectStaticSourceTargets(
      resolved.path,
      resolved.content,
    )) {
      if (scheduled.has(dependencyPath)) continue;
      if (scheduled.size >= OPENSCAD_PROJECT_MAX_FILES) {
        throw new GithubScadResolveError(
          'too_many_files',
          `OpenSCAD project exceeds ${OPENSCAD_PROJECT_MAX_FILES} source files.`,
        );
      }
      scheduled.add(dependencyPath);
      pending.push({ path: dependencyPath, requestedBy: resolved.path });
    }
  }

  let project: OpenScadProject;
  try {
    project = normalizeOpenScadProject({
      schemaVersion: 1,
      entrypointPath,
      files,
    });
    validateOpenScadProjectSourceReferences(project);
  } catch (error) {
    throw new GithubScadResolveError(
      'github_dependency_invalid',
      error instanceof Error
        ? error.message
        : 'The resolved GitHub OpenSCAD project is invalid.',
    );
  }

  return {
    filename: source.filename,
    project,
    canonicalUrl: source.canonicalUrl,
  };
}

type GistFile = {
  filename?: unknown;
  type?: unknown;
  language?: unknown;
  raw_url?: unknown;
  size?: unknown;
  truncated?: unknown;
  content?: unknown;
};

async function resolveGist(
  source: Extract<GithubScadSource, { kind: 'gist' }>,
): Promise<ResolvedGithubScadImport> {
  const endpoint = `https://api.github.com/gists/${encodeURIComponent(source.gistId)}`;
  const response = await githubFetch(endpoint);
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub returned an invalid Gist payload.',
    );
  }
  if (payload['truncated'] === true) {
    throw new GithubScadResolveError(
      'gist_truncated',
      'The Gist file list is truncated by GitHub and cannot be imported unambiguously.',
    );
  }
  const files = payload['files'];
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'The Gist does not contain a valid file map.',
    );
  }

  const candidates = Object.values(files as Record<string, GistFile>).filter(
    (file) =>
      file &&
      typeof file === 'object' &&
      typeof file.filename === 'string' &&
      /\.scad$/i.test(file.filename),
  );
  if (candidates.length !== 1) {
    throw new GithubScadResolveError(
      'gist_ambiguous',
      'The Gist must contain exactly one .scad file.',
    );
  }

  const file = candidates[0];
  const filename = file.filename as string;
  if (
    typeof file.size === 'number' &&
    Number.isFinite(file.size) &&
    file.size > OPENSCAD_MAX_SOURCE_BYTES
  ) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }
  if (file.truncated === true) {
    throw new GithubScadResolveError(
      'gist_truncated',
      'The Gist SCAD file is truncated by GitHub and cannot be imported safely.',
    );
  }
  if (typeof file.content !== 'string') {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub did not return inline Gist source content.',
    );
  }

  const bytes = new TextEncoder().encode(file.content);
  if (bytes.byteLength > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }
  const code = decodeScadImportBytes(filename, bytes);
  const project = normalizeOpenScadProject({
    schemaVersion: 1,
    entrypointPath: filename,
    files: [{ path: filename, content: code }],
  });
  return {
    filename,
    project,
    canonicalUrl: source.canonicalUrl,
  };
}

export async function resolveGithubScadImport(
  input: string,
): Promise<ResolvedGithubScadImport> {
  const source = normalizeGithubScadUrl(input);
  return source.kind === 'file'
    ? resolveGithubFileProject(source)
    : resolveGist(source);
}
