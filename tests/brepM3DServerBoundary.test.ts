import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateBrepProject } from '@/server/brepEvaluation';
import { BREP_PROJECT_SCHEMA_VERSION, type BrepProject } from '@shared/brepProject';

const originalRunner = process.env.PCAD_BREP_RUNNER;

afterEach(() => {
  if (originalRunner == null) delete process.env.PCAD_BREP_RUNNER;
  else process.env.PCAD_BREP_RUNNER = originalRunner;
});

function circularProject(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'circular-boundary',
    name: 'Circular Boundary',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [],
    nodes: [
      { id: 'seed', type: 'box', width: 10, depth: 6, height: 4 },
      {
        id: 'offset',
        type: 'transform',
        input: 'seed',
        translate: [20, 0, 0],
      },
      {
        id: 'pattern',
        type: 'circularPattern',
        input: 'offset',
        axis: 'z',
        center: [0, 0, 0],
        count: 4,
        angleStepDeg: 90,
      },
    ],
    resultNodeId: 'pattern',
  };
}

async function fakeRunner(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'brepia-m3d-boundary-'));
  const runner = path.join(directory, 'runner.sh');
  const bounds = [
    { min: [15, -3, -2], max: [25, 3, 2] },
    { min: [-3, 15, -2], max: [3, 25, 2] },
    { min: [-25, -3, -2], max: [-15, 3, 2] },
    { min: [-3, -25, -2], max: [3, -15, 2] },
  ];
  const bodies = bounds
    .map((bodyBounds, index) =>
      JSON.stringify({
        id: `pattern::${index}`,
        nodeId: 'pattern',
        instance: { index, sourceNodeId: 'offset' },
        bounds: bodyBounds,
      }),
    )
    .join(',');

  await writeFile(
    runner,
    `#!/usr/bin/env bash\nset -euo pipefail\nOUTPUT=''\nwhile [ "$#" -gt 0 ]; do case "$1" in --input) shift 2;; --output) OUTPUT="$2"; shift 2;; *) exit 64;; esac; done\nmkdir -p "$OUTPUT"\ncat > "$OUTPUT/result.json" <<'JSON'\n{"status":"success","provider":{"id":"build123d-occt","providerVersion":"0.3.0","kernelVersion":"test"},"projectId":"circular-boundary","resultNodeId":"pattern","resultKind":"instanceSet","bodies":[${bodies}],"bounds":{"min":[-25,-25,-2],"max":[25,25,2]},"projectObject":{"placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0],"zAxis":[0,0,1]},"geometry":{},"points":[]},"warnings":[],"exactExport":{"format":"step","available":false}}\nJSON\n`,
    'utf8',
  );
  await chmod(runner, 0o755);
  return runner;
}

describe('M3D server evaluation boundary', () => {
  it('accepts a canonical circularPattern instanceSet with count ordered bodies', async () => {
    process.env.PCAD_BREP_RUNNER = await fakeRunner();
    const artifact = await evaluateBrepProject(circularProject());

    expect(artifact.result.status).toBe('success');
    if (artifact.result.status !== 'success') throw new Error('Expected success');
    expect(artifact.result.resultKind).toBe('instanceSet');
    expect(artifact.result.bodies.map((body) => body.id)).toEqual([
      'pattern::0',
      'pattern::1',
      'pattern::2',
      'pattern::3',
    ]);
    expect(artifact.result.bodies.map((body) => body.instance?.sourceNodeId)).toEqual([
      'offset',
      'offset',
      'offset',
      'offset',
    ]);
  });
});
