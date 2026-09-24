import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  ProductTemplateError,
  normalizeBuiltinProductTemplate,
  resolveBuiltinProductTemplateParameterPresentation,
} from '@shared/productTemplate';

function templateWithPresentation(presentation: unknown) {
  return {
    id: 'builtin:c2-fixture',
    version: 1,
    name: 'C2 fixture',
    category: 'Acceptance',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
    presentation,
  };
}

describe('Phase C2 parameter presentation metadata', () => {
  it('resolves product-friendly metadata while preserving canonical numeric authority', () => {
    const template = normalizeBuiltinProductTemplate(
      templateWithPresentation({
        parameterOrder: ['width'],
        parameters: {
          width: {
            label: 'Cabinet width',
            description: 'Overall enclosure width.',
            unitLabel: 'mm',
            tier: 'basic',
          },
          height: {
            label: 'Cabinet height',
            visibility: 'hidden',
          },
        },
        groups: [
          {
            id: 'dimensions',
            label: 'Dimensions',
            description: 'Primary envelope dimensions.',
            tier: 'advanced',
            parameterIds: ['height'],
          },
        ],
      }),
    );

    const resolved = resolveBuiltinProductTemplateParameterPresentation(template);
    const width = resolved[0];
    const height = resolved[1];
    const canonicalWidth = template.source.source.parameters.find(
      (parameter) => parameter.id === 'width',
    )!;
    const canonicalHeight = template.source.source.parameters.find(
      (parameter) => parameter.id === 'height',
    )!;

    expect(resolved.map((parameter) => parameter.id)).toEqual([
      'width',
      'height',
    ]);

    expect(width).toMatchObject({
      id: 'width',
      label: 'Cabinet width',
      description: 'Overall enclosure width.',
      unit: canonicalWidth.unit,
      unitLabel: 'mm',
      default: canonicalWidth.default,
      min: canonicalWidth.min,
      max: canonicalWidth.max,
      step: canonicalWidth.step,
      visibility: 'visible',
      tier: 'basic',
    });

    expect(height).toMatchObject({
      id: 'height',
      label: 'Cabinet height',
      unit: canonicalHeight.unit,
      default: canonicalHeight.default,
      min: canonicalHeight.min,
      max: canonicalHeight.max,
      step: canonicalHeight.step,
      visibility: 'hidden',
      tier: 'advanced',
      group: {
        id: 'dimensions',
        label: 'Dimensions',
        description: 'Primary envelope dimensions.',
        tier: 'advanced',
      },
    });
  });

  it('keeps omitted parameters visible and appends them in canonical order', () => {
    const template = normalizeBuiltinProductTemplate(
      templateWithPresentation({
        parameterOrder: ['width'],
      }),
    );

    expect(
      resolveBuiltinProductTemplateParameterPresentation(template).map(
        (parameter) => ({
          id: parameter.id,
          visibility: parameter.visibility,
          tier: parameter.tier,
        }),
      ),
    ).toEqual([
      { id: 'width', visibility: 'visible', tier: 'basic' },
      { id: 'height', visibility: 'visible', tier: 'basic' },
    ]);
  });

  it.each(['default', 'min', 'max', 'step', 'unit', 'type'])(
    'rejects %s in presentation instead of creating a second parameter authority',
    (field) => {
      expect(() =>
        normalizeBuiltinProductTemplate(
          templateWithPresentation({
            parameters: {
              width: {
                [field]: field === 'unit' ? 'cm' : 123,
              },
            },
          }),
        ),
      ).toThrow(/cannot define canonical geometry field/i);
    },
  );

  it('rejects presentation references to unknown parameters', () => {
    expect(() =>
      normalizeBuiltinProductTemplate(
        templateWithPresentation({
          parameters: {
            missing: { label: 'Missing' },
          },
        }),
      ),
    ).toThrow(/unknown published parameter missing/i);
  });

  it('rejects a parameter assigned to more than one presentation group', () => {
    expect(() =>
      normalizeBuiltinProductTemplate(
        templateWithPresentation({
          groups: [
            {
              id: 'primary',
              label: 'Primary',
              parameterIds: ['width'],
            },
            {
              id: 'secondary',
              label: 'Secondary',
              parameterIds: ['width'],
            },
          ],
        }),
      ),
    ).toThrow(/cannot belong to more than one presentation group/i);
  });

  it('fails closed for invalid visibility and tier values', () => {
    expect(() =>
      normalizeBuiltinProductTemplate(
        templateWithPresentation({
          parameters: {
            width: { visibility: 'disabled' },
          },
        }),
      ),
    ).toThrow(ProductTemplateError);

    expect(() =>
      normalizeBuiltinProductTemplate(
        templateWithPresentation({
          groups: [
            {
              id: 'dimensions',
              label: 'Dimensions',
              tier: 'expert',
              parameterIds: ['width'],
            },
          ],
        }),
      ),
    ).toThrow(/must be basic or advanced/i);
  });
});
