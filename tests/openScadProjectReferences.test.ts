import { describe, expect, it } from 'vitest';
import {
  collectOpenScadProjectSourceReferences,
  openScadProjectUsesBundledLibrary,
  resolveOpenScadProjectReference,
  validateOpenScadProjectSourceReferences,
} from '@shared/openScadProjectReferences';
import type { OpenScadProject } from '@shared/openScadProject';

function project(files: OpenScadProject['files']): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: 'main.scad',
    files,
  };
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
});
