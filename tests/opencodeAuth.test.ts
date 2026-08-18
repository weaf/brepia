import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'vitest';
import { opencodeAuthHeaders } from '../src/server/opencode';

const originalPassword = process.env.OPENCODE_SERVER_PASSWORD;
const originalUsername = process.env.OPENCODE_SERVER_USERNAME;

afterEach(() => {
  if (originalPassword === undefined) {
    delete process.env.OPENCODE_SERVER_PASSWORD;
  } else {
    process.env.OPENCODE_SERVER_PASSWORD = originalPassword;
  }

  if (originalUsername === undefined) {
    delete process.env.OPENCODE_SERVER_USERNAME;
  } else {
    process.env.OPENCODE_SERVER_USERNAME = originalUsername;
  }
});

describe('OpenCode server Basic Auth headers', () => {
  it('adds no Authorization header when password auth is disabled', () => {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    delete process.env.OPENCODE_SERVER_USERNAME;

    const headers = opencodeAuthHeaders({ 'Content-Type': 'application/json' });

    assert.equal(headers.get('Authorization'), null);
    assert.equal(headers.get('Content-Type'), 'application/json');
  });

  it('uses the documented default username when only the password is set', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'secret';
    delete process.env.OPENCODE_SERVER_USERNAME;

    const headers = opencodeAuthHeaders();
    const expected = Buffer.from('opencode:secret').toString('base64');

    assert.equal(headers.get('Authorization'), `Basic ${expected}`);
  });

  it('uses OPENCODE_SERVER_USERNAME when configured', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'secret';
    process.env.OPENCODE_SERVER_USERNAME = 'cadam';

    const headers = opencodeAuthHeaders();
    const expected = Buffer.from('cadam:secret').toString('base64');

    assert.equal(headers.get('Authorization'), `Basic ${expected}`);
  });

  it('preserves an explicit Authorization header', () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'secret';

    const headers = opencodeAuthHeaders({ Authorization: 'Bearer explicit' });

    assert.equal(headers.get('Authorization'), 'Bearer explicit');
  });
});
