import { describe, expect, it } from 'vitest';
import {
  CreativeRuntimeModelRoutingSchema,
  LOCAL_CREATIVE_PROFILE_DEFAULTS,
  getDefaultLocalCreativeProfile,
  getUsableLocalCreativeProfiles,
} from '@shared/modelRouting';
import { selectCreativeRuntimeModelIds } from '@/server/creativeRuntimeModels';

describe('Local Creative profiles', () => {
  it('keeps profiles explicit and defaults unconfigured', () => {
    const routing = CreativeRuntimeModelRoutingSchema.parse({});
    expect(routing.localCreativeProfiles).toEqual([]);
    expect(routing.defaultLocalCreativeProfileId).toBeNull();
    expect(getDefaultLocalCreativeProfile(routing)).toBeNull();
  });

  it('adds safe runtime defaults to existing profiles', () => {
    const routing = CreativeRuntimeModelRoutingSchema.parse({
      localCreativeProfiles: [
        {
          id: 'legacy-profile',
          name: 'Legacy profile',
          meshModelId: 'creative/mesh-a',
        },
      ],
    });

    expect(routing.localCreativeProfiles[0]).toMatchObject({
      resolution: LOCAL_CREATIVE_PROFILE_DEFAULTS.resolution,
      imageGenerationTimeoutMs:
        LOCAL_CREATIVE_PROFILE_DEFAULTS.imageGenerationTimeoutMs,
      meshGenerationTimeoutMs:
        LOCAL_CREATIVE_PROFILE_DEFAULTS.meshGenerationTimeoutMs,
    });
  });

  it('uses the explicitly selected usable profile', () => {
    const routing = CreativeRuntimeModelRoutingSchema.parse({
      localCreativeProfiles: [
        {
          id: 'draft',
          name: 'Draft runtime',
          adapter: 'native-image-mesh-v1',
          imageModelId: 'creative/image-a',
          meshModelId: 'creative/mesh-a',
          resolution: '512',
          imageGenerationTimeoutMs: 300_000,
          meshGenerationTimeoutMs: 600_000,
          enabled: true,
        },
        {
          id: 'quality',
          name: 'Quality runtime',
          adapter: 'native-image-mesh-v1',
          imageModelId: 'creative/image-b',
          meshModelId: 'creative/mesh-b',
          resolution: '1536',
          imageGenerationTimeoutMs: 900_000,
          meshGenerationTimeoutMs: 3_600_000,
          enabled: true,
        },
      ],
      defaultLocalCreativeProfileId: 'quality',
    });

    expect(getUsableLocalCreativeProfiles(routing)).toHaveLength(2);
    expect(getDefaultLocalCreativeProfile(routing)).toMatchObject({
      id: 'quality',
      resolution: '1536',
      imageGenerationTimeoutMs: 900_000,
      meshGenerationTimeoutMs: 3_600_000,
    });
  });

  it('does not treat disabled or mesh-less profiles as usable', () => {
    const routing = CreativeRuntimeModelRoutingSchema.parse({
      localCreativeProfiles: [
        {
          id: 'disabled',
          name: 'Disabled',
          adapter: 'native-image-mesh-v1',
          imageModelId: null,
          meshModelId: 'creative/mesh-a',
          enabled: false,
        },
        {
          id: 'incomplete',
          name: 'Incomplete',
          adapter: 'native-image-mesh-v1',
          imageModelId: 'creative/image-a',
          meshModelId: null,
          enabled: true,
        },
      ],
      defaultLocalCreativeProfileId: 'disabled',
    });

    expect(getUsableLocalCreativeProfiles(routing)).toEqual([]);
    expect(getDefaultLocalCreativeProfile(routing)).toBeNull();
  });

  it('rejects duplicate profile IDs', () => {
    const result = CreativeRuntimeModelRoutingSchema.safeParse({
      localCreativeProfiles: [
        {
          id: 'same',
          name: 'One',
          meshModelId: 'creative/mesh-a',
        },
        {
          id: 'same',
          name: 'Two',
          meshModelId: 'creative/mesh-b',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unsafe per-profile runtime settings', () => {
    const tooLong = CreativeRuntimeModelRoutingSchema.safeParse({
      localCreativeProfiles: [
        {
          id: 'too-long',
          name: 'Too long',
          meshModelId: 'creative/mesh-a',
          meshGenerationTimeoutMs: 14_400_001,
        },
      ],
    });
    const unsupportedResolution = CreativeRuntimeModelRoutingSchema.safeParse({
      localCreativeProfiles: [
        {
          id: 'bad-resolution',
          name: 'Bad resolution',
          meshModelId: 'creative/mesh-a',
          resolution: '2048',
        },
      ],
    });

    expect(tooLong.success).toBe(false);
    expect(unsupportedResolution.success).toBe(false);
  });
});

describe('Creative runtime discovery', () => {
  it('keeps only Creative runtime namespace IDs without naming models', () => {
    expect(
      selectCreativeRuntimeModelIds([
        'chat/model-a',
        'creative/image-runtime',
        'local/creative/mesh-runtime',
        'vision/model-b',
      ]),
    ).toEqual(['creative/image-runtime', 'local/creative/mesh-runtime']);
  });
});
