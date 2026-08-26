import { Buffer } from 'node:buffer';
import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';
import { decodeScadImportBytes } from '@/lib/scadImport';
import {
  normalizeGithubScadUrl,
  type GithubScadSource,
} from '@/lib/githubScadImport';
import { env } from './env';

export type ResolvedGithubScadImport = {
  filename: string;
  code: string;
  canonicalUrl: string;
};

export type GithubScadResolveErrorCode =
  | 'github_not_found'
  | 'github_rate_limited'
  | 'github_fetch_failed'
  | 'github_invalid_response'
  | 'gist_ambiguous'
  | 'gist_truncated'
  | 'too_large';

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

async function resolveGithubFile(
  source: Extract<GithubScadSource, { kind: 'file' }>,
): Promise<ResolvedGithubScadImport> {
  const endpoint =
    `https://api.github.com/repos/${encodeURIComponent(source.owner)}` +
    `/${encodeURIComponent(source.repo)}/contents/${encodedContentPath(source.path)}` +
    `?ref=${encodeURIComponent(source.ref)}`;
  const response = await githubFetch(endpoint);
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!payload || Array.isArray(payload)) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub did not return a single file.',
    );
  }

  const size = payload['size'];
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub file size metadata is invalid.',
    );
  }
  if (size > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }
  if (payload['type'] !== 'file' || payload['encoding'] !== 'base64') {
    throw new GithubScadResolveError(
      'github_invalid_response',
      'GitHub import must resolve to one normal file.',
    );
  }

  const bytes = decodeGithubBase64(payload['content']);
  if (bytes.byteLength > OPENSCAD_MAX_SOURCE_BYTES) {
    throw new GithubScadResolveError(
      'too_large',
      `OpenSCAD source exceeds ${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes.`,
    );
  }
  return {
    filename: source.filename,
    code: decodeScadImportBytes(source.filename, bytes),
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
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
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
  return {
    filename,
    code: decodeScadImportBytes(filename, bytes),
    canonicalUrl: source.canonicalUrl,
  };
}

export async function resolveGithubScadImport(
  input: string,
): Promise<ResolvedGithubScadImport> {
  const source = normalizeGithubScadUrl(input);
  return source.kind === 'file'
    ? resolveGithubFile(source)
    : resolveGist(source);
}
