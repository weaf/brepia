import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { buildBrepDependencyGraph } from '@shared/brepProjectGraph';

describe('BRep dependency graph presentation model', () => {
  it('derives dependency depth, consumers and result flow without changing project order', () => {
    const graph = buildBrepDependencyGraph(phaseOneCabinetProject);

    expect(graph.nodes.map((node) => node.id)).toEqual(
      phaseOneCabinetProject.nodes.map((node) => node.id),
    );
    expect(graph.maxDepth).toBe(2);

    expect(graph.nodes.find((node) => node.id === 'cabinetBody')).toMatchObject({
      depth: 0,
      dependencies: [],
      consumers: ['cabinetWithCableHole'],
      isResult: false,
    });
    expect(graph.nodes.find((node) => node.id === 'cableHole')).toMatchObject({
      depth: 0,
      dependencies: [],
      consumers: ['positionedHole'],
      isResult: false,
    });
    expect(graph.nodes.find((node) => node.id === 'positionedHole')).toMatchObject({
      depth: 1,
      dependencies: ['cableHole'],
      consumers: ['cabinetWithCableHole'],
      isResult: false,
    });
    expect(
      graph.nodes.find((node) => node.id === 'cabinetWithCableHole'),
    ).toMatchObject({
      depth: 2,
      dependencies: ['cabinetBody', 'positionedHole'],
      consumers: [],
      isResult: true,
    });

    expect(graph.edges).toEqual([
      { source: 'cableHole', target: 'positionedHole' },
      { source: 'cabinetBody', target: 'cabinetWithCableHole' },
      { source: 'positionedHole', target: 'cabinetWithCableHole' },
    ]);
  });

  it('deduplicates repeated references for presentation edges', () => {
    const project = {
      ...phaseOneCabinetProject,
      nodes: phaseOneCabinetProject.nodes.map((node) =>
        node.id === 'cabinetWithCableHole' && node.type === 'subtract'
          ? { ...node, tools: ['cabinetBody', 'positionedHole', 'cabinetBody'] }
          : node,
      ),
    };

    const graph = buildBrepDependencyGraph(project);
    const result = graph.nodes.find(
      (node) => node.id === 'cabinetWithCableHole',
    );

    expect(result?.dependencies).toEqual(['cabinetBody', 'positionedHole']);
    expect(
      graph.edges.filter(
        (edge) =>
          edge.source === 'cabinetBody' &&
          edge.target === 'cabinetWithCableHole',
      ),
    ).toHaveLength(1);
  });

  it('fails closed if a non-canonical snapshot contains a missing dependency', () => {
    const project = {
      ...phaseOneCabinetProject,
      nodes: phaseOneCabinetProject.nodes.map((node) =>
        node.id === 'positionedHole' && node.type === 'transform'
          ? { ...node, input: 'missingNode' }
          : node,
      ),
    };

    expect(() => buildBrepDependencyGraph(project)).toThrow(/missing node/i);
  });

  it('fails closed if a non-canonical snapshot contains a cycle', () => {
    const project = {
      ...phaseOneCabinetProject,
      nodes: phaseOneCabinetProject.nodes.map((node) =>
        node.id === 'positionedHole' && node.type === 'transform'
          ? { ...node, input: 'cabinetWithCableHole' }
          : node,
      ),
    };

    expect(() => buildBrepDependencyGraph(project)).toThrow(/cycle/i);
  });
});
