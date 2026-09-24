import { describe, expect, it } from 'vitest';
import {
  BREP_TEMPLATE_SCHEMA_VERSION,
  computeBrepTemplateDefinitionDigest,
  normalizeBrepTemplateDefinition,
} from '@shared/brepTemplate';
import {
  builtinBrepTemplates,
  createBuiltinBrepTemplateRegistry,
} from '@shared/brepTemplates';

function templateBody(version = 1) {
  return {
    templateSchemaVersion: BREP_TEMPLATE_SCHEMA_VERSION,
    id: 'c1-test-fixture',
    version,
    name: 'C1 test fixture',
    category: 'test-fixture',
    description: 'Technical fixture for template-foundation contract tests.',
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

describe('C1.1 BRep template contract', () => {
  it('normalizes and freezes one immutable template version without changing canonical BRep schema', () => {
    const definition = normalizeBrepTemplateDefinition(templateDefinition());

    expect(definition.templateSchemaVersion).toBe(1);
    expect(definition.source.schemaVersion).toBe(1);
    expect(definition.definitionDigest).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.source)).toBe(true);
    expect(Object.isFrozen(definition.source.nodes)).toBe(true);
  });

  it('rejects content drift when the immutable version digest is unchanged', () => {
    const original = templateDefinition();
    expect(() =>
      normalizeBrepTemplateDefinition({
        ...original,
        description: 'Changed content under the same immutable version.',
      }),
    ).toThrow(/definitionDigest does not match/i);
  });

  it('rejects unsupported template or canonical BRep schema compatibility', () => {
    const definition = templateDefinition();

    expect(() =>
      normalizeBrepTemplateDefinition({
        ...definition,
        templateSchemaVersion: 2,
      }),
    ).toThrow(/unsupported.*template schema version/i);

    expect(() =>
      normalizeBrepTemplateDefinition({
        ...definition,
        compatibility: { brepSchemaVersion: 2 },
      }),
    ).toThrow(/canonical schemaVersion 1/i);
  });

  it('strips unrelated envelope fields instead of turning them into authority', () => {
    const definition = templateDefinition();
    const normalized = normalizeBrepTemplateDefinition({
      ...definition,
      previewMesh: { positions: [1, 2, 3] },
      nativeStepPath: '/tmp/hidden-authority.step',
    });

    expect(normalized).not.toHaveProperty('previewMesh');
    expect(normalized).not.toHaveProperty('nativeStepPath');
  });
});

describe('C1.1 built-in BRep template registry', () => {
  it('resolves exact immutable id/version pairs and keeps versions independent', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(2),
      templateDefinition(1),
    ]);

    expect(registry.resolve({ id: 'c1-test-fixture', version: 1 }).version).toBe(1);
    expect(registry.resolve({ id: 'c1-test-fixture', version: 2 }).version).toBe(2);
    expect(registry.list().map((item) => item.version)).toEqual([1, 2]);
    expect(() =>
      registry.resolve({ id: 'c1-test-fixture', version: 3 }),
    ).toThrow(/not found/i);
  });

  it('fails closed on duplicate id/version entries', () => {
    const definition = templateDefinition();
    expect(() =>
      createBuiltinBrepTemplateRegistry([definition, definition]),
    ).toThrow(/duplicate.*template version/i);
  });

  it('publishes no product template during C1.1', () => {
    expect(builtinBrepTemplates.list()).toEqual([]);
  });
});
