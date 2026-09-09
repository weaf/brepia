import { describe, expect, it } from 'vitest';
import {
  creativeImageIdsFromMessageParts,
  findCreativeTurnImageIds,
  resolveCreativeRequestedImageIds,
  type CreativeReferenceMessage,
} from '../src/server/creativeMeshReferenceImages';

const IMAGE_A = '11111111-1111-4111-8111-111111111111';
const IMAGE_B = '22222222-2222-4222-8222-222222222222';

function imagePart(id: string) {
  return {
    type: 'file',
    mediaType: 'image/png',
    filename: `${id}.png`,
    url: `/storage/v1/object/public/images/test/${id}`,
  };
}

describe('Creative image-to-mesh reference anchoring', () => {
  it('extracts canonical image UUIDs from persisted file parts', () => {
    expect(
      creativeImageIdsFromMessageParts([
        imagePart(IMAGE_A),
        { type: 'file', mediaType: 'text/plain', filename: `${IMAGE_B}.txt` },
        imagePart(IMAGE_A),
      ]),
    ).toEqual([IMAGE_A]);
  });

  it('uses the authoritative turn images when the model omits imageIds', () => {
    expect(resolveCreativeRequestedImageIds([], [IMAGE_A])).toEqual([IMAGE_A]);
  });

  it('resolves model-facing image aliases against the authoritative turn', () => {
    expect(
      resolveCreativeRequestedImageIds(['image-2.png'], [IMAGE_A, IMAGE_B]),
    ).toEqual([IMAGE_B]);
  });

  it('falls back to one unambiguous attachment when the model invents an alias', () => {
    expect(
      resolveCreativeRequestedImageIds(['reference-image'], [IMAGE_A]),
    ).toEqual([IMAGE_A]);
  });

  it('recovers the current user attachment when the mutable leaf has advanced to an assistant', async () => {
    const messages = new Map<string, CreativeReferenceMessage>([
      [
        'assistant-current',
        {
          role: 'assistant',
          parentMessageId: 'user-current',
          parts: [],
        },
      ],
      [
        'user-current',
        {
          role: 'user',
          parentMessageId: 'assistant-previous',
          parts: [imagePart(IMAGE_A)],
        },
      ],
    ]);

    await expect(
      findCreativeTurnImageIds({
        leafMessageId: 'assistant-current',
        loadMessage: async (id) => messages.get(id) ?? null,
      }),
    ).resolves.toEqual([IMAGE_A]);
  });

  it('stops at the nearest user turn and never reuses an older image', async () => {
    const messages = new Map<string, CreativeReferenceMessage>([
      [
        'assistant-current',
        {
          role: 'assistant',
          parentMessageId: 'user-current',
          parts: [],
        },
      ],
      [
        'user-current',
        {
          role: 'user',
          parentMessageId: 'assistant-previous',
          parts: [{ type: 'text', text: 'make a red cube' }],
        },
      ],
      [
        'assistant-previous',
        {
          role: 'assistant',
          parentMessageId: 'user-previous',
          parts: [],
        },
      ],
      [
        'user-previous',
        {
          role: 'user',
          parentMessageId: null,
          parts: [imagePart(IMAGE_B)],
        },
      ],
    ]);

    await expect(
      findCreativeTurnImageIds({
        leafMessageId: 'assistant-current',
        loadMessage: async (id) => messages.get(id) ?? null,
      }),
    ).resolves.toEqual([]);
  });

  it('fails closed on a cyclic branch instead of walking forever', async () => {
    const messages = new Map<string, CreativeReferenceMessage>([
      [
        'assistant-a',
        { role: 'assistant', parentMessageId: 'assistant-b', parts: [] },
      ],
      [
        'assistant-b',
        { role: 'assistant', parentMessageId: 'assistant-a', parts: [] },
      ],
    ]);

    await expect(
      findCreativeTurnImageIds({
        leafMessageId: 'assistant-a',
        loadMessage: async (id) => messages.get(id) ?? null,
      }),
    ).resolves.toEqual([]);
  });
});
