import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runnerPath = path.resolve('scripts/brep/pcad-brep-sandbox');
const launcherPath = path.resolve('start.sh');
const stableRuntimeProxyPath = path.resolve('scripts/stable-runtime-proxy.mjs');

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

  it('wires the native evaluator into the canonical local launcher and stable runtime', async () => {
    const [launcher, stableRuntimeProxy] = await Promise.all([
      readFile(launcherPath, 'utf8'),
      readFile(stableRuntimeProxyPath, 'utf8'),
    ]);

    expect(launcher).toContain('if [ -z "${PCAD_BREP_RUNNER:-}" ]; then');
    expect(launcher).toContain(
      'export PCAD_BREP_RUNNER="${SCRIPT_DIR}/scripts/brep/pcad-brep-sandbox"',
    );
    expect(launcher.indexOf('export PCAD_BREP_RUNNER=')).toBeLessThan(
      launcher.indexOf('node scripts/stable-runtime-proxy.mjs'),
    );
    expect(stableRuntimeProxy).toContain('env: process.env');
  });
});
