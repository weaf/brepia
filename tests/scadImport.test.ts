import { describe, expect, it } from 'vitest';
import { OPENSCAD_MAX_SOURCE_BYTES } from '@/lib/openScadLimits';
import {
  ScadImportError,
  boundedScadCompileError,
  decodeScadImportBytes,
  findUnsupportedScadDependencies,
  isBlockingScadCompileError,
  scadImportTitle,
} from '@/lib/scadImport';

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
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
    expect(
      decodeScadImportBytes('kropp4.scad.txt', bytes(VALID_SOURCE)),
    ).toBe(VALID_SOURCE);
    expect(
      decodeScadImportBytes('MODEL.SCAD.TXT', bytes(VALID_SOURCE)),
    ).toBe(VALID_SOURCE);
  });

  it('rejects ordinary TXT files that are not SCAD filename aliases', () => {
    expect(() => decodeScadImportBytes('bracket.txt', bytes(VALID_SOURCE)))
      .toThrowError(ScadImportError);
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
    expect(() => decodeScadImportBytes('libs.scad', bytes(source))).not.toThrow();
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

  it('rejects import() and surface() external assets', () => {
    const source = `
import("mesh.stl");
surface(file="heightmap.dat");
${VALID_SOURCE}
`;
    expect(findUnsupportedScadDependencies(source).map((issue) => issue.kind))
      .toEqual(['import', 'surface']);
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
      isBlockingScadCompileError(new Error('OpenSCAD output exceeds 67108864 bytes.')),
    ).toBe(true);
    expect(
      isBlockingScadCompileError(new Error('Parser error: syntax error in file input.scad')),
    ).toBe(false);
  });

  it('bounds retained compiler diagnostics from the tail', () => {
    const diagnostic = `prefix-${'x'.repeat(13_000)}-tail`;
    const bounded = boundedScadCompileError(new Error(diagnostic));
    expect(bounded.length).toBeLessThanOrEqual(12_000);
    expect(bounded.endsWith('-tail')).toBe(true);
  });
});
