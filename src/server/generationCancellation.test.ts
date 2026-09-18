import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';

const cancelActiveGenerationWithRunId = vi.fn();
const cancelDurableGenerationRun = vi.fn();
const cancelLatestDurableGenerationRun = vi.fn();

vi.mock('./activeGeneration', () => ({
  cancelActiveGenerationWithRunId,
}));

vi.mock('./aiGenerationRunLifecycle', () => ({
  cancelDurableGenerationRun,
  cancelLatestDurableGenerationRun,
}));

const { cancelConversationGeneration } =
  await import('./generationCancellation');

describe('cancelConversationGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelDurableGenerationRun.mockResolvedValue(undefined);
    cancelLatestDurableGenerationRun.mockResolvedValue(false);
  });

  it('cancels the exact durable run owned by the active generation', async () => {
    cancelActiveGenerationWithRunId.mockReturnValue({
      cancelled: true,
      durableRunId: 'run-active',
    });

    assert.equal(
      await cancelConversationGeneration('user-a', 'conversation-a'),
      true,
    );
    assert.deepEqual(cancelDurableGenerationRun.mock.calls, [
      ['run-active', 'user-a', 'conversation-a'],
    ]);
    assert.equal(cancelLatestDurableGenerationRun.mock.calls.length, 0);
  });

  it('falls back to the latest durable run after in-memory state was lost', async () => {
    cancelActiveGenerationWithRunId.mockReturnValue({ cancelled: false });
    cancelLatestDurableGenerationRun.mockResolvedValue(true);

    assert.equal(
      await cancelConversationGeneration('user-a', 'conversation-a'),
      true,
    );
    assert.deepEqual(cancelLatestDurableGenerationRun.mock.calls, [
      ['user-a', 'conversation-a'],
    ]);
    assert.equal(cancelDurableGenerationRun.mock.calls.length, 0);
  });

  it('still reports an in-memory cancellation when no durable id is attached', async () => {
    cancelActiveGenerationWithRunId.mockReturnValue({ cancelled: true });
    cancelLatestDurableGenerationRun.mockResolvedValue(false);

    assert.equal(
      await cancelConversationGeneration('user-a', 'conversation-a'),
      true,
    );
  });

  it('reports false only when neither in-memory nor durable state was active', async () => {
    cancelActiveGenerationWithRunId.mockReturnValue({ cancelled: false });

    assert.equal(
      await cancelConversationGeneration('user-a', 'conversation-a'),
      false,
    );
  });
});
