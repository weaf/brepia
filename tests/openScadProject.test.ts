import { describe, expect, it } from 'vitest';
import {
  OPENSCAD_PROJECT_MAX_FILE_BYTES,
  OPENSCAD_PROJECT_MAX_FILES,
  OPENSCAD_PROJECT_MAX_TOTAL_BYTES,
  OpenScadProjectError,
  getOpenScadEntrypoint,
  normalizeOpenScadProject,
  normalizeOpenScadProjectPath,
  replaceOpenScadProjectFileContent,
  type OpenScadProject,
} from '@shared/openScadProject';

function project(
  files: OpenScadProject['files'],
  entrypointPath = 'main.scad',
): OpenScadProject {
  return { schemaVersion: 1, entrypointPath, files };
}

describe('OpenSCAD project normalization', () => {
  it('normalizes separators and sorts files deterministically', () => {
    const normalized = normalizeOpenScadProject(
      project(
        [
          { path: 'parts\\lid.scad', content: 'module lid() { cube(2); }' },
          { path: 'main.scad', content: 'include <parts/lid.scad>\nlid();' },
        ],
        'main.scad',
      ),
    );

    expect(normalized.files.map((file) => file.path)).toEqual([
      'main.scad',
      'parts/lid.scad',
    ]);
    expect(getOpenScadEntrypoint(normalized).content).toContain('lid();');
  });

  it.each([
    '/absolute/main.scad',
    'C:\\project\\main.scad',
    '../main.scad',
    'parts/../main.scad',
    './main.scad',
    'parts//main.scad',
    ' parts/main.scad',
    'parts/main.scad ',
    'parts/ma\u0000in.scad',
  ])('rejects unsafe path %s', (path) => {
    expect(() => normalizeOpenScadProjectPath(path)).toThrowError(
      OpenScadProjectError,
    );
  });

  it('rejects duplicate normalized paths', () => {
    expect(() =>
      normalizeOpenScadProject(
        project([
          { path: 'main.scad', content: 'cube(1);' },
          { path: 'main.scad', content: 'cube(2);' },
        ]),
      ),
    ).toThrow(/Duplicate OpenSCAD project path/i);
  });

  it('rejects case-colliding paths', () => {
    expect(() =>
      normalizeOpenScadProject(
        project([
          { path: 'main.scad', content: 'use <Part.scad>\npart();' },
          { path: 'Part.scad', content: 'module part() { cube(1); }' },
          { path: 'part.scad', content: 'module part() { cube(2); }' },
        ]),
      ),
    ).toThrow(/differ only by case/i);
  });

  it('requires the declared entrypoint to exist and contain source', () => {
    expect(() =>
      normalizeOpenScadProject(
        project([{ path: 'other.scad', content: 'cube(1);' }]),
      ),
    ).toThrow(/entrypoint is missing/i);

    expect(() =>
      normalizeOpenScadProject(
        project([{ path: 'main.scad', content: '   \n' }]),
      ),
    ).toThrow(/entrypoint cannot be empty/i);
  });

  it('accepts only SCAD source files in the first project schema', () => {
    expect(() =>
      normalizeOpenScadProject(
        project([
          { path: 'main.scad', content: 'import("mesh.stl");' },
          { path: 'mesh.stl', content: 'not-a-mesh' },
        ]),
      ),
    ).toThrow(/must use the .scad extension/i);
  });

  it('enforces file-count and per-file byte bounds', () => {
    expect(() =>
      normalizeOpenScadProject(
        project(
          Array.from({ length: OPENSCAD_PROJECT_MAX_FILES + 1 }, (_, index) => ({
            path: `file-${index}.scad`,
            content: index === 0 ? 'cube(1);' : '',
          })),
          'file-0.scad',
        ),
      ),
    ).toThrow(/exceeds 64 files/i);

    expect(() =>
      normalizeOpenScadProject(
        project([
          {
            path: 'main.scad',
            content: 'x'.repeat(OPENSCAD_PROJECT_MAX_FILE_BYTES + 1),
          },
        ]),
      ),
    ).toThrow(/exceeds 256000 UTF-8 bytes/i);
  });

  it('enforces the aggregate project byte bound', () => {
    const chunk = 'x'.repeat(OPENSCAD_PROJECT_MAX_FILE_BYTES);
    const files = Array.from({ length: 5 }, (_, index) => ({
      path: index === 0 ? 'main.scad' : `part-${index}.scad`,
      content: chunk,
    }));

    expect(5 * OPENSCAD_PROJECT_MAX_FILE_BYTES).toBeGreaterThan(
      OPENSCAD_PROJECT_MAX_TOTAL_BYTES,
    );
    expect(() => normalizeOpenScadProject(project(files))).toThrow(
      /project exceeds 1048576 UTF-8 bytes/i,
    );
  });

  it('replaces one file while preserving the normalized project', () => {
    const original = normalizeOpenScadProject(
      project([
        { path: 'main.scad', content: 'use <parts/body.scad>\nbody();' },
        { path: 'parts/body.scad', content: 'module body() { cube(1); }' },
      ]),
    );

    const updated = replaceOpenScadProjectFileContent(
      original,
      'parts/body.scad',
      'module body() { cube(2); }',
    );

    expect(updated.files.find((file) => file.path === 'main.scad')?.content).toBe(
      'use <parts/body.scad>\nbody();',
    );
    expect(
      updated.files.find((file) => file.path === 'parts/body.scad')?.content,
    ).toContain('cube(2)');
  });
});
