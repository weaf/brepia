import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createBrepGrasshopperContract } from '../../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../../shared/brepGrasshopperExecutableGhxValidation.ts';
import type { BrepProject } from '../../shared/brepProject.ts';

type FixtureKind = 'final' | 'cutters';

const PARAMETER_A = 'pitchA';
const PARAMETER_BASE_B = 'pitchBaseB';

function parameters(): BrepProject['parameters'] {
  return [
    {
      id: PARAMETER_A,
      label: 'Pitch A',
      type: 'number',
      unit: 'mm',
      default: 20,
      min: 5,
      max: 80,
    },
    {
      id: PARAMETER_BASE_B,
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
        spacingA: { parameter: PARAMETER_A },
        spacingB: {
          op: 'add',
          args: [{ parameter: PARAMETER_BASE_B }, 5],
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
      { id: 'base', type: 'box', width: 120, depth: 120, height: 20 },
      { id: 'cutter', type: 'cylinder', radius: 4, height: 40 },
      {
        id: 'cutters',
        type: 'rectangularPattern',
        input: 'cutter',
        axisA: 'x',
        axisB: 'y',
        countA: 2,
        countB: 3,
        spacingA: { parameter: PARAMETER_A },
        spacingB: {
          op: 'add',
          args: [{ parameter: PARAMETER_BASE_B }, 5],
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

function projectFor(kind: FixtureKind): BrepProject {
  return kind === 'final' ? finalPatternProject() : patternCuttersProject();
}

function sourceRevisionId(kind: FixtureKind): string {
  return kind === 'final'
    ? 'm3c-rhino-final-pattern-acceptance'
    : 'm3c-rhino-pattern-cutters-acceptance';
}

function fixtureFilename(kind: FixtureKind): string {
  return kind === 'final'
    ? 'm3c-final-rectangular-pattern.ghx'
    : 'm3c-rectangular-pattern-cutters.ghx';
}

async function contractFor(kind: FixtureKind) {
  return createBrepGrasshopperContract({
    project: projectFor(kind),
    sourceRevisionId: sourceRevisionId(kind),
  });
}

async function generate(outputDirectory: string): Promise<void> {
  await fs.mkdir(outputDirectory, { recursive: true });

  for (const kind of ['final', 'cutters'] as const) {
    const contract = await contractFor(kind);
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

    const filename = fixtureFilename(kind);
    await fs.writeFile(path.join(outputDirectory, filename), ghx, 'utf8');
    console.log(
      JSON.stringify({
        kind,
        file: filename,
        generatedValidation: 'accepted',
        parameters: validation.parameters,
        expectedResultAccess: kind === 'final' ? 'List' : 'Item',
      }),
    );
  }
}

async function validateReturned(
  kind: FixtureKind,
  filename: string,
  expectedPitchA?: number,
  expectedPitchBaseB?: number,
): Promise<void> {
  const ghx = await fs.readFile(filename, 'utf8');
  const contract = await contractFor(kind);
  const validation = await validateBrepGrasshopperExecutableGhx(
    ghx,
    contract,
    'returned',
  );

  if (!validation.accepted) {
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
    return;
  }

  if (
    expectedPitchA != null &&
    validation.parameters[PARAMETER_A] !== expectedPitchA
  ) {
    throw new Error(
      `Expected ${PARAMETER_A}=${expectedPitchA}, got ${validation.parameters[PARAMETER_A]}.`,
    );
  }
  if (
    expectedPitchBaseB != null &&
    validation.parameters[PARAMETER_BASE_B] !== expectedPitchBaseB
  ) {
    throw new Error(
      `Expected ${PARAMETER_BASE_B}=${expectedPitchBaseB}, got ${validation.parameters[PARAMETER_BASE_B]}.`,
    );
  }

  console.log(
    JSON.stringify({
      kind,
      returnedValidation: 'accepted',
      parameters: validation.parameters,
      expectedResultAccess: kind === 'final' ? 'List' : 'Item',
    }),
  );
}

function parseKind(value: string | undefined): FixtureKind {
  if (value === 'final' || value === 'cutters') return value;
  throw new Error(`Expected fixture kind "final" or "cutters", got ${value ?? '<missing>'}.`);
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a finite number, got ${value}.`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'generate') {
    await generate(path.resolve(args[0] ?? 'tmp/m3c-rhino-acceptance'));
    return;
  }

  if (command === 'validate') {
    const kind = parseKind(args[0]);
    const filename = args[1];
    if (!filename) {
      throw new Error('Returned GHX path is required.');
    }
    await validateReturned(
      kind,
      path.resolve(filename),
      parseOptionalNumber(args[2]),
      parseOptionalNumber(args[3]),
    );
    return;
  }

  throw new Error(
    'Usage: node --experimental-strip-types scripts/brep/m3c-rhino-acceptance.ts generate [output-dir]\n' +
      '   or: node --experimental-strip-types scripts/brep/m3c-rhino-acceptance.ts validate <final|cutters> <returned.ghx> [expectedPitchA] [expectedPitchBaseB]',
  );
}

await main();
