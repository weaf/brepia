import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STEP_EXPORT_PROVIDER_VERSION,
  STEP_EXPORT_SOURCE_LIMIT_BYTES,
  StepExportError,
  exportScadToStep,
} from '@/server/stepExport';

const tempDirs: string[] = [];
let previousRunner: string | undefined;
let previousMaxConcurrent: string | undefined;
let previousMarker: string | undefined;

async function fakeRunner(body: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pcad-step-test-runner-'));
  tempDirs.push(dir);
  const runner = path.join(dir, 'runner.sh');
  await writeFile(
    runner,
    `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`,
    { mode: 0o700 },
  );
  return runner;
}

async function waitForFile(file: string, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(file);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`Timed out waiting for test marker: ${file}`);
}

async function expectStepError(
  promise: Promise<unknown>,
  code: StepExportError['code'],
) {
  await expect(promise).rejects.toMatchObject({
    name: 'StepExportError',
    code,
  });
}

describe('server STEP export boundary', () => {
  beforeEach(() => {
    previousRunner = process.env.PCAD_STEP_EXPORT_RUNNER;
    previousMaxConcurrent = process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT;
    previousMarker = process.env.PCAD_STEP_TEST_MARKER;
    delete process.env.PCAD_STEP_EXPORT_RUNNER;
    delete process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT;
    delete process.env.PCAD_STEP_TEST_MARKER;
  });

  afterEach(async () => {
    if (previousRunner === undefined) {
      delete process.env.PCAD_STEP_EXPORT_RUNNER;
    } else {
      process.env.PCAD_STEP_EXPORT_RUNNER = previousRunner;
    }
    if (previousMaxConcurrent === undefined) {
      delete process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT;
    } else {
      process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT = previousMaxConcurrent;
    }
    if (previousMarker === undefined) {
      delete process.env.PCAD_STEP_TEST_MARKER;
    } else {
      process.env.PCAD_STEP_TEST_MARKER = previousMarker;
    }
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        rm(dir, { recursive: true, force: true }),
      ),
    );
  });

  it('fails closed when no sandbox runner is configured', async () => {
    await expectStepError(exportScadToStep('cube(1);'), 'provider_unavailable');
  });

  it('rejects oversized source before invoking a runner', async () => {
    process.env.PCAD_STEP_EXPORT_RUNNER = '/definitely/not/a/runner';
    const source = 'x'.repeat(STEP_EXPORT_SOURCE_LIMIT_BYTES + 1);
    await expectStepError(exportScadToStep(source), 'source_too_large');
  });

  it('returns a Part 21 STEP file and records mesh fallback warnings', async () => {
    process.env.PCAD_STEP_EXPORT_RUNNER = await fakeRunner(`
output="$3"
printf 'ISO-10303-21;\\nHEADER;\\nENDSEC;\\nDATA;\\nENDSEC;\\nEND-ISO-10303-21;\\n' > "$output"
echo 'WARNING: mesh fallback used for hull()' >&2
`);

    const result = await exportScadToStep('cube(1);');
    const text = new TextDecoder().decode(result.bytes);

    expect(text).toContain('ISO-10303-21');
    expect(result.provider).toBe(`scad123d@${STEP_EXPORT_PROVIDER_VERSION}`);
    expect(result.warnings).toEqual([
      'WARNING: mesh fallback used for hull()',
    ]);
  });

  it('maps an unavailable sandbox image/runner exit to provider_unavailable', async () => {
    process.env.PCAD_STEP_EXPORT_RUNNER = await fakeRunner(`
echo 'STEP_SANDBOX_UNAVAILABLE: sandbox image is not built' >&2
exit 69
`);

    await expect(exportScadToStep('cube(1);')).rejects.toMatchObject({
      code: 'provider_unavailable',
      message: 'sandbox image is not built',
    });
  });

  it('rejects a symlink produced as STEP output', async () => {
    process.env.PCAD_STEP_EXPORT_RUNNER = await fakeRunner(`
ln -s /etc/hosts "$3"
`);

    await expectStepError(exportScadToStep('cube(1);'), 'output_invalid');
  });

  it('rejects regular output that is not STEP Part 21', async () => {
    process.env.PCAD_STEP_EXPORT_RUNNER = await fakeRunner(`
printf 'not a STEP file\\n' > "$3"
`);

    await expectStepError(exportScadToStep('cube(1);'), 'output_invalid');
  });

  it('rejects excess concurrent conversions and releases capacity afterward', async () => {
    const runner = await fakeRunner(`
touch "$PCAD_STEP_TEST_MARKER"
sleep 0.2
printf 'ISO-10303-21;\\nHEADER;\\nENDSEC;\\nDATA;\\nENDSEC;\\nEND-ISO-10303-21;\\n' > "$3"
`);
    const marker = path.join(path.dirname(runner), 'started');
    process.env.PCAD_STEP_EXPORT_RUNNER = runner;
    process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT = '1';
    process.env.PCAD_STEP_TEST_MARKER = marker;

    const firstExport = exportScadToStep('cube(1);');
    await waitForFile(marker);

    await expectStepError(exportScadToStep('sphere(1);'), 'capacity_exceeded');
    await expect(firstExport).resolves.toMatchObject({
      provider: `scad123d@${STEP_EXPORT_PROVIDER_VERSION}`,
    });

    await expect(exportScadToStep('sphere(1);')).resolves.toMatchObject({
      provider: `scad123d@${STEP_EXPORT_PROVIDER_VERSION}`,
    });
  });
});
