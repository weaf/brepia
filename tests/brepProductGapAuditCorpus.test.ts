import { describe, expect, it } from 'vitest';
import {
  BREP_PRODUCT_GAP_TARGETS,
  brepProductGapTarget,
} from './brepProductGapAuditTargets';

describe('bounded BRep product-gap audit corpus', () => {
  it('locks exactly the five approved target families A-E', () => {
    expect(Object.keys(BREP_PRODUCT_GAP_TARGETS)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
  });

  it.each(Object.values(BREP_PRODUCT_GAP_TARGETS))(
    '$id publishes a perturbable parameter and keeps the canonical boundary explicit',
    (target) => {
      expect(target.prompt).toContain(target.perturbation.label);
      expect(target.prompt).toContain('schemaVersion 1');
      expect(target.prompt).toContain('current canonical Native BRep schema');
      expect(target.prompt).toContain(
        'do not add decorative or orphan controls',
      );
      expect(target.prompt).toContain('Do not invent unsupported node types');
    },
  );

  it('makes only the path-based target tolerant of a truthful no-project outcome', () => {
    expect(BREP_PRODUCT_GAP_TARGETS.E.allowTerminalWithoutProject).toBe(true);
    for (const id of ['A', 'B', 'C', 'D'] as const) {
      expect(BREP_PRODUCT_GAP_TARGETS[id].allowTerminalWithoutProject).not.toBe(
        true,
      );
    }
  });

  it('rejects an unknown audit target before opening a product session', () => {
    expect(() => brepProductGapTarget('F')).toThrow(
      /must be one of A, B, C, D, E/,
    );
  });
});
