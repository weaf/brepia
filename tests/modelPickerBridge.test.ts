import {
  __modelPickerBridgeTestUtils,
  getConversationModelPicker,
  registerConversationModelPicker,
} from '@/lib/modelPickerBridge';
import type { Model } from '@shared/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  __modelPickerBridgeTestUtils.clear();
});

describe('model picker bridge', () => {
  it('exposes the picker binding only for the matching conversation', () => {
    const onModelChange = vi.fn<(model: Model) => void>();
    const binding = {
      models: [
        {
          id: 'local/qwen',
          name: 'Qwen',
          provider: 'Local',
          supportsTools: true,
        },
      ],
      selectedModel: 'local/qwen',
      onModelChange,
      disabled: false,
      type: 'parametric' as const,
    };

    registerConversationModelPicker('conversation-a', binding);

    expect(getConversationModelPicker('conversation-a')).toBe(binding);
    expect(getConversationModelPicker('conversation-b')).toBeUndefined();
  });

  it('lets a newer registration replace an older model selection', () => {
    const onModelChange = vi.fn<(model: Model) => void>();
    const oldBinding = {
      models: [],
      selectedModel: 'openai/gpt-5.6-sol',
      onModelChange,
      disabled: false,
      type: 'parametric' as const,
    };
    const newBinding = {
      ...oldBinding,
      selectedModel: 'local/qwen',
    };

    const cleanupOld = registerConversationModelPicker(
      'conversation-a',
      oldBinding,
    );
    registerConversationModelPicker('conversation-a', newBinding);

    cleanupOld();

    expect(getConversationModelPicker('conversation-a')).toBe(newBinding);
  });

  it('removes the active binding on cleanup', () => {
    const binding = {
      models: [],
      selectedModel: 'local/qwen',
      onModelChange: vi.fn<(model: Model) => void>(),
      disabled: false,
      type: 'parametric' as const,
    };
    const cleanup = registerConversationModelPicker('conversation-a', binding);

    cleanup();

    expect(getConversationModelPicker('conversation-a')).toBeUndefined();
  });
});
