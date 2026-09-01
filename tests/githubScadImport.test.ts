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
import { OPENSCAD_PROJECT_MAX_FILES } from '@shared/openScadProject';

const scad = 'width = 20;\nheight = 10;\ncube([width, width, height]);\n';

function repositoryFilePayload(
  content: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    type: 'file',
    encoding: 'base64',
    size: Buffer.byteLength(content),
    content: Buffer.from(content, 'utf8').toString('base64'),
    ...overrides,
  };
}

function repositoryAssetMetadata(
  byteLength: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    type: 'file',
    size: byteLength,
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

  it('accepts normal GitHub percent-encoding for spaces and path separators', () => {
    expect(
      normalizeGithubScadUrl(
        'https://github.com/Noty-design/Parametric-designs/blob/main/Flexible%20figure%2Fkropp4.scad',
      ),
    ).toEqual({
      provider: 'github',
      kind: 'file',
      owner: 'Noty-design',
      repo: 'Parametric-designs',
      ref: 'main',
      path: 'Flexible figure/kropp4.scad',
      filename: 'kropp4.scad',
      canonicalUrl:
        'https://github.com/Noty-design/Parametric-designs/blob/main/Flexible%20figure/kropp4.scad',
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
      normalizeGithubScadUrl('https://gist.github.com/aa5a315d61ae9438b18d'),
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

  it('rejects query parameters, traversal, double encoding, backslashes and non-SCAD files', () => {
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/model.scad?raw=1',
      ),
    ).toThrow(/query/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/models/%2e%2e/model.scad',
      ),
    ).toThrow(/dot segments/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/models/%252e%252e/model.scad',
      ),
    ).toThrow(/double-encoded/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://github.com/example/cad/blob/main/models%5cmodel.scad',
      ),
    ).toThrow(/backslashes/i);
    expect(() =>
      normalizeGithubScadUrl(
        'https://raw.githubusercontent.com/example/cad/main/model.stl',
      ),
    ).toThrow(/\.scad/i);
  });
});

describe('trusted GitHub SCAD retrieval', () => {
  it('retrieves a standalone repository file as a one-file project through the fixed GitHub API host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(scad)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://raw.githubusercontent.com/example/cad/main/model.scad',
    );

    expect(result).toEqual({
      filename: 'model.scad',
      project: {
        schemaVersion: 1,
        entrypointPath: 'model.scad',
        files: [{ path: 'model.scad', content: scad }],
      },
      assets: [],
      canonicalUrl: 'https://github.com/example/cad/blob/main/model.scad',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toBe(
      'https://api.github.com/repos/example/cad/contents/model.scad?ref=main',
    );
    expect(calledUrl).not.toContain('raw.githubusercontent.com');
  });

  it('preserves a percent-encoded repository-relative entrypoint path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(scad)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://github.com/Noty-design/Parametric-designs/blob/main/Flexible%20figure%2Fkropp4.scad',
    );

    expect(result.project).toEqual({
      schemaVersion: 1,
      entrypointPath: 'Flexible figure/kropp4.scad',
      files: [{ path: 'Flexible figure/kropp4.scad', content: scad }],
    });
    expect(result.assets).toEqual([]);
    expect(result.canonicalUrl).toBe(
      'https://github.com/Noty-design/Parametric-designs/blob/main/Flexible%20figure/kropp4.scad',
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.github.com/repos/Noty-design/Parametric-designs/contents/Flexible%20figure/kropp4.scad?ref=main',
    );
  });

  it('recursively resolves nested include/use dependencies at the same Git ref', async () => {
    const main = 'include <parts/body.scad>\nbody();\n';
    const body = 'use <../shared/rib.scad>\nmodule body() { rib(); }\n';
    const rib = 'module rib() { cube([20, 2, 6]); }\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(body)))
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(rib)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://github.com/example/cad/blob/release/models/main.scad',
    );

    expect(result.project.entrypointPath).toBe('models/main.scad');
    expect(result.project.files).toEqual([
      { path: 'models/main.scad', content: main },
      { path: 'models/parts/body.scad', content: body },
      { path: 'models/shared/rib.scad', content: rib },
    ]);
    expect(result.assets).toEqual([]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://api.github.com/repos/example/cad/contents/models/main.scad?ref=release',
      'https://api.github.com/repos/example/cad/contents/models/parts/body.scad?ref=release',
      'https://api.github.com/repos/example/cad/contents/models/shared/rib.scad?ref=release',
    ]);
  });

  it('deduplicates cyclic dependencies instead of fetching a file twice', async () => {
    const main = 'include <parts/a.scad>\ncube(1);\n';
    const part = 'include <../main.scad>\nmodule a() { cube(2); }\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(part)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://github.com/example/cad/blob/main/main.scad',
    );

    expect(result.project.files).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fetch bundled BOSL/BOSL2/MCAD library references', async () => {
    const main = 'include <parts/body.scad>\nbody();\n';
    const body =
      'include <BOSL2/std.scad>\nuse <MCAD/boxes.scad>\nmodule body() { cube(1); }\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(body)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://github.com/example/cad/blob/main/models/main.scad',
    );

    expect(result.project.files.map((file) => file.path)).toEqual([
      'models/main.scad',
      'models/parts/body.scad',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a missing repository-local dependency clearly', async () => {
    const main = 'include <parts/missing.scad>\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/models/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_dependency_missing' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects dependencies that escape the repository root before another fetch', async () => {
    const main = 'include <../../outside.scad>\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(main)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/models/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_dependency_invalid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects symlink/submodule-like dependency payloads instead of following them', async () => {
    const main = 'include <parts/link.scad>\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(
        jsonResponse({
          type: 'symlink',
          encoding: 'none',
          size: 12,
          target: '../real.scad',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_non_regular_file' });
  });

  it('resolves only statically referenced relative assets at the same Git ref', async () => {
    const main =
      'include <parts/body.scad>\nbody();\n';
    const body =
      'module body() { import("../assets/body.stl"); }\n';
    const assetBytes = new Uint8Array([0, 1, 2, 3, 255]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(body)))
      .mockResolvedValueOnce(
        jsonResponse(repositoryAssetMetadata(assetBytes.byteLength)),
      )
      .mockResolvedValueOnce(new Response(assetBytes));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://github.com/example/cad/blob/release/models/main.scad',
    );

    expect(result.assets).toEqual([
      {
        path: 'models/assets/body.stl',
        contentBase64: Buffer.from(assetBytes).toString('base64'),
      },
    ]);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      'https://api.github.com/repos/example/cad/contents/models/main.scad?ref=release',
      'https://api.github.com/repos/example/cad/contents/models/parts/body.scad?ref=release',
      'https://api.github.com/repos/example/cad/contents/models/assets/body.stl?ref=release',
      'https://api.github.com/repos/example/cad/contents/models/assets/body.stl?ref=release',
    ]);
    const rawRequestHeaders = fetchMock.mock.calls[3]?.[1]?.headers;
    expect(rawRequestHeaders).toBeInstanceOf(Headers);
    expect((rawRequestHeaders as Headers).get('Accept')).toBe(
      'application/vnd.github.raw+json',
    );
  });

  it('rejects dynamic GitHub asset filenames before fetching an asset', async () => {
    const main = 'name = "mesh.stl"; import(name);\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(main)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_dependency_invalid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a missing statically referenced GitHub asset clearly', async () => {
    const main = 'import("assets/missing.stl");\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(repositoryFilePayload(main)))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_dependency_missing' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects import/surface kind-extension mismatches before fetching an asset', async () => {
    const main = 'surface(file="mesh.stl");\ncube(1);\n';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(main)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'github_dependency_invalid' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces the project file-count bound before fetching an unbounded repository tree', async () => {
    const includes = Array.from(
      { length: OPENSCAD_PROJECT_MAX_FILES },
      (_, index) => `include <parts/p${index}.scad>`,
    ).join('\n');
    const main = `${includes}\ncube(1);\n`;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(repositoryFilePayload(main)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport(
        'https://github.com/example/cad/blob/main/main.scad',
      ),
    ).rejects.toMatchObject({ code: 'too_many_files' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects repository files above the shared SCAD byte limit before decoding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          type: 'file',
          encoding: 'base64',
          size: OPENSCAD_MAX_SOURCE_BYTES + 1,
          content: '',
        }),
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
      jsonResponse({
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
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveGithubScadImport(
      'https://gist.github.com/octocat/aa5a315d61ae9438b18d',
    );
    expect(result.filename).toBe('model.scad');
    expect(result.project).toEqual({
      schemaVersion: 1,
      entrypointPath: 'model.scad',
      files: [{ path: 'model.scad', content: scad }],
    });
    expect(result.assets).toEqual([]);
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
      fetchMock.mockResolvedValueOnce(jsonResponse(payload));
    }
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resolveGithubScadImport('https://gist.github.com/aa5a315d61ae9438b18d'),
    ).rejects.toMatchObject({ code: 'gist_ambiguous' });
    await expect(
      resolveGithubScadImport('https://gist.github.com/aa5a315d61ae9438b18d'),
    ).rejects.toMatchObject({ code: 'gist_ambiguous' });
    await expect(
      resolveGithubScadImport('https://gist.github.com/aa5a315d61ae9438b18d'),
    ).rejects.toMatchObject({ code: 'gist_truncated' });
  });

  it('does not convert GitHub transport failures into arbitrary outbound retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
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
