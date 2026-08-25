import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GithubScadImportError,
  normalizeGithubScadUrl,
} from '@/lib/githubScadImport';
import {
  GithubScadResolveError,
  resolveGithubScadImport,
} from '@/server/githubScadImport';
import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';

const scad = 'width = 20;\nheight = 10;\ncube([width, width, height]);\n';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHub SCAD URL normalization', () => {
  it('normalizes a GitHub blob URL', () => {
    expect(
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/models/bracket.scad',
      ),
    ).toEqual({
      provider: 'github',
      kind: 'file',
      owner: 'example',
      repo: 'cad',
      ref: 'main',
      path: 'models/bracket.scad',
      filename: 'bracket.scad',
      canonicalUrl:
        'https://github.com/example/cad/blob/main/models/bracket.scad',
    });
  });

  it('normalizes a raw GitHub URL to the canonical blob identity', () => {
    expect(
      normalizeGithubScadUrl(
        'https://raw.githubusercontent.com/example/cad/main/models/bracket.scad',
      ),
    ).toEqual({
      provider: 'github',
      kind: 'file',
      owner: 'example',
      repo: 'cad',
      ref: 'main',
      path: 'models/bracket.scad',
      filename: 'bracket.scad',
      canonicalUrl:
        'https://github.com/example/cad/blob/main/models/bracket.scad',
    });
  });

  it('normalizes owner-qualified and ownerless Gist URLs', () => {
    expect(
      normalizeGithubScadUrl(
        'https://gist.github.com/octocat/aa5a315d61ae9438b18d',
      ),
    ).toMatchObject({
      kind: 'gist',
      gistId: 'aa5a315d61ae9438b18d',
      canonicalUrl: 'https://gist.github.com/aa5a315d61ae9438b18d',
    });
    expect(
      normalizeGithubScadUrl(
        'https://gist.github.com/aa5a315d61ae9438b18d',
      ),
    ).toMatchObject({ kind: 'gist', gistId: 'aa5a315d61ae9438b18d' });
  });

  it('rejects arbitrary hosts and URL credentials', () => {
    expect(() =>
      normalizeGithubScadUrl('https://example.com/model.scad'),
    ).toThrow(GithubScadImportError);
    expect(() =>
      normalizeGithubScadUrl(
        'https://user:secret@github.com/example/cad/blob/main/model.scad',
      ),
    ).toThrow(/credentials/i);
  });

  it('rejects query parameters, encoded paths, traversal forms and non-SCAD files', () => {
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/model.scad?raw=1',
      ),
    ).toThrow(/query/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/models/%2e%2e/model.scad',
      ),
    ).toThrow(/encoded/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://raw.githubusercontent.com/example/cad/main/model.stl',
      ),
    ).toThrow(/\.scad/i);
  });
});

describe('trusted GitHub SCAD retrieval', () => {
  it('retrieves repository content only through the fixed GitHub API host', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'file',
          encoding: 'base64',
          size: Buffer.byteLength(scad),
          content: Buffer.from(scad, 'utf8').toString('base64'),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://raw.githubusercontent.com/example/cad/main/model.scad',
    );

    expect(result).toEqual({
      filename: 'model.scad',
      code: scad,
      canonicalUrl: 'https://github.com/example/cad/blob/main/model.scad',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toBe(
      'https://api.github.com/repos/example/cad/contents/model.scad?ref=main',
    );
    expect(calledUrl).not.toContain('raw.githubusercontent.com');
  });

  it('rejects repository files above the shared SCAD byte limit before decoding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'file',
            encoding: 'base64',
            size: OPENSCAD_MAX_SOURCE_BYTES + 1,
            content: '',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/model.scad',
      ),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('imports a Gist only when exactly one SCAD candidate exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: {
            'model.scad': {
              filename: 'model.scad',
              size: Buffer.byteLength(scad),
              truncated: false,
              content: scad,
            },
            'README.md': {
              filename: 'README.md',
              size: 4,
              truncated: false,
              content: 'demo',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://gist.github.com/octocat/aa5a315d61ae9438b18d',
    );
    expect(result.filename).toBe('model.scad');
    expect(result.code).toBe(scad);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/gists/aa5a315d61ae9438b18d',
    );
  });

  it('rejects Gists with zero, multiple or truncated SCAD candidates', async () => {
    const responses = [
      { files: { 'README.md': { filename: 'README.md', content: 'x' } } },
      {
        files: {
          'a.scad': { filename: 'a.scad', content: scad, truncated: false },
          'b.scad': { filename: 'b.scad', content: scad, truncated: false },
        },
      },
      {
        files: {
          'a.scad': {
            filename: 'a.scad',
            content: scad,
            truncated: true,
          },
        },
      },
    ];
    const fetchMock = vi.fn();
    for (const payload of responses) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://gist.github.com/aa5a315d61ae9438b18d',
      ),
    ).rejects.toMatchObject({ code: 'gist_ambiguous' });
    await expect(
      resolveGithubScadImport(
        'https://gist.github.com/aa5a315d61ae9438b18d',
      ),
    ).rejects.toMatchObject({ code: 'gist_ambiguous' });
    await expect(
      resolveGithubScadImport(
        'https://gist.github.com/aa5a315d61ae9438b18d',
      ),
    ).rejects.toMatchObject({ code: 'gist_truncated' });
  });

  it('does not convert GitHub transport failures into arbitrary outbound retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/model.scad',
      ),
    ).rejects.toBeInstanceOf(GithubScadResolveError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /^https:\/\/api\.github\.com\//,
    );
  });
});
