import fs from 'node:fs/promises';
import path from 'node:path';

import { createBrepGrasshopperContract } from '../../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject } from '../../shared/brepProject.ts';

export type M3cRhinoFixtureKind = 'final' | 'cutters';

export const M3C_RHINO_PARAMETER_A = 'pitchA';
export const M3C_RHINO_PARAMETER_BASE_B = 'pitchBaseB';

export type M3cRhinoFixtureResult = {
  kind: M3cRhinoFixtureKind;
  filename: string;
  parameters: Record<string, number>;
  expectedResultAccess: 'List' | 'Item';
};

function parameters(): BrepProject['parameters'] {
  return [
    {
      id: M3C_RHINO_PARAMETER_A,
      label: 'Pitch A',
      type: 'number',
      unit: 'mm',
      default: 20,
      min: 5,
      max: 80,
    },
    {
      id: M3C_RHINO_PARAMETER_BASE_B,
      label: 'Pitch base B',
      type: 'number',
      unit: 'mm',
      default: 25,
      min: 5,
      max: 80,
    },
  ];
}

function finalPatternProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3cRhinoFinalPattern',
    name: 'M3C Rhino final rectangular pattern',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: parameters(),
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'rectangularPattern',
        input: 'body',
        axisA: 'x',
        axisB: 'y',
        countA: 2,
        countB: 3,
        spacingA: { parameter: M3C_RHINO_PARAMETER_A },
        spacingB: {
          op: 'add',
          args: [{ parameter: M3C_RHINO_PARAMETER_BASE_B }, 5],
        },
      },
    ],
    resultNodeId: 'pattern',
  };
}

function patternCuttersProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3cRhinoPatternCutters',
    name: 'M3C Rhino rectangular pattern cutters',
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
        id: 'cutters',
        type: 'rectangularPattern',
        input: 'cutter',
        axisA: 'x',
        axisB: 'y',
        countA: 2,
        countB: 3,
        spacingA: { parameter: M3C_RHINO_PARAMETER_A },
        spacingB: {
          op: 'add',
          args: [{ parameter: M3C_RHINO_PARAMETER_BASE_B }, 5],
        },
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

function projectFor(kind: M3cRhinoFixtureKind): BrepProject {
  return kind === 'final' ? finalPatternProject() : patternCuttersProject();
}

function sourceRevisionId(kind: M3cRhinoFixtureKind): string {
  return kind === 'final'
    ? 'm3c-rhino-final-pattern-acceptance'
    : 'm3c-rhino-pattern-cutters-acceptance';
}

export function m3cRhinoFixtureFilename(kind: M3cRhinoFixtureKind): string {
  return kind === 'final'
    ? 'm3c-final-rectangular-pattern.ghx'
    : 'm3c-rectangular-pattern-cutters.ghx';
}

function contractFor(kind: M3cRhinoFixtureKind) {
  return createBrepGrasshopperContract({
    project: projectFor(kind),
    sourceRevisionId: sourceRevisionId(kind),
  });
}

export async function generateM3cRhinoAcceptanceFixtures(
  outputDirectory: string,
): Promise<M3cRhinoFixtureResult[]> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const results: M3cRhinoFixtureResult[] = [];

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

    const filename = m3cRhinoFixtureFilename(kind);
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

export async function validateM3cRhinoReturnedFixture(
  kind: M3cRhinoFixtureKind,
  filename: string,
  expectedPitchA?: number,
  expectedPitchBaseB?: number,
): Promise<M3cRhinoFixtureResult> {
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
    expectedPitchA != null &&
    validation.parameters[M3C_RHINO_PARAMETER_A] !== expectedPitchA
  ) {
    throw new Error(
      `Expected ${M3C_RHINO_PARAMETER_A}=${expectedPitchA}, got ${validation.parameters[M3C_RHINO_PARAMETER_A]}.`,
    );
  }
  if (
    expectedPitchBaseB != null &&
    validation.parameters[M3C_RHINO_PARAMETER_BASE_B] !== expectedPitchBaseB
  ) {
    throw new Error(
      `Expected ${M3C_RHINO_PARAMETER_BASE_B}=${expectedPitchBaseB}, got ${validation.parameters[M3C_RHINO_PARAMETER_BASE_B]}.`,
    );
  }

  return {
    kind,
    filename: path.basename(filename),
    parameters: validation.parameters,
    expectedResultAccess: kind === 'final' ? 'List' : 'Item',
  };
}
