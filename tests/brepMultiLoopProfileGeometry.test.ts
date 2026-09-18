import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  validateBrepMultiLoopProfileGeometry,
  type BrepResolvedProfileLoop,
} from '../shared/brepProfileGeometry.ts';
import { BrepScalarEvaluationError } from '../shared/brepScalar.ts';

const outerRectangle: BrepResolvedProfileLoop = {
  type: 'rectangle',
  centerU: 0,
  centerV: 0,
  width: 100,
  height: 60,
};

function circle(centerU: number, centerV: number, radius: number): BrepResolvedProfileLoop {
  return { type: 'circle', centerU, centerV, radius };
}

function expectGeometryError(operation: () => unknown, pattern: RegExp): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof BrepScalarEvaluationError && pattern.test(error.message),
  );
}

describe('bounded multi-loop profile geometry predicates', () => {
  it('accepts a centered circular hole strictly inside a rectangular outer loop', () => {
    validateBrepMultiLoopProfileGeometry(
      outerRectangle,
      [circle(0, 0, 10)],
      'plate',
    );
  });

  it('accepts separated holes while preserving geometry-independent array order', () => {
    const left = circle(-25, 0, 6);
    const right: BrepResolvedProfileLoop = {
      type: 'rectangle',
      centerU: 25,
      centerV: 0,
      width: 12,
      height: 10,
    };
    validateBrepMultiLoopProfileGeometry(outerRectangle, [left, right], 'plate');
    validateBrepMultiLoopProfileGeometry(outerRectangle, [right, left], 'plate');
  });

  it('accepts a non-circular closedPolyline hole', () => {
    validateBrepMultiLoopProfileGeometry(
      outerRectangle,
      [
        {
          type: 'closedPolyline',
          points: [
            [-12, -5],
            [12, -5],
            [8, 7],
            [-8, 7],
          ],
        },
      ],
      'plate',
    );
  });

  it('rejects a hole outside or crossing the outer boundary', () => {
    expectGeometryError(
      () => validateBrepMultiLoopProfileGeometry(outerRectangle, [circle(48, 0, 5)], 'plate'),
      /strictly inside/,
    );
    expectGeometryError(
      () => validateBrepMultiLoopProfileGeometry(outerRectangle, [circle(60, 0, 5)], 'plate'),
      /strictly inside/,
    );
  });

  it('rejects a hole tangent to the outer boundary', () => {
    expectGeometryError(
      () => validateBrepMultiLoopProfileGeometry(outerRectangle, [circle(45, 0, 5)], 'plate'),
      /strictly inside/,
    );
  });

  it('rejects intersecting or tangent sibling holes', () => {
    expectGeometryError(
      () =>
        validateBrepMultiLoopProfileGeometry(
          outerRectangle,
          [circle(-4, 0, 6), circle(4, 0, 6)],
          'plate',
        ),
      /disjoint, non-touching, and non-nested/,
    );
    expectGeometryError(
      () =>
        validateBrepMultiLoopProfileGeometry(
          outerRectangle,
          [circle(-5, 0, 5), circle(5, 0, 5)],
          'plate',
        ),
      /disjoint, non-touching, and non-nested/,
    );
  });

  it('rejects nested sibling holes even when their boundaries do not intersect', () => {
    expectGeometryError(
      () =>
        validateBrepMultiLoopProfileGeometry(
          outerRectangle,
          [circle(0, 0, 12), circle(0, 0, 4)],
          'plate',
        ),
      /disjoint, non-touching, and non-nested/,
    );
  });

  it('handles a closedPolyline outer boundary without relying on winding', () => {
    const clockwiseOuter: BrepResolvedProfileLoop = {
      type: 'closedPolyline',
      points: [
        [-50, -30],
        [-50, 30],
        [50, 30],
        [50, -30],
      ],
    };
    validateBrepMultiLoopProfileGeometry(clockwiseOuter, [circle(0, 0, 8)], 'plate');
  });
});
