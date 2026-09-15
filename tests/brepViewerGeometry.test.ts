import { describe, expect, it } from 'vitest';
import { brepViewerGeometryFromResult } from '@/components/brep/brepViewerGeometry';
import type { BrepEvaluationSuccess } from '@shared/brepProvider';

function result(): BrepEvaluationSuccess {
  return {
    status: 'success',
    provider: {
      id: 'build123d-occt',
      providerVersion: '0.3.0',
      kernelVersion: 'test',
    },
    projectId: 'pattern-project',
    resultNodeId: 'pattern',
    resultKind: 'instanceSet',
    bodies: [
      {
        id: 'pattern::0',
        nodeId: 'pattern',
        instance: { index: 0, sourceNodeId: 'body' },
        bounds: { min: [0, 0, 0], max: [1, 1, 0] },
        viewerMesh: {
          bodyId: 'pattern::0',
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
          indices: [0, 1, 2],
        },
      },
      {
        id: 'pattern::1',
        nodeId: 'pattern',
        instance: { index: 1, sourceNodeId: 'body' },
        bounds: { min: [10, 0, 0], max: [11, 1, 0] },
        viewerMesh: {
          bodyId: 'pattern::1',
          positions: [10, 0, 0, 11, 0, 0, 10, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
          indices: [0, 1, 2],
        },
      },
    ],
    bounds: { min: [0, 0, 0], max: [11, 1, 0] },
    projectObject: {
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
        zAxis: [0, 0, 1],
      },
      geometry: {},
      points: [],
    },
    warnings: [],
    exactExport: { format: 'step', available: true },
  };
}

describe('M3B BRep viewer geometry aggregation', () => {
  it('renders every explicit result body and offsets each index buffer', () => {
    const geometry = brepViewerGeometryFromResult(result());
    expect(geometry).not.toBeNull();
    expect(Array.from(geometry!.getAttribute('position').array)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      10, 0, 0, 11, 0, 0, 10, 1, 0,
    ]);
    expect(Array.from(geometry!.getIndex()!.array)).toEqual([0, 1, 2, 3, 4, 5]);
    geometry!.dispose();
  });

  it('fails closed instead of displaying only part of an instance set', () => {
    const partial = result();
    partial.bodies[1] = { ...partial.bodies[1]!, viewerMesh: undefined };
    expect(brepViewerGeometryFromResult(partial)).toBeNull();
  });
});
