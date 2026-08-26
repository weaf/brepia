import {
  __chatSubmitBridgeTestUtils,
  registerChatTextSubmitter,
  submitChatText,
} from '@/lib/chatSubmitBridge';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  __chatSubmitBridgeTestUtils.clear();
});

describe('chat submit bridge', () => {
  it('routes text only to the matching conversation submitter', () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);

    registerChatTextSubmitter('conversation-a', first);
    registerChatTextSubmitter('conversation-b', second);

    expect(submitChatText('conversation-a', 'Fix this model')).toBe(true);
    expect(first).toHaveBeenCalledWith('Fix this model');
    expect(second).not.toHaveBeenCalled();
  });

  it('removes the registered submitter on cleanup', () => {
    const submitter = vi.fn(() => true);
    const cleanup = registerChatTextSubmitter('conversation-a', submitter);

    cleanup();

    expect(submitChatText('conversation-a', 'Fix this model')).toBe(false);
    expect(submitter).not.toHaveBeenCalled();
  });

  it('does not let stale cleanup remove a newer registration', () => {
    const oldSubmitter = vi.fn(() => true);
    const newSubmitter = vi.fn(() => true);
    const cleanupOld = registerChatTextSubmitter(
      'conversation-a',
      oldSubmitter,
    );
    registerChatTextSubmitter('conversation-a', newSubmitter);

    cleanupOld();

    expect(submitChatText('conversation-a', 'Fix this model')).toBe(true);
    expect(oldSubmitter).not.toHaveBeenCalled();
    expect(newSubmitter).toHaveBeenCalledWith('Fix this model');
  });

  it('rejects empty conversation ids and blank text', () => {
    const submitter = vi.fn(() => true);
    registerChatTextSubmitter('conversation-a', submitter);

    expect(submitChatText('', 'Fix this model')).toBe(false);
    expect(submitChatText('conversation-a', '   ')).toBe(false);
    expect(submitter).not.toHaveBeenCalled();
  });
});
