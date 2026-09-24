import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  ProductTemplateError,
  normalizeBuiltinProductTemplate,
  normalizeBuiltinProductTemplateCatalog,
} from '@shared/productTemplate';

function cabinetTemplate(version = 1) {
  return {
    id: 'builtin:electrical-cabinet',
    version,
    name: 'Electrical Cabinet',
    category: 'Electrical',
    description: 'Reusable cabinet foundation fixture.',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
    presentation: {
      parameterOrder: ['width', 'height'],
      groups: [
        {
          id: 'dimensions',
          label: 'Dimensions',
          parameterIds: ['width', 'height'],
        },
      ],
      preview: {
        kind: 'bundled',
        assetId: 'templates/electrical-cabinet-v1.webp',
      },
    },
  } as const;
}

describe('built-in product template contract', () => {
  it('normalizes one immutable template around the canonical BRep source', () => {
    const template = normalizeBuiltinProductTemplate({
      ...cabinetTemplate(),
      viewerMesh: { vertices: [1, 2, 3] },
      step: 'ISO-10303-21',
    });

    expect(template).toMatchObject({
      id: 'builtin:electrical-cabinet',
      version: 1,
      name: 'Electrical Cabinet',
      category: 'Electrical',
      description: 'Reusable cabinet foundation fixture.',
      source: { kind: 'brep' },
      presentation: cabinetTemplate().presentation,
    });
    expect(
      template.source.source.parameters.map((parameter) => parameter.id),
    ).toEqual(['height', 'width']);
    expect(Object.isFrozen(template)).toBe(true);
    expect(Object.isFrozen(template.source.source)).toBe(true);
    expect('viewerMesh' in template).toBe(false);
    expect('step' in template).toBe(false);
  });

  it('keeps template version independent from canonical BRep schemaVersion', () => {
    const template = normalizeBuiltinProductTemplate(cabinetTemplate(7));

    expect(template.version).toBe(7);
    expect(template.source.source.schemaVersion).toBe(1);
  });

  it('rejects invalid IDs, versions, non-BRep sources and unsupported BRep schemas', () => {
    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        id: 'Electrical Cabinet',
      }),
    ).toThrow(ProductTemplateError);
    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        version: 0,
      }),
    ).toThrow(/positive safe integer/i);
    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        source: {
          kind: 'openscad',
          source: {
            schemaVersion: 1,
            entrypointPath: 'main.scad',
            files: [{ path: 'main.scad', content: 'cube(10);\n' }],
          },
        },
      }),
    ).toThrow(/must have kind brep/i);
    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        source: {
          kind: 'brep',
          source: { ...phaseOneCabinetProject, schemaVersion: 2 },
        },
      }),
    ).toThrow(/invalid or unsupported/i);
  });

  it('fails closed when presentation metadata references unknown parameters', () => {
    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        presentation: {
          parameterOrder: ['width', 'missing'],
        },
      }),
    ).toThrow(/unknown published parameter missing/i);

    expect(() =>
      normalizeBuiltinProductTemplate({
        ...cabinetTemplate(),
        presentation: {
          groups: [
            {
              id: 'dimensions',
              label: 'Dimensions',
              parameterIds: ['width', 'width'],
            },
          ],
        },
      }),
    ).toThrow(/duplicate published parameter width/i);
  });

  it('allows multiple immutable versions of one family but rejects duplicate pairs', () => {
    const catalog = normalizeBuiltinProductTemplateCatalog([
      cabinetTemplate(2),
      cabinetTemplate(1),
    ]);

    expect(catalog.map((template) => template.version)).toEqual([1, 2]);
    expect(Object.isFrozen(catalog)).toBe(true);

    expect(() =>
      normalizeBuiltinProductTemplateCatalog([
        cabinetTemplate(1),
        cabinetTemplate(1),
      ]),
    ).toThrow(/duplicate built-in product template version/i);
  });
});
