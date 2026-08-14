import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- Copied from src/server/opencode.ts for isolated unit testing ---
// See opencodeEvents.test.ts for the same pattern.

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Extract incremental text and reasoning from the accumulated event stream.
 * Opencode event shapes:
 *   session.next.text.ended   → data.text = complete text segment
 *   session.next.reasoning.ended → data.text = reasoning content
 *   session.next.step.ended   → data.tokens = { input, output, reasoning, cache }
 */
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

// --- Tests ---

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
    const events: SSEEvent[] = [
      { type: 'session.next.reasoning.ended', data: { text: 'Thinking' } },
      { type: 'session.next.reasoning.ended', data: { text: ' more' } },
    ];
    const result = extractText(events);
    assert.strictEqual(result.reasoning, 'Thinking more');
  });

  it('extracts token usage from step.ended', () => {
    const events: SSEEvent[] = [
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 100, output: 200, reasoning: 50, cache: 10 } },
      },
    ];
    const result = extractText(events);
    assert.ok(result.tokens);
    assert.strictEqual(result.tokens!.inputTokens, 100);
    assert.strictEqual(result.tokens!.outputTokens, 200);
    assert.strictEqual(result.tokens!.totalTokens, 300);
  });

  it('returns undefined tokens when step.ended has no tokens', () => {
    const events: SSEEvent[] = [{ type: 'session.next.step.ended', data: {} }];
    const result = extractText(events);
    assert.strictEqual(result.tokens, undefined);
  });

  it('ignores unknown event types', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.prompted', data: {} },
      { type: 'session.next.step.started', data: {} },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, '');
    assert.strictEqual(result.reasoning, '');
    assert.strictEqual(result.tokens, undefined);
  });

  it('handles mixed text, reasoning, and tokens in one batch', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.reasoning.ended', data: { text: 'R1' } },
      { type: 'session.next.text.ended', data: { text: 'A1' } },
      { type: 'session.next.text.ended', data: { text: 'A2' } },
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 10, output: 20 } },
      },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, 'A1A2');
    assert.strictEqual(result.reasoning, 'R1');
    assert.ok(result.tokens);
    assert.strictEqual(result.tokens!.outputTokens, 20);
  });
});

describe('D06 — final text before finish', () => {
  it('text.ended before step.ended in same batch processes text first', () => {
    // D06 regression: final text must be captured before terminal handling
    const events: SSEEvent[] = [
      { type: 'session.next.text.ended', data: { text: 'final answer' } },
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 5, output: 10 } },
      },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, 'final answer');
    assert.ok(result.tokens); // tokens are captured alongside text
  });

  it('step.ended before text.ended still captures both', () => {
    // Even if ordering is reversed, both should be processed
    const events: SSEEvent[] = [
      {
        type: 'session.next.step.ended',
        data: { tokens: { input: 5, output: 10 } },
      },
      { type: 'session.next.text.ended', data: { text: 'late text' } },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, 'late text');
    assert.ok(result.tokens);
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
    const events: SSEEvent[] = [{ type: 'session.next.text.ended', data: {} }];
    const result = extractText(events);
    assert.strictEqual(result.text, '');
  });

  it('handles non-string text field', () => {
    const events: SSEEvent[] = [
      { type: 'session.next.text.ended', data: { text: 42 } },
    ];
    const result = extractText(events);
    assert.strictEqual(result.text, '');
  });
});
