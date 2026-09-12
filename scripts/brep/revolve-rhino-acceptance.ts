import fs from 'node:fs/promises';
import path from 'node:path';

import { createBrepGrasshopperContract } from '../../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject, BrepScalar } from '../../shared/brepProject.ts';

export type RevolveRhinoFixtureKind = 'parameterized' | 'axisAdjacent';

export const REVOLVE_RHINO_PARAMETER_OUTER_RADIUS = 'outerRadius';
export const REVOLVE_RHINO_PARAMETER_LENGTH = 'length';
export const REVOLVE_RHINO_DEFAULT_OUTER_RADIUS = 18;
export const REVOLVE_RHINO_DEFAULT_LENGTH = 40;
export const REVOLVE_RHINO_ACCEPTED_OUTER_RADIUS = 22;
export const REVOLVE_RHINO_ACCEPTED_LENGTH = 52;

export type RevolveRhinoFixtureResult = {
  kind: RevolveRhinoFixtureKind;
  filename: string;
  parameters: Record<string, number>;
  expectedResultAccess: 'Item';
};

function halfLength(sign: 1 | -1): BrepScalar {
  const half: BrepScalar = {
    op: 'mul',
    args: [{ parameter: REVOLVE_RHINO_PARAMETER_LENGTH }, 0.5],
  };
  return sign === 1 ? half : { op: 'neg', args: [half] };
}

function parameterizedProject(): BrepProject {
  const uMin = halfLength(-1);
  const uMax = halfLength(1);
  return {
    schemaVersion: 1,
    id: 'revolveRhinoParameterized',
    name: 'Bounded revolve Rhino parameter acceptance',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: REVOLVE_RHINO_PARAMETER_OUTER_RADIUS,
        label: 'Outer radius',
        type: 'number',
        unit: 'mm',
        default: REVOLVE_RHINO_DEFAULT_OUTER_RADIUS,
        min: 14,
        max: 30,
      },
      {
        id: REVOLVE_RHINO_PARAMETER_LENGTH,
        label: 'Length',
        type: 'number',
        unit: 'mm',
        default: REVOLVE_RHINO_DEFAULT_LENGTH,
        min: 40,
        max: 80,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'revolve',
        axis: 'z',
        profile: {
          type: 'closedPolyline',
          points: [
            { u: uMin, v: 8 },
            { u: uMin, v: { parameter: REVOLVE_RHINO_PARAMETER_OUTER_RADIUS } },
            { u: -18, v: { parameter: REVOLVE_RHINO_PARAMETER_OUTER_RADIUS } },
            { u: -18, v: 13 },
            { u: 18, v: 13 },
            { u: 18, v: { parameter: REVOLVE_RHINO_PARAMETER_OUTER_RADIUS } },
            { u: uMax, v: { parameter: REVOLVE_RHINO_PARAMETER_OUTER_RADIUS } },
            { u: uMax, v: 8 },
          ],
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function axisAdjacentProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'revolveRhinoAxisAdjacent',
    name: 'Bounded revolve Rhino axis-adjacent acceptance',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [],
    nodes: [
      {
        id: 'body',
        type: 'revolve',
        axis: 'y',
        profile: {
          type: 'closedPolyline',
          points: [
            { u: -20, v: 0 },
            { u: -20, v: 12 },
            { u: -5, v: 12 },
            { u: -5, v: 9 },
            { u: 20, v: 9 },
            { u: 20, v: 0 },
          ],
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function projectFor(kind: RevolveRhinoFixtureKind): BrepProject {
  return kind === 'parameterized' ? parameterizedProject() : axisAdjacentProject();
}

function sourceRevisionId(kind: RevolveRhinoFixtureKind): string {
  return kind === 'parameterized'
    ? 'revolve-rhino-parameterized-acceptance'
    : 'revolve-rhino-axis-adjacent-acceptance';
}

export function revolveRhinoFixtureFilename(kind: RevolveRhinoFixtureKind): string {
  return kind === 'parameterized'
    ? 'revolve-parameterized-z.ghx'
    : 'revolve-axis-adjacent-y.ghx';
}

function contractFor(kind: RevolveRhinoFixtureKind) {
  return createBrepGrasshopperContract({
    project: projectFor(kind),
    sourceRevisionId: sourceRevisionId(kind),
  });
}

export async function generateRevolveRhinoAcceptanceFixtures(
  outputDirectory: string,
): Promise<RevolveRhinoFixtureResult[]> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const results: RevolveRhinoFixtureResult[] = [];

  for (const kind of ['parameterized', 'axisAdjacent'] as const) {
    const contract = contractFor(kind);
    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      contract,
      'generated',
    );
    if (!validation.accepted) {
      throw new Error(
        `${kind} generated GHX failed validation: ${JSON.stringify(validation.diagnostics)}`,
      );
    }

    const filename = revolveRhinoFixtureFilename(kind);
    await fs.writeFile(path.join(outputDirectory, filename), ghx, 'utf8');
    results.push({
      kind,
      filename,
      parameters: validation.parameters,
      expectedResultAccess: 'Item',
    });
  }

  return results;
}

export async function validateRevolveRhinoReturnedFixture(
  kind: RevolveRhinoFixtureKind,
  filename: string,
  expectedOuterRadius?: number,
  expectedLength?: number,
): Promise<RevolveRhinoFixtureResult> {
  const ghx = await fs.readFile(filename, 'utf8');
  const contract = contractFor(kind);
  const validation = await validateBrepGrasshopperExecutableGhx(
    ghx,
    contract,
    'returned',
  );

  if (!validation.accepted) {
    throw new Error(
      `${kind} returned GHX failed validation: ${JSON.stringify(validation.diagnostics)}`,
    );
  }

  if (kind === 'parameterized') {
    if (
      expectedOuterRadius != null &&
      validation.parameters[REVOLVE_RHINO_PARAMETER_OUTER_RADIUS] !==
        expectedOuterRadius
    ) {
      throw new Error(
        `Expected ${REVOLVE_RHINO_PARAMETER_OUTER_RADIUS}=${expectedOuterRadius}, got ${validation.parameters[REVOLVE_RHINO_PARAMETER_OUTER_RADIUS]}.`,
      );
    }
    if (
      expectedLength != null &&
      validation.parameters[REVOLVE_RHINO_PARAMETER_LENGTH] !== expectedLength
    ) {
      throw new Error(
        `Expected ${REVOLVE_RHINO_PARAMETER_LENGTH}=${expectedLength}, got ${validation.parameters[REVOLVE_RHINO_PARAMETER_LENGTH]}.`,
      );
    }
  } else if (Object.keys(validation.parameters).length !== 0) {
    throw new Error('Axis-adjacent returned GHX unexpectedly contains published parameter values.');
  }

  return {
    kind,
    filename: path.basename(filename),
    parameters: validation.parameters,
    expectedResultAccess: 'Item',
  };
}
