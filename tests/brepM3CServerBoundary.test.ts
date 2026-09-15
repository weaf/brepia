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

function rectangularProject(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'rectangular-boundary',
    name: 'Rectangular Boundary',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [],
    nodes: [
      { id: 'seed', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'rectangularPattern',
        input: 'seed',
        axisA: 'x',
        axisB: 'y',
        countA: 2,
        countB: 3,
        spacingA: 20,
        spacingB: 30,
      },
    ],
    resultNodeId: 'pattern',
  };
}

async function fakeRunner(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'brepia-m3c-boundary-'));
  const runner = path.join(directory, 'runner.sh');
  const bodies = Array.from({ length: 6 }, (_, index) => {
    const a = Math.floor(index / 3);
    const b = index % 3;
    const minX = -5 + a * 20;
    const maxX = 5 + a * 20;
    const minY = -5 + b * 30;
    const maxY = 5 + b * 30;
    return JSON.stringify({
      id: `pattern::${index}`,
      nodeId: 'pattern',
      instance: { index, sourceNodeId: 'seed' },
      bounds: { min: [minX, minY, -5], max: [maxX, maxY, 5] },
    });
  }).join(',');

  await writeFile(
    runner,
    `#!/usr/bin/env bash\nset -euo pipefail\nOUTPUT=''\nwhile [ "$#" -gt 0 ]; do case "$1" in --input) shift 2;; --output) OUTPUT="$2"; shift 2;; *) exit 64;; esac; done\nmkdir -p "$OUTPUT"\ncat > "$OUTPUT/result.json" <<'JSON'\n{"status":"success","provider":{"id":"build123d-occt","providerVersion":"0.3.0","kernelVersion":"test"},"projectId":"rectangular-boundary","resultNodeId":"pattern","resultKind":"instanceSet","bodies":[${bodies}],"bounds":{"min":[-5,-5,-5],"max":[25,65,5]},"projectObject":{"placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0],"zAxis":[0,0,1]},"geometry":{},"points":[]},"warnings":[],"exactExport":{"format":"step","available":false}}\nJSON\n`,
    'utf8',
  );
  await chmod(runner, 0o755);
  return runner;
}

describe('M3C server evaluation boundary', () => {
  it('accepts a canonical rectangularPattern instanceSet with countA * countB ordered bodies', async () => {
    process.env.PCAD_BREP_RUNNER = await fakeRunner();
    const artifact = await evaluateBrepProject(rectangularProject());

    expect(artifact.result.status).toBe('success');
    if (artifact.result.status !== 'success') throw new Error('Expected success');
    expect(artifact.result.resultKind).toBe('instanceSet');
    expect(artifact.result.bodies.map((body) => body.id)).toEqual([
      'pattern::0',
      'pattern::1',
      'pattern::2',
      'pattern::3',
      'pattern::4',
      'pattern::5',
    ]);
  });
});
