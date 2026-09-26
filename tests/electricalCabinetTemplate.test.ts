import { describe, expect, it } from 'vitest';
import { validateBuiltinProductTemplateStatic } from '@shared/productTemplateValidation';
import {
  BUILTIN_PRODUCT_TEMPLATES,
  builtinProductTemplateCatalog,
} from '@shared/productTemplateCatalog';
import { resolveBuiltinProductTemplateParameterPresentation } from '@shared/productTemplate';

describe('D1 Electrical Cabinet built-in template', () => {
  it('ships the recovered canonical cabinet as exact builtin:electrical-cabinet@1', () => {
    const template = builtinProductTemplateCatalog.requireExact({
      id: 'builtin:electrical-cabinet',
      version: 1,
    });

    expect(BUILTIN_PRODUCT_TEMPLATES).toHaveLength(1);
    expect(template.source.source.id).toBe('wallmounted-control-cabinet');
    expect(template.source.source.resultNodeId).toBe('cabinet');
    expect(template.source.source.nodes).toHaveLength(39);
    expect(template.source.source.parameters.map(({ id }) => id)).toEqual([
      'D',
      'door_clear',
      'doorOpenAngleDeg',
      'H',
      'plate_margin',
      'rail_inset',
      'rail_spacing',
      'sheet_t',
      'vent_pitch',
      'W',
    ]);
  });

  it('keeps the D1 customer surface bounded while preserving canonical controls', () => {
    const template = builtinProductTemplateCatalog.requireExact({
      id: 'builtin:electrical-cabinet',
      version: 1,
    });
    const presentation =
      resolveBuiltinProductTemplateParameterPresentation(template);
    const visible = presentation
      .filter(({ visibility }) => visibility === 'visible')
      .map(({ id }) => id);
    const hidden = presentation
      .filter(({ visibility }) => visibility === 'hidden')
      .map(({ id }) => id);

    expect(visible).toEqual(['W', 'H', 'D', 'sheet_t', 'doorOpenAngleDeg']);
    expect(hidden).toEqual([
      'door_clear',
      'plate_margin',
      'rail_inset',
      'rail_spacing',
      'vent_pitch',
    ]);

    const angle = presentation.find(({ id }) => id === 'doorOpenAngleDeg');
    expect(angle).toMatchObject({
      default: 0,
      min: 0,
      max: 120,
      step: 5,
      unit: 'deg',
      unitLabel: '°',
    });
  });

  it('passes the C5 static validation contract', async () => {
    const template = builtinProductTemplateCatalog.requireExact({
      id: 'builtin:electrical-cabinet',
      version: 1,
    });

    const validation = await validateBuiltinProductTemplateStatic(template);
    expect(validation.template.id).toBe('builtin:electrical-cabinet');
    expect(validation.expectedResultKind).toBe('single');
    expect(validation.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(validation.definitionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
