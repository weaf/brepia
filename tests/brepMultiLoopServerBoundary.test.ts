import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateBrepProject } from '@/server/brepEvaluation';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '@shared/brepProject';

const originalRunner = process.env.PCAD_BREP_RUNNER;

afterEach(() => {
  if (originalRunner == null) delete process.env.PCAD_BREP_RUNNER;
  else process.env.PCAD_BREP_RUNNER = originalRunner;
});

function multiLoopProject(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'multi-loop-server-boundary',
    name: 'Multi-loop server boundary',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 100,
      },
      {
        id: 'margin',
        label: 'Margin',
        type: 'number',
        unit: 'mm',
        default: 35,
      },
      {
        id: 'holeRadius',
        label: 'Hole radius',
        type: 'number',
        unit: 'mm',
        default: 7,
      },
    ],
    nodes: [
      {
        id: 'plate',
        type: 'extrude',
        axis: 'z',
        depth: 8,
        profile: {
          type: 'rectangle',
          width: { parameter: 'width' },
          height: 70,
          holes: [
            {
              loop: { type: 'circle', radius: { parameter: 'holeRadius' } },
              offsetU: {
                op: 'sub',
                args: [
                  { op: 'div', args: [{ parameter: 'width' }, 2] },
                  { parameter: 'margin' },
                ],
              },
              offsetV: 0,
            },
            {
              loop: {
                type: 'closedPolyline',
                points: [
                  { u: -5, v: -4 },
                  { u: 5, v: -4 },
                  { u: 5, v: 4 },
                  { u: -5, v: 4 },
                ],
              },
              offsetU: -20,
              offsetV: 0,
            },
          ],
        },
      },
    ],
    resultNodeId: 'plate',
  };
}

async function fakeRunner(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'brepia-multiloop-boundary-'));
  const runner = path.join(directory, 'runner.sh');
  await writeFile(
    runner,
    `#!/usr/bin/env bash\nset -euo pipefail\nINPUT=''\nOUTPUT=''\nwhile [ "$#" -gt 0 ]; do case "$1" in --input) INPUT="$2"; shift 2;; --output) OUTPUT="$2"; shift 2;; *) exit 64;; esac; done\nnode - "$INPUT" <<'NODE'\nconst fs = require('fs');\nconst request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\nconst node = request.project.nodes.find((candidate) => candidate.id === 'plate');\nif (!node || node.type !== 'extrude' || node.profile.holes?.length !== 2) process.exit(21);\nif (node.profile.holes[0].loop.type !== 'circle' || node.profile.holes[1].loop.type !== 'closedPolyline') process.exit(22);\nif (node.profile.holes[0].offsetU?.op !== 'sub' || node.profile.holes[0].offsetU?.args?.[0]?.op !== 'div') process.exit(23);\nconst values = request.parameterValues;\nif (values.width !== 120 || values.margin !== 40 || values.holeRadius !== 9) process.exit(24);\nNODE\nmkdir -p "$OUTPUT"\ncat > "$OUTPUT/result.json" <<'JSON'\n{"status":"success","provider":{"id":"build123d-occt","providerVersion":"0.3.0","kernelVersion":"test"},"projectId":"multi-loop-server-boundary","resultNodeId":"plate","resultKind":"single","bodies":[{"id":"plate","nodeId":"plate","bounds":{"min":[-60,-35,-4],"max":[60,35,4]}}],"bounds":{"min":[-60,-35,-4],"max":[60,35,4]},"projectObject":{"placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0],"zAxis":[0,0,1]},"geometry":{},"points":[]},"warnings":[],"exactExport":{"format":"step","available":false}}\nJSON\n`,
    'utf8',
  );
  await chmod(runner, 0o755);
  return runner;
}

describe('bounded multi-loop server evaluation boundary', () => {
  it('passes normalized holes and effective overrides to the single-result native runner', async () => {
    process.env.PCAD_BREP_RUNNER = await fakeRunner();
    const artifact = await evaluateBrepProject(multiLoopProject(), {
      width: 120,
      margin: 40,
      holeRadius: 9,
    });

    expect(artifact.result.status).toBe('success');
    if (artifact.result.status !== 'success') throw new Error('Expected success');
    expect(artifact.result.resultKind).toBe('single');
    expect(artifact.result.bodies).toHaveLength(1);
    expect(artifact.result.bodies[0]?.id).toBe('plate');
    expect(artifact.result.bounds).toEqual({
      min: [-60, -35, -4],
      max: [60, 35, 4],
    });
  });

  it('rejects a runtime override that makes the circular hole touch the outer boundary before invoking native execution', async () => {
    await expect(
      evaluateBrepProject(multiLoopProject(), {
        width: 100,
        margin: 10,
        holeRadius: 10,
      }),
    ).rejects.toMatchObject({
      name: 'BrepEvaluationRequestError',
      code: 'invalid_parameter_value',
    });
  });
});
