import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { normalizeBrepProject } from '@shared/brepProject';
import {
  replaceBrepProjectObjectDefinition,
  suggestBrepProjectObjectPointId,
} from '@shared/brepProjectEditing';

function projectWithAuxiliaryNodes() {
  return normalizeBrepProject({
    ...phaseOneCabinetProject,
    nodes: [
      ...phaseOneCabinetProject.nodes,
      {
        id: 'footprint',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: 10,
      },
      {
        id: 'clearance',
        type: 'box',
        width: 1800,
        depth: 1000,
        height: { parameter: 'height' },
      },
    ],
  });
}

describe('BRep project-object authoring', () => {
  it('replaces only project-object semantics and preserves canonical project authority', () => {
    const baseline = projectWithAuxiliaryNodes();
    const next = replaceBrepProjectObjectDefinition(baseline, {
      footprintNodeId: 'footprint',
      clearanceEnvelopeNodeId: 'clearance',
      points: [
        {
          id: 'cableEntry',
          kind: 'cable',
          label: 'Cable entry',
          position: [{ parameter: 'width' }, 100, 0],
          direction: [0, 0, 1],
        },
      ],
    });

    expect(next.id).toBe(baseline.id);
    expect(next.name).toBe(baseline.name);
    expect(next.placement).toEqual(baseline.placement);
    expect(next.metadata).toEqual(baseline.metadata);
    expect(next.parameters).toEqual(baseline.parameters);
    expect(next.nodes).toEqual(baseline.nodes);
    expect(next.resultNodeId).toBe(baseline.resultNodeId);
    expect(next.projectObject).toEqual({
      footprintNodeId: 'footprint',
      clearanceEnvelopeNodeId: 'clearance',
      points: [
        {
          id: 'cableEntry',
          kind: 'cable',
          label: 'Cable entry',
          position: [{ parameter: 'width' }, 100, 0],
          direction: [0, 0, 1],
        },
      ],
    });
  });

  it('canonicalizes an empty project-object definition away', () => {
    const configured = replaceBrepProjectObjectDefinition(
      projectWithAuxiliaryNodes(),
      {
        footprintNodeId: 'footprint',
        points: [
          {
            id: 'mount',
            kind: 'mounting',
            position: [0, 0, 0],
          },
        ],
      },
    );

    const cleared = replaceBrepProjectObjectDefinition(configured, {});
    expect(cleared.projectObject).toBeUndefined();
  });

  it('rejects unknown semantic role nodes and incompatible point parameter units', () => {
    const baseline = projectWithAuxiliaryNodes();

    expect(() =>
      replaceBrepProjectObjectDefinition(baseline, {
        footprintNodeId: 'missing',
      }),
    ).toThrow(/references unknown node missing/i);

    const withUnitless = normalizeBrepProject({
      ...baseline,
      parameters: [
        ...baseline.parameters,
        {
          id: 'scale',
          label: 'Scale',
          type: 'number',
          unit: 'none',
          default: 1,
        },
      ],
    });
    expect(() =>
      replaceBrepProjectObjectDefinition(withUnitless, {
        points: [
          {
            id: 'badPosition',
            kind: 'connection',
            position: [{ parameter: 'scale' }, 0, 0],
          },
        ],
      }),
    ).toThrow(/requires parameter units mm/i);
  });

  it('suggests deterministic stable point IDs without mutating the source', () => {
    const baseline = replaceBrepProjectObjectDefinition(
      projectWithAuxiliaryNodes(),
      {
        points: [
          { id: 'connection', kind: 'connection', position: [0, 0, 0] },
          { id: 'connection2', kind: 'connection', position: [1, 0, 0] },
          { id: 'cable', kind: 'cable', position: [0, 1, 0] },
        ],
      },
    );
    const before = JSON.stringify(baseline);

    expect(suggestBrepProjectObjectPointId(baseline, 'connection')).toBe(
      'connection3',
    );
    expect(suggestBrepProjectObjectPointId(baseline, 'mounting')).toBe(
      'mounting',
    );
    expect(suggestBrepProjectObjectPointId(baseline, 'cable')).toBe('cable2');
    expect(JSON.stringify(baseline)).toBe(before);
  });
});
