import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { normalizeBrepProject } from '@shared/brepProject';
import {
  addBrepProjectNode,
  brepNodeConsumers,
  brepNodeDependencies,
  deleteBrepProjectNode,
  replaceExistingBrepProjectNode,
  setBrepProjectResultNode,
  suggestBrepNodeId,
} from '@shared/brepProjectEditing';

describe('BRep existing-node editing', () => {
  it('replaces one existing node while preserving stable project structure', () => {
    const canonicalBaseline = normalizeBrepProject(phaseOneCabinetProject);
    const current = canonicalBaseline.nodes.find(
      (node) => node.id === 'cabinetBody',
    );
    expect(current?.type).toBe('box');
    if (!current || current.type !== 'box') throw new Error('Missing box node');

    const next = replaceExistingBrepProjectNode(
      canonicalBaseline,
      current.id,
      { ...current, depth: 700 },
    );

    expect(next.id).toBe(canonicalBaseline.id);
    expect(next.resultNodeId).toBe(canonicalBaseline.resultNodeId);
    expect(next.placement).toEqual(canonicalBaseline.placement);
    expect(next.metadata).toEqual(canonicalBaseline.metadata);
    expect(next.parameters).toEqual(canonicalBaseline.parameters);
    expect(next.nodes.map((node) => node.id)).toEqual(
      canonicalBaseline.nodes.map((node) => node.id),
    );
    expect(next.nodes.find((node) => node.id === current.id)).toMatchObject({
      id: current.id,
      type: 'box',
      depth: 700,
    });
  });

  it('keeps stable IDs and node types locked for existing nodes', () => {
    const current = phaseOneCabinetProject.nodes[0];

    expect(() =>
      replaceExistingBrepProjectNode(phaseOneCabinetProject, current.id, {
        ...current,
        id: 'renamedNode',
      }),
    ).toThrow(/stable.*cannot be renamed/i);

    expect(() =>
      replaceExistingBrepProjectNode(phaseOneCabinetProject, current.id, {
        id: current.id,
        type: 'cylinder',
        radius: 10,
        height: 20,
      }),
    ).toThrow(/types cannot be changed/i);
  });

  it('reuses canonical DAG validation and rejects a cyclic edit', () => {
    const transform = phaseOneCabinetProject.nodes.find(
      (node) => node.id === 'positionedHole',
    );
    expect(transform?.type).toBe('transform');
    if (!transform || transform.type !== 'transform') {
      throw new Error('Missing transform node');
    }

    expect(() =>
      replaceExistingBrepProjectNode(
        phaseOneCabinetProject,
        transform.id,
        { ...transform, input: 'cabinetWithCableHole' },
      ),
    ).toThrow(/cycle/i);
  });

  it('reuses canonical parameter-unit validation for edited scalar references', () => {
    const project = normalizeBrepProject({
      ...phaseOneCabinetProject,
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'angle',
          label: 'Angle',
          type: 'number',
          unit: 'deg',
          default: 15,
        },
      ],
    });
    const box = project.nodes.find((node) => node.id === 'cabinetBody');
    if (!box || box.type !== 'box') throw new Error('Missing box node');

    expect(() =>
      replaceExistingBrepProjectNode(project, box.id, {
        ...box,
        width: { parameter: 'angle' },
      }),
    ).toThrow(/unit mm/i);
  });

  it('summarizes dependencies and consumers from canonical node semantics', () => {
    expect(
      brepNodeDependencies(
        phaseOneCabinetProject.nodes.find(
          (node) => node.id === 'cabinetWithCableHole',
        )!,
      ),
    ).toEqual(['cabinetBody', 'positionedHole']);
    expect(brepNodeConsumers(phaseOneCabinetProject, 'cableHole')).toEqual([
      'positionedHole',
    ]);
  });
});

describe('BRep structural DAG authoring', () => {
  it('suggests a deterministic fresh ID without mutating the project', () => {
    const project = normalizeBrepProject({
      ...phaseOneCabinetProject,
      nodes: [
        ...phaseOneCabinetProject.nodes,
        { id: 'box', type: 'box', width: 10, depth: 10, height: 10 },
        { id: 'box2', type: 'box', width: 20, depth: 20, height: 20 },
      ],
    });
    const before = JSON.stringify(project);

    expect(suggestBrepNodeId(project, 'box')).toBe('box3');
    expect(JSON.stringify(project)).toBe(before);
  });

  it('adds a new stable node while preserving the explicit current result', () => {
    const next = addBrepProjectNode(phaseOneCabinetProject, {
      id: 'inspectionBoss',
      type: 'cylinder',
      radius: 15,
      height: 20,
    });

    expect(next.resultNodeId).toBe(phaseOneCabinetProject.resultNodeId);
    expect(next.nodes.find((node) => node.id === 'inspectionBoss')).toEqual({
      id: 'inspectionBoss',
      type: 'cylinder',
      radius: 15,
      height: 20,
    });
    expect(() =>
      addBrepProjectNode(next, {
        id: 'inspectionBoss',
        type: 'box',
        width: 10,
        depth: 10,
        height: 10,
      }),
    ).toThrow(/already exists/i);
  });

  it('adds referenced nodes through the same canonical dependency validation', () => {
    const next = addBrepProjectNode(phaseOneCabinetProject, {
      id: 'raisedCabinet',
      type: 'transform',
      input: 'cabinetWithCableHole',
      translate: [0, 0, 100],
    });

    expect(
      next.nodes.find((node) => node.id === 'raisedCabinet'),
    ).toMatchObject({
      type: 'transform',
      input: 'cabinetWithCableHole',
    });
    expect(() =>
      addBrepProjectNode(phaseOneCabinetProject, {
        id: 'badTransform',
        type: 'transform',
        input: 'missingNode',
        translate: [0, 0, 10],
      }),
    ).toThrow(/unknown node missingNode/i);
  });

  it('changes only the explicit result authority when selecting a result node', () => {
    const canonical = normalizeBrepProject(phaseOneCabinetProject);
    const next = setBrepProjectResultNode(canonical, 'cableHole');

    expect(next.resultNodeId).toBe('cableHole');
    expect(next.nodes).toEqual(canonical.nodes);
    expect(() => setBrepProjectResultNode(canonical, 'missingNode')).toThrow(
      /does not exist/i,
    );
  });

  it('deletes only unreferenced non-result nodes and never cascades implicitly', () => {
    const withDetachedNode = addBrepProjectNode(phaseOneCabinetProject, {
      id: 'detachedBox',
      type: 'box',
      width: 10,
      depth: 20,
      height: 30,
    });
    const deleted = deleteBrepProjectNode(withDetachedNode, 'detachedBox');

    expect(deleted.nodes.some((node) => node.id === 'detachedBox')).toBe(false);
    expect(deleted.resultNodeId).toBe(phaseOneCabinetProject.resultNodeId);

    expect(() =>
      deleteBrepProjectNode(
        phaseOneCabinetProject,
        phaseOneCabinetProject.resultNodeId,
      ),
    ).toThrow(/current result.*another result/i);
    expect(() =>
      deleteBrepProjectNode(phaseOneCabinetProject, 'cableHole'),
    ).toThrow(/used by positionedHole.*rewire/i);
  });
});
