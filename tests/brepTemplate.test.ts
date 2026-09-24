import { describe, expect, it } from 'vitest';
import {
  BREP_TEMPLATE_SCHEMA_VERSION,
  computeBrepTemplateDefinitionDigest,
  normalizeBrepTemplateDefinition,
  normalizeBrepTemplateDefinitionBody,
  normalizeBrepTemplateRef,
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


describe('C1.1C built-in BRep template registry', () => {
  it('resolves only the exact requested id/version pair', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(2),
      templateDefinition(1),
    ]);

    expect(registry.resolve({ id: 'c1-test-fixture', version: 1 }).version).toBe(1);
    expect(registry.resolve({ id: 'c1-test-fixture', version: 2 }).version).toBe(2);
    expect(() =>
      registry.resolve({ id: 'c1-test-fixture', version: 3 }),
    ).toThrow(/not found/i);
  });

  it('lists immutable versions deterministically without selecting a latest version', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(2),
      templateDefinition(1),
    ]);

    expect(registry.list().map(({ id, version }) => ({ id, version }))).toEqual([
      { id: 'c1-test-fixture', version: 1 },
      { id: 'c1-test-fixture', version: 2 },
    ]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });

  it('fails closed on duplicate id/version definitions', () => {
    const definition = templateDefinition();

    expect(() =>
      createBuiltinBrepTemplateRegistry([definition, definition]),
    ).toThrow(/duplicate.*template version/i);
  });

  it('publishes no product template during C1.1', () => {
    expect(builtinBrepTemplates.list()).toEqual([]);
  });
});


describe('C1.2 independent template instantiation', () => {
  it('creates a new canonical project identity from one exact immutable template version', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(1),
      templateDefinition(2),
    ]);

    const project = registry.instantiate(
      { id: 'c1-test-fixture', version: 1 },
      { projectIdFactory: () => 'project_instance_one' },
    );

    expect(project.id).toBe('project_instance_one');
    expect(project.id).not.toBe(
      registry.resolve({ id: 'c1-test-fixture', version: 1 }).source.id,
    );
    expect(project.schemaVersion).toBe(1);
  });

  it('preserves node and parameter identities while producing independent nested project state', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(1),
    ]);
    const definition = registry.resolve({
      id: 'c1-test-fixture',
      version: 1,
    });
    const project = registry.instantiate(
      { id: 'c1-test-fixture', version: 1 },
      { projectIdFactory: () => 'project_instance_two' },
    );

    expect(project.parameters.map((parameter) => parameter.id)).toEqual(
      definition.source.parameters.map((parameter) => parameter.id),
    );
    expect(project.nodes.map((node) => node.id)).toEqual(
      definition.source.nodes.map((node) => node.id),
    );
    expect(project.parameters).not.toBe(definition.source.parameters);
    expect(project.nodes).not.toBe(definition.source.nodes);
    expect(project.placement).not.toBe(definition.source.placement);
  });

  it('does not allow instance mutation to flow back into immutable template state', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(1),
    ]);
    const definition = registry.resolve({
      id: 'c1-test-fixture',
      version: 1,
    });
    const project = registry.instantiate(
      { id: 'c1-test-fixture', version: 1 },
      { projectIdFactory: () => 'project_instance_three' },
    );

    project.parameters[0].default = 250;
    project.nodes[0].id = 'instanceBody';

    expect(definition.source.parameters[0].default).toBe(100);
    expect(definition.source.nodes[0].id).toBe('body');
  });

  it('creates distinct project identities across repeated instantiations', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(1),
    ]);
    let counter = 0;
    const projectIdFactory = () => {
      counter += 1;
      return `project_instance_${counter}`;
    };

    const first = registry.instantiate(
      { id: 'c1-test-fixture', version: 1 },
      { projectIdFactory },
    );
    const second = registry.instantiate(
      { id: 'c1-test-fixture', version: 1 },
      { projectIdFactory },
    );

    expect(first.id).not.toBe(second.id);
    expect(first).toEqual({ ...second, id: first.id });
  });

  it('fails closed when an injected identity reuses the template source project id', () => {
    const registry = createBuiltinBrepTemplateRegistry([
      templateDefinition(1),
    ]);

    expect(() =>
      registry.instantiate(
        { id: 'c1-test-fixture', version: 1 },
        { projectIdFactory: () => 'c1TemplateSource' },
      ),
    ).toThrow(/must differ from the template source project id/i);
  });
});
