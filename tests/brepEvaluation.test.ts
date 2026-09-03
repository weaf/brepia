import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateBrepProject,
  BrepEvaluationError,
} from '@/server/brepEvaluation';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '@shared/brepProject';

const originalRunner = process.env.PCAD_BREP_RUNNER;
const originalConcurrency = process.env.PCAD_BREP_MAX_CONCURRENT;
afterEach(() => {
  if (originalRunner == null) delete process.env.PCAD_BREP_RUNNER;
  else process.env.PCAD_BREP_RUNNER = originalRunner;
  if (originalConcurrency == null) delete process.env.PCAD_BREP_MAX_CONCURRENT;
  else process.env.PCAD_BREP_MAX_CONCURRENT = originalConcurrency;
});

function project(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'box',
    name: 'Box',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 10,
        min: 1,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 5,
        height: 5,
      },
    ],
    resultNodeId: 'body',
  };
}

async function fakeRunner(body: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'brepia-brep-test-'));
  const runner = path.join(directory, 'runner.sh');
  await writeFile(
    runner,
    `#!/usr/bin/env bash\nset -euo pipefail\nINPUT=''\nOUTPUT=''\nwhile [ "$#" -gt 0 ]; do case "$1" in --input) INPUT="$2"; shift 2;; --output) OUTPUT="$2"; shift 2;; *) exit 64;; esac; done\nmkdir -p "$OUTPUT"\n${body}\n`,
    'utf8',
  );
  await chmod(runner, 0o755);
  return runner;
}

function expectBrepError(
  action: () => Promise<unknown>,
  code: BrepEvaluationError['code'],
) {
  return expect(action()).rejects.toMatchObject({
    name: 'BrepEvaluationError',
    code,
  });
}

describe('isolated BRep evaluation boundary', () => {
  it('requires an explicit sandbox runner', async () => {
    delete process.env.PCAD_BREP_RUNNER;
    await expectBrepError(
      () => evaluateBrepProject(project()),
      'provider_unavailable',
    );
  });

  it('accepts only a bounded valid sandbox result and preserves STEP as a separate artifact', async () => {
    process.env.PCAD_BREP_RUNNER =
      await fakeRunner(`cat > "$OUTPUT/result.json" <<'JSON'
{"status":"success","provider":{"id":"build123d-occt","providerVersion":"0.1.0","kernelVersion":"7.8"},"projectId":"box","resultNodeId":"body","bodies":[{"id":"body","bounds":{"min":[0,0,0],"max":[20,5,5]},"viewerMesh":{"bodyId":"body","positions":[0,0,0,20,0,0,0,5,0],"normals":[0,0,1,0,0,1,0,0,1],"indices":[0,1,2]}}],"bounds":{"min":[0,0,0],"max":[20,5,5]},"warnings":[],"exactExport":{"format":"step","available":true}}
JSON
printf 'ISO-10303-21;\nEND-ISO-10303-21;' > "$OUTPUT/model.step"`);
    const artifact = await evaluateBrepProject(project(), { width: 20 });
    expect(artifact.result.status).toBe('success');
    expect(artifact.stepBytes).toBeInstanceOf(Uint8Array);
  });

  it('fails closed when the sandbox result violates the viewer contract', async () => {
    process.env.PCAD_BREP_RUNNER = await fakeRunner(
      `printf '{}' > "$OUTPUT/result.json"`,
    );
    await expectBrepError(
      () => evaluateBrepProject(project()),
      'output_invalid',
    );
  });
});
