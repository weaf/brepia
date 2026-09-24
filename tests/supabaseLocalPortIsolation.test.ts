import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const portNames = [
  'BREPIA_SUPABASE_API_PORT',
  'BREPIA_SUPABASE_DB_PORT',
  'BREPIA_SUPABASE_SHADOW_PORT',
  'BREPIA_SUPABASE_POOLER_PORT',
  'BREPIA_SUPABASE_EDGE_INSPECTOR_PORT',
  'BREPIA_SUPABASE_STUDIO_PORT',
  'BREPIA_SUPABASE_LOCAL_SMTP_PORT',
  'BREPIA_SUPABASE_SMTP_PORT',
  'BREPIA_SUPABASE_POP3_PORT',
  'BREPIA_SUPABASE_ANALYTICS_PORT',
];

describe('local Supabase port ownership', () => {
  it('binds every host-facing Supabase port to the checkout-local port bundle', async () => {
    const config = await readFile('supabase/config.toml', 'utf8');
    const helper = await readFile('scripts/supabase-local.sh', 'utf8');

    for (const name of portNames) {
      expect(config).toContain(`env(${name})`);
      expect(helper).toContain(name);
    }

    expect(helper).toContain('.brepia');
    expect(helper).toContain('supabase-ports.env');
    expect(helper).toContain('label=com.supabase.cli.project=brepia');
    expect(helper).toContain('podman rm -f');
    expect(helper).not.toContain('podman volume rm');
    expect(helper).toContain('scripts/podman');
    expect(helper).not.toContain('retrying once after project-only cleanup');
    expect(helper).toContain('brepia_supabase_start');
    expect(config).toContain('[edge_runtime]');
    expect(config).toContain('enabled = false');
    const analyticsSection =
      config.match(/\[analytics\]\n([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
    expect(analyticsSection).toContain('enabled = false');
  });

  it('pins the Supabase CLI to the Podman-compatible version', async () => {
    const [packageText, lockText, lifecycle] = await Promise.all([
      readFile('package.json', 'utf8'),
      readFile('package-lock.json', 'utf8'),
      readFile('docs/local_supabase_lifecycle.md', 'utf8'),
    ]);
    const packageJson = JSON.parse(packageText);
    const packageLock = JSON.parse(lockText);

    expect(packageJson.devDependencies.supabase).toBe('2.114.0');
    expect(packageLock.packages[''].devDependencies.supabase).toBe('2.114.0');
    expect(packageLock.packages['node_modules/supabase'].version).toBe(
      '2.114.0',
    );
    expect(lifecycle).toContain('pins the CLI to `2.114.0`');
  });

  it('removes the historical 54321 runtime coupling', async () => {
    const [launcher, vite, proxy, smoke] = await Promise.all([
      readFile('start.sh', 'utf8'),
      readFile('vite.config.ts', 'utf8'),
      readFile('scripts/stable-runtime-proxy.mjs', 'utf8'),
      readFile('playwright.smoke.config.ts', 'utf8'),
    ]);

    expect(launcher).toContain(
      'source "${SCRIPT_DIR}/scripts/supabase-local.sh"',
    );
    expect(launcher).toContain('brepia_supabase status');
    expect(vite).not.toContain('port: 54321');
    expect(vite).not.toContain("host: 'localhost:54321'");
    expect(proxy).not.toContain('|| 54321');
    expect(smoke).not.toContain('127.0.0.1:54321');
  });
});

describe('Supabase Realtime Podman compatibility', () => {
  it('routes Supabase CLI calls through the repo-owned Podman shim without retrying startup', async () => {
    const wrapper = await readFile('scripts/supabase-local.sh', 'utf8');
    expect(wrapper).toContain(
      'PATH="${BREPIA_ROOT}/scripts/podman:${PATH}" npx supabase',
    );
    expect(wrapper).not.toContain('retrying once after project-only cleanup');
  });

  it('pins only Brepia Realtime creates to the running DB IPv4 and explicit IPv4 mode', async () => {
    const shim = await readFile('scripts/podman/podman', 'utf8');
    expect(shim).toContain('"${1:-}" == "create"');
    expect(shim).toContain('"${APP_NAME:-}" == "realtime"');
    expect(shim).toContain('"${DB_HOST:-}" == "supabase_db_brepia"');
    expect(shim).toContain('export DB_HOST="${db_ip}"');
    expect(shim).toContain('export DB_IP_VERSION="ipv4"');
    expect(shim).toContain('newargs+=("-e" "DB_IP_VERSION")');
  });
});
