import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Replicated from src/server/opencode.ts for isolated unit testing.
interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('data: ')) {
      try {
        const payload = JSON.parse(trimmed.slice(6)) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (payload.type && payload.data) {
          events.push({ type: payload.type, data: payload.data });
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }
  return events;
}

function extractText(events: SSEEvent[]): {
  text: string;
  reasoning: string;
  tokens:
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;
} {
  let text = '';
  let reasoning = '';
  let tokens:
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;
  for (const evt of events) {
    const t = evt.type ?? '';
    if (t.includes('text.ended') && typeof evt.data['text'] === 'string') {
      text += evt.data['text'] as string;
    } else if (
      t.includes('reasoning.ended') &&
      typeof evt.data['text'] === 'string'
    ) {
      reasoning += evt.data['text'] as string;
    } else if (t.includes('step.ended')) {
      const tok = evt.data['tokens'] as Record<string, unknown> | undefined;
      if (tok) {
        const input = Number(tok['input'] ?? 0);
        const output = Number(tok['output'] ?? 0);
        const reasoningTok = Number(tok['reasoning'] ?? 0);
        if (input || output || reasoningTok) {
          tokens = {
            inputTokens: input,
            outputTokens: output,
            totalTokens: input + output,
          };
        }
      }
    }
  }
  return { text, reasoning, tokens };
}

describe('extractText — opencode event shapes', () => {
  it('extracts text from session.next.text.ended events', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.prompt.admitted', data: {} },
      {
        type: 'session.next.step.started',
        data: { assistantMessageID: 'msg_001' },
      },
      {
        type: 'session.next.text.ended',
        data: {
          assistantMessageID: 'msg_001',
          textID: 'text-0',
          text: 'Hello! How can I help you today?',
        },
      },
      { type: 'session.next.step.ended', data: { finish: 'stop' } },
    ];
    const result = extractText(events);
    assert.equal(result.text, 'Hello! How can I help you today?');
    assert.equal(result.reasoning, '');
    assert.equal(result.tokens, undefined);
  });

  it('extracts reasoning from session.next.reasoning.ended events', () => {
    const events: SSEEvent[] = [
      {
        type: 'session.next.reasoning.ended',
        data: {
          assistantMessageID: 'msg_001',
          reasoningID: 'reasoning-0',
          text: 'The user wants help. I should respond politely.',
        },
      },
      {
        type: 'session.next.text.ended',
        data: {
          assistantMessageID: 'msg_001',
          textID: 'text-0',
          text: 'Sure, I can help with that.',
        },
      },
      { type: 'session.next.step.ended', data: { finish: 'stop' } },
    ];
    const result = extractText(events);
    assert.equal(
      result.reasoning,
      'The user wants help. I should respond politely.',
    );
    assert.equal(result.text, 'Sure, I can help with that.');
  });

  it('extracts tokens from session.next.step.ended', () => {
    const events: SSEEvent[] = [
      {
        type: 'session.next.step.ended',
        data: {
          finish: 'stop',
          tokens: {
            input: 3428,
            output: 12,
            reasoning: 13,
            cache: { read: 0, write: 0 },
          },
        },
      },
    ];
    const result = extractText(events);
    assert.ok(result.tokens);
    assert.equal(result.tokens.inputTokens, 3428);
    assert.equal(result.tokens.outputTokens, 12);
    assert.equal(result.tokens.totalTokens, 3440);
  });

  it('extracts text and tokens from raw SSE text', () => {
    const sseText = [
      'data: {"type":"session.next.text.ended","data":{"text":"Hello!","assistantMessageID":"msg_001","textID":"text-0"}}',
      'data: {"type":"session.next.step.ended","data":{"finish":"stop","tokens":{"input":100,"output":50,"reasoning":20}}}',
    ].join('\n');
    const events = parseSSE(sseText);
    const result = extractText(events);
    assert.equal(result.text, 'Hello!');
    assert.ok(result.tokens);
    assert.equal(result.tokens.inputTokens, 100);
    assert.equal(result.tokens.outputTokens, 50);
    assert.equal(result.tokens.totalTokens, 150);
  });

  it('ignores events with unknown shapes (no text/step)', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.prompt.admitted', data: {} },
      { type: 'session.next.prompted', data: {} },
      { type: 'session.next.step.started', data: {} },
    ];
    const result = extractText(events);
    assert.equal(result.text, '');
    assert.equal(result.reasoning, '');
    assert.equal(result.tokens, undefined);
  });

  it('returns zero tokens when step.ended has no tokens data', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.step.ended', data: { finish: 'stop' } },
    ];
    const result = extractText(events);
    assert.equal(result.tokens, undefined);
  });

  it('returns empty string when no events match text.ended or reasoning.ended', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.reasoning.started', data: {} },
      { type: 'session.next.text.started', data: {} },
    ];
    const result = extractText(events);
    assert.equal(result.text, '');
    assert.equal(result.reasoning, '');
    assert.equal(result.tokens, undefined);
  });
});

describe('parseSSE — raw SSE handling', () => {
  it('parses multiple events from SSE stream', () => {
    const sseText = [
      'data: {"type":"session.next.prompt.admitted","data":{"sessionID":"ses_abc"}}',
      '',
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}',
      'data: {"type":"session.next.text.ended","data":{"text":"Hello!","textID":"text-0"}}',
      'data: {"type":"session.next.step.ended","data":{"finish":"stop"}}',
    ].join('\n');
    const events = parseSSE(sseText);
    assert.equal(events.length, 4);
    assert.equal(events[0].type, 'session.next.prompt.admitted');
    assert.equal(events[2].type, 'session.next.text.ended');
    assert.equal(events[3].type, 'session.next.step.ended');
  });

  it('tolerates empty lines and trailing whitespace in SSE', () => {
    const sseText =
      'data: {"type":"test","data":{"x":1}}\n\n   \ndata: {"type":"test2","data":{}}\n';
    const events = parseSSE(sseText);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'test');
    assert.equal(events[1].type, 'test2');
  });

  it('skips malformed JSON data lines', () => {
    const sseText = [
      'data: {"type":"good","data":{"x":1}}',
      'data: {broken json here}',
      'data: {"type":"also_good","data":{"y":2}}',
    ].join('\n');
    const events = parseSSE(sseText);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'good');
    assert.equal(events[1].type, 'also_good');
  });
});
