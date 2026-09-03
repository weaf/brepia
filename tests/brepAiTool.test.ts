import { describe, expect, it } from 'vitest';
import {
  brepAiBuildInputSchema,
  brepAiBuildOutputSchema,
} from '../shared/brepAiTool';
import { parametricArtifactSchema } from '../shared/chatAi';

function brepInput() {
  return {
    title: 'Cabinet A42',
    version: 'v1',
    project: {
      schemaVersion: 1 as const,
      id: 'cabinetA42',
      name: 'Cabinet A42',
      units: 'mm' as const,
      placement: {
        origin: [0, 0, 0] as [number, number, number],
        xAxis: [1, 0, 0] as [number, number, number],
        yAxis: [0, 1, 0] as [number, number, number],
      },
      parameters: [
        {
          id: 'width',
          label: 'Width',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 1200,
          min: 600,
          max: 2400,
          step: 50,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'box' as const,
          width: { parameter: 'width' },
          depth: 600,
          height: 1800,
        },
      ],
      resultNodeId: 'body',
    },
  };
}

function openScadInput() {
  return {
    title: 'Legacy OpenSCAD model',
    version: 'v1',
    project: {
      schemaVersion: 1 as const,
      entrypointPath: 'main.scad',
      files: [{ path: 'main.scad', content: 'cube([10, 20, 30]);' }],
    },
  };
}

describe('native BRep AI build tool contract', () => {
  it('accepts a complete canonical BRep project snapshot', () => {
    const result = brepAiBuildInputSchema.safeParse(brepInput());
    expect(result.success).toBe(true);
  });

  it('rejects unsupported raw topology selectors', () => {
    const input = brepInput();
    input.project.nodes = [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: 1800,
      },
      {
        id: 'rounded',
        type: 'fillet',
        input: 'body',
        radius: 10,
        selector: { kind: 'edgeIndex', index: 0 },
      },
    ] as never;
    input.project.resultNodeId = 'rounded';

    expect(brepAiBuildInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects runtime/code/geometry fields rather than silently stripping them', () => {
    const input = {
      ...brepInput(),
      python: 'import build123d',
    };
    expect(brepAiBuildInputSchema.safeParse(input).success).toBe(false);

    const projectWithStep = {
      ...brepInput(),
      project: { ...brepInput().project, step: 'ISO-10303-21' },
    };
    expect(brepAiBuildInputSchema.safeParse(projectWithStep).success).toBe(
      false,
    );
  });

  it('fails closed on invalid references and cycles through canonical validation', () => {
    const missing = brepInput();
    missing.project.nodes[0] = {
      id: 'body',
      type: 'box',
      width: { parameter: 'missingWidth' },
      depth: 600,
      height: 1800,
    };
    expect(brepAiBuildInputSchema.safeParse(missing).success).toBe(false);

    const cycle = brepInput();
    cycle.project.nodes = [
      { id: 'first', type: 'transform', input: 'second', translate: [1, 0, 0] },
      { id: 'second', type: 'transform', input: 'first', translate: [1, 0, 0] },
    ] as never;
    cycle.project.resultNodeId = 'first';
    expect(brepAiBuildInputSchema.safeParse(cycle).success).toBe(false);
  });

  it('keeps the legacy OpenSCAD build payload separate and valid', () => {
    expect(parametricArtifactSchema.safeParse(openScadInput()).success).toBe(
      true,
    );
    expect(brepAiBuildInputSchema.safeParse(openScadInput()).success).toBe(
      false,
    );
    expect(parametricArtifactSchema.safeParse(brepInput()).success).toBe(false);
  });

  it('validates only the bounded BRep tool result contract', () => {
    expect(
      brepAiBuildOutputSchema.safeParse({
        status: 'success',
        message: 'BRep project accepted.',
      }).success,
    ).toBe(true);
    expect(
      brepAiBuildOutputSchema.safeParse({
        status: 'success',
        message: 'BRep project accepted.',
        step: 'not-source-authority',
      }).success,
    ).toBe(false);
  });
});
