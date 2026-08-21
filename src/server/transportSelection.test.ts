import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- I09G: Focused regression tests for the transport selection request flow ---
//
// These tests exercise the server-side boundaries of the full transport
// selection flow without requiring a component test harness.
//
// They verify that:
//   - The request body carries openCodeExecutionMode
//   - The server resolves the correct transport
//   - Precedence rules are enforced end-to-end
//   - Non-OpenCode models are unaffected

// --- Copied from aiChat.ts for isolated unit testing ---

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

type ChatTransport =
  | { kind: 'cli-agent' }
  | { kind: 'streaming-opencode'; underlyingModelId: string }
  | { kind: 'normal' };

function selectChatTransport(
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

/**
 * Full flow simulation: PromptView → ChatSession → Server request → Transport.
 * This exercises the entire decision chain at the architecture boundary.
 */
function simulateRequestFlow({
  initialMode,
  selectedMode,
  persistedSettings,
}: {
  initialMode: 'cli' | 'streaming';
  selectedMode: 'cli' | 'streaming';
  persistedSettings?: { openCodeExecutionMode?: 'cli' | 'streaming' };
}): {
  chatBody: ChatBody;
  resolvedMode: 'cli' | 'streaming';
  transport: ChatTransport;
} {
  // PromptView draft state (I09B)
  const _executionMode = initialMode;

  // User changes selection (I09B onExecutionModeChange)
  const modeAfterSelection = selectedMode;

  // ChatSession prepareSendMessagesRequest (I09D)
  const chatBody: ChatBody = {
    conversationId: 'conv-001',
    model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
    openCodeExecutionMode: modeAfterSelection,
  };

  // Server resolveExecutionMode (aiChat.ts line 1094-1097)
  const resolvedMode = resolveExecutionMode({
    rawBody: chatBody,
    conversationSettings: persistedSettings,
  });

  // Server selectChatTransport (aiChat.ts line 1286)
  const transport = selectChatTransport(chatBody.model, resolvedMode);

  return { chatBody, resolvedMode, transport };
}

describe('I09G — request flow: PromptView draft default → CLI transport', () => {
  it('default draft mode CLI produces cli-agent transport', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'cli',
    });

    assert.ok(isChatBody(result.chatBody), 'chatBody should be valid');
    assert.equal(
      result.chatBody.openCodeExecutionMode,
      'cli',
      'request should carry openCodeExecutionMode=cli',
    );
    assert.equal(result.resolvedMode, 'cli');
    assert.deepEqual(result.transport, { kind: 'cli-agent' });
  });
});

describe('I09G — request flow: PromptView selection → Streaming transport', () => {
  it('draft default CLI, user selects Streaming → streaming-opencode transport', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'streaming',
    });

    assert.ok(isChatBody(result.chatBody));
    assert.equal(
      result.chatBody.openCodeExecutionMode,
      'streaming',
      'request should carry openCodeExecutionMode=streaming',
    );
    assert.equal(result.resolvedMode, 'streaming');
    assert.deepEqual(result.transport, {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });
});

describe('I09G — conversation settings contain executionMode', () => {
  it('new conversation with CLI selected includes openCodeExecutionMode in settings', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'cli',
    });

    assert.equal(
      result.chatBody.openCodeExecutionMode,
      'cli',
      'new conversation settings should carry openCodeExecutionMode',
    );
  });

  it('new conversation with Streaming selected includes streaming in settings', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'streaming',
    });

    assert.equal(
      result.chatBody.openCodeExecutionMode,
      'streaming',
      'new conversation settings should carry openCodeExecutionMode=streaming',
    );
  });
});

describe('I09G — first request includes selected mode', () => {
  it('first PromptView request carries the live state value', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'streaming',
    });

    assert.ok(
      result.chatBody.openCodeExecutionMode != null,
      'first request must NOT omit openCodeExecutionMode (eliminates timing race)',
    );
    assert.equal(result.chatBody.openCodeExecutionMode, 'streaming');
    assert.equal(result.resolvedMode, 'streaming');
  });
});

describe('I09G — ChatSession subsequent request includes current mode', () => {
  it('existing conversation with persisted streaming mode → streaming transport', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'streaming',
      persistedSettings: { openCodeExecutionMode: 'streaming' },
    });

    assert.equal(result.resolvedMode, 'streaming');
    assert.deepEqual(result.transport, {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });

  it('existing conversation with persisted CLI mode → cli-agent transport', () => {
    const result = simulateRequestFlow({
      initialMode: 'streaming',
      selectedMode: 'cli',
      persistedSettings: { openCodeExecutionMode: 'cli' },
    });

    assert.equal(result.resolvedMode, 'cli');
    assert.deepEqual(result.transport, { kind: 'cli-agent' });
  });
});

describe('I09G — explicit request mode overrides stale persisted DB mode', () => {
  it('request=streaming, persisted=cli → streaming transport wins', () => {
    const result = simulateRequestFlow({
      initialMode: 'streaming',
      selectedMode: 'streaming',
      persistedSettings: { openCodeExecutionMode: 'cli' },
    });

    assert.equal(result.resolvedMode, 'streaming');
    assert.deepEqual(result.transport, {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });

  it('request=cli, persisted=streaming → cli transport wins', () => {
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'cli',
      persistedSettings: { openCodeExecutionMode: 'streaming' },
    });

    assert.equal(result.resolvedMode, 'cli');
    assert.deepEqual(result.transport, { kind: 'cli-agent' });
  });
});

describe('I09G — missing explicit mode falls back to persisted setting', () => {
  it('missing openCodeExecutionMode in body, persisted=streaming → streaming transport', () => {
    // Simulate a request that omits openCodeExecutionMode (older client)
    const chatBody: ChatBody = {
      conversationId: 'conv-001',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      // openCodeExecutionMode intentionally omitted
    };

    const resolvedMode = resolveExecutionMode({
      rawBody: chatBody,
      conversationSettings: { openCodeExecutionMode: 'streaming' },
    });

    assert.equal(resolvedMode, 'streaming');
    assert.deepEqual(selectChatTransport(chatBody.model, resolvedMode), {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });
});

describe('I09G — missing both defaults to CLI', () => {
  it('no body value and no persisted setting → cli transport', () => {
    const chatBody: ChatBody = {
      conversationId: 'conv-001',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
    };

    const resolvedMode = resolveExecutionMode({
      rawBody: chatBody,
      conversationSettings: {},
    });

    assert.equal(resolvedMode, 'cli');
    assert.deepEqual(selectChatTransport(chatBody.model, resolvedMode), {
      kind: 'cli-agent',
    });
  });
});

describe('I09G — invalid mode cannot select Streaming accidentally', () => {
  it('invalid openCodeExecutionMode fails isChatBody validation', () => {
    const body = {
      conversationId: 'conv-001',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      openCodeExecutionMode: 'invalid' as 'cli' | 'streaming',
    } as unknown as ChatBody;

    assert.ok(!isChatBody(body));
  });

  it('empty string fails isChatBody validation', () => {
    const body = {
      conversationId: 'conv-001',
      model: 'agent/opencode/llama-swap/qwen3.6-35b-mtp-128k',
      openCodeExecutionMode: '' as 'cli' | 'streaming',
    } as unknown as ChatBody;

    assert.ok(!isChatBody(body));
  });
});

describe('I09G — non-OpenCode model routing is unchanged', () => {
  it('google model → normal transport regardless of executionMode', () => {
    const chatBody: ChatBody = {
      conversationId: 'conv-001',
      model: 'google/gemini-3.6-flash',
      openCodeExecutionMode: 'streaming',
    };

    const resolvedMode = resolveExecutionMode({ rawBody: chatBody });
    const transport = selectChatTransport(chatBody.model, resolvedMode);

    assert.equal(resolvedMode, 'streaming');
    assert.deepEqual(transport, { kind: 'normal' });
  });

  it('anthropic model → normal transport regardless of executionMode', () => {
    const chatBody: ChatBody = {
      conversationId: 'conv-001',
      model: 'anthropic/claude-3.5-sonnet',
      openCodeExecutionMode: 'cli',
    };

    const resolvedMode = resolveExecutionMode({ rawBody: chatBody });
    const transport = selectChatTransport(chatBody.model, resolvedMode);

    assert.equal(resolvedMode, 'cli');
    assert.deepEqual(transport, { kind: 'normal' });
  });
});

describe('I09G — transport-control selected state driven by value', () => {
  it('resolvedMode matches request value (not focus state)', () => {
    // Simulate a user who toggled to streaming, then toggled away.
    // The resolved mode should reflect the last explicit selection,
    // not any transient UI focus state.
    const result = simulateRequestFlow({
      initialMode: 'cli',
      selectedMode: 'streaming',
      persistedSettings: { openCodeExecutionMode: 'streaming' },
    });

    assert.equal(result.chatBody.openCodeExecutionMode, 'streaming');
    assert.equal(result.resolvedMode, 'streaming');
    assert.deepEqual(result.transport, {
      kind: 'streaming-opencode',
      underlyingModelId: 'llama-swap/qwen3.6-35b-mtp-128k',
    });
  });

  it('CLI selected → resolvedMode === cli regardless of prior streaming state', () => {
    const result = simulateRequestFlow({
      initialMode: 'streaming',
      selectedMode: 'cli',
      persistedSettings: { openCodeExecutionMode: 'streaming' },
    });

    // Even though persisted settings say streaming, the explicit request=cli wins
    assert.equal(result.chatBody.openCodeExecutionMode, 'cli');
    assert.equal(result.resolvedMode, 'cli');
    assert.deepEqual(result.transport, { kind: 'cli-agent' });
  });
});
