import { describe, expect, it } from 'vitest';
import { BREP_PROJECT_SCHEMA_VERSION, type BrepProject } from '@shared/brepProject';
import {
  digestBuiltinProductTemplateDefinition,
  ProductTemplateValidationError,
  validateBuiltinProductTemplateStatic,
} from '@shared/productTemplateValidation';

function project(options?: {
  unused?: boolean;
  pattern?: boolean;
  semanticOnly?: boolean;
}): BrepProject {
  const parameters = [
    {
      id: 'width',
      label: 'Width',
      type: 'number' as const,
      unit: 'mm' as const,
      default: 100,
      min: 50,
      max: 200,
    },
    ...(options?.semanticOnly
      ? [
          {
            id: 'anchor',
            label: 'Anchor',
            type: 'number' as const,
            unit: 'mm' as const,
            default: 0,
          },
        ]
      : []),
    ...(options?.unused
      ? [
          {
            id: 'unused',
            label: 'Unused',
            type: 'number' as const,
            unit: 'mm' as const,
            default: 1,
          },
        ]
      : []),
  ];

  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'templateValidationFixture',
    name: 'Template validation fixture',
    units: 'mm',
    placement: {
      origin: options?.semanticOnly ? [{ parameter: 'anchor' }, 0, 0] : [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters,
    nodes: options?.pattern
      ? [
          {
            id: 'body',
            type: 'box',
            width: { parameter: 'width' },
            depth: 50,
            height: 25,
          },
          {
            id: 'pattern',
            type: 'linearPattern',
            input: 'body',
            axis: 'x',
            count: 3,
            spacing: 150,
          },
        ]
      : [
          {
            id: 'body',
            type: 'box',
            width: { parameter: 'width' },
            depth: 50,
            height: 25,
          },
        ],
    resultNodeId: options?.pattern ? 'pattern' : 'body',
  };
}

function fixture(version = 1, source = project()) {
  return {
    id: 'builtin:validation-fixture',
    version,
    name: 'Validation fixture',
    category: 'Test fixtures',
    description: 'C5 validation fixture.',
    source: {
      kind: 'brep' as const,
      source,
    },
    presentation: {
      parameterOrder: ['width'],
      parameters: {
        width: {
          label: 'Width',
        },
      },
    },
  };
}

describe('C5 static built-in product template validation', () => {
  it('validates canonical normalization, M0 integrity and expected result kind', async () => {
    const result = await validateBuiltinProductTemplateStatic(fixture());

    expect(result.template.source.source.parameters.map((item) => item.id)).toEqual([
      'width',
    ]);
    expect(result.integrity.orphanNodeIds).toEqual([]);
    expect(result.integrity.orphanOnlyParameterIds).toEqual([]);
    expect(result.integrity.unusedParameterIds).toEqual([]);
    expect(result.integrity.effectiveParameterIds).toEqual(['width']);
    expect(result.publishedControlIds).toEqual(['width']);
    expect(result.expectedResultKind).toBe('single');
    expect(result.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.definitionDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('derives instanceSet result semantics from the canonical result node', async () => {
    const result = await validateBuiltinProductTemplateStatic(
      fixture(1, project({ pattern: true })),
    );

    expect(result.expectedResultKind).toBe('instanceSet');
  });

  it('fails closed on M0 orphan/unused published controls', async () => {
    await expect(
      validateBuiltinProductTemplateStatic(fixture(1, project({ unused: true }))),
    ).rejects.toMatchObject({
      name: 'ProductTemplateValidationError',
      code: 'm0_integrity',
    } satisfies Partial<ProductTemplateValidationError>);
  });


  it('requires every visible template control to affect authoritative geometry', async () => {
    const semanticProject = project({ semanticOnly: true });

    await expect(
      validateBuiltinProductTemplateStatic(fixture(1, semanticProject)),
    ).rejects.toMatchObject({
      name: 'ProductTemplateValidationError',
      code: 'ineffective_published_control',
    } satisfies Partial<ProductTemplateValidationError>);

    const hiddenSemanticControl = fixture(1, semanticProject);
    hiddenSemanticControl.presentation.parameters.anchor = {
      visibility: 'hidden',
    };
    const result = await validateBuiltinProductTemplateStatic(
      hiddenSemanticControl,
    );

    expect(result.integrity.semanticOnlyParameterIds).toEqual(['anchor']);
    expect(result.publishedControlIds).toEqual(['width']);
  });

  it('produces deterministic exact-version definition identity', async () => {
    const first = fixture(4);
    const reordered = {
      category: first.category,
      name: first.name,
      version: first.version,
      id: first.id,
      presentation: first.presentation,
      source: first.source,
      description: first.description,
    };

    const firstDigest = await digestBuiltinProductTemplateDefinition(first);
    const reorderedDigest =
      await digestBuiltinProductTemplateDefinition(reordered);
    const nextVersionDigest = await digestBuiltinProductTemplateDefinition(
      fixture(5),
    );

    expect(reorderedDigest).toBe(firstDigest);
    expect(nextVersionDigest).not.toBe(firstDigest);

    const versionFour = await validateBuiltinProductTemplateStatic(first);
    const versionFive = await validateBuiltinProductTemplateStatic(fixture(5));
    expect(versionFour.sourceDigest).toBe(versionFive.sourceDigest);
    expect(versionFour.definitionDigest).not.toBe(versionFive.definitionDigest);
  });
});
