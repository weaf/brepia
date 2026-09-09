import { describe, expect, it } from 'vitest';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
  type BrepScalar,
} from '../shared/brepProject';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity';
import {
  BREP_SCALAR_EXPRESSION_MAX_DEPTH,
  brepScalarParameterReferences,
  formatBrepScalar,
  resolveBrepScalar,
} from '../shared/brepScalar';

function project(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'expressionFixture',
    name: 'Expression fixture',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 1200,
      },
      {
        id: 'height',
        label: 'Height',
        type: 'number',
        unit: 'mm',
        default: 1800,
      },
      {
        id: 'scale',
        label: 'Scale',
        type: 'number',
        unit: 'none',
        default: 0.5,
      },
      {
        id: 'angle',
        label: 'Angle',
        type: 'number',
        unit: 'deg',
        default: 15,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: { parameter: 'height' },
      },
    ],
    resultNodeId: 'body',
  };
}

function body(source: BrepProject) {
  const node = source.nodes.find((candidate) => candidate.id === 'body');
  if (!node || node.type !== 'box') throw new Error('Fixture is invalid.');
  return node;
}

function expectProjectError(source: BrepProject, code: BrepProjectError['code']) {
  try {
    normalizeBrepProject(source);
  } catch (error) {
    expect(error).toBeInstanceOf(BrepProjectError);
    expect((error as BrepProjectError).code).toBe(code);
    return;
  }
  throw new Error(`Expected BrepProjectError ${code}.`);
}

describe('M1 bounded BRep scalar expressions', () => {
  it('keeps existing schemaVersion 1 literal and direct-reference snapshots backward compatible', () => {
    const normalized = normalizeBrepProject(project());

    expect(normalized.schemaVersion).toBe(1);
    expect(body(normalized).width).toEqual({ parameter: 'width' });
    expect(body(normalized).depth).toBe(600);
  });

  it('normalizes and resolves derived add/sub/div/neg relationships deterministically', () => {
    const source = project();
    const expression: BrepScalar = {
      op: 'sub',
      args: [
        { op: 'div', args: [{ parameter: 'width' }, 2] },
        { op: 'neg', args: [-25] },
      ],
    };
    body(source).width = expression;

    const normalized = normalizeBrepProject(source);
    const normalizedExpression = body(normalized).width;

    expect(normalizedExpression).toEqual(expression);
    expect(resolveBrepScalar(normalizedExpression, { width: 1200 })).toBe(625);
    expect(resolveBrepScalar(normalizedExpression, { width: 1600 })).toBe(825);
    expect(formatBrepScalar(normalizedExpression)).toBe(
      '((width / 2) - -(-25))',
    );
  });

  it('allows dimensionless scaling while rejecting unsupported implicit area algebra', () => {
    const scaled = project();
    body(scaled).width = {
      op: 'mul',
      args: [{ parameter: 'scale' }, { parameter: 'width' }],
    };
    expect(() => normalizeBrepProject(scaled)).not.toThrow();

    const area = project();
    body(area).width = {
      op: 'mul',
      args: [{ parameter: 'width' }, { parameter: 'height' }],
    };
    expectProjectError(area, 'invalid_parameter');
  });

  it('rejects addition of incompatible parameter units', () => {
    const source = project();
    body(source).width = {
      op: 'add',
      args: [{ parameter: 'width' }, { parameter: 'scale' }],
    };

    expectProjectError(source, 'invalid_parameter');
  });

  it('rejects malformed expression arity and unsupported operators', () => {
    const wrongArity = project() as unknown as BrepProject & {
      nodes: Array<Record<string, unknown>>;
    };
    wrongArity.nodes[0]!.width = {
      op: 'add',
      args: [{ parameter: 'width' }],
    };
    expectProjectError(wrongArity, 'invalid_node');

    const unsupported = project() as unknown as BrepProject & {
      nodes: Array<Record<string, unknown>>;
    };
    unsupported.nodes[0]!.width = {
      op: 'pow',
      args: [{ parameter: 'width' }, 2],
    };
    expectProjectError(unsupported, 'invalid_node');
  });

  it('rejects expression trees deeper than the canonical bound', () => {
    const source = project();
    let expression: BrepScalar = { parameter: 'width' };
    for (let index = 0; index <= BREP_SCALAR_EXPRESSION_MAX_DEPTH + 1; index += 1) {
      expression = { op: 'neg', args: [expression] };
    }
    body(source).width = expression;

    expectProjectError(source, 'invalid_node');
  });

  it('rejects default division by zero and bounded-arithmetic overflow before persistence', () => {
    const divideByZero = project();
    body(divideByZero).width = {
      op: 'div',
      args: [{ parameter: 'width' }, 0],
    };
    expectProjectError(divideByZero, 'invalid_parameter');

    const overflow = project();
    body(overflow).width = {
      op: 'mul',
      args: [{ parameter: 'width' }, 1_000_000],
    };
    expectProjectError(overflow, 'invalid_parameter');
  });

  it('finds parameter references transitively and keeps M0 effectiveness correct', () => {
    const source = project();
    body(source).width = {
      op: 'sub',
      args: [
        { parameter: 'width' },
        { op: 'mul', args: [{ parameter: 'scale' }, 20] },
      ],
    };
    body(source).height = {
      op: 'div',
      args: [{ parameter: 'height' }, 2],
    };
    source.parameters = source.parameters.filter(
      (parameter) => parameter.id !== 'angle',
    );

    const normalized = normalizeBrepProject(source);
    expect(brepScalarParameterReferences(body(normalized).width)).toEqual([
      'scale',
      'width',
    ]);
    expect(analyzeBrepProjectIntegrity(normalized).effectiveParameterIds).toEqual([
      'height',
      'scale',
      'width',
    ]);
    expect(analyzeBrepProjectIntegrity(normalized).unusedParameterIds).toEqual([]);
  });
});