import { describe, expect, it } from 'vitest';
import {
  brepNodeValueKind,
  normalizeBrepProject,
  type BrepProject,
} from '@shared/brepProject';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '@shared/brepProvider';
import { analyzeBrepProjectIntegrity } from '@shared/brepProjectIntegrity';
import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '@shared/brepAiTool';

function circularProject(): BrepProject {
  return normalizeBrepProject({
    schemaVersion: 1,
    id: 'circular-pattern',
    name: 'Circular Pattern',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      {
        id: 'radius',
        label: 'Radius',
        type: 'number',
        unit: 'mm',
        default: 40,
        min: 10,
        max: 100,
      },
      {
        id: 'angleStep',
        label: 'Angle step',
        type: 'number',
        unit: 'deg',
        default: 60,
        min: -180,
        max: 180,
      },
    ],
    nodes: [
      { id: 'seed', type: 'box', width: 8, depth: 4, height: 6 },
      {
        id: 'offset',
        type: 'transform',
        input: 'seed',
        translate: [{ parameter: 'radius' }, 0, 0],
      },
      {
        id: 'pattern',
        type: 'circularPattern',
        input: 'offset',
        axis: 'z',
        center: [0, 0, 0],
        count: 6,
        angleStepDeg: { parameter: 'angleStep' },
      },
    ],
    resultNodeId: 'pattern',
  });
}

describe('M3D bounded circular pattern contract', () => {
  it('normalizes a bounded circular pattern as an instanceSet with effective parameters', () => {
    const project = circularProject();
    const pattern = project.nodes.find((node) => node.id === 'pattern');

    expect(pattern?.type).toBe('circularPattern');
    expect(pattern && brepNodeValueKind(pattern)).toBe('instanceSet');
    const integrity = analyzeBrepProjectIntegrity(project);
    expect(integrity.orphanNodeIds).toEqual([]);
    expect(integrity.effectiveParameterIds).toEqual(['angleStep', 'radius']);
    expect(integrity.unusedParameterIds).toEqual([]);
  });

  it('fails closed for zero and over-one-turn effective spacing at defaults', () => {
    const base = circularProject();
    const pattern = base.nodes.find((node) => node.id === 'pattern');
    if (!pattern || pattern.type !== 'circularPattern') throw new Error('pattern missing');

    expect(() =>
      normalizeBrepProject({
        ...base,
        parameters: base.parameters.map((parameter) =>
          parameter.id === 'angleStep' ? { ...parameter, default: 0 } : parameter,
        ),
      }),
    ).toThrow(/non-zero degree value/i);

    expect(() =>
      normalizeBrepProject({
        ...base,
        nodes: base.nodes.map((node) =>
          node.id === 'pattern'
            ? { ...pattern, angleStepDeg: 61 }
            : node,
        ),
      }),
    ).toThrow(/must not exceed 360 degrees/i);
  });

  it('checks the same angular boundary after runtime parameter overrides', () => {
    const project = circularProject();

    expect(
      normalizeBrepEvaluationRequest({
        project,
        parameterValues: { radius: 50, angleStep: -60 },
      }).parameterValues.angleStep,
    ).toBe(-60);

    expect(() =>
      normalizeBrepEvaluationRequest({
        project,
        parameterValues: { radius: 50, angleStep: 0 },
      }),
    ).toThrow(BrepEvaluationRequestError);

    expect(() =>
      normalizeBrepEvaluationRequest({
        project,
        parameterValues: { radius: 50, angleStep: 61 },
      }),
    ).toThrow(/must not exceed 360 degrees/i);
  });

  it('rejects pattern-of-pattern and non-degree angle parameters', () => {
    const project = circularProject();

    expect(() =>
      normalizeBrepProject({
        ...project,
        nodes: [
          ...project.nodes,
          {
            id: 'nested',
            type: 'circularPattern',
            input: 'pattern',
            axis: 'z',
            center: [0, 0, 0],
            count: 2,
            angleStepDeg: 180,
          },
        ],
        resultNodeId: 'nested',
      }),
    ).toThrow(/requires a single-shape node/i);

    expect(() =>
      normalizeBrepProject({
        ...project,
        parameters: project.parameters.map((parameter) =>
          parameter.id === 'angleStep' ? { ...parameter, unit: 'mm' } : parameter,
        ),
      }),
    ).toThrow(/must resolve to unit deg/i);
  });

  it('exposes the node through both canonical and finite provider schemas', async () => {
    const project = circularProject();
    const input = { title: project.name, version: 'v1', project };

    expect(brepAiBuildInputSchema.safeParse(input).success).toBe(true);
    expect(brepAiProviderBuildInputZodSchema.safeParse(input).success).toBe(true);
  });
});
