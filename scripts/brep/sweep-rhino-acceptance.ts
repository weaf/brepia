import fs from 'node:fs/promises';
import path from 'node:path';

import { createBrepGrasshopperContract } from '../../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject } from '../../shared/brepProject.ts';

export const SWEEP_RHINO_PARAMETER_TUBE_DIAMETER = 'tubeDiameter';
export const SWEEP_RHINO_PARAMETER_BEND_RADIUS = 'bendRadius';
export const SWEEP_RHINO_DEFAULT_TUBE_DIAMETER = 40;
export const SWEEP_RHINO_DEFAULT_BEND_RADIUS = 150;
export const SWEEP_RHINO_ACCEPTED_TUBE_DIAMETER = 50;
export const SWEEP_RHINO_ACCEPTED_BEND_RADIUS = 180;
export const SWEEP_RHINO_FILENAME = 'sweep-planar-elbow-z.ghx';

export type SweepRhinoFixtureResult = {
  filename: string;
  parameters: Record<string, number>;
  expectedResultAccess: 'Item';
};

function sweepRhinoProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'sweepRhinoPlanarElbow',
    name: 'Bounded planar elbow sweep Rhino acceptance',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: SWEEP_RHINO_PARAMETER_TUBE_DIAMETER,
        label: 'Tube diameter',
        type: 'number',
        unit: 'mm',
        default: SWEEP_RHINO_DEFAULT_TUBE_DIAMETER,
        min: 10,
        max: 100,
      },
      {
        id: SWEEP_RHINO_PARAMETER_BEND_RADIUS,
        label: 'Bend radius',
        type: 'number',
        unit: 'mm',
        default: SWEEP_RHINO_DEFAULT_BEND_RADIUS,
        min: 75,
        max: 300,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'sweep',
        profile: {
          type: 'circle',
          radius: {
            op: 'div',
            args: [{ parameter: SWEEP_RHINO_PARAMETER_TUBE_DIAMETER }, 2],
          },
        },
        path: {
          type: 'planarElbow90',
          planeNormalAxis: 'z',
          firstLegLength: 1000,
          secondLegLength: 700,
          bendRadius: { parameter: SWEEP_RHINO_PARAMETER_BEND_RADIUS },
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function contract() {
  return createBrepGrasshopperContract({
    project: sweepRhinoProject(),
    sourceRevisionId: 'sweep-rhino-planar-elbow-acceptance-2026-09-19',
  });
}

export async function generateSweepRhinoAcceptanceFixture(
  outputDirectory: string,
): Promise<SweepRhinoFixtureResult> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const expected = contract();
  const ghx = await compileBrepGrasshopperExecutableGhx(expected);
  const validation = await validateBrepGrasshopperExecutableGhx(
    ghx,
    expected,
    'generated',
  );
  if (!validation.accepted) {
    throw new Error(
      `Generated sweep GHX failed validation: ${JSON.stringify(validation.diagnostics)}`,
    );
  }
  await fs.writeFile(
    path.join(outputDirectory, SWEEP_RHINO_FILENAME),
    ghx,
    'utf8',
  );
  return {
    filename: SWEEP_RHINO_FILENAME,
    parameters: validation.parameters,
    expectedResultAccess: 'Item',
  };
}

export async function validateSweepRhinoReturnedFixture(
  filename: string,
  expectedTubeDiameter = SWEEP_RHINO_ACCEPTED_TUBE_DIAMETER,
  expectedBendRadius = SWEEP_RHINO_ACCEPTED_BEND_RADIUS,
): Promise<SweepRhinoFixtureResult> {
  const ghx = await fs.readFile(filename, 'utf8');
  const validation = await validateBrepGrasshopperExecutableGhx(
    ghx,
    contract(),
    'returned',
  );
  if (!validation.accepted) {
    throw new Error(
      `Returned sweep GHX failed validation: ${JSON.stringify(validation.diagnostics)}`,
    );
  }
  if (
    validation.parameters[SWEEP_RHINO_PARAMETER_TUBE_DIAMETER] !==
    expectedTubeDiameter
  ) {
    throw new Error(
      `Expected tubeDiameter=${expectedTubeDiameter}, got ${validation.parameters[SWEEP_RHINO_PARAMETER_TUBE_DIAMETER]}.`,
    );
  }
  if (
    validation.parameters[SWEEP_RHINO_PARAMETER_BEND_RADIUS] !==
    expectedBendRadius
  ) {
    throw new Error(
      `Expected bendRadius=${expectedBendRadius}, got ${validation.parameters[SWEEP_RHINO_PARAMETER_BEND_RADIUS]}.`,
    );
  }
  return {
    filename: path.basename(filename),
    parameters: validation.parameters,
    expectedResultAccess: 'Item',
  };
}
