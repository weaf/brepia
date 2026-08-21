import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

/** Replicate the env-priority URL resolution logic for testing. */
function resolveOpenCodeUrl(): string {
  const baseUrl = (process.env.OPENCODE_BASE_URL ?? '').trim();
  if (baseUrl) return baseUrl.replace(/\/+$/, '');
  const port = process.env.OPENCODE_PORT;
  if (port) return `http://127.0.0.1:${port}`;
  return 'http://127.0.0.1:4096';
}

describe('openCode URL resolution', () => {
  after(() => {
    delete process.env.OPENCODE_BASE_URL;
    delete process.env.OPENCODE_PORT;
  });

  it('returns default when no env vars are set', () => {
    delete process.env.OPENCODE_BASE_URL;
    delete process.env.OPENCODE_PORT;
    assert.equal(resolveOpenCodeUrl(), 'http://127.0.0.1:4096');
  });

  it('uses OPENCODE_BASE_URL (full URL) when set', () => {
    process.env.OPENCODE_BASE_URL = 'http://127.0.0.1:8080';
    delete process.env.OPENCODE_PORT;
    assert.equal(resolveOpenCodeUrl(), 'http://127.0.0.1:8080');
  });

  it('strips trailing slashes from OPENCODE_BASE_URL', () => {
    process.env.OPENCODE_BASE_URL = 'http://127.0.0.1:8080///';
    delete process.env.OPENCODE_PORT;
    assert.equal(resolveOpenCodeUrl(), 'http://127.0.0.1:8080');
  });

  it('uses OPENCODE_PORT as legacy fallback', () => {
    delete process.env.OPENCODE_BASE_URL;
    process.env.OPENCODE_PORT = '9999';
    assert.equal(resolveOpenCodeUrl(), 'http://127.0.0.1:9999');
  });

  it('prioritises OPENCODE_BASE_URL over OPENCODE_PORT', () => {
    process.env.OPENCODE_BASE_URL = 'http://localhost:3000';
    process.env.OPENCODE_PORT = '9999';
    assert.equal(resolveOpenCodeUrl(), 'http://localhost:3000');
  });

  it('treats whitespace-only OPENCODE_BASE_URL as unset', () => {
    process.env.OPENCODE_BASE_URL = '   ';
    process.env.OPENCODE_PORT = '4096';
    assert.equal(resolveOpenCodeUrl(), 'http://127.0.0.1:4096');
  });

  it('preserves OPENCODE_BASE_URL with custom hostname and port', () => {
    process.env.OPENCODE_BASE_URL = 'https://opencode.example.com:8443';
    delete process.env.OPENCODE_PORT;
    assert.equal(resolveOpenCodeUrl(), 'https://opencode.example.com:8443');
  });
});
