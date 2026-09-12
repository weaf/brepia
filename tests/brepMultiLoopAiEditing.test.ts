import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import {
  BREP_PROJECT_MAX_PROFILE_HOLES,
  type BrepProject,
} from '../shared/brepProject.ts';
import { brepProjectParameterUsages } from '../shared/brepProjectEditing.ts';

function providerInput() {
  return {
    title: 'Multi-loop plate',
    version: 'v1',
    project: {
      schemaVersion: 1 as const,
      id: 'multiLoopPlate',
      name: 'Multi-loop plate',
      units: 'mm' as const,
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      parameters: [
        {
          id: 'holeRadius',
          label: 'Hole radius',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 5,
          min: 1,
          max: 10,
        },
        {
          id: 'holeOffset',
          label: 'Hole offset',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 30,
          min: 15,
          max: 35,
        },
      ],
      nodes: [
        {
          id: 'plate',
          type: 'extrude' as const,
          profile: {
            type: 'rectangle' as const,
            width: 100,
            height: 60,
            holes: [
              {
                loop: {
                  type: 'circle' as const,
                  radius: { parameter: 'holeRadius' },
                },
                offsetU: { parameter: 'holeOffset' },
                offsetV: 0,
              },
              {
                loop: {
                  type: 'circle' as const,
                  radius: { parameter: 'holeRadius' },
                },
                offsetU: {
                  op: 'neg' as const,
                  args: [{ parameter: 'holeOffset' }],
                },
                offsetV: 0,
              },
            ],
          },
          axis: 'z' as const,
          depth: 10,
        },
      ],
      resultNodeId: 'plate',
    },
  };
}

describe('bounded multi-loop AI and editing integration', () => {
  it('accepts bounded holes through canonical and finite provider schemas', async () => {
    const input = providerInput();
    const canonical = await brepAiBuildInputSchema.safeParseAsync(input);
    const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync(input);
    assert.equal(canonical.success, true);
    assert.equal(provider.success, true);
  });

  it('keeps holes non-recursive and extrusion-only in provider authoring', async () => {
    const nested = structuredClone(providerInput());
    const nestedLoop = nested.project.nodes[0]!.profile.holes[0]!.loop as Record<string, unknown>;
    nestedLoop.holes = [];
    assert.equal(
      (await brepAiProviderBuildInputZodSchema.safeParseAsync(nested)).success,
      false,
    );

    const revolve = structuredClone(providerInput());
    const extrude = revolve.project.nodes[0]!;
    const revolveNode = {
      id: 'turned',
      type: 'revolve' as const,
      axis: 'z' as const,
      profile: {
        type: 'closedPolyline' as const,
        points: [
          { u: -20, v: 8 },
          { u: 20, v: 8 },
          { u: 20, v: 18 },
          { u: -20, v: 18 },
        ],
        holes: extrude.profile.holes,
      },
    };
    (revolve.project.nodes as unknown[])[0] = revolveNode;
    revolve.project.resultNodeId = 'turned';
    assert.equal(
      (await brepAiProviderBuildInputZodSchema.safeParseAsync(revolve)).success,
      false,
    );
  });

  it('bounds provider-authored hole cardinality before canonical validation', async () => {
    const input = providerInput();
    input.project.nodes[0]!.profile.holes = Array.from(
      { length: BREP_PROJECT_MAX_PROFILE_HOLES + 1 },
      (_, index) => ({
        loop: { type: 'circle' as const, radius: 1 },
        offsetU: -40 + index * 10,
        offsetV: 0,
      }),
    );
    assert.equal(
      (await brepAiProviderBuildInputZodSchema.safeParseAsync(input)).success,
      false,
    );
  });

  it('reports hole loop and placement parameter usages to structural editing', () => {
    const project = providerInput().project as unknown as BrepProject;
    assert.deepEqual(brepProjectParameterUsages(project, 'holeRadius'), [
      'plate.profile.holes[0].loop.radius',
      'plate.profile.holes[1].loop.radius',
    ]);
    assert.deepEqual(brepProjectParameterUsages(project, 'holeOffset'), [
      'plate.profile.holes[0].offsetU',
      'plate.profile.holes[1].offsetU',
    ]);
  });
});
