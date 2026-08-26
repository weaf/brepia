import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  MODEL_USAGE_LIMIT_MESSAGE,
  PROVIDER_AUTH_MESSAGE,
  VISION_CONFIGURATION_MESSAGE,
  userFacingChatError,
} from '../src/hooks/chatErrorPresentation';

describe('chat error presentation', () => {
  it('turns OpenCode FreeUsageLimitError / HTTP 429 into an actionable usage-limit message', () => {
    const error = new Error(
      'Provider request failed with HTTP 429: {"type":"error","error":{"type":"FreeUsageLimitError","message":"Rate limit exceeded. Please try again later."}}',
    );

    assert.equal(userFacingChatError(error).message, MODEL_USAGE_LIMIT_MESSAGE);
  });

  it('turns missing vision configuration into an actionable Vision settings message', () => {
    const error = new Error(
      'Model call failed: Vision models are not configured. Open Settings → Vision.',
    );

    assert.equal(userFacingChatError(error).message, VISION_CONFIGURATION_MESSAGE);
  });

  it('turns missing provider authentication into a Providers settings message', () => {
    const error = new Error('AI_APICallError: Missing Authentication header');

    assert.equal(userFacingChatError(error).message, PROVIDER_AUTH_MESSAGE);
  });

  it('preserves unknown Error instances unchanged', () => {
    const error = new Error('Unexpected provider transport failure');
    assert.equal(userFacingChatError(error), error);
  });
});
