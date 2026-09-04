import { describe, expect, it } from 'vitest';
import {
  BrepAiContextError,
  resolveActiveBrepAiSourceForLeaf,
} from '../shared/brepAiContext';

describe('native BRep leaf snapshot reconciliation', () => {
  it('returns unresolved when the selected leaf is absent from the current message snapshot', () => {
    expect(
      resolveActiveBrepAiSourceForLeaf(
        [
          {
            id: 'a1',
            role: 'assistant',
            parts: [],
            parent_message_id: null,
          },
        ],
        'cached-leaf-not-fetched-yet',
      ),
    ).toBeUndefined();
  });

  it('still fails closed when a present leaf has incomplete persisted ancestry', () => {
    expect(() =>
      resolveActiveBrepAiSourceForLeaf(
        [
          {
            id: 'u2',
            role: 'user',
            parts: [{ type: 'text', text: 'Continue.' }],
            parent_message_id: 'missing-parent',
          },
        ],
        'u2',
      ),
    ).toThrowError(BrepAiContextError);
  });
});
