import { describe, expect, it } from 'vitest';
import {
  CreativeRuntimeModelRoutingSchema,
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

  it('uses the explicitly selected usable profile', () => {
    const routing = CreativeRuntimeModelRoutingSchema.parse({
      localCreativeProfiles: [
        {
          id: 'draft',
          name: 'Draft runtime',
          adapter: 'native-image-mesh-v1',
          imageModelId: 'creative/image-a',
          meshModelId: 'creative/mesh-a',
          enabled: true,
        },
        {
          id: 'quality',
          name: 'Quality runtime',
          adapter: 'native-image-mesh-v1',
          imageModelId: 'creative/image-b',
          meshModelId: 'creative/mesh-b',
          enabled: true,
        },
      ],
      defaultLocalCreativeProfileId: 'quality',
    });

    expect(getUsableLocalCreativeProfiles(routing)).toHaveLength(2);
    expect(getDefaultLocalCreativeProfile(routing)?.id).toBe('quality');
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
