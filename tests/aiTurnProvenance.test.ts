import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { resolveAiTurnProvenance } from '../src/server/aiTurnProvenance';

describe('AI turn provenance', () => {
  it('records direct model execution without inventing an execution mode', () => {
    assert.deepEqual(
      resolveAiTurnProvenance({
        actualModelId: 'local/qwen3.8-27b',
        transport: { kind: 'normal' },
        executionMode: 'cli',
      }),
      {
        actualModel: 'local/qwen3.8-27b',
        transportKind: 'direct',
      },
    );
  });

  it('records the underlying model for streaming OpenCode turns', () => {
    assert.deepEqual(
      resolveAiTurnProvenance({
        actualModelId: 'agent/opencode/llama-swap/qwen3.8-27b',
        transport: {
          kind: 'streaming-opencode',
          underlyingModelId: 'llama-swap/qwen3.8-27b',
        },
        executionMode: 'streaming',
      }),
      {
        actualModel: 'llama-swap/qwen3.8-27b',
        transportKind: 'opencode',
        openCodeExecutionMode: 'streaming',
      },
    );
  });

  it('records OpenCode CLI independently from later conversation settings', () => {
    assert.deepEqual(
      resolveAiTurnProvenance({
        actualModelId: 'agent/opencode/llama-swap/qwen3.6-35b-heretic',
        transport: { kind: 'cli-agent' },
        executionMode: 'cli',
      }),
      {
        actualModel: 'llama-swap/qwen3.6-35b-heretic',
        transportKind: 'opencode',
        openCodeExecutionMode: 'cli',
      },
    );
  });

  it('records Codex CLI as a distinct transport', () => {
    assert.deepEqual(
      resolveAiTurnProvenance({
        actualModelId: 'agent/codex/gpt-5.6-codex',
        transport: { kind: 'cli-agent' },
        executionMode: 'cli',
      }),
      {
        actualModel: 'gpt-5.6-codex',
        transportKind: 'codex',
      },
    );
  });
});
