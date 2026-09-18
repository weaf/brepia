import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  BREP_PROJECT_MAX_PROFILE_POINTS,
  BrepProjectError,
  brepNodeValueKind,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '../shared/brepProvider.ts';

function rectangleProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm4extrude',
    name: 'M4 rectangle extrusion',
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
        default: 40,
        min: -100,
        max: 100,
      },
      {
        id: 'depth',
        label: 'Extrusion depth',
        type: 'number',
        unit: 'mm',
        default: 12,
        min: -100,
        max: 100,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: {
          type: 'rectangle',
          width: { parameter: 'width' },
          height: 20,
        },
        axis: 'z',
        depth: { parameter: 'depth' },
      },
    ],
    resultNodeId: 'body',
  };
}

function polylineProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm4polyline',
    name: 'M4 polyline extrusion',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'span',
        label: 'Span',
        type: 'number',
        unit: 'mm',
        default: 20,
        min: 0,
        max: 100,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: {
          type: 'closedPolyline',
          points: [
            { u: 0, v: 0 },
            { u: { parameter: 'span' }, v: 0 },
            { u: { parameter: 'span' }, v: 10 },
            { u: 0, v: 10 },
          ],
        },
        axis: 'x',
        depth: 8,
      },
    ],
    resultNodeId: 'body',
  };
}

function expectProjectError(
  operation: () => unknown,
  code: BrepProjectError['code'],
): void {
  assert.throws(
    operation,
    (error: unknown) => error instanceof BrepProjectError && error.code === code,
  );
}

describe('M4 profile + extrusion canonical contract', () => {
  it('keeps schemaVersion 1 and returns one single body value', () => {
    const normalized = normalizeBrepProject(rectangleProject());
    const node = normalized.nodes[0]!;
    assert.equal(node.type, 'extrude');
    assert.equal(brepNodeValueKind(node), 'single');
    assert.equal(normalized.schemaVersion, 1);
  });

  it.each(['x', 'y', 'z'] as const)('accepts canonical %s extrusion axis', (axis) => {
    const project = rectangleProject();
    const node = project.nodes[0]!;
    assert.equal(node.type, 'extrude');
    if (node.type !== 'extrude') return;
    node.axis = axis;
    const normalized = normalizeBrepProject(project);
    assert.equal(normalized.nodes[0]!.type, 'extrude');
    assert.equal(
      normalized.nodes[0]!.type === 'extrude' ? normalized.nodes[0]!.axis : null,
      axis,
    );
  });

  it('accepts rectangle, circle and bounded closedPolyline profiles', () => {
    normalizeBrepProject(rectangleProject());

    const circle = rectangleProject();
    const circleNode = circle.nodes[0]!;
    assert.equal(circleNode.type, 'extrude');
    if (circleNode.type !== 'extrude') return;
    circleNode.profile = { type: 'circle', radius: 10 };
    normalizeBrepProject(circle);

    normalizeBrepProject(polylineProject());
  });

  it('bounds closedPolyline profiles to 3..32 vertices', () => {
    const tooFew = polylineProject();
    const tooFewNode = tooFew.nodes[0]!;
    if (tooFewNode.type !== 'extrude') return;
    tooFewNode.profile = {
      type: 'closedPolyline',
      points: [
        { u: 0, v: 0 },
        { u: 1, v: 1 },
      ],
    };
    expectProjectError(() => normalizeBrepProject(tooFew), 'invalid_node');

    const tooMany = polylineProject();
    const tooManyNode = tooMany.nodes[0]!;
    if (tooManyNode.type !== 'extrude') return;
    tooManyNode.profile = {
      type: 'closedPolyline',
      points: Array.from({ length: BREP_PROJECT_MAX_PROFILE_POINTS + 1 }, (_, index) => ({
        u: index,
        v: index % 2,
      })),
    };
    expectProjectError(() => normalizeBrepProject(tooMany), 'invalid_node');
  });

  it('requires positive rectangle/circle dimensions and extrusion depth', () => {
    for (const field of ['width', 'depth'] as const) {
      const project = rectangleProject();
      project.parameters.find((parameter) => parameter.id === field)!.default = 0;
      expectProjectError(() => normalizeBrepProject(project), 'invalid_parameter');
    }

    const circle = rectangleProject();
    const node = circle.nodes[0]!;
    if (node.type !== 'extrude') return;
    node.profile = { type: 'circle', radius: 0 };
    expectProjectError(() => normalizeBrepProject(circle), 'invalid_parameter');
  });

  it('rejects zero-length edges, zero area and self-intersecting closed polylines', () => {
    const duplicate = polylineProject();
    const duplicateNode = duplicate.nodes[0]!;
    if (duplicateNode.type !== 'extrude') return;
    duplicateNode.profile = {
      type: 'closedPolyline',
      points: [
        { u: 0, v: 0 },
        { u: 10, v: 0 },
        { u: 10, v: 0 },
        { u: 0, v: 10 },
      ],
    };
    expectProjectError(() => normalizeBrepProject(duplicate), 'invalid_parameter');

    const zeroArea = polylineProject();
    const zeroAreaNode = zeroArea.nodes[0]!;
    if (zeroAreaNode.type !== 'extrude') return;
    zeroAreaNode.profile = {
      type: 'closedPolyline',
      points: [
        { u: 0, v: 0 },
        { u: 10, v: 0 },
        { u: 20, v: 0 },
      ],
    };
    expectProjectError(() => normalizeBrepProject(zeroArea), 'invalid_parameter');

    const selfIntersecting = polylineProject();
    const selfIntersectingNode = selfIntersecting.nodes[0]!;
    if (selfIntersectingNode.type !== 'extrude') return;
    selfIntersectingNode.profile = {
      type: 'closedPolyline',
      points: [
        { u: 0, v: 0 },
        { u: 30, v: 0 },
        { u: 5, v: 20 },
        { u: 25, v: 20 },
        { u: 15, v: -10 },
      ],
    };
    expectProjectError(() => normalizeBrepProject(selfIntersecting), 'invalid_parameter');
  });

  it('revalidates profile geometry after effective runtime parameter overrides', () => {
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: polylineProject(),
          parameterValues: { span: 0 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value',
    );

    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: rectangleProject(),
          parameterValues: { width: -1, depth: 12 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /positive/.test(error.message),
    );
  });

  it('tracks extrusion/profile scalars through M0 effectiveness analysis', () => {
    const integrity = analyzeBrepProjectIntegrity(rectangleProject());
    assert.deepEqual(integrity.resultReachableNodeIds, ['body']);
    assert.deepEqual(integrity.effectiveParameterIds, ['depth', 'width']);
    assert.deepEqual(integrity.orphanNodeIds, []);
    assert.deepEqual(integrity.unusedParameterIds, []);
  });

  it('accepts M4 extrusion through canonical and finite provider authoring schemas', async () => {
    const input = {
      title: 'M4 profile extrusion',
      version: 'v1',
      project: rectangleProject(),
    };
    const canonical = await brepAiBuildInputSchema.safeParseAsync(input);
    const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync(input);
    assert.equal(canonical.success, true);
    assert.equal(provider.success, true);
  });

  it('keeps provider expression depth bounded inside profile and depth scalars', async () => {
    const project = rectangleProject();
    const node = project.nodes[0]!;
    if (node.type !== 'extrude' || node.profile.type !== 'rectangle') return;
    node.profile.width = {
      op: 'add',
      args: [
        {
          op: 'add',
          args: [
            { op: 'add', args: [{ parameter: 'width' }, 1] },
            1,
          ],
        },
        1,
      ],
    };
    const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync({
      title: 'Too deep',
      version: 'v1',
      project,
    });
    assert.equal(provider.success, false);
  });
});
