import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cliAgentChatModel } from './cliAgents.ts';
import { opencodeChatModel, streamingOpencodeChatModel } from './opencode.ts';

describe('native AI SDK v3 agent adapters', () => {
  it('exposes the OpenCode HTTP/SSE adapters as LanguageModelV3', () => {
    assert.equal(
      streamingOpencodeChatModel('llama-swap/qwen3.6-35b-mtp-128k')
        .specificationVersion,
      'v3',
    );
    assert.equal(
      opencodeChatModel('opencode/big-pickle').specificationVersion,
      'v3',
    );
  });

  it('exposes both CLI agent families as LanguageModelV3', () => {
    assert.equal(
      cliAgentChatModel('agent/opencode/opencode/big-pickle')
        .specificationVersion,
      'v3',
    );
    assert.equal(
      cliAgentChatModel('agent/codex/default').specificationVersion,
      'v3',
    );
  });
});
