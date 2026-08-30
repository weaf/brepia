import { afterEach, describe, expect, it } from 'vitest';
import { resolveCreativeMeshProvider } from '../src/server/creativeMeshProviderRegistry';

const originalProviderList = process.env.PCAD_CREATIVE_MESH_PROVIDERS;
const originalFalKey = process.env.FAL_KEY;

afterEach(() => {
  if (originalProviderList === undefined) {
    delete process.env.PCAD_CREATIVE_MESH_PROVIDERS;
  } else {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = originalProviderList;
  }
  if (originalFalKey === undefined) {
    delete process.env.FAL_KEY;
  } else {
    process.env.FAL_KEY = originalFalKey;
  }
});

describe('Creative mesh provider registry', () => {
  it('keeps the neutral native backend enabled as the core provider', () => {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    const resolved = resolveCreativeMeshProvider('local/native');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/native');
    expect(resolved?.enabled).toBe(true);
  });

  it('normalizes legacy model-specific local IDs to the native backend', () => {
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    const resolved = resolveCreativeMeshProvider('local/trellis2');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/native');
    expect(resolved?.enabled).toBe(true);
  });

  it('does not resolve an unknown model to a hidden provider fallback', () => {
    expect(resolveCreativeMeshProvider('not-configured')).toBeNull();
  });

  it('requires both provider opt-in and credentials for fal.ai', () => {
    process.env.FAL_KEY = 'test-key';
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'none';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(false);

    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'fal';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(true);
  });

  it('keeps an opted-in provider disabled when credentials are absent', () => {
    delete process.env.FAL_KEY;
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = 'fal';
    expect(resolveCreativeMeshProvider('quality')?.enabled).toBe(false);
  });
});
