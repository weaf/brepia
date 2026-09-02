import { describe, expect, it } from 'vitest';
import { assertServerOpenScadProjectAssetStorageScope } from '@/server/openScadProjectAssetStorage';
import type { OpenScadProjectAsset } from '@shared/openScadProject';

const asset: OpenScadProjectAsset = {
  path: 'assets/body.stl',
  storagePath: 'user-a/conversation-a/body.stl',
  mediaType: 'model/stl',
  byteLength: 128,
  sha256: 'a'.repeat(64),
};

describe('server OpenSCAD project asset scope', () => {
  it('accepts only the exact user/conversation storage prefix', () => {
    expect(() =>
      assertServerOpenScadProjectAssetStorageScope({
        asset,
        userId: 'user-a',
        conversationId: 'conversation-a',
      }),
    ).not.toThrow();
  });

  it('rejects another user or conversation before service-role download', () => {
    expect(() =>
      assertServerOpenScadProjectAssetStorageScope({
        asset,
        userId: 'user-b',
        conversationId: 'conversation-a',
      }),
    ).toThrow(/outside the active conversation/i);
    expect(() =>
      assertServerOpenScadProjectAssetStorageScope({
        asset,
        userId: 'user-a',
        conversationId: 'conversation-b',
      }),
    ).toThrow(/outside the active conversation/i);
  });
});
