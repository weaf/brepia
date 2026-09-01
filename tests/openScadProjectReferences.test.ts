import { describe, expect, it } from 'vitest';
import {
  collectOpenScadProjectAssetReferences,
  collectOpenScadProjectSourceReferences,
  openScadProjectUsesBundledLibrary,
  resolveOpenScadProjectReference,
  validateOpenScadProjectAssetReferences,
  validateOpenScadProjectSourceReferences,
} from '@shared/openScadProjectReferences';
import type { OpenScadProject } from '@shared/openScadProject';

const SHA = 'b'.repeat(64);

function project(
  files: OpenScadProject['files'],
  assets: NonNullable<OpenScadProject['assets']> = [],
): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: 'main.scad',
    files,
    assets,
  };
}

function asset(
  path: string,
  mediaType: 'model/stl' | 'text/plain' | 'application/dxf' | 'image/svg+xml',
) {
  return {
    path,
    storagePath: `user/conversation/${SHA}-${path.replace(/\//g, '-')}`,
    mediaType,
    byteLength: 128,
    sha256: SHA,
  } as const;
}

describe('OpenSCAD project references', () => {
  it('resolves sibling, nested and parent references inside the project', () => {
    expect(resolveOpenScadProjectReference('main.scad', 'parts/body.scad')).toBe(
      'parts/body.scad',
    );
    expect(
      resolveOpenScadProjectReference('parts/body.scad', './nested/rib.scad'),
    ).toBe('parts/nested/rib.scad');
    expect(
      resolveOpenScadProjectReference('parts/nested/rib.scad', '../body.scad'),
    ).toBe('parts/body.scad');
  });

  it.each([
    ['main.scad', '../outside.scad'],
    ['parts/body.scad', '../../outside.scad'],
    ['main.scad', '/absolute.scad'],
    ['main.scad', 'C:\\outside.scad'],
  ])('rejects references that leave the project: %s -> %s', (source, target) => {
    expect(() => resolveOpenScadProjectReference(source, target)).toThrow(
      /project|relative/i,
    );
  });

  it('validates nested include/use references against project files', () => {
    const value = project([
      {
        path: 'main.scad',
        content: 'include <parts/body.scad>\nbody();',
      },
      {
        path: 'parts/body.scad',
        content: 'use <nested/rib.scad>\nmodule body() { rib(); }',
      },
      {
        path: 'parts/nested/rib.scad',
        content: 'module rib() { cube([10, 2, 2]); }',
      },
    ]);

    const references = validateOpenScadProjectSourceReferences(value);
    expect(references.map((reference) => reference.resolvedPath)).toEqual([
      'parts/body.scad',
      'parts/nested/rib.scad',
    ]);
  });

  it('ignores include/use text inside strings and comments', () => {
    const value = project([
      {
        path: 'main.scad',
        content: [
          '// include <missing.scad>',
          'echo("use <also-missing.scad>");',
          'cube(10);',
        ].join('\n'),
      },
    ]);

    expect(collectOpenScadProjectSourceReferences(value)).toEqual([]);
  });

  it('rejects a missing project-local dependency before OpenSCAD runs', () => {
    const value = project([
      { path: 'main.scad', content: 'include <parts/missing.scad>\ncube(1);' },
    ]);

    expect(() => validateOpenScadProjectSourceReferences(value)).toThrow(
      /does not resolve to a project file/i,
    );
  });

  it('recognizes bundled libraries from support files without requiring them in the project', () => {
    const value = project([
      { path: 'main.scad', content: 'include <parts/body.scad>\nbody();' },
      {
        path: 'parts/body.scad',
        content: 'include <BOSL2/std.scad>\nmodule body() { cuboid(10); }',
      },
    ]);

    expect(() => validateOpenScadProjectSourceReferences(value)).not.toThrow();
    expect(openScadProjectUsesBundledLibrary(value, 'BOSL2')).toBe(true);
    expect(openScadProjectUsesBundledLibrary(value, 'BOSL')).toBe(false);
  });

  it('collects literal import/surface references from entrypoint and support files', () => {
    const value = project(
      [
        {
          path: 'main.scad',
          content: 'import(file = "assets/body.stl", convexity=5); include <parts/top.scad>',
        },
        {
          path: 'parts/top.scad',
          content: 'surface("../heightmaps/top.dat", center=true);',
        },
      ],
      [
        asset('assets/body.stl', 'model/stl'),
        asset('heightmaps/top.dat', 'text/plain'),
      ],
    );

    expect(collectOpenScadProjectAssetReferences(value)).toEqual([
      {
        kind: 'import',
        sourcePath: 'main.scad',
        target: 'assets/body.stl',
        resolvedPath: 'assets/body.stl',
        dynamic: false,
      },
      {
        kind: 'surface',
        sourcePath: 'parts/top.scad',
        target: '../heightmaps/top.dat',
        resolvedPath: 'heightmaps/top.dat',
        dynamic: false,
      },
    ]);
    expect(() => validateOpenScadProjectAssetReferences(value)).not.toThrow();
  });

  it('ignores import/surface words inside comments and strings', () => {
    const value = project([
      {
        path: 'main.scad',
        content: [
          '// import("missing.stl");',
          'echo("surface missing.dat import missing.stl");',
          'cube(1);',
        ].join('\n'),
      },
    ]);
    expect(collectOpenScadProjectAssetReferences(value)).toEqual([]);
  });

  it('rejects dynamic asset filenames clearly', () => {
    const value = project([
      {
        path: 'main.scad',
        content: 'name = "body.stl"; import(name);',
      },
    ]);

    expect(() => validateOpenScadProjectAssetReferences(value)).toThrow(
      /dynamic file argument.*literal filename/i,
    );
  });

  it('rejects missing assets, root escapes and kind/extension mismatches', () => {
    expect(() =>
      validateOpenScadProjectAssetReferences(
        project([{ path: 'main.scad', content: 'import("missing.stl");' }]),
      ),
    ).toThrow(/does not resolve to a project asset/i);

    expect(() =>
      collectOpenScadProjectAssetReferences(
        project([{ path: 'main.scad', content: 'surface("../outside.dat");' }]),
      ),
    ).toThrow(/escapes project root/i);

    expect(() =>
      validateOpenScadProjectAssetReferences(
        project(
          [{ path: 'main.scad', content: 'surface("mesh.stl");' }],
          [asset('mesh.stl', 'model/stl')],
        ),
      ),
    ).toThrow(/unsupported asset format/i);
  });
});
