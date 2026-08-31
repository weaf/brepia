import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractText, type SSEEvent } from './opencode.ts';

describe('extractText — opencode incremental processing', () => {
  it('accumulates text deltas across multiple text.ended events', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.text.ended', data: { text: 'Hello' } },
      { type: 'session.next.text.ended', data: { text: ' world' } },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, 'Hello world');
    assert.strictEqual(result.reasoning, '');
  });

  it('accumulates reasoning deltas', () => {
    const result = extractText([
      { type: 'session.next.reasoning.ended', data: { text: 'Thinking' } },
      { type: 'session.next.reasoning.ended', data: { text: ' more' } },
    ]);
    assert.strictEqual(result.reasoning, 'Thinking more');
  });

  it('extracts native v3 token usage from step.ended', () => {
    const result = extractText([
      {
        type: 'session.next.step.ended',
        data: {
          tokens: {
            input: 100,
            output: 200,
            reasoning: 50,
            cache: { read: 10, write: 4 },
          },
        },
      },
    ]);
    assert.strictEqual(result.tokens?.inputTokens.total, 100);
    assert.strictEqual(result.tokens?.inputTokens.cacheRead, 10);
    assert.strictEqual(result.tokens?.inputTokens.cacheWrite, 4);
    assert.strictEqual(result.tokens?.outputTokens.total, 200);
    assert.strictEqual(result.tokens?.outputTokens.reasoning, 50);
  });

  it('returns undefined usage when step.ended has no tokens', () => {
    const result = extractText([{ type: 'session.next.step.ended', data: {} }]);
    assert.strictEqual(result.tokens, undefined);
  });

  it('ignores unknown event types', () => {
    const result = extractText([
      { type: 'session.next.prompted', data: {} },
      { type: 'session.next.step.started', data: {} },
    ]);
    assert.strictEqual(result.text, '');
    assert.strictEqual(result.reasoning, '');
    assert.strictEqual(result.tokens, undefined);
  });

  it('handles mixed text, reasoning, and usage in one batch', () => {
    const result = extractText([
      { type: 'session.next.reasoning.ended', data: { text: 'R1' } },
      { type: 'session.next.text.ended', data: { text: 'A1' } },
      { type: 'session.next.text.ended', data: { text: 'A2' } },
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 10, output: 20 } },
      },
    ]);
    assert.strictEqual(result.text, 'A1A2');
    assert.strictEqual(result.reasoning, 'R1');
    assert.strictEqual(result.tokens?.outputTokens.total, 20);
  });
});

describe('D06 — final text before finish', () => {
  it('text.ended before step.ended in same batch captures both', () => {
    const result = extractText([
      { type: 'session.next.text.ended', data: { text: 'final answer' } },
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 5, output: 10 } },
      },
    ]);
    assert.strictEqual(result.text, 'final answer');
    assert.strictEqual(result.tokens?.inputTokens.total, 5);
  });

  it('step.ended before text.ended still captures both', () => {
    const result = extractText([
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 5, output: 10 } },
      },
      { type: 'session.next.text.ended', data: { text: 'late text' } },
    ]);
    assert.strictEqual(result.text, 'late text');
    assert.strictEqual(result.tokens?.outputTokens.total, 10);
  });
});

describe('extractText — edge cases', () => {
  it('handles empty events array', () => {
    const result = extractText([]);
    assert.strictEqual(result.text, '');
    assert.strictEqual(result.reasoning, '');
    assert.strictEqual(result.tokens, undefined);
  });

  it('handles missing text field on text.ended event', () => {
    const result = extractText([{ type: 'session.next.text.ended', data: {} }]);
    assert.strictEqual(result.text, '');
  });

  it('handles non-string text field', () => {
    const result = extractText([
      { type: 'session.next.text.ended', data: { text: 42 } },
    ]);
    assert.strictEqual(result.text, '');
  });
});
