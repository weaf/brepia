import { describe, expect, it } from 'vitest';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
  type BrepEvaluationSuccess,
} from '../shared/brepProvider';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '../shared/brepProject';

function project(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'cabinetA42',
    name: 'Cabinet A42',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      {
        id: 'height',
        label: 'Height',
        type: 'number',
        unit: 'mm',
        default: 1800,
        min: 800,
        max: 3000,
      },
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 1200,
        min: 600,
        max: 2400,
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

function expectRequestError(
  action: () => unknown,
  code: BrepEvaluationRequestError['code'],
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BrepEvaluationRequestError);
    expect((error as BrepEvaluationRequestError).code).toBe(code);
    return;
  }
  throw new Error(`Expected BrepEvaluationRequestError with code ${code}.`);
}

describe('BRep provider contract', () => {
  it('resolves sorted defaults and overrides without mutating the canonical project', () => {
    const source = project();
    const normalized = normalizeBrepEvaluationRequest({
      project: source,
      parameterValues: { width: 1500 },
    });

    expect(normalized.parameterValues).toEqual({ height: 1800, width: 1500 });
    expect(
      source.parameters.find((parameter) => parameter.id === 'width')?.default,
    ).toBe(1200);
    expect(normalized.project).not.toBe(source);
  });

  it('rejects unknown and out-of-range overrides before a provider can execute', () => {
    expectRequestError(
      () =>
        normalizeBrepEvaluationRequest({
          project: project(),
          parameterValues: { missing: 1 },
        }),
      'invalid_parameter_value',
    );
    expectRequestError(
      () =>
        normalizeBrepEvaluationRequest({
          project: project(),
          parameterValues: { width: 1 },
        }),
      'invalid_parameter_value',
    );
  });

  it('has a kernel-neutral success payload with stable Brepia body identities', () => {
    const result: BrepEvaluationSuccess = {
      status: 'success',
      provider: {
        id: 'build123d-occt',
        providerVersion: '0.1.0',
        kernelVersion: 'OCCT-7.8',
      },
      projectId: 'cabinetA42',
      resultNodeId: 'body',
      bodies: [{ id: 'body', bounds: { min: [0, 0, 0], max: [1, 1, 1] } }],
      bounds: { min: [0, 0, 0], max: [1, 1, 1] },
      warnings: [],
      exactExport: { format: 'step', available: true },
    };
    expect(result.bodies[0].id).toBe('body');
  });
});
