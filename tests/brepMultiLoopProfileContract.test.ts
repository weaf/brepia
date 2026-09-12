import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  BREP_PROJECT_MAX_PROFILE_HOLES,
  BREP_PROJECT_MAX_PROFILE_POINTS,
  BREP_PROJECT_MAX_PROFILE_TOTAL_POINTS,
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
  type BrepScalar,
} from '../shared/brepProject.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '../shared/brepProvider.ts';

function positiveHoleOffset(): BrepScalar {
  return {
    op: 'sub',
    args: [
      { op: 'div', args: [{ parameter: 'width' }, 2] },
      { parameter: 'margin' },
    ],
  };
}

function multiLoopProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'multiloop',
    name: 'Bounded multi-loop extrusion',
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
        min: 60,
        max: 140,
      },
      {
        id: 'margin',
        label: 'Hole margin',
        type: 'number',
        unit: 'mm',
        default: 15,
        min: 5,
        max: 30,
      },
      {
        id: 'holeRadius',
        label: 'Hole radius',
        type: 'number',
        unit: 'mm',
        default: 5,
        min: 2,
        max: 12,
      },
      {
        id: 'depth',
        label: 'Depth',
        type: 'number',
        unit: 'mm',
        default: 12,
        min: 1,
        max: 30,
      },
    ],
    nodes: [
      {
        id: 'plate',
        type: 'extrude',
        profile: {
          type: 'rectangle',
          width: { parameter: 'width' },
          height: 60,
          holes: [
            {
              loop: { type: 'circle', radius: { parameter: 'holeRadius' } },
              offsetU: positiveHoleOffset(),
              offsetV: 0,
            },
            {
              loop: { type: 'circle', radius: { parameter: 'holeRadius' } },
              offsetU: { op: 'neg', args: [positiveHoleOffset()] },
              offsetV: 0,
            },
          ],
        },
        axis: 'z',
        depth: { parameter: 'depth' },
      },
    ],
    resultNodeId: 'plate',
  };
}

function legacyProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'legacy',
    name: 'Legacy M4 profile',
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
        default: 80,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'extrude',
        profile: {
          type: 'rectangle',
          width: { parameter: 'width' },
          height: 40,
        },
        axis: 'z',
        depth: 10,
      },
    ],
    resultNodeId: 'body',
  };
}

function expectProjectError(
  operation: () => unknown,
  code: BrepProjectError['code'],
  pattern?: RegExp,
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof BrepProjectError &&
      error.code === code &&
      (!pattern || pattern.test(error.message)),
  );
}

describe('bounded multi-loop canonical extrusion contract', () => {
  it('preserves legacy single-loop M4 shape and schemaVersion 1 exactly', () => {
    const normalized = normalizeBrepProject(legacyProject());
    const node = normalized.nodes[0]!;
    assert.equal(normalized.schemaVersion, 1);
    assert.equal(node.type, 'extrude');
    if (node.type !== 'extrude') return;
    assert.deepEqual(node.profile, {
      type: 'rectangle',
      width: { parameter: 'width' },
      height: 40,
    });
  });

  it('accepts ordered non-recursive holes and preserves scalar ASTs', () => {
    const source = multiLoopProject();
    const sourceNode = source.nodes[0]!;
    assert.equal(sourceNode.type, 'extrude');
    if (sourceNode.type !== 'extrude') return;
    const expectedOffset = sourceNode.profile.holes?.[0]?.offsetU;

    const normalized = normalizeBrepProject(source);
    const node = normalized.nodes[0]!;
    assert.equal(node.type, 'extrude');
    if (node.type !== 'extrude') return;
    assert.equal(node.profile.holes?.length, 2);
    assert.deepEqual(
      node.profile.holes?.map((hole) => hole.loop.type),
      ['circle', 'circle'],
    );
    assert.deepEqual(node.profile.holes?.[0]?.offsetU, expectedOffset);
  });

  it('canonicalizes an explicitly empty holes array back to the legacy profile shape', () => {
    const project = legacyProject();
    const node = project.nodes[0]!;
    if (node.type !== 'extrude') return;
    node.profile = { ...node.profile, holes: [] };

    const normalized = normalizeBrepProject(project);
    const normalizedNode = normalized.nodes[0]!;
    assert.equal(normalizedNode.type, 'extrude');
    if (normalizedNode.type !== 'extrude') return;
    assert.equal('holes' in normalizedNode.profile, false);
  });

  it('tracks hole dimensions and offsets through M0 parameter effectiveness', () => {
    const integrity = analyzeBrepProjectIntegrity(multiLoopProject());
    assert.deepEqual(integrity.resultReachableNodeIds, ['plate']);
    assert.deepEqual(
      integrity.effectiveParameterIds,
      ['depth', 'holeRadius', 'margin', 'width'],
    );
    assert.deepEqual(integrity.unusedParameterIds, []);
  });

  it('revalidates strict containment after effective runtime overrides', () => {
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: multiLoopProject(),
          parameterValues: { margin: 5 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /strictly inside/.test(error.message),
    );
  });

  it('rejects more than the bounded hole count before geometry execution', () => {
    const project = legacyProject() as unknown as Record<string, unknown>;
    const nodes = project.nodes as Array<Record<string, unknown>>;
    const node = nodes[0]!;
    node.profile = {
      type: 'rectangle',
      width: 100,
      height: 80,
      holes: Array.from({ length: BREP_PROJECT_MAX_PROFILE_HOLES + 1 }, (_, index) => ({
        loop: { type: 'circle', radius: 2 },
        offsetU: index * 5,
        offsetV: 0,
      })),
    };
    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_node',
      /more than 8 holes/,
    );
  });

  it('rejects nested hole grammar instead of silently dropping it', () => {
    const project = legacyProject() as unknown as Record<string, unknown>;
    const nodes = project.nodes as Array<Record<string, unknown>>;
    const node = nodes[0]!;
    node.profile = {
      type: 'rectangle',
      width: 100,
      height: 80,
      holes: [
        {
          loop: { type: 'circle', radius: 5, holes: [] },
          offsetU: 0,
          offsetV: 0,
        },
      ],
    };
    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_node',
      /cannot contain nested holes/,
    );
  });

  it('rejects profile point totals above the cross-loop bound', () => {
    const makePoints = (offset: number) =>
      Array.from({ length: BREP_PROJECT_MAX_PROFILE_POINTS }, (_, index) => ({
        u: offset + index,
        v: index % 2,
      }));
    const project = legacyProject() as unknown as Record<string, unknown>;
    const nodes = project.nodes as Array<Record<string, unknown>>;
    const node = nodes[0]!;
    node.profile = {
      type: 'closedPolyline',
      points: makePoints(0),
      holes: Array.from({ length: 4 }, (_, index) => ({
        loop: { type: 'closedPolyline', points: makePoints((index + 1) * 100) },
        offsetU: 0,
        offsetV: 0,
      })),
    };
    assert.equal(
      BREP_PROJECT_MAX_PROFILE_POINTS * 5 > BREP_PROJECT_MAX_PROFILE_TOTAL_POINTS,
      true,
    );
    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_node',
      /128 explicit closedPolyline points/,
    );
  });

  it('keeps profile holes extrusion-only in the first slice', () => {
    const project = legacyProject() as unknown as Record<string, unknown>;
    const nodes = project.nodes as Array<Record<string, unknown>>;
    nodes[0] = {
      id: 'body',
      type: 'revolve',
      axis: 'z',
      profile: {
        type: 'closedPolyline',
        points: [
          { u: -20, v: 8 },
          { u: 20, v: 8 },
          { u: 20, v: 20 },
          { u: -20, v: 20 },
        ],
        holes: [
          {
            loop: { type: 'circle', radius: 2 },
            offsetU: 0,
            offsetV: 12,
          },
        ],
      },
    };
    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_node',
      /does not support profile holes/,
    );
  });

  it('rejects invalid default hole geometry through the same canonical gate', () => {
    const project = multiLoopProject();
    const node = project.nodes[0]!;
    if (node.type !== 'extrude') return;
    const firstHole = node.profile.holes?.[0];
    assert.ok(firstHole);
    firstHole.offsetU = 45;
    firstHole.offsetV = 0;

    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_parameter',
      /strictly inside/,
    );
  });
});
