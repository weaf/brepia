import { describe, expect, it } from 'vitest';
import {
  BREP_TEMPLATE_SCHEMA_VERSION,
  computeBrepTemplateDefinitionDigest,
  normalizeBrepTemplateDefinition,
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

function templateDefinition(version = 1) {
  const body = templateBody(version);
  return {
    ...body,
    definitionDigest: computeBrepTemplateDefinitionDigest(body),
  };
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

describe('C1.1B BRep template digest and immutability', () => {
  it('computes the digest from normalized template content', () => {
    const body = templateBody();
    const normalizedBody = normalizeBrepTemplateDefinitionBody(body);

    expect(computeBrepTemplateDefinitionDigest(body)).toBe(
      computeBrepTemplateDefinitionDigest(normalizedBody),
    );
    expect(computeBrepTemplateDefinitionDigest(body)).toMatch(
      /^fnv1a64:[a-f0-9]{16}$/,
    );
  });

  it('accepts a matching digest and deeply freezes the normalized definition', () => {
    const definition = normalizeBrepTemplateDefinition(templateDefinition());

    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.source)).toBe(true);
    expect(Object.isFrozen(definition.source.parameters)).toBe(true);
    expect(Object.isFrozen(definition.source.nodes)).toBe(true);
  });

  it('rejects content drift under an unchanged immutable version digest', () => {
    const definition = templateDefinition();

    expect(() =>
      normalizeBrepTemplateDefinition({
        ...definition,
        description: 'Changed content under the same immutable template version.',
      }),
    ).toThrow(/definitionDigest does not match/i);
  });

  it('does not let unrelated non-authoritative fields change the digest', () => {
    const body = templateBody();

    expect(
      computeBrepTemplateDefinitionDigest({
        ...body,
        previewMesh: { positions: [1, 2, 3] },
        nativeStepPath: '/tmp/not-authority.step',
      }),
    ).toBe(computeBrepTemplateDefinitionDigest(body));
  });
});
