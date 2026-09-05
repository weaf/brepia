import { describe, expect, it } from 'vitest';
import { brepAiProjectSchema } from '@shared/brepAiTool';
import { diffBrepProjects } from '@shared/brepAiProject';
import {
  BREP_PROJECT_MAX_OBJECT_POINTS,
  normalizeBrepProject,
} from '@shared/brepProject';
import {
  brepProjectParameterUsages,
  deleteBrepProjectNode,
} from '@shared/brepProjectEditing';
import { phaseOneCabinetProject } from '@shared/brepSamples';

describe('BRep Phase 5A project-object contract', () => {
  it('keeps legacy schema-v1 projects unchanged when projectObject is absent', () => {
    const normalized = normalizeBrepProject(phaseOneCabinetProject);

    expect(normalized).not.toHaveProperty('projectObject');
    expect(normalized.resultNodeId).toBe(phaseOneCabinetProject.resultNodeId);
    expect(normalized.placement).toEqual(phaseOneCabinetProject.placement);
    expect(normalized.metadata).toEqual(phaseOneCabinetProject.metadata);
  });

  it('normalizes semantic geometry roles and stable points deterministically', () => {
    const normalized = normalizeBrepProject({
      ...phaseOneCabinetProject,
      projectObject: {
        footprintNodeId: 'cabinetBody',
        clearanceEnvelopeNodeId: 'cabinetWithCableHole',
        maintenanceEnvelopeNodeId: 'cabinetBody',
        points: [
          {
            id: 'powerCable',
            kind: 'cable',
            label: 'Power cable entry',
            position: [{ parameter: 'width' }, 300, 0],
            direction: [0, 0, 1],
          },
          {
            id: 'anchorA',
            kind: 'mounting',
            position: [50, 50, 0],
          },
        ],
      },
    });

    expect(normalized.projectObject).toEqual({
      footprintNodeId: 'cabinetBody',
      clearanceEnvelopeNodeId: 'cabinetWithCableHole',
      maintenanceEnvelopeNodeId: 'cabinetBody',
      points: [
        {
          id: 'anchorA',
          kind: 'mounting',
          position: [50, 50, 0],
        },
        {
          id: 'powerCable',
          kind: 'cable',
          label: 'Power cable entry',
          position: [{ parameter: 'width' }, 300, 0],
          direction: [0, 0, 1],
        },
      ],
    });
  });

  it('rejects unknown semantic geometry node references', () => {
    expect(() =>
      normalizeBrepProject({
        ...phaseOneCabinetProject,
        projectObject: { footprintNodeId: 'missingFootprint' },
      }),
    ).toThrow(/footprint.*unknown node missingFootprint/i);
  });

  it('enforces point parameter units for position and direction', () => {
    const withAngle = {
      ...phaseOneCabinetProject,
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'angle',
          label: 'Angle',
          type: 'number' as const,
          unit: 'deg' as const,
          default: 15,
        },
      ],
    };

    expect(() =>
      normalizeBrepProject({
        ...withAngle,
        projectObject: {
          points: [
            {
              id: 'badPosition',
              kind: 'connection',
              position: [{ parameter: 'angle' }, 0, 0],
            },
          ],
        },
      }),
    ).toThrow(/position\[0\].*unit mm/i);

    expect(() =>
      normalizeBrepProject({
        ...phaseOneCabinetProject,
        projectObject: {
          points: [
            {
              id: 'badDirection',
              kind: 'connection',
              position: [0, 0, 0],
              direction: [{ parameter: 'width' }, 0, 0],
            },
          ],
        },
      }),
    ).toThrow(/direction\[0\].*unit none/i);
  });

  it('rejects duplicate semantic point IDs and excessive point counts', () => {
    expect(() =>
      normalizeBrepProject({
        ...phaseOneCabinetProject,
        projectObject: {
          points: [
            { id: 'samePoint', kind: 'cable', position: [0, 0, 0] },
            { id: 'samePoint', kind: 'mounting', position: [1, 0, 0] },
          ],
        },
      }),
    ).toThrow(/duplicate.*point.*samePoint/i);

    expect(() =>
      normalizeBrepProject({
        ...phaseOneCabinetProject,
        projectObject: {
          points: Array.from(
            { length: BREP_PROJECT_MAX_OBJECT_POINTS + 1 },
            (_, index) => ({
              id: `point${index}`,
              kind: 'connection',
              position: [index, 0, 0],
            }),
          ),
        },
      }),
    ).toThrow(/project-object.*points/i);
  });

  it('protects parameters referenced by semantic points', () => {
    const project = normalizeBrepProject({
      ...phaseOneCabinetProject,
      projectObject: {
        points: [
          {
            id: 'cableEntry',
            kind: 'cable',
            position: [{ parameter: 'width' }, 0, 0],
          },
        ],
      },
    });

    expect(brepProjectParameterUsages(project, 'width')).toContain(
      'projectObject.points.cableEntry.position[0]',
    );
  });

  it('blocks deletion of nodes assigned to semantic project-object roles', () => {
    const project = normalizeBrepProject({
      ...phaseOneCabinetProject,
      projectObject: { footprintNodeId: 'cableHole' },
    });

    expect(() => deleteBrepProjectNode(project, 'cableHole')).toThrow(
      /footprint.*clear.*role/i,
    );
  });

  it('accepts projectObject in the provider-visible AI schema and diffs it', () => {
    const previous = normalizeBrepProject(phaseOneCabinetProject);
    const next = normalizeBrepProject({
      ...phaseOneCabinetProject,
      projectObject: {
        clearanceEnvelopeNodeId: 'cabinetBody',
        points: [
          {
            id: 'servicePoint',
            kind: 'connection',
            position: [100, 0, 0],
          },
        ],
      },
    });

    expect(brepAiProjectSchema.parse(next)).toEqual(next);
    expect(diffBrepProjects(previous, next).projectPaths).toContain(
      'project.projectObject',
    );
  });
});
