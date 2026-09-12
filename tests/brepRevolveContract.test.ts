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

function steppedBushing(axis: BrepAxis = 'x'): BrepProject {
  return {
    schemaVersion: 1,
    id: 'revolveBushing',
    name: 'Bounded revolve stepped bushing',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [],
    nodes: [
      {
        id: 'body',
        type: 'revolve',
        axis,
        profile: {
          type: 'closedPolyline',
          points: [
            { u: -30, v: 8 },
            { u: -30, v: 16 },
            { u: -18, v: 16 },
            { u: -18, v: 13 },
            { u: 18, v: 13 },
            { u: 18, v: 16 },
            { u: 30, v: 16 },
            { u: 30, v: 8 },
          ],
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function parameterizedBushing(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'revolveParameterized',
    name: 'Parameterized bounded revolve',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'outerRadius',
        label: 'Outer radius',
        type: 'number',
        unit: 'mm',
        default: 18,
        min: 1,
        max: 100,
      },
      {
        id: 'length',
        label: 'Length',
        type: 'number',
        unit: 'mm',
        default: 40,
        min: 1,
        max: 200,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'revolve',
        axis: 'z',
        profile: {
          type: 'closedPolyline',
          points: [
            {
              u: {
                op: 'neg',
                args: [{ op: 'mul', args: [{ parameter: 'length' }, 0.5] }],
              },
              v: 8,
            },
            {
              u: {
                op: 'neg',
                args: [{ op: 'mul', args: [{ parameter: 'length' }, 0.5] }],
              },
              v: { parameter: 'outerRadius' },
            },
            {
              u: { op: 'mul', args: [{ parameter: 'length' }, 0.5] },
              v: { parameter: 'outerRadius' },
            },
            {
              u: { op: 'mul', args: [{ parameter: 'length' }, 0.5] },
              v: 8,
            },
          ],
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function expectProjectError(project: BrepProject, pattern: RegExp): void {
  assert.throws(
    () => normalizeBrepProject(project),
    (error: unknown) =>
      error instanceof BrepProjectError &&
      error.code === 'invalid_parameter' &&
      pattern.test(error.message),
  );
}

describe('bounded full revolve canonical contract', () => {
  it.each(['x', 'y', 'z'] as const)(
    'keeps schemaVersion 1 and a single result on canonical %s axis',
    (axis) => {
      const normalized = normalizeBrepProject(steppedBushing(axis));
      const node = normalized.nodes[0]!;
      assert.equal(node.type, 'revolve');
      assert.equal(node.type === 'revolve' ? node.axis : null, axis);
      assert.equal(brepNodeValueKind(node), 'single');
      assert.deepEqual(brepNodeDependencies(node), []);
      assert.equal(normalized.schemaVersion, 1);
    },
  );

  it('accepts the locked axis-adjacent profile with a non-zero v=0 boundary segment', () => {
    const project = steppedBushing();
    const node = project.nodes[0]!;
    if (node.type !== 'revolve') return;
    node.profile = {
      type: 'closedPolyline',
      points: [
        { u: -20, v: 0 },
        { u: -20, v: 12 },
        { u: -5, v: 12 },
        { u: -5, v: 9 },
        { u: 20, v: 9 },
        { u: 20, v: 0 },
      ],
    };
    normalizeBrepProject(project);
  });

  it('rejects an explicit profile crossing the rotation axis', () => {
    const project = steppedBushing();
    const node = project.nodes[0]!;
    if (node.type !== 'revolve') return;
    node.profile = {
      type: 'closedPolyline',
      points: [
        { u: -20, v: -2 },
        { u: -20, v: 12 },
        { u: 20, v: 12 },
        { u: 20, v: -2 },
      ],
    };
    expectProjectError(project, /must not cross the rotation axis/);
  });

  it('rejects isolated point-only contact with the rotation axis', () => {
    const project = steppedBushing();
    const node = project.nodes[0]!;
    if (node.type !== 'revolve') return;
    node.profile = {
      type: 'closedPolyline',
      points: [
        { u: -20, v: 4 },
        { u: 0, v: 0 },
        { u: 20, v: 4 },
        { u: 20, v: 12 },
        { u: -20, v: 12 },
      ],
    };
    expectProjectError(project, /only through a non-zero-length boundary segment/);
  });

  it('rejects centered rectangle/circle for revolve without changing M4 extrusion semantics', () => {
    for (const profile of [
      { type: 'rectangle' as const, width: 20, height: 10 },
      { type: 'circle' as const, radius: 10 },
    ]) {
      const revolve = steppedBushing();
      const revolveNode = revolve.nodes[0]!;
      if (revolveNode.type !== 'revolve') continue;
      revolveNode.profile = profile;
      expectProjectError(revolve, /currently requires a closedPolyline profile/);

      const extrude: BrepProject = {
        ...revolve,
        id: `extrude${profile.type}`,
        name: `M4 ${profile.type} regression`,
        nodes: [
          {
            id: 'body',
            type: 'extrude',
            axis: 'z',
            depth: 8,
            profile,
          },
        ],
      };
      normalizeBrepProject(extrude);
    }
  });

  it('tracks radial and axial profile parameters as M0-effective', () => {
    const project = parameterizedBushing();
    const normalized = normalizeBrepProject(project);
    const integrity = analyzeBrepProjectIntegrity(normalized);
    assert.deepEqual(integrity.resultReachableNodeIds, ['body']);
    assert.deepEqual(integrity.effectiveParameterIds, ['length', 'outerRadius']);
    assert.deepEqual(integrity.unusedParameterIds, []);
    assert.ok(
      brepProjectParameterUsages(normalized, 'outerRadius').some((usage) =>
        usage.includes('.profile.points['),
      ),
    );
    assert.ok(
      brepProjectParameterUsages(normalized, 'length').some((usage) =>
        usage.includes('.profile.points['),
      ),
    );
  });

  it('revalidates radial admissibility after runtime parameter overrides', () => {
    const project = steppedBushing();
    project.parameters = [
      {
        id: 'innerRadius',
        label: 'Inner radius',
        type: 'number',
        unit: 'mm',
        default: 8,
        min: -10,
        max: 20,
      },
    ];
    const node = project.nodes[0]!;
    if (node.type !== 'revolve' || node.profile.type !== 'closedPolyline') return;
    node.profile.points[0]!.v = { parameter: 'innerRadius' };
    node.profile.points[node.profile.points.length - 1]!.v = {
      parameter: 'innerRadius',
    };

    normalizeBrepEvaluationRequest({
      project,
      parameterValues: { innerRadius: 6 },
    });

    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project,
          parameterValues: { innerRadius: -1 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /must not cross the rotation axis/.test(error.message),
    );
  });
});
