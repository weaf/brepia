import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLocalOpenAiUrls } from './runtimeIntegrations.ts';

describe('runtime integration URL normalization', () => {
  it('does not duplicate /v1 for OpenAI-compatible model discovery', () => {
    assert.deepEqual(normalizeLocalOpenAiUrls('http://127.0.0.1:9292/v1'), {
      baseUrl: 'http://127.0.0.1:9292/v1',
      modelsUrl: 'http://127.0.0.1:9292/v1/models',
      rootUrl: 'http://127.0.0.1:9292',
    });
  });

  it('adds /v1/models when the configured endpoint is a server root', () => {
    assert.deepEqual(normalizeLocalOpenAiUrls('http://127.0.0.1:9292/'), {
      baseUrl: 'http://127.0.0.1:9292',
      modelsUrl: 'http://127.0.0.1:9292/v1/models',
      rootUrl: 'http://127.0.0.1:9292',
    });
  });
});
