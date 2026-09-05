import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { normalizeBrepProject } from '@shared/brepProject';
import {
  brepNodeDependencies,
  replaceExistingBrepProjectNode,
} from '@shared/brepProjectEditing';

describe('BRep existing-node editing', () => {
  it('replaces one existing node while preserving stable project structure', () => {
    const current = phaseOneCabinetProject.nodes.find(
      (node) => node.id === 'cabinetBody',
    );
    expect(current?.type).toBe('box');
    if (!current || current.type !== 'box') throw new Error('Missing box node');

    const next = replaceExistingBrepProjectNode(
      phaseOneCabinetProject,
      current.id,
      { ...current, depth: 700 },
    );

    expect(next.id).toBe(phaseOneCabinetProject.id);
    expect(next.resultNodeId).toBe(phaseOneCabinetProject.resultNodeId);
    expect(next.placement).toEqual(phaseOneCabinetProject.placement);
    expect(next.metadata).toEqual(phaseOneCabinetProject.metadata);
    expect(next.parameters).toEqual(phaseOneCabinetProject.parameters);
    expect(next.nodes.map((node) => node.id)).toEqual(
      phaseOneCabinetProject.nodes.map((node) => node.id),
    );
    expect(next.nodes.find((node) => node.id === current.id)).toMatchObject({
      id: current.id,
      type: 'box',
      depth: 700,
    });
  });

  it('keeps stable IDs and node types locked in the Phase 4A helper', () => {
    const current = phaseOneCabinetProject.nodes[0];

    expect(() =>
      replaceExistingBrepProjectNode(phaseOneCabinetProject, current.id, {
        ...current,
        id: 'renamedNode',
      }),
    ).toThrow(/cannot rename stable BRep node IDs/i);

    expect(() =>
      replaceExistingBrepProjectNode(phaseOneCabinetProject, current.id, {
        id: current.id,
        type: 'cylinder',
        radius: 10,
        height: 20,
      }),
    ).toThrow(/cannot change BRep node type/i);
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

  it('summarizes dependencies from the same canonical node semantics', () => {
    expect(
      brepNodeDependencies(
        phaseOneCabinetProject.nodes.find(
          (node) => node.id === 'cabinetWithCableHole',
        )!,
      ),
    ).toEqual(['cabinetBody', 'positionedHole']);
  });
});
