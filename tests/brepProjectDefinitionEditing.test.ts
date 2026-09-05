import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { normalizeBrepProject } from '@shared/brepProject';
import {
  brepProjectParameterUsages,
  replaceBrepProjectDefinition,
  suggestBrepParameterId,
} from '@shared/brepProjectEditing';

describe('BRep project-definition editing', () => {
  it('finds published parameter usages across placement and feature scalars', () => {
    const project = normalizeBrepProject({
      ...phaseOneCabinetProject,
      placement: {
        ...phaseOneCabinetProject.placement,
        origin: [{ parameter: 'width' }, 0, 0],
      },
    });

    expect(brepProjectParameterUsages(project, 'width')).toEqual([
      'placement.origin[0]',
      'cabinetBody.width',
    ]);
    expect(brepProjectParameterUsages(project, 'height')).toEqual([
      'cabinetBody.height',
    ]);
    expect(brepProjectParameterUsages(project, 'missing')).toEqual([]);
  });

  it('replaces only project-definition fields and preserves stable graph authority', () => {
    const baseline = normalizeBrepProject(phaseOneCabinetProject);
    const width = baseline.parameters.find((parameter) => parameter.id === 'width');
    if (!width) throw new Error('Missing width parameter');

    const next = replaceBrepProjectDefinition(baseline, {
      name: 'Cabinet A42',
      placement: {
        origin: [100, 200, 300],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      metadata: {
        objectType: 'cabinet',
        classification: 'equipment',
        properties: { discipline: 'traction-power' },
      },
      parameters: baseline.parameters.map((parameter) =>
        parameter.id === width.id
          ? { ...parameter, label: 'Cabinet width', default: 1300 }
          : parameter,
      ),
    });

    expect(next.id).toBe(baseline.id);
    expect(next.nodes).toEqual(baseline.nodes);
    expect(next.resultNodeId).toBe(baseline.resultNodeId);
    expect(next.name).toBe('Cabinet A42');
    expect(next.placement.origin).toEqual([100, 200, 300]);
    expect(next.metadata).toEqual({
      objectType: 'cabinet',
      classification: 'equipment',
      properties: { discipline: 'traction-power' },
    });
    expect(next.parameters.find((parameter) => parameter.id === 'width')).toMatchObject({
      id: 'width',
      label: 'Cabinet width',
      default: 1300,
    });
  });

  it('rejects removing a published parameter while canonical features still reference it', () => {
    const baseline = normalizeBrepProject(phaseOneCabinetProject);

    expect(() =>
      replaceBrepProjectDefinition(baseline, {
        name: baseline.name,
        placement: baseline.placement,
        metadata: baseline.metadata,
        parameters: baseline.parameters.filter((parameter) => parameter.id !== 'width'),
      }),
    ).toThrow(/unknown published parameter width/i);
  });

  it('rejects a default placement plane with collinear axes before persistence', () => {
    const baseline = normalizeBrepProject(phaseOneCabinetProject);

    expect(() =>
      replaceBrepProjectDefinition(baseline, {
        name: baseline.name,
        placement: {
          origin: [0, 0, 0],
          xAxis: [1, 0, 0],
          yAxis: [2, 0, 0],
        },
        metadata: baseline.metadata,
        parameters: baseline.parameters,
      }),
    ).toThrow(/must not be collinear/i);
  });

  it('suggests a deterministic fresh published parameter ID without mutating source', () => {
    const baseline = normalizeBrepProject({
      ...phaseOneCabinetProject,
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'parameter',
          label: 'Parameter',
          type: 'number',
          unit: 'none',
          default: 1,
        },
        {
          id: 'parameter2',
          label: 'Parameter 2',
          type: 'number',
          unit: 'none',
          default: 2,
        },
      ],
    });
    const before = JSON.stringify(baseline);

    expect(suggestBrepParameterId(baseline)).toBe('parameter3');
    expect(JSON.stringify(baseline)).toBe(before);
  });
});
