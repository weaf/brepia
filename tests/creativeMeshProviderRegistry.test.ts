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
  it('keeps TRELLIS.2 enabled as the core provider', () => {
    delete process.env.PCAD_CREATIVE_MESH_PROVIDERS;
    const resolved = resolveCreativeMeshProvider('local/trellis2');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/trellis2');
    expect(resolved?.enabled).toBe(true);
  });

  it('normalizes retired local IDs to TRELLIS.2', () => {
    const resolved = resolveCreativeMeshProvider('local/trellis-v1');
    expect(resolved?.provider.id).toBe('local');
    expect(resolved?.modelId).toBe('local/trellis2');
    expect(resolved?.enabled).toBe(true);
  });

  it('requires both provider opt-in and credentials for fal.ai', () => {
    process.env.FAL_KEY = 'test-key';
    process.env.PCAD_CREATIVE_MESH_PROVIDERS = '';
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
