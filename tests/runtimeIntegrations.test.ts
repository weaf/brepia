/**
 * B4 — Runtime integrations discovery tests.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/server/opencode', () => ({
  opencodeApiUrl: () => 'http://127.0.0.1:4096',
  opencodeModels: vi.fn(async () => []),
}));

// ---------------------------------------------------------------------------
// Mock fetch (for network probes in OpenCode / Local OpenAI)
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Mock env
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

function setEnv(partial: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('discoverRuntimeIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv({ LOCAL_LLM_BASE_URL: undefined });
    mockFetch.mockReset();
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  it('returns exactly 3 integration statuses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();

    expect(results).toHaveLength(3);
    const ids = results.map((r) => r.integrationId);
    expect(ids).toContain('opencode');
    expect(ids).toContain('codex');
    expect(ids).toContain('local-openai');
  });

  it('OpenCode integration has correct label and valid status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();
    const opencode = results.find((r) => r.integrationId === 'opencode');

    expect(opencode).toBeDefined();
    expect(opencode?.label).toBe('OpenCode');
    expect(['connected', 'available', 'unavailable']).toContain(
      opencode?.status,
    );
    expect(typeof opencode?.modelCount).toBe('number');
    expect(typeof opencode?.baseUrl).toBe('string');
  });

  it('Local OpenAI returns not-configured when LOCAL_LLM_BASE_URL is absent', async () => {
    setEnv({ LOCAL_LLM_BASE_URL: undefined });
    mockFetch.mockReset();

    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();

    const local = results.find((r) => r.integrationId === 'local-openai');
    expect(local?.status).toBe('not-configured');
    expect(local?.baseUrl).toBeNull();
    expect(local?.modelCount).toBe(0);
  });

  it('Local OpenAI returns not-configured when LOCAL_LLM_BASE_URL is empty string', async () => {
    setEnv({ LOCAL_LLM_BASE_URL: '' });
    mockFetch.mockReset();

    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();

    const local = results.find((r) => r.integrationId === 'local-openai');
    expect(local?.status).toBe('not-configured');
  });

  it('no secret values appear in any integration DTO', async () => {
    setEnv({ LOCAL_LLM_BASE_URL: 'http://localhost:11434' });
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();

    const allText = results.map((r) => JSON.stringify(r)).join('\n');
    expect(allText).not.toContain('sk-');
    expect(allText).not.toContain('sb_');
    expect(allText).not.toContain('eyJ');
    expect(allText).not.toContain('Bearer');
  });
});

describe('RuntimeIntegrationStatus DTO shape', () => {
  it('has all required fields with correct types', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { discoverRuntimeIntegrations } =
      await import('@/server/runtimeIntegrations');
    const results = await discoverRuntimeIntegrations();

    for (const r of results) {
      expect(r).toHaveProperty('integrationId');
      expect(r).toHaveProperty('label');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('baseUrl');
      expect(r).toHaveProperty('modelCount');
      expect(r).toHaveProperty('explanation');
      expect(typeof r.label).toBe('string');
      expect(r.label.length).toBeGreaterThan(0);
      expect([
        'connected',
        'available',
        'unavailable',
        'not-configured',
      ]).toContain(r.status);
      expect(r.baseUrl === null || typeof r.baseUrl === 'string').toBe(true);
      expect(typeof r.modelCount).toBe('number');
      expect(r.modelCount).toBeGreaterThanOrEqual(0);
      expect(typeof r.explanation).toBe('string');
      expect(r.explanation.length).toBeGreaterThan(0);
    }
  });
});

describe('API endpoint auth requirement', () => {
  it('route file uses requireUser for auth', async () => {
    const routeSource = readFileSync(
      join(
        import.meta.dirname,
        '../src/routes/api/settings/runtimeIntegrations.ts',
      ),
      'utf-8',
    );
    expect(routeSource).toContain('requireUser');
  });

  it('route is defined with GET handler', async () => {
    const routeSource = readFileSync(
      join(
        import.meta.dirname,
        '../src/routes/api/settings/runtimeIntegrations.ts',
      ),
      'utf-8',
    );
    expect(routeSource).toContain('GET');
    expect(routeSource).toContain('discoverRuntimeIntegrations');
  });
});
