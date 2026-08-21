import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractText, parseSSE, type SSEEvent } from './opencode.ts';

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

  it('maps OpenCode tokens to native LanguageModelV3 usage', () => {
    const events: SSEEvent[] = [
      {
        type: 'session.next.step.ended',
        data: {
          finish: 'stop',
          tokens: {
            input: 3428,
            output: 12,
            reasoning: 13,
            cache: { read: 21, write: 8 },
          },
        },
      },
    ];
    const result = extractText(events);
    assert.deepEqual(result.tokens, {
      inputTokens: {
        total: 3428,
        noCache: undefined,
        cacheRead: 21,
        cacheWrite: 8,
      },
      outputTokens: {
        total: 12,
        text: undefined,
        reasoning: 13,
      },
    });
  });

  it('extracts text and v3 usage from raw SSE text', () => {
    const sseText = [
      'data: {"type":"session.next.text.ended","data":{"text":"Hello!","assistantMessageID":"msg_001","textID":"text-0"}}',
      'data: {"type":"session.next.step.ended","data":{"finish":"stop","tokens":{"input":100,"output":50,"reasoning":20}}}',
    ].join('\n');
    const events = parseSSE(sseText);
    const result = extractText(events);
    assert.equal(result.text, 'Hello!');
    assert.equal(result.tokens?.inputTokens.total, 100);
    assert.equal(result.tokens?.outputTokens.total, 50);
    assert.equal(result.tokens?.outputTokens.reasoning, 20);
  });

  it('ignores events with unknown shapes', () => {
    const result = extractText([
      { type: 'session.next.prompt.admitted', data: {} },
      { type: 'session.next.prompted', data: {} },
      { type: 'session.next.step.started', data: {} },
    ]);
    assert.equal(result.text, '');
    assert.equal(result.reasoning, '');
    assert.equal(result.tokens, undefined);
  });

  it('returns undefined usage when step.ended has no tokens data', () => {
    const result = extractText([
      { type: 'session.next.step.ended', data: { finish: 'stop' } },
    ]);
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
    const events = parseSSE(
      [
        'data: {"type":"good","data":{"x":1}}',
        'data: {broken json here}',
        'data: {"type":"also_good","data":{"y":2}}',
      ].join('\n'),
    );
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'good');
    assert.equal(events[1].type, 'also_good');
  });
});
