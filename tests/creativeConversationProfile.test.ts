import { describe, expect, it } from 'vitest';
import { CreativeRuntimeModelRoutingSchema } from '@shared/modelRouting';
import { resolveCreativeConversationProfile } from '@/server/creativeConversationProfile';

function routing() {
  return CreativeRuntimeModelRoutingSchema.parse({
    localCreativeProfiles: [
      {
        id: 'draft',
        name: 'Draft',
        imageModelId: 'creative/image-draft',
        meshModelId: 'creative/mesh-draft',
        resolution: '512',
        enabled: false,
      },
      {
        id: 'quality',
        name: 'Quality',
        imageModelId: 'creative/image-quality',
        meshModelId: 'creative/mesh-quality',
        resolution: '1024',
        enabled: true,
      },
    ],
    defaultLocalCreativeProfileId: 'quality',
    nativeImageModelId: 'creative/image-quality',
    nativeMeshModelId: 'creative/mesh-quality',
  });
}

describe('Creative conversation profile pinning', () => {
  it('keeps legacy conversations on the current explicit default', () => {
    const resolved = resolveCreativeConversationProfile(routing(), {
      model: 'local/native',
    });

    expect(resolved.source).toBe('legacy-current-default');
    expect(resolved.profileId).toBe('quality');
    expect(resolved.profile?.meshModelId).toBe('creative/mesh-quality');
  });

  it('keeps a pinned profile even when the global default points elsewhere', () => {
    const resolved = resolveCreativeConversationProfile(routing(), {
      model: 'local/native',
      localCreativeProfileId: 'draft',
    });

    expect(resolved.source).toBe('pinned');
    expect(resolved.profileId).toBe('draft');
    expect(resolved.profile?.meshModelId).toBe('creative/mesh-draft');
    expect(resolved.profile?.resolution).toBe('512');
  });

  it('allows an existing conversation to keep a disabled pinned profile', () => {
    const resolved = resolveCreativeConversationProfile(routing(), {
      localCreativeProfileId: 'draft',
    });

    expect(resolved.profile?.enabled).toBe(false);
    expect(resolved.profileId).toBe('draft');
  });

  it('preserves an explicit no-profile pin instead of adopting a future default', () => {
    const resolved = resolveCreativeConversationProfile(routing(), {
      localCreativeProfileId: null,
    });

    expect(resolved).toEqual({
      profile: null,
      profileId: null,
      source: 'pinned-none',
    });
  });

  it('fails closed when a pinned profile was deleted', () => {
    expect(() =>
      resolveCreativeConversationProfile(routing(), {
        localCreativeProfileId: 'deleted-profile',
      }),
    ).toThrow(/no longer exists/i);
  });

  it('fails closed when a pinned profile loses its mesh runtime', () => {
    const incomplete = CreativeRuntimeModelRoutingSchema.parse({
      localCreativeProfiles: [
        {
          id: 'pinned',
          name: 'Pinned',
          imageModelId: 'creative/image-a',
          meshModelId: null,
          enabled: false,
        },
      ],
      defaultLocalCreativeProfileId: null,
    });

    expect(() =>
      resolveCreativeConversationProfile(incomplete, {
        localCreativeProfileId: 'pinned',
      }),
    ).toThrow(/mesh runtime/i);
  });

  it('rejects malformed persisted profile pins', () => {
    expect(() =>
      resolveCreativeConversationProfile(routing(), {
        localCreativeProfileId: 123,
      }),
    ).toThrow(/invalid Local Creative profile pin/i);
  });
});
