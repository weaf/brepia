import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const STEP_EXPORT_SOURCE_LIMIT_BYTES = 256_000;
export const STEP_EXPORT_OUTPUT_LIMIT_BYTES = 32 * 1024 * 1024;
export const STEP_EXPORT_TIMEOUT_MS = 45_000;
export const STEP_EXPORT_PROVIDER = 'scad123d';
export const STEP_EXPORT_PROVIDER_VERSION = '0.5.0';

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
      | 'conversion_failed'
      | 'conversion_timeout'
      | 'output_missing'
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
export async function exportScadToStep(sourceCode: string): Promise<StepExportResult> {
  const sourceBytes = byteLength(sourceCode);
  if (sourceBytes > STEP_EXPORT_SOURCE_LIMIT_BYTES) {
    throw new StepExportError(
      'source_too_large',
      `OpenSCAD source exceeds the ${STEP_EXPORT_SOURCE_LIMIT_BYTES}-byte STEP export limit.`,
    );
  }

  const workspace = await mkdtemp(path.join(tmpdir(), 'pcad-step-'));
  const inputPath = path.join(workspace, 'model.scad');
  const outputPath = path.join(workspace, 'model.step');

  try {
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
      const record = error as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: string;
        stderr?: string;
      };
      if (record.code === 'ENOENT') {
        throw new StepExportError(
          'provider_unavailable',
          'Configured STEP export runner was not found on the server.',
        );
      }
      if (record.killed || record.signal === 'SIGTERM') {
        throw new StepExportError(
          'conversion_timeout',
          'STEP conversion exceeded the server time limit.',
        );
      }
      const detail = typeof record.stderr === 'string' ? record.stderr.trim() : '';
      throw new StepExportError(
        'conversion_failed',
        detail ? `STEP conversion failed: ${detail.slice(0, 1200)}` : 'STEP conversion failed.',
      );
    }

    let output: Buffer;
    try {
      output = await readFile(outputPath);
    } catch {
      throw new StepExportError(
        'output_missing',
        'STEP converter completed without producing an output file.',
      );
    }

    if (output.byteLength > STEP_EXPORT_OUTPUT_LIMIT_BYTES) {
      throw new StepExportError(
        'output_too_large',
        `STEP output exceeds the ${STEP_EXPORT_OUTPUT_LIMIT_BYTES}-byte server limit.`,
      );
    }

    return {
      bytes: new Uint8Array(output),
      warnings: parseWarnings(stderr),
      provider: `${STEP_EXPORT_PROVIDER}@${STEP_EXPORT_PROVIDER_VERSION}`,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
