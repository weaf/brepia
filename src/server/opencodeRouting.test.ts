import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- Copied from src/server/cliAgents.ts for isolated unit testing ---
// See opencodeEvents.test.ts for the same pattern (extensionless source
// imports do not resolve under `node --test`). Keep in sync with
// src/server/cliAgents.ts (R04B: shared final-result parser convergence).

export type ChatTransport =
  | { kind: 'cli-agent' }
  | { kind: 'streaming-opencode'; underlyingModelId: string }
  | { kind: 'normal' };

export function selectChatTransport(
  modelId: string,
  executionMode: 'cli' | 'streaming',
): ChatTransport {
  if (modelId.startsWith('agent/opencode/')) {
    const underlyingModelId = modelId.slice('agent/opencode/'.length);
    return executionMode === 'streaming'
      ? { kind: 'streaming-opencode', underlyingModelId }
      : { kind: 'cli-agent' };
  }
  if (modelId.startsWith('opencode/')) {
    return executionMode === 'streaming'
      ? { kind: 'streaming-opencode', underlyingModelId: modelId }
      : { kind: 'normal' };
  }
  return { kind: 'normal' };
}

describe('R03 routing — executionMode switches transport for the SAME model', () => {
  it('agent/opencode/<provider>/<model> + cli -> cli-agent', () => {
    const t = selectChatTransport(
      'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      'cli',
    );
    assert.deepEqual(t, { kind: 'cli-agent' });
  });

  it('agent/opencode/<provider>/<model> + streaming -> streaming-opencode with underlying provider/model', () => {
    const t = selectChatTransport(
      'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      'streaming',
    );
    assert.deepEqual(t, {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });

  it('agent/opencode/<provider>/<model> streaming strips only the agent/ prefix', () => {
    const t = selectChatTransport(
      'agent/opencode/opencode/big-pickle',
      'streaming',
    );
    assert.deepEqual(t, {
      kind: 'streaming-opencode',
      underlyingModelId: 'opencode/big-pickle',
    });
  });

  it('non-OpenCode model + cli -> normal provider routing', () => {
    assert.deepEqual(selectChatTransport('google/gemini-3.6-flash', 'cli'), {
      kind: 'normal',
    });
  });

  it('non-OpenCode model + streaming -> normal provider routing', () => {
    assert.deepEqual(
      selectChatTransport('anthropic/claude-3.5-sonnet', 'streaming'),
      {
        kind: 'normal',
      },
    );
  });

  it('local model + streaming -> normal provider routing', () => {
    assert.deepEqual(
      selectChatTransport('local/qwen3.6-35b-mtp-96k', 'streaming'),
      { kind: 'normal' },
    );
  });

  it('legacy opencode/<model> + streaming -> streaming-opencode pass-through', () => {
    const t = selectChatTransport('opencode/big-pickle', 'streaming');
    assert.deepEqual(t, {
      kind: 'streaming-opencode',
      underlyingModelId: 'opencode/big-pickle',
    });
  });

  it('legacy opencode/<model> + cli -> normal (falls through to opencodeChatModel)', () => {
    assert.deepEqual(selectChatTransport('opencode/big-pickle', 'cli'), {
      kind: 'normal',
    });
  });

  it('codex agent + streaming -> normal (codex has no streaming transport)', () => {
    assert.deepEqual(
      selectChatTransport('agent/codex/opencode/gpt-5-codex', 'streaming'),
      { kind: 'normal' },
    );
  });
});
