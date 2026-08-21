import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isRequestAbort } from '../src/server/requestAbort';

describe('request abort classification', () => {
  it('classifies an aborted request signal as a normal cancellation', () => {
    const controller = new AbortController();
    controller.abort();

    assert.equal(
      isRequestAbort(new Error('wrapped stream failure'), controller.signal),
      true,
    );
  });

  it('recognizes AbortError before the signal state propagates', () => {
    const error = new DOMException('This operation was aborted', 'AbortError');

    assert.equal(isRequestAbort(error, new AbortController().signal), true);
  });

  it('does not hide ordinary model or transport failures', () => {
    assert.equal(
      isRequestAbort(
        new Error('OpenCode returned HTTP 500'),
        new AbortController().signal,
      ),
      false,
    );
  });
});
