import { BrepScalarEvaluationError } from './brepScalar.ts';

export type BrepResolvedProfilePoint = readonly [number, number];
export type BrepProfileOperation = 'extrude' | 'revolve';

function samePoint(
  left: BrepResolvedProfilePoint,
  right: BrepResolvedProfilePoint,
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function orientation(
  a: BrepResolvedProfilePoint,
  b: BrepResolvedProfilePoint,
  c: BrepResolvedProfilePoint,
): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(
  a: BrepResolvedProfilePoint,
  b: BrepResolvedProfilePoint,
  point: BrepResolvedProfilePoint,
): boolean {
  return (
    orientation(a, b, point) === 0 &&
    point[0] >= Math.min(a[0], b[0]) &&
    point[0] <= Math.max(a[0], b[0]) &&
    point[1] >= Math.min(a[1], b[1]) &&
    point[1] <= Math.max(a[1], b[1])
  );
}

function segmentsIntersect(
  a: BrepResolvedProfilePoint,
  b: BrepResolvedProfilePoint,
  c: BrepResolvedProfilePoint,
  d: BrepResolvedProfilePoint,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (
    ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
    ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
  ) {
    return true;
  }

  return (
    (abC === 0 && onSegment(a, b, c)) ||
    (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) ||
    (cdB === 0 && onSegment(c, d, b))
  );
}

function edgesAreAdjacent(left: number, right: number, edgeCount: number): boolean {
  return (
    left === right ||
    (left + 1) % edgeCount === right ||
    (right + 1) % edgeCount === left
  );
}

/**
 * Validate an already-resolved closed polyline boundary before either geometry
 * kernel sees it. Closure is implicit: the last point is connected to point 0.
 */
export function validateBrepClosedPolylineProfilePoints(
  points: readonly BrepResolvedProfilePoint[],
  nodeId: string,
  operation: BrepProfileOperation = 'extrude',
): void {
  const owner = `BRep ${operation} ${nodeId}`;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    if (samePoint(points[index]!, points[next]!)) {
      throw new BrepScalarEvaluationError(
        `${owner} closedPolyline profile contains a zero-length edge at index ${index}.`,
      );
    }
  }

  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubledArea += current[0] * next[1] - next[0] * current[1];
  }
  if (doubledArea === 0) {
    throw new BrepScalarEvaluationError(
      `${owner} closedPolyline profile must have non-zero area.`,
    );
  }

  for (let left = 0; left < points.length; left += 1) {
    const leftNext = (left + 1) % points.length;
    for (let right = left + 1; right < points.length; right += 1) {
      if (edgesAreAdjacent(left, right, points.length)) continue;
      const rightNext = (right + 1) % points.length;
      if (
        segmentsIntersect(
          points[left]!,
          points[leftNext]!,
          points[right]!,
          points[rightNext]!,
        )
      ) {
        throw new BrepScalarEvaluationError(
          `${owner} closedPolyline profile self-intersects between edges ${left} and ${right}.`,
        );
      }
    }
  }
}
