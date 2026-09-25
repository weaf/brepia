import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BREP_PROJECT_SCHEMA_VERSION } from '@shared/brepProject';
import { validateBuiltinProductTemplateNative } from '@/server/productTemplateValidation';

const originalRunner = process.env.PCAD_BREP_RUNNER;

afterEach(() => {
  if (originalRunner == null) delete process.env.PCAD_BREP_RUNNER;
  else process.env.PCAD_BREP_RUNNER = originalRunner;
});

function fixture() {
  return {
    id: 'builtin:native-validation-fixture',
    version: 1,
    name: 'Native validation fixture',
    category: 'Test fixtures',
    source: {
      kind: 'brep' as const,
      source: {
        schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
        id: 'nativeValidationFixture',
        name: 'Native validation fixture',
        units: 'mm' as const,
        placement: {
          origin: [0, 0, 0] as [number, number, number],
          xAxis: [1, 0, 0] as [number, number, number],
          yAxis: [0, 1, 0] as [number, number, number],
        },
        parameters: [
          {
            id: 'width',
            label: 'Width',
            type: 'number' as const,
            unit: 'mm' as const,
            default: 40,
            min: 20,
            max: 80,
          },
        ],
        nodes: [
          {
            id: 'body',
            type: 'box' as const,
            width: { parameter: 'width' },
            depth: 20,
            height: 10,
          },
        ],
        resultNodeId: 'body',
      },
    },
    presentation: {
      parameterOrder: ['width'],
    },
  };
}

async function fakeRunner(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'brepia-c5-native-'));
  const runner = path.join(directory, 'runner.sh');
  const script = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    "OUTPUT=''",
    'while [ "$#" -gt 0 ]; do',
    '  case "$1" in',
    '    --input) shift 2;;',
    '    --output) OUTPUT="$2"; shift 2;;',
    '    *) exit 64;;',
    '  esac',
    'done',
    'mkdir -p "$OUTPUT"',
    "cat > \"$OUTPUT/result.json\" <<'JSON'",
    '{"status":"success","provider":{"id":"build123d-occt","providerVersion":"0.3.0","kernelVersion":"7.9.3.1"},"projectId":"nativeValidationFixture","resultNodeId":"body","resultKind":"single","bodies":[{"id":"body","nodeId":"body","bounds":{"min":[-20,-10,-5],"max":[20,10,5]},"viewerMesh":{"bodyId":"body","positions":[0,0,0,1,0,0,0,1,0],"normals":[0,0,1,0,0,1,0,0,1],"indices":[0,1,2]}}],"bounds":{"min":[-20,-10,-5],"max":[20,10,5]},"projectObject":{"placement":{"origin":[0,0,0],"xAxis":[1,0,0],"yAxis":[0,1,0],"zAxis":[0,0,1]},"geometry":{},"points":[]},"warnings":[],"exactExport":{"format":"step","available":true}}',
    'JSON',
    "printf 'ISO-10303-21;\\nEND-ISO-10303-21;' > \"$OUTPUT/model.step\"",
    '',
  ].join('\n');
  await writeFile(runner, script, 'utf8');
  await chmod(runner, 0o755);
  return runner;
}

describe('C5 native built-in product template validation', () => {
  it('reuses the native evaluator and requires matching result kind plus exact STEP', async () => {
    process.env.PCAD_BREP_RUNNER = await fakeRunner();

    const result = await validateBuiltinProductTemplateNative(fixture());

    expect(result.staticValidation.expectedResultKind).toBe('single');
    expect(result.evaluation.resultKind).toBe('single');
    expect(result.evaluation.exactExport.available).toBe(true);
    expect(result.stepBytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result.stepBytes)).toContain('ISO-10303-21');
  });
});
