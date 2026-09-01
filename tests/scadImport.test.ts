import { describe, expect, it } from 'vitest';
import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';
import {
  ScadImportError,
  boundedScadCompileError,
  decodeScadFolderImportEntries,
  decodeScadImportBytes,
  finalizeScadFolderImport,
  findUnsupportedScadDependencies,
  isBlockingScadCompileError,
  scadImportTitle,
  type ScadFolderSourceInput,
} from '@/lib/scadImport';

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function folderEntry(
  relativePath: string,
  source: string,
  name = relativePath.split('/').at(-1) ?? relativePath,
): ScadFolderSourceInput {
  return { name, relativePath, bytes: bytes(source) };
}

const VALID_SOURCE = 'size = 20;\ncube([size, size, size]);\n';

describe('local SCAD import validation', () => {
  it('accepts case-insensitive .scad filenames and strips a UTF-8 BOM', () => {
    const source = decodeScadImportBytes(
      'Bracket.SCAD',
      bytes(`\uFEFF${VALID_SOURCE}`),
    );
    expect(source).toBe(VALID_SOURCE);
  });

  it('accepts Android/browser .scad.txt filename aliases', () => {
    expect(decodeScadImportBytes('kropp4.scad.txt', bytes(VALID_SOURCE))).toBe(
      VALID_SOURCE,
    );
    expect(decodeScadImportBytes('MODEL.SCAD.TXT', bytes(VALID_SOURCE))).toBe(
      VALID_SOURCE,
    );
  });

  it('rejects ordinary TXT files that are not SCAD filename aliases', () => {
    expect(() =>
      decodeScadImportBytes('bracket.txt', bytes(VALID_SOURCE)),
    ).toThrowError(ScadImportError);
    try {
      decodeScadImportBytes('bracket.txt', bytes(VALID_SOURCE));
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid_extension' });
    }
  });

  it('rejects source larger than the shared 256,000 byte limit', () => {
    const oversized = new Uint8Array(OPENSCAD_MAX_SOURCE_BYTES + 1).fill(97);
    expect(() => decodeScadImportBytes('large.scad', oversized)).toThrow(
      /exceeds 256000/i,
    );
  });

  it('rejects invalid UTF-8', () => {
    const invalid = new Uint8Array([0xc3, 0x28, ...bytes(VALID_SOURCE)]);
    expect(() => decodeScadImportBytes('bad.scad', invalid)).toThrow(
      /valid UTF-8/i,
    );
  });

  it('rejects NUL/binary-like source', () => {
    expect(() =>
      decodeScadImportBytes('binary.scad', bytes(`${VALID_SOURCE}\0more`)),
    ).toThrow(/binary\/NUL/i);
  });

  it('accepts bundled BOSL, BOSL2 and MCAD include/use dependencies', () => {
    const source = `
include <BOSL2/std.scad>
use <BOSL/shapes.scad>
include <MCAD/boxes.scad>
${VALID_SOURCE}
`;
    expect(findUnsupportedScadDependencies(source)).toEqual([]);
    expect(() =>
      decodeScadImportBytes('libs.scad', bytes(source)),
    ).not.toThrow();
  });

  it('rejects custom or relative include/use dependencies', () => {
    const source = `
include <parts/custom.scad>
use <local.scad>
${VALID_SOURCE}
`;
    const issues = findUnsupportedScadDependencies(source);
    expect(issues.map((issue) => issue.kind)).toEqual(['include', 'use']);
    expect(() => decodeScadImportBytes('custom.scad', bytes(source))).toThrow(
      /not supported by single-file import/i,
    );
  });

  it('rejects import() and surface() external assets for single-file import', () => {
    const source = `
import("mesh.stl");
surface(file="heightmap.dat");
${VALID_SOURCE}
`;
    expect(
      findUnsupportedScadDependencies(source).map((issue) => issue.kind),
    ).toEqual(['import', 'surface']);
    expect(() => decodeScadImportBytes('assets.scad', bytes(source))).toThrow(
      /require a project folder/i,
    );
  });

  it('does not treat commented or quoted dependency examples as active', () => {
    const source = `
// include <parts/not-real.scad>
/* use <other/not-real.scad> */
echo("import(mesh.stl)");
${VALID_SOURCE}
`;
    expect(findUnsupportedScadDependencies(source)).toEqual([]);
  });

  it('derives a clean artifact title from SCAD and Android alias filenames', () => {
    expect(scadImportTitle('/tmp/My Bracket.scad')).toBe('My Bracket');
    expect(scadImportTitle('part.SCAD')).toBe('part');
    expect(scadImportTitle('kropp4.scad.txt')).toBe('kropp4');
  });

  it('classifies resource/lifecycle failures as blocking import failures', () => {
    expect(
      isBlockingScadCompileError(
        new Error('OpenSCAD worker timed out after 20000 ms.'),
      ),
    ).toBe(true);
    expect(
      isBlockingScadCompileError(
        new Error('OpenSCAD output exceeds 67108864 bytes.'),
      ),
    ).toBe(true);
    expect(
      isBlockingScadCompileError(
        new Error('Parser error: syntax error in file input.scad'),
      ),
    ).toBe(false);
  });

  it('bounds retained compiler diagnostics from the tail', () => {
    const diagnostic = `prefix-${'x'.repeat(13_000)}-tail`;
    const bounded = boundedScadCompileError(new Error(diagnostic));
    expect(bounded.length).toBeLessThanOrEqual(12_000);
    expect(bounded.endsWith('-tail')).toBe(true);
  });
});

describe('local OpenSCAD folder import', () => {
  it('preserves nested source paths and auto-selects top-level main.scad', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry(
        'Bracket/main.scad',
        'include <parts/body.scad>\nbody();\n',
      ),
      folderEntry(
        'Bracket/parts/body.scad',
        'use <nested/rib.scad>\nmodule body() { rib(); }\n',
      ),
      folderEntry(
        'Bracket/parts/nested/rib.scad',
        'module rib() { cube([1, 2, 3]); }\n',
      ),
    ]);

    expect(result.kind).toBe('project');
    if (result.kind !== 'project') throw new Error('Expected ready project');
    expect(result.title).toBe('Bracket');
    expect(result.project.entrypointPath).toBe('main.scad');
    expect(result.project.files.map((file) => file.path)).toEqual([
      'main.scad',
      'parts/body.scad',
      'parts/nested/rib.scad',
    ]);
    expect(result.assets).toEqual([]);
  });

  it('auto-selects the only top-level source when it is not named main.scad', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry(
        'Widget/model.scad',
        'include <parts/helper.scad>\ncube([4, 4, 4]);\n',
      ),
      folderEntry(
        'Widget/parts/helper.scad',
        'module helper() { sphere(1); }\n',
      ),
    ]);

    expect(result.kind).toBe('project');
    if (result.kind !== 'project') throw new Error('Expected ready project');
    expect(result.project.entrypointPath).toBe('model.scad');
  });

  it('uses the dependency graph when the only project root is nested', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry(
        'Nested/models/assembly.scad',
        'include <../parts/body.scad>\nbody();\n',
      ),
      folderEntry(
        'Nested/parts/body.scad',
        'module body() { cube([2, 2, 2]); }\n',
      ),
    ]);

    expect(result.kind).toBe('project');
    if (result.kind !== 'project') throw new Error('Expected ready project');
    expect(result.project.entrypointPath).toBe('models/assembly.scad');
  });

  it('requires an explicit entrypoint for multiple independent models', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry('Examples/alpha.scad', 'cube([1, 1, 1]);\n'),
      folderEntry('Examples/beta.scad', 'sphere(2);\n'),
    ]);

    expect(result.kind).toBe('entrypoint-required');
    if (result.kind !== 'entrypoint-required') {
      throw new Error('Expected entrypoint chooser');
    }
    expect(result.pending.entrypointCandidates).toEqual([
      'alpha.scad',
      'beta.scad',
    ]);

    const project = finalizeScadFolderImport(result.pending, 'beta.scad');
    expect(project.entrypointPath).toBe('beta.scad');
    expect(project.files).toHaveLength(2);
  });

  it('ignores unrelated files but normalizes .scad.txt aliases inside the project', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry('PhoneExport/README.md', '# notes\n', 'README.md'),
      folderEntry(
        'PhoneExport/main.scad.txt',
        'include <parts/helper.scad>\nhelper();\n',
      ),
      folderEntry(
        'PhoneExport/parts/helper.scad.txt',
        'module helper() { cube([1, 2, 3]); }\n',
      ),
      folderEntry('PhoneExport/unused.stl', 'unused mesh bytes', 'unused.stl'),
    ]);

    expect(result.kind).toBe('project');
    if (result.kind !== 'project') throw new Error('Expected ready project');
    expect(result.project.files.map((file) => file.path)).toEqual([
      'main.scad',
      'parts/helper.scad',
    ]);
    expect(result.assets).toEqual([]);
  });

  it('retains only statically referenced assets with exact nested project paths', () => {
    const result = decodeScadFolderImportEntries([
      folderEntry(
        'Assets/main.scad',
        'include <parts/body.scad>\nbody();\n',
      ),
      folderEntry(
        'Assets/parts/body.scad',
        [
          'module body() {',
          '  import("../meshes/body.stl");',
          '  surface(file="../heightmaps/top.dat", center=true);',
          '}',
        ].join('\n'),
      ),
      folderEntry('Assets/meshes/body.stl', 'binary-ish-stl', 'body.stl'),
      folderEntry('Assets/heightmaps/top.dat', '0 1\n1 0\n', 'top.dat'),
      folderEntry('Assets/meshes/unused.stl', 'unused', 'unused.stl'),
    ]);

    expect(result.kind).toBe('project');
    if (result.kind !== 'project') throw new Error('Expected ready project');
    expect(result.assets.map((asset) => asset.path)).toEqual([
      'heightmaps/top.dat',
      'meshes/body.stl',
    ]);
    expect(result.assets.find((asset) => asset.path === 'meshes/body.stl')?.bytes).toEqual(
      bytes('binary-ish-stl'),
    );
  });

  it('rejects dynamic or missing folder asset references clearly', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry(
          'Assets/main.scad',
          'name = "mesh.stl"; import(name);\ncube(1);\n',
        ),
        folderEntry('Assets/mesh.stl', 'mesh', 'mesh.stl'),
      ]),
    ).toThrow(/dynamic file argument.*literal filename/i);

    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry('Assets/main.scad', 'import("mesh.stl");\ncube(1);\n'),
      ]),
    ).toThrow(/does not resolve to a supported file/i);
  });

  it('rejects kind/extension mismatches for folder assets', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry(
          'Assets/main.scad',
          'surface(file="mesh.stl");\ncube(1);\n',
        ),
        folderEntry('Assets/mesh.stl', 'mesh', 'mesh.stl'),
      ]),
    ).toThrow(/unsupported asset format/i);
  });

  it('rejects missing project-local include/use dependencies clearly', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry(
          'Broken/main.scad',
          'include <parts/missing.scad>\ncube([1, 1, 1]);\n',
        ),
      ]),
    ).toThrow(/does not resolve to a project file/i);
  });

  it('rejects folder source references that escape the project root', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry(
          'Broken/main.scad',
          'include <../outside.scad>\ncube([1, 1, 1]);\n',
        ),
      ]),
    ).toThrow(/escapes project root/i);
  });

  it('rejects malformed picker paths instead of flattening them', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry('../main.scad', 'cube([1, 1, 1]);\n'),
      ]),
    ).toThrow(/invalid OpenSCAD project path/i);
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry('Project/../main.scad', 'cube([1, 1, 1]);\n'),
      ]),
    ).toThrow(/invalid OpenSCAD project path/i);
  });

  it('rejects folders without supported OpenSCAD source files', () => {
    expect(() =>
      decodeScadFolderImportEntries([
        folderEntry('Notes/README.md', '# notes\n', 'README.md'),
      ]),
    ).toThrow(/does not contain any \.scad files/i);
  });
});
