import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_SOURCE_BYTES = 256_000;
const VALIDATION_TIMEOUT_MS = 20_000;

export type OpenScadValidation = {
  valid: boolean;
  exitCode: number | null;
  outputBytes: number;
  diagnostics: string | null;
};

function compile(
  sourcePath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<{ exitCode: number | null; diagnostics: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      '/usr/bin/openscad',
      ['--export-format', 'binstl', '--quiet', '-o', outputPath, sourcePath],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let diagnostics = '';
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(stop, VALIDATION_TIMEOUT_MS);
    signal?.addEventListener('abort', stop, { once: true });
    child.stderr.on('data', (chunk: Buffer) => {
      diagnostics = `${diagnostics}${chunk}`.slice(-12_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      resolve({ exitCode, diagnostics: diagnostics.trim() });
    });
  });
}

/** Compile an isolated OpenSCAD candidate.  Nothing from the project is read. */
export async function validateOpenScad(
  code: string,
  signal?: AbortSignal,
): Promise<OpenScadValidation> {
  if (Buffer.byteLength(code, 'utf8') > MAX_SOURCE_BYTES) {
    return {
      valid: false,
      exitCode: null,
      outputBytes: 0,
      diagnostics: `OpenSCAD source exceeds ${MAX_SOURCE_BYTES} bytes.`,
    };
  }

  const dir = await mkdtemp(join(tmpdir(), 'pcad-openscad-'));
  const sourcePath = join(dir, 'candidate.scad');
  const outputPath = join(dir, 'candidate.stl');
  try {
    await writeFile(sourcePath, code, 'utf8');
    const result = await compile(sourcePath, outputPath, signal);
    const valid = result.exitCode === 0;
    return {
      valid,
      exitCode: result.exitCode,
      outputBytes: valid ? (await readFile(outputPath)).byteLength : 0,
      diagnostics: result.diagnostics || null,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
