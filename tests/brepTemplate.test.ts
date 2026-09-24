import { describe, expect, it } from 'vitest';
import {
  BREP_TEMPLATE_SCHEMA_VERSION,
  normalizeBrepTemplateDefinitionBody,
  normalizeBrepTemplateRef,
} from '@shared/brepTemplate';

function templateBody(version = 1) {
  return {
    templateSchemaVersion: BREP_TEMPLATE_SCHEMA_VERSION,
    id: 'c1-test-fixture',
    version,
    name: ' C1 test fixture ',
    category: ' test-fixture ',
    description: ' Technical fixture for template-foundation contract tests. ',
    source: {
      schemaVersion: 1,
      id: 'c1TemplateSource',
      name: 'C1 template source',
      units: 'mm',
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      parameters: [
        {
          id: 'width',
          label: 'Width',
          type: 'number',
          unit: 'mm',
          default: 100,
          min: 10,
          max: 1000,
          step: 10,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'box',
          width: { parameter: 'width' },
          depth: 50,
          height: 25,
        },
      ],
      resultNodeId: 'body',
    },
    compatibility: {
      brepSchemaVersion: 1,
    },
  } as const;
}

describe('C1.1A BRep template contract', () => {
  it('normalizes identity, metadata and canonical BRep source while preserving schemaVersion 1', () => {
    const normalized = normalizeBrepTemplateDefinitionBody(templateBody());

    expect(normalized).toEqual({
      ...templateBody(),
      name: 'C1 test fixture',
      category: 'test-fixture',
      description: 'Technical fixture for template-foundation contract tests.',
    });
    expect(normalized.source.schemaVersion).toBe(1);
  });

  it('normalizes exact id/version references', () => {
    expect(
      normalizeBrepTemplateRef({ id: 'c1-test-fixture', version: 2 }),
    ).toEqual({ id: 'c1-test-fixture', version: 2 });
  });

  it('rejects invalid template ids and versions', () => {
    expect(() =>
      normalizeBrepTemplateRef({ id: 'C1 Fixture', version: 1 }),
    ).toThrow(/template id/i);
    expect(() =>
      normalizeBrepTemplateRef({ id: 'c1-test-fixture', version: 0 }),
    ).toThrow(/positive safe integer/i);
  });

  it('rejects unsupported template schema and incompatible canonical BRep schema metadata', () => {
    expect(() =>
      normalizeBrepTemplateDefinitionBody({
        ...templateBody(),
        templateSchemaVersion: 2,
      }),
    ).toThrow(/unsupported.*template schema version/i);

    expect(() =>
      normalizeBrepTemplateDefinitionBody({
        ...templateBody(),
        compatibility: { brepSchemaVersion: 2 },
      }),
    ).toThrow(/canonical schemaVersion 1/i);
  });

  it('drops unrelated envelope fields instead of turning them into authority', () => {
    const normalized = normalizeBrepTemplateDefinitionBody({
      ...templateBody(),
      previewMesh: { positions: [1, 2, 3] },
      nativeStepPath: '/tmp/hidden-authority.step',
    });

    expect(normalized).not.toHaveProperty('previewMesh');
    expect(normalized).not.toHaveProperty('nativeStepPath');
  });
});
