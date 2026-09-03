import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runnerPath = path.resolve('scripts/brep/pcad-brep-sandbox');

describe('BRep Podman sandbox contract', () => {
  it('keeps the native evaluator rootless, networkless and read-only', async () => {
    const runner = await readFile(runnerPath, 'utf8');
    expect(runner).toContain('--network=none');
    expect(runner).toContain('--read-only');
    expect(runner).toContain('--security-opt=no-new-privileges');
    expect(runner).toContain('--cap-drop=all');
    expect(runner).toContain('--userns=keep-id');
    expect(runner).toContain('--pids-limit=');
    expect(runner).toContain('--memory=');
    expect(runner).toContain('--cpus=');
    expect(runner).toContain(':ro');
  });
});
