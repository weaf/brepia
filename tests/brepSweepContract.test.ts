import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  BrepProjectError,
  brepNodeValueKind,
  normalizeBrepProject,
  type BrepAxis,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepNodeDependencies,
  brepProjectParameterUsages,
} from '../shared/brepProjectEditing.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '../shared/brepProvider.ts';

function sweepProject(planeNormalAxis: BrepAxis = 'z'): BrepProject {
  return {
    schemaVersion: 1,
    id: `sweep${planeNormalAxis}`,
    name: `Bounded planar elbow sweep ${planeNormalAxis}`,
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'tubeDiameter',
        label: 'Tube diameter',
        type: 'number',
        unit: 'mm',
        default: 40,
        min: 1,
        max: 200,
      },
      {
        id: 'firstLeg',
        label: 'First leg',
        type: 'number',
        unit: 'mm',
        default: 1000,
        min: 1,
        max: 5000,
      },
      {
        id: 'secondLeg',
        label: 'Second leg',
        type: 'number',
        unit: 'mm',
        default: 700,
        min: 1,
        max: 5000,
      },
      {
        id: 'bendRadius',
        label: 'Bend radius',
        type: 'number',
        unit: 'mm',
        default: 150,
        min: 1,
        max: 1000,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'sweep',
        profile: {
          type: 'circle',
          radius: {
            op: 'div',
            args: [{ parameter: 'tubeDiameter' }, 2],
          },
        },
        path: {
          type: 'planarElbow90',
          planeNormalAxis,
          firstLegLength: { parameter: 'firstLeg' },
          secondLegLength: { parameter: 'secondLeg' },
          bendRadius: { parameter: 'bendRadius' },
        },
      },
    ],
    resultNodeId: 'body',
  };
}

describe('bounded planar 90-degree circular sweep canonical contract', () => {
  it.each(['x', 'y', 'z'] as const)(
    'keeps schemaVersion 1, one source node and a single result on %s plane normal',
    (axis) => {
      const normalized = normalizeBrepProject(sweepProject(axis));
      const node = normalized.nodes[0]!;
      assert.equal(node.type, 'sweep');
      assert.equal(
        node.type === 'sweep' ? node.path.planeNormalAxis : null,
        axis,
      );
      assert.equal(brepNodeValueKind(node), 'single');
      assert.deepEqual(brepNodeDependencies(node), []);
      assert.equal(normalized.schemaVersion, 1);
    },
  );

  it('tracks all four sweep dimensions as M0-effective while preserving the tube-diameter expression', () => {
    const normalized = normalizeBrepProject(sweepProject());
    const node = normalized.nodes[0]!;
    assert.equal(node.type, 'sweep');
    if (node.type !== 'sweep') return;

    assert.deepEqual(node.profile.radius, {
      op: 'div',
      args: [{ parameter: 'tubeDiameter' }, 2],
    });

    const integrity = analyzeBrepProjectIntegrity(normalized);
    assert.deepEqual(integrity.resultReachableNodeIds, ['body']);
    assert.deepEqual(integrity.effectiveParameterIds, [
      'bendRadius',
      'firstLeg',
      'secondLeg',
      'tubeDiameter',
    ]);
    assert.deepEqual(integrity.unusedParameterIds, []);

    assert.deepEqual(brepProjectParameterUsages(normalized, 'tubeDiameter'), [
      'body.profile.radius',
    ]);
    assert.deepEqual(brepProjectParameterUsages(normalized, 'firstLeg'), [
      'body.path.firstLegLength',
    ]);
    assert.deepEqual(brepProjectParameterUsages(normalized, 'secondLeg'), [
      'body.path.secondLegLength',
    ]);
    assert.deepEqual(brepProjectParameterUsages(normalized, 'bendRadius'), [
      'body.path.bendRadius',
    ]);
  });

  it('fails closed when section radius reaches or exceeds centerline bend radius', () => {
    const project = sweepProject();
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project,
          parameterValues: { tubeDiameter: 200, bendRadius: 100 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /profile radius must resolve smaller than bendRadius/.test(
          error.message,
        ),
    );

    const invalid = sweepProject();
    invalid.parameters.find(
      (parameter) => parameter.id === 'bendRadius',
    )!.default = 20;
    assert.throws(
      () => normalizeBrepProject(invalid),
      (error: unknown) =>
        error instanceof BrepProjectError &&
        error.code === 'invalid_parameter' &&
        /profile radius must resolve smaller than bendRadius/.test(
          error.message,
        ),
    );
  });

  it('revalidates every positive sweep dimension after runtime overrides', () => {
    const project = sweepProject();
    project.parameters.find((parameter) => parameter.id === 'firstLeg')!.min =
      -10;
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project,
          parameterValues: { firstLeg: 0 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /firstLegLength must resolve to a positive/.test(error.message),
    );
  });

  it('rejects non-circular profiles, non-planarElbow90 paths and hidden breadth fields', () => {
    const rectangle = structuredClone(sweepProject()) as unknown as Record<
      string,
      unknown
    >;
    const rectangleNodes = rectangle.nodes as Array<Record<string, unknown>>;
    rectangleNodes[0]!.profile = {
      type: 'rectangle',
      width: 40,
      height: 40,
    };
    assert.throws(
      () => normalizeBrepProject(rectangle),
      /profile must be one circle profile/,
    );

    const arbitraryPath = structuredClone(sweepProject()) as unknown as Record<
      string,
      unknown
    >;
    const arbitraryNodes = arbitraryPath.nodes as Array<
      Record<string, unknown>
    >;
    arbitraryNodes[0]!.path = {
      type: 'polyline',
      points: [
        [0, 0, 0],
        [100, 0, 0],
      ],
    };
    assert.throws(
      () => normalizeBrepProject(arbitraryPath),
      /path must be planarElbow90/,
    );

    const withAngle = structuredClone(sweepProject()) as unknown as Record<
      string,
      unknown
    >;
    const angleNodes = withAngle.nodes as Array<Record<string, unknown>>;
    const path = angleNodes[0]!.path as Record<string, unknown>;
    path.angleDeg = 90;
    assert.throws(
      () => normalizeBrepProject(withAngle),
      /planarElbow90 path contains unsupported fields/,
    );
  });
});
