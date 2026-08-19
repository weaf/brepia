import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  beginActiveGeneration,
  cancelActiveGeneration,
} from '../src/server/activeGeneration';

describe('detached active generation lifecycle', () => {
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
});
