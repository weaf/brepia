import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isRecoverableOpenCodeEventStreamError } from '../src/server/opencode';

describe('OpenCode durable event stream recovery', () => {
  it('retries Undici body timeouts instead of terminating the agent turn', () => {
    const cause = Object.assign(new Error('Body Timeout Error'), {
      code: 'UND_ERR_BODY_TIMEOUT',
    });
    const error = new TypeError('terminated', { cause });

    assert.equal(isRecoverableOpenCodeEventStreamError(error), true);
  });

  it('retries common socket transport failures', () => {
    const error = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });

    assert.equal(isRecoverableOpenCodeEventStreamError(error), true);
  });

  it('does not hide ordinary non-transport OpenCode failures', () => {
    assert.equal(
      isRecoverableOpenCodeEventStreamError(
        new Error('OpenCode rejected the returned project envelope'),
      ),
      false,
    );
  });
});
