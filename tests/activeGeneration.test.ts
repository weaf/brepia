import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import {
  beginActiveGeneration,
  cancelActiveGeneration,
  cancelActiveGenerationWithRunId,
  scheduleActiveGenerationCancellation,
} from '../src/server/activeGeneration';

describe('detached active generation lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('continues independently until an explicit cancel arrives', () => {
    const request = new AbortController();
    const generation = beginActiveGeneration('user-a', 'conversation-a');

    request.abort();
    assert.equal(generation.signal.aborted, false);
    assert.equal(cancelActiveGeneration('user-a', 'conversation-a'), true);
    assert.equal(generation.signal.aborted, true);
  });

  it('scopes cancellation by user and conversation', () => {
    const generation = beginActiveGeneration('user-a', 'conversation-b');

    assert.equal(cancelActiveGeneration('user-b', 'conversation-b'), false);
    assert.equal(generation.signal.aborted, false);

    generation.finish();
  });

  it('does not let an older run clear a newer run', () => {
    const older = beginActiveGeneration('user-a', 'conversation-c');
    const newer = beginActiveGeneration('user-a', 'conversation-c');

    assert.equal(older.signal.aborted, true);
    older.finish();

    assert.equal(cancelActiveGeneration('user-a', 'conversation-c'), true);
    assert.equal(newer.signal.aborted, true);
  });

  it('returns the durable run id for explicit cancellation', () => {
    const generation = beginActiveGeneration(
      'user-a',
      'conversation-durable',
      'run-123',
    );

    assert.deepEqual(
      cancelActiveGenerationWithRunId('user-a', 'conversation-durable'),
      { cancelled: true, durableRunId: 'run-123' },
    );
    assert.equal(generation.signal.aborted, true);
  });

  it('reports the durable run replaced by a newer generation', () => {
    const older = beginActiveGeneration(
      'user-a',
      'conversation-replaced',
      'run-old',
    );
    const newer = beginActiveGeneration(
      'user-a',
      'conversation-replaced',
      'run-new',
    );

    assert.equal(older.signal.aborted, true);
    assert.equal(newer.replacedDurableRunId, 'run-old');
    assert.deepEqual(
      cancelActiveGenerationWithRunId('user-a', 'conversation-replaced'),
      { cancelled: true, durableRunId: 'run-new' },
    );
  });

  it('cancels the matching conversation on the next macrotask', () => {
    vi.useFakeTimers();
    const generation = beginActiveGeneration('user-a', 'conversation-d');

    scheduleActiveGenerationCancellation('conversation-d');
    assert.equal(generation.signal.aborted, false);

    vi.runAllTimers();
    assert.equal(generation.signal.aborted, true);
  });

  it('does not cancel another conversation when cancellation is scheduled', () => {
    vi.useFakeTimers();
    const generation = beginActiveGeneration('user-a', 'conversation-e');

    scheduleActiveGenerationCancellation('conversation-f');
    vi.runAllTimers();

    assert.equal(generation.signal.aborted, false);
    assert.equal(cancelActiveGeneration('user-a', 'conversation-e'), true);
  });
});
