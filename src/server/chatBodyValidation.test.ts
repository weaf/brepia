import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- Copied from src/server/aiChat.ts for isolated unit testing ---
// See opencodeRouting.test.ts for the same pattern.
//
// E01 execution-mode precedence:
//   1. Explicit openCodeExecutionMode in the request body (user's transport toggle)
//   2. Persisted conversation.settings.openCodeExecutionMode (DB fallback)
//   3. Default 'cli' (backward compatibility)
//
// This precedence ensures the current request always uses the most recent
// client-side selection even before the DB write completes, eliminating the
// persistence race where a toggle change would be ignored.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type ChatBody = {
  conversationId: string;
  model: string;
  thinking?: boolean;
  openCodeExecutionMode?: 'cli' | 'streaming';
};

function isChatBody(value: unknown): value is ChatBody {
  return (
    isRecord(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.model === 'string' &&
    (value.thinking == null || typeof value.thinking === 'boolean') &&
    (value.openCodeExecutionMode == null ||
      value.openCodeExecutionMode === 'cli' ||
      value.openCodeExecutionMode === 'streaming')
  );
}

/**
 * Simulates the server-side execution-mode resolution (aiChat.ts line ~1086).
 * Used to verify the precedence: body > settings > default.
 */
function resolveExecutionMode({
  rawBody,
  conversationSettings,
}: {
  rawBody: ChatBody;
  conversationSettings?: { openCodeExecutionMode?: 'cli' | 'streaming' };
}): 'cli' | 'streaming' {
  return (
    rawBody.openCodeExecutionMode ??
    conversationSettings?.openCodeExecutionMode ??
    'cli'
  );
}

describe('I09 — ChatBody validation accepts openCodeExecutionMode', () => {
  it('valid body with openCodeExecutionMode=cli passes isChatBody', () => {
    const body = {
      conversationId: 'abc123',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      openCodeExecutionMode: 'cli' as const,
    };
    assert.ok(isChatBody(body));
  });

  it('valid body with openCodeExecutionMode=streaming passes isChatBody', () => {
    const body = {
      conversationId: 'abc123',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      openCodeExecutionMode: 'streaming' as const,
    };
    assert.ok(isChatBody(body));
  });

  it('valid body WITHOUT openCodeExecutionMode passes isChatBody (backward compat)', () => {
    const body = {
      conversationId: 'abc123',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
    };
    assert.ok(isChatBody(body));
  });

  it('invalid openCodeExecutionMode value fails isChatBody', () => {
    const body = {
      conversationId: 'abc123',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      openCodeExecutionMode: 'invalid',
    } as unknown as ChatBody;
    assert.ok(!isChatBody(body));
  });

  it('valid body with thinking and openCodeExecutionMode passes isChatBody', () => {
    const body = {
      conversationId: 'abc123',
      model: 'anthropic/claude-3.5-sonnet',
      thinking: true,
      openCodeExecutionMode: 'cli' as const,
    };
    assert.ok(isChatBody(body));
  });
});

describe('I09 — executionMode precedence: body > settings > default', () => {
  it('body openCodeExecutionMode=streaming overrides settings=cli', () => {
    const mode = resolveExecutionMode({
      rawBody: {
        conversationId: 'abc123',
        model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
        openCodeExecutionMode: 'streaming',
      },
      conversationSettings: { openCodeExecutionMode: 'cli' },
    });
    assert.equal(mode, 'streaming');
  });

  it('body openCodeExecutionMode=cli overrides settings=streaming', () => {
    const mode = resolveExecutionMode({
      rawBody: {
        conversationId: 'abc123',
        model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
        openCodeExecutionMode: 'cli',
      },
      conversationSettings: { openCodeExecutionMode: 'streaming' },
    });
    assert.equal(mode, 'cli');
  });

  it('settings openCodeExecutionMode used when body omits it', () => {
    const mode = resolveExecutionMode({
      rawBody: {
        conversationId: 'abc123',
        model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      },
      conversationSettings: { openCodeExecutionMode: 'streaming' },
    });
    assert.equal(mode, 'streaming');
  });

  it('defaults to cli when neither body nor settings provide it', () => {
    const mode = resolveExecutionMode({
      rawBody: {
        conversationId: 'abc123',
        model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      },
      conversationSettings: {},
    });
    assert.equal(mode, 'cli');
  });

  it('defaults to cli when no conversationSettings provided', () => {
    const mode = resolveExecutionMode({
      rawBody: {
        conversationId: 'abc123',
        model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      },
    });
    assert.equal(mode, 'cli');
  });
});
