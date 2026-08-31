import { execFile } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const STEP_EXPORT_SOURCE_LIMIT_BYTES = 256_000;
export const STEP_EXPORT_OUTPUT_LIMIT_BYTES = 32 * 1024 * 1024;
export const STEP_EXPORT_TIMEOUT_MS = 45_000;
export const STEP_EXPORT_PROVIDER = 'scad123d';
export const STEP_EXPORT_PROVIDER_VERSION = '0.5.0';
export const STEP_EXPORT_DEFAULT_MAX_CONCURRENT = 1;
const STEP_EXPORT_MAX_CONCURRENT_LIMIT = 8;

let activeStepExports = 0;

export type StepExportResult = {
  bytes: Uint8Array;
  warnings: string[];
  provider: string;
};

export class StepExportError extends Error {
  constructor(
    public readonly code:
      | 'source_too_large'
      | 'provider_unavailable'
      | 'capacity_exceeded'
      | 'conversion_failed'
      | 'conversion_timeout'
      | 'output_missing'
      | 'output_invalid'
      | 'output_too_large',
    message: string,
  ) {
    super(message);
    this.name = 'StepExportError';
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseWarnings(stderr: string): string[] {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /warn|fallback|mesh/i.test(line))
    .slice(0, 20);
}

function sandboxRunner(): string {
  const runner = process.env.PCAD_STEP_EXPORT_RUNNER?.trim();
  if (!runner) {
    throw new StepExportError(
      'provider_unavailable',
      'STEP export is not configured on this server.',
    );
  }
  return runner;
}

function configuredMaxConcurrent(): number {
  const configured = Number.parseInt(
    process.env.PCAD_STEP_EXPORT_MAX_CONCURRENT ?? '',
    10,
  );
  if (!Number.isFinite(configured) || configured < 1) {
    return STEP_EXPORT_DEFAULT_MAX_CONCURRENT;
  }
  return Math.min(configured, STEP_EXPORT_MAX_CONCURRENT_LIMIT);
}

function acquireStepExportSlot(): () => void {
  const maxConcurrent = configuredMaxConcurrent();
  if (activeStepExports >= maxConcurrent) {
    throw new StepExportError(
      'capacity_exceeded',
      'STEP export capacity is currently busy. Try again shortly.',
    );
  }

  activeStepExports += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeStepExports = Math.max(0, activeStepExports - 1);
  };
}

function stderrText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Buffer.isBuffer(value)) return value.toString('utf8').trim();
  return '';
}

function providerUnavailableMessage(detail: string): string {
  const normalized = detail
    .replace(/^STEP_SANDBOX_UNAVAILABLE:\s*/i, '')
    .trim();
  return normalized || 'STEP export sandbox is unavailable on this server.';
}

async function convertScadToStep(
  sourceCode: string,
): Promise<StepExportResult> {
  const workspace = await mkdtemp(path.join(tmpdir(), 'pcad-step-'));
  const inputDir = path.join(workspace, 'input');
  const outputDir = path.join(workspace, 'output');
  const inputPath = path.join(inputDir, 'model.scad');
  const outputPath = path.join(outputDir, 'model.step');

  try {
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, sourceCode, 'utf8');

    let stderr = '';
    try {
      const result = await execFileAsync(
        sandboxRunner(),
        [inputPath, '-o', outputPath],
        {
          timeout: STEP_EXPORT_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
          env: process.env,
        },
      );
      stderr = result.stderr ?? '';
    } catch (error) {
      if (error instanceof StepExportError) throw error;

      const record = error as {
        code?: string | number;
        killed?: boolean;
        signal?: string;
        stderr?: string | Buffer;
      };
      const detail = stderrText(record.stderr);

      if (record.code === 'ENOENT' || record.code === 69) {
        throw new StepExportError(
          'provider_unavailable',
          record.code === 'ENOENT'
            ? 'Configured STEP export runner was not found on the server.'
            : providerUnavailableMessage(detail),
        );
      }

      if (record.code === 124 || record.killed || record.signal === 'SIGTERM') {
        throw new StepExportError(
          'conversion_timeout',
          'STEP conversion exceeded the server time limit.',
        );
      }

      throw new StepExportError(
        'conversion_failed',
        detail
          ? `STEP conversion failed: ${detail.slice(0, 1200)}`
          : 'STEP conversion failed.',
      );
    }

    let outputStat;
    try {
      outputStat = await lstat(outputPath);
    } catch {
      throw new StepExportError(
        'output_missing',
        'STEP converter completed without producing an output file.',
      );
    }

    if (outputStat.isSymbolicLink() || !outputStat.isFile()) {
      throw new StepExportError(
        'output_invalid',
        'STEP converter produced an invalid output object.',
      );
    }

    if (outputStat.size > STEP_EXPORT_OUTPUT_LIMIT_BYTES) {
      throw new StepExportError(
        'output_too_large',
        `STEP output exceeds the ${STEP_EXPORT_OUTPUT_LIMIT_BYTES}-byte server limit.`,
      );
    }

    const output = await readFile(outputPath);
    if (output.byteLength > STEP_EXPORT_OUTPUT_LIMIT_BYTES) {
      throw new StepExportError(
        'output_too_large',
        `STEP output exceeds the ${STEP_EXPORT_OUTPUT_LIMIT_BYTES}-byte server limit.`,
      );
    }

    const header = output.subarray(0, 128).toString('ascii');
    if (!header.includes('ISO-10303-21')) {
      throw new StepExportError(
        'output_invalid',
        'STEP converter output is not an ISO 10303-21 Part 21 file.',
      );
    }

    return {
      bytes: new Uint8Array(output),
      warnings: parseWarnings(stderr),
      provider: `${STEP_EXPORT_PROVIDER}@${STEP_EXPORT_PROVIDER_VERSION}`,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

/**
 * Convert complete OpenSCAD source to STEP using an explicitly configured,
 * sandboxed scad2step runner.
 *
 * IMPORTANT: scad123d invokes native OpenSCAD and upstream explicitly warns
 * against running untrusted SCAD directly on a host. pCAD accepts imported
 * user SCAD, so this module intentionally has no direct `uvx scad2step`
 * fallback. PCAD_STEP_EXPORT_RUNNER must point at an operator-controlled
 * sandbox wrapper (container/VM) that accepts `<input.scad> -o <output.step>`.
 */
export async function exportScadToStep(
  sourceCode: string,
): Promise<StepExportResult> {
  const sourceBytes = byteLength(sourceCode);
  if (sourceBytes > STEP_EXPORT_SOURCE_LIMIT_BYTES) {
    throw new StepExportError(
      'source_too_large',
      `OpenSCAD source exceeds the ${STEP_EXPORT_SOURCE_LIMIT_BYTES}-byte STEP export limit.`,
    );
  }

  const releaseSlot = acquireStepExportSlot();
  try {
    return await convertScadToStep(sourceCode);
  } finally {
    releaseSlot();
  }
}
