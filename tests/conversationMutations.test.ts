import {
  applyConversationPatch,
  restoreConversationPatch,
} from '../src/services/conversationMutations';
import type { Conversation } from '@shared/types';
import { describe, expect, it } from 'vitest';

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    title: 'Old title',
    current_message_leaf_id: 'leaf-old',
    user_id: 'user-1',
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    privacy: 'private',
    type: 'parametric',
    settings: {
      model: 'old-model',
      openCodeExecutionMode: 'cli',
    },
    ...overrides,
  };
}

describe('conversation metadata patches', () => {
  it('preserves a newer active leaf when applying a stale title patch', () => {
    const stale = conversation();
    const current = conversation({ current_message_leaf_id: 'leaf-new' });

    const result = applyConversationPatch(current, { title: 'New title' });

    expect(result.title).toBe('New title');
    expect(result.current_message_leaf_id).toBe('leaf-new');
    expect(stale.current_message_leaf_id).toBe('leaf-old');
  });

  it('changes only the intended settings key and preserves the newer leaf', () => {
    const current = conversation({
      current_message_leaf_id: 'leaf-new',
      settings: {
        model: 'newer-model',
        openCodeExecutionMode: 'cli',
      },
    });

    const result = applyConversationPatch(current, {
      settings: { openCodeExecutionMode: 'streaming' },
    });

    expect(result.settings).toEqual({
      model: 'newer-model',
      openCodeExecutionMode: 'streaming',
    });
    expect(result.current_message_leaf_id).toBe('leaf-new');
  });

  it('rolls back only touched fields and never rolls back a concurrent leaf move', () => {
    const previous = conversation({
      title: 'Before',
      current_message_leaf_id: 'leaf-old',
    });
    const currentAfterConcurrentLeafMove = conversation({
      title: 'Optimistic',
      current_message_leaf_id: 'leaf-new',
    });

    const result = restoreConversationPatch(
      currentAfterConcurrentLeafMove,
      previous,
      { title: 'Optimistic' },
    );

    expect(result.title).toBe('Before');
    expect(result.current_message_leaf_id).toBe('leaf-new');
  });
});
