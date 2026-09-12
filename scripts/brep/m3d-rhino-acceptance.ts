import fs from 'node:fs/promises';
import path from 'node:path';

import { createBrepGrasshopperContract } from '../../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject } from '../../shared/brepProject.ts';

export type M3dRhinoFixtureKind = 'final' | 'cutters';

export const M3D_RHINO_PARAMETER_RADIUS = 'radius';
export const M3D_RHINO_PARAMETER_ANGLE_STEP = 'angleStep';
export const M3D_RHINO_DEFAULT_RADIUS = 30;
export const M3D_RHINO_DEFAULT_ANGLE_STEP = 60;

export type M3dRhinoFixtureResult = {
  kind: M3dRhinoFixtureKind;
  filename: string;
  parameters: Record<string, number>;
  expectedResultAccess: 'List' | 'Item';
};

function parameters(): BrepProject['parameters'] {
  return [
    {
      id: M3D_RHINO_PARAMETER_RADIUS,
      label: 'Pattern radius',
      type: 'number',
      unit: 'mm',
      default: M3D_RHINO_DEFAULT_RADIUS,
      min: 10,
      max: 80,
    },
    {
      id: M3D_RHINO_PARAMETER_ANGLE_STEP,
      label: 'Angle step',
      type: 'number',
      unit: 'deg',
      default: M3D_RHINO_DEFAULT_ANGLE_STEP,
      min: 15,
      max: 60,
    },
  ];
}

function finalPatternProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3dRhinoFinalPattern',
    name: 'M3D Rhino final circular pattern',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: parameters(),
    nodes: [
      { id: 'seed', type: 'box', width: 10, depth: 6, height: 4 },
      {
        id: 'seedAt',
        type: 'transform',
        input: 'seed',
        translate: [
          {
            op: 'add',
            args: [5, { parameter: M3D_RHINO_PARAMETER_RADIUS }],
          },
          -3,
          0,
        ],
      },
      {
        id: 'pattern',
        type: 'circularPattern',
        input: 'seedAt',
        axis: 'z',
        center: [5, -10, 0],
        count: 6,
        angleStepDeg: { parameter: M3D_RHINO_PARAMETER_ANGLE_STEP },
      },
    ],
    resultNodeId: 'pattern',
  };
}

function patternCuttersProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3dRhinoPatternCutters',
    name: 'M3D Rhino circular pattern cutters',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: parameters(),
    nodes: [
      { id: 'base', type: 'box', width: 240, depth: 240, height: 20 },
      { id: 'cutter', type: 'cylinder', radius: 4, height: 40 },
      {
        id: 'cutterAt',
        type: 'transform',
        input: 'cutter',
        translate: [
          {
            op: 'add',
            args: [20, { parameter: M3D_RHINO_PARAMETER_RADIUS }],
          },
          -15,
          0,
        ],
      },
      {
        id: 'cutters',
        type: 'circularPattern',
        input: 'cutterAt',
        axis: 'z',
        center: [20, -15, 0],
        count: 6,
        angleStepDeg: { parameter: M3D_RHINO_PARAMETER_ANGLE_STEP },
      },
      {
        id: 'cut',
        type: 'subtract',
        base: 'base',
        tools: ['cutters'],
      },
    ],
    resultNodeId: 'cut',
  };
}

function projectFor(kind: M3dRhinoFixtureKind): BrepProject {
  return kind === 'final' ? finalPatternProject() : patternCuttersProject();
}

function sourceRevisionId(kind: M3dRhinoFixtureKind): string {
  return kind === 'final'
    ? 'm3d-rhino-final-pattern-acceptance'
    : 'm3d-rhino-pattern-cutters-acceptance';
}

export function m3dRhinoFixtureFilename(kind: M3dRhinoFixtureKind): string {
  return kind === 'final'
    ? 'm3d-final-circular-pattern.ghx'
    : 'm3d-circular-pattern-cutters.ghx';
}

function contractFor(kind: M3dRhinoFixtureKind) {
  return createBrepGrasshopperContract({
    project: projectFor(kind),
    sourceRevisionId: sourceRevisionId(kind),
  });
}

export async function generateM3dRhinoAcceptanceFixtures(
  outputDirectory: string,
): Promise<M3dRhinoFixtureResult[]> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const results: M3dRhinoFixtureResult[] = [];

  for (const kind of ['final', 'cutters'] as const) {
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

    const filename = m3dRhinoFixtureFilename(kind);
    await fs.writeFile(path.join(outputDirectory, filename), ghx, 'utf8');
    results.push({
      kind,
      filename,
      parameters: validation.parameters,
      expectedResultAccess: kind === 'final' ? 'List' : 'Item',
    });
  }

  return results;
}

export async function validateM3dRhinoReturnedFixture(
  kind: M3dRhinoFixtureKind,
  filename: string,
  expectedRadius?: number,
  expectedAngleStep?: number,
): Promise<M3dRhinoFixtureResult> {
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

  if (
    expectedRadius != null &&
    validation.parameters[M3D_RHINO_PARAMETER_RADIUS] !== expectedRadius
  ) {
    throw new Error(
      `Expected ${M3D_RHINO_PARAMETER_RADIUS}=${expectedRadius}, got ${validation.parameters[M3D_RHINO_PARAMETER_RADIUS]}.`,
    );
  }
  if (
    expectedAngleStep != null &&
    validation.parameters[M3D_RHINO_PARAMETER_ANGLE_STEP] !== expectedAngleStep
  ) {
    throw new Error(
      `Expected ${M3D_RHINO_PARAMETER_ANGLE_STEP}=${expectedAngleStep}, got ${validation.parameters[M3D_RHINO_PARAMETER_ANGLE_STEP]}.`,
    );
  }

  return {
    kind,
    filename: path.basename(filename),
    parameters: validation.parameters,
    expectedResultAccess: kind === 'final' ? 'List' : 'Item',
  };
}
