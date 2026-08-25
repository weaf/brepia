export type GithubScadSource =
  | {
      provider: 'github';
      kind: 'file';
      owner: string;
      repo: string;
      ref: string;
      path: string;
      filename: string;
      canonicalUrl: string;
    }
  | {
      provider: 'github';
      kind: 'gist';
      gistId: string;
      canonicalUrl: string;
    };

export type GithubScadImportErrorCode =
  | 'invalid_url'
  | 'unsupported_host'
  | 'credentials_not_allowed'
  | 'invalid_path'
  | 'invalid_extension'
  | 'unsafe_encoding';

export class GithubScadImportError extends Error {
  constructor(
    public readonly code: GithubScadImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GithubScadImportError';
  }
}

const SIMPLE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const GIST_ID = /^[A-Fa-f0-9]+$/;

function fail(
  code: GithubScadImportErrorCode,
  message: string,
): never {
  throw new GithubScadImportError(code, message);
}

/**
 * Extract the path from the original URL text before WHATWG URL parsing.
 * `new URL()` canonicalizes dot segments, including percent-encoded forms
 * such as `%2e%2e`, so security checks that run only on `url.pathname` are
 * too late to distinguish a traversal-shaped input from an ordinary path.
 */
function rawPathname(input: string): string {
  const schemeSeparator = input.indexOf('://');
  if (schemeSeparator === -1) return '';

  const authorityStart = schemeSeparator + 3;
  const pathStart = input.indexOf('/', authorityStart);
  if (pathStart === -1) return '';

  const queryStart = input.indexOf('?', pathStart);
  const fragmentStart = input.indexOf('#', pathStart);
  const candidates = [queryStart, fragmentStart].filter(
    (index) => index !== -1,
  );
  const pathEnd = candidates.length > 0 ? Math.min(...candidates) : input.length;
  return input.slice(pathStart, pathEnd);
}

function assertSafeRawInputPath(input: string): void {
  const pathname = rawPathname(input);

  // V1 deliberately rejects encoded path syntax rather than trying to
  // canonicalize ambiguous/double-encoded traversal forms. This check must
  // happen before `new URL()` because WHATWG normalization collapses encoded
  // dot segments such as `%2e%2e`.
  if (/%[0-9a-f]{2}/i.test(pathname)) {
    fail(
      'unsafe_encoding',
      'Encoded GitHub path segments are not supported for SCAD import.',
    );
  }
  if (pathname.includes('\\')) {
    fail('invalid_path', 'Backslashes are not allowed in GitHub import paths.');
  }
  if (
    pathname
      .split('/')
      .some((segment) => segment === '.' || segment === '..')
  ) {
    fail('invalid_path', 'GitHub import paths may not contain dot segments.');
  }
}

function splitPath(url: URL): string[] {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    fail('invalid_path', 'GitHub import paths may not contain dot segments.');
  }
  return segments;
}

function assertSimpleSegment(value: string, label: string): void {
  if (!value || !SIMPLE_SEGMENT.test(value) || value === '.' || value === '..') {
    fail('invalid_path', `Invalid GitHub ${label}.`);
  }
}

function assertScadPath(path: string): string {
  const filename = path.split('/').at(-1) ?? '';
  if (!filename || !/\.scad$/i.test(filename)) {
    fail('invalid_extension', 'GitHub import must point to one .scad file.');
  }
  return filename;
}

function parseGithubBlob(url: URL): GithubScadSource {
  const segments = splitPath(url);
  if (segments.length < 5 || segments[2] !== 'blob') {
    fail(
      'invalid_path',
      'Use a GitHub blob URL that points directly to a .scad file.',
    );
  }

  const [owner, repo, , ref, ...pathParts] = segments;
  assertSimpleSegment(owner, 'owner');
  assertSimpleSegment(repo, 'repository');
  assertSimpleSegment(ref, 'ref');
  if (pathParts.length === 0) fail('invalid_path', 'GitHub file path is missing.');
  for (const segment of pathParts) assertSimpleSegment(segment, 'file path');

  const path = pathParts.join('/');
  const filename = assertScadPath(path);
  return {
    provider: 'github',
    kind: 'file',
    owner,
    repo,
    ref,
    path,
    filename,
    canonicalUrl: `https://github.com/${owner}/${repo}/blob/${ref}/${path}`,
  };
}

function parseRawGithub(url: URL): GithubScadSource {
  const segments = splitPath(url);
  if (segments.length < 4) {
    fail(
      'invalid_path',
      'Use a raw.githubusercontent.com URL that points directly to a .scad file.',
    );
  }

  const [owner, repo, ref, ...pathParts] = segments;
  assertSimpleSegment(owner, 'owner');
  assertSimpleSegment(repo, 'repository');
  assertSimpleSegment(ref, 'ref');
  if (pathParts.length === 0) fail('invalid_path', 'GitHub file path is missing.');
  for (const segment of pathParts) assertSimpleSegment(segment, 'file path');

  const path = pathParts.join('/');
  const filename = assertScadPath(path);
  return {
    provider: 'github',
    kind: 'file',
    owner,
    repo,
    ref,
    path,
    filename,
    canonicalUrl: `https://github.com/${owner}/${repo}/blob/${ref}/${path}`,
  };
}

function parseGist(url: URL): GithubScadSource {
  const segments = splitPath(url);
  // Supported forms are gist.github.com/<id> and gist.github.com/<owner>/<id>.
  // Extra path fragments and file anchors are intentionally rejected in V1;
  // the server resolves exactly one .scad candidate from the gist metadata.
  const gistId =
    segments.length === 1
      ? segments[0]
      : segments.length === 2
        ? segments[1]
        : '';
  if (!gistId || !GIST_ID.test(gistId)) {
    fail(
      'invalid_path',
      'Use a GitHub Gist URL containing one unambiguous gist ID.',
    );
  }

  return {
    provider: 'github',
    kind: 'gist',
    gistId,
    canonicalUrl: `https://gist.github.com/${gistId}`,
  };
}

export function normalizeGithubScadUrl(input: string): GithubScadSource {
  const trimmed = input.trim();
  if (!trimmed) fail('invalid_url', 'Enter a GitHub or Gist URL.');

  // Inspect the literal input before WHATWG URL canonicalization can erase
  // traversal evidence such as `/models/%2e%2e/model.scad` or `/a/../b.scad`.
  assertSafeRawInputPath(trimmed);

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    fail('invalid_url', 'Enter a valid GitHub or Gist HTTPS URL.');
  }

  if (url.protocol !== 'https:') {
    fail('invalid_url', 'GitHub SCAD import requires HTTPS.');
  }
  if (url.username || url.password) {
    fail(
      'credentials_not_allowed',
      'GitHub import URLs may not contain credentials.',
    );
  }
  if (url.search) {
    fail(
      'invalid_path',
      'GitHub import URLs may not contain query parameters.',
    );
  }

  const host = url.hostname.toLowerCase();
  if (host === 'github.com') return parseGithubBlob(url);
  if (host === 'raw.githubusercontent.com') return parseRawGithub(url);
  if (host === 'gist.github.com') return parseGist(url);

  fail(
    'unsupported_host',
    'Only github.com, raw.githubusercontent.com and gist.github.com are supported.',
  );
}
