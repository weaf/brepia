import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { parametricProjectSourceSchema } from '@shared/chatAi';
import {
  ParametricProjectSourceError,
  normalizeParametricProjectSource,
} from '@shared/parametricProjectSource';

const legacyOpenScadProject = {
  schemaVersion: 1,
  entrypointPath: 'main.scad',
  files: [{ path: 'main.scad', content: 'cube(10);\n' }],
};

describe('parametric project source persistence contract', () => {
  it('normalizes discriminator-free persisted artifacts as legacy OpenSCAD', () => {
    expect(normalizeParametricProjectSource(legacyOpenScadProject)).toEqual({
      kind: 'openscad',
      source: legacyOpenScadProject,
    });
  });

  it('round-trips a normalized, versioned BRep source without derived state', () => {
    const source = normalizeParametricProjectSource({
      kind: 'brep',
      source: phaseOneCabinetProject,
    });

    expect(JSON.parse(JSON.stringify(source))).toEqual(source);
    expect(source).toMatchObject({
      kind: 'brep',
      source: {
        schemaVersion: phaseOneCabinetProject.schemaVersion,
        id: phaseOneCabinetProject.id,
        placement: phaseOneCabinetProject.placement,
        metadata: phaseOneCabinetProject.metadata,
      },
    });
    expect(
      source.kind === 'brep' && source.source.parameters.map((p) => p.id),
    ).toEqual(['height', 'width']);
  });

  it('fails explicitly for malformed and unsupported BRep source versions', () => {
    expect(() =>
      normalizeParametricProjectSource({
        kind: 'brep',
        source: { ...phaseOneCabinetProject, schemaVersion: 999 },
      }),
    ).toThrow(ParametricProjectSourceError);
    expect(() =>
      normalizeParametricProjectSource({
        kind: 'brep',
        source: { ...phaseOneCabinetProject, schemaVersion: 999 },
      }),
    ).toThrow(/invalid or unsupported/i);
    expect(
      parametricProjectSourceSchema.safeParse({
        kind: 'brep',
        source: { ...phaseOneCabinetProject, schemaVersion: 999 },
      }).success,
    ).toBe(false);
  });
});
