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

function providerExecutable(): string {
  return process.env.PCAD_SCAD2STEP_BIN?.trim() || 'uvx';
}

function providerArgs(inputPath: string, outputPath: string): string[] {
  const configured = process.env.PCAD_SCAD2STEP_BIN?.trim();
  if (configured) return [inputPath, '-o', outputPath];

  return [
    '--from',
    `scad123d==${STEP_EXPORT_PROVIDER_VERSION}`,
    'scad2step',
    inputPath,
    '-o',
    outputPath,
  ];
}

/**
 * Convert complete OpenSCAD source to STEP using scad123d/build123d/OCCT.
 *
 * The provider is deliberately isolated behind this server function: the UI
 * and API contract do not depend on scad123d and can move to another B-Rep
 * implementation later without changing the browser export flow.
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
        providerExecutable(),
        providerArgs(inputPath, outputPath),
        {
          timeout: STEP_EXPORT_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            ...(process.env.PCAD_OPENSCAD_BIN
              ? { SCAD123D_OPENSCAD: process.env.PCAD_OPENSCAD_BIN }
              : {}),
          },
        },
      );
      stderr = result.stderr ?? '';
    } catch (error) {
      const record = error as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: string;
        stderr?: string;
      };
      if (record.code === 'ENOENT') {
        throw new StepExportError(
          'provider_unavailable',
          'STEP export provider is not installed on the server.',
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
