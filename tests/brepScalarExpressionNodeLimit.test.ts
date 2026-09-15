import { describe, expect, it } from 'vitest';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
  type BrepScalar,
} from '../shared/brepProject';
import { BREP_SCALAR_EXPRESSION_MAX_NODES } from '../shared/brepScalar';

function balancedAddTree(depth: number): BrepScalar {
  if (depth === 0) return { parameter: 'width' };
  return {
    op: 'add',
    args: [balancedAddTree(depth - 1), balancedAddTree(depth - 1)],
  };
}

describe('BRep M1 scalar expression node bound', () => {
  it('rejects a shallow expression tree whose expression-node count exceeds the canonical limit', () => {
    const expression = balancedAddTree(7);
    expect(2 ** 7 - 1).toBeGreaterThan(BREP_SCALAR_EXPRESSION_MAX_NODES);

    const project: BrepProject = {
      schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
      id: 'nodeLimitFixture',
      name: 'Node limit fixture',
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
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'box',
          width: expression,
          depth: 100,
          height: 100,
        },
      ],
      resultNodeId: 'body',
    };

    try {
      normalizeBrepProject(project);
    } catch (error) {
      expect(error).toBeInstanceOf(BrepProjectError);
      expect((error as BrepProjectError).code).toBe('invalid_node');
      return;
    }
    throw new Error('Expected the over-limit scalar expression to be rejected.');
  });
});
