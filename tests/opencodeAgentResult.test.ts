import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  finishWithParametricToolCall,
  parseAgentResult,
  parseStructuredAgentResult,
  resolveAgentResultChannels,
} from '../src/server/opencodeAgentResult';

describe('OpenCode agent result parsing', () => {
  it('extracts a terminal JSON artifact embedded after reasoning prose', () => {
    const response = [
      'I will create a parametric box.',
      JSON.stringify({
        code: 'difference() { cube([20, 20, 10]); cube([16, 16, 10]); }',
        message: 'Box created',
      }),
    ].join('\n');

    assert.deepEqual(parseAgentResult(response), {
      code: 'difference() { cube([20, 20, 10]); cube([16, 16, 10]); }',
      message: 'Box created',
    });
  });

  it('uses a structured reasoning result when the text channel is empty', () => {
    const envelope = JSON.stringify({
      code: 'cube([10, 10, 10]);',
      message: 'Cube created',
    });
    const resolved = resolveAgentResultChannels(
      '',
      `I need a simple cube.\n${envelope}`,
    );

    assert.equal(resolved.resultText, `I need a simple cube.\n${envelope}`);
    assert.equal(resolved.reasoningText, 'I need a simple cube.');
    assert.deepEqual(parseAgentResult(resolved.resultText), {
      code: 'cube([10, 10, 10]);',
      message: 'Cube created',
    });

    const parts = finishWithParametricToolCall(resolved.resultText, {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: {
          total: 0,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 0, text: undefined, reasoning: undefined },
      },
    });
    assert.equal(parts[0]?.type, 'tool-call');
    if (parts[0]?.type === 'tool-call') {
      assert.equal(parts[0].toolName, 'build_parametric_model');
    }
  });

  it('prefers the final structured result in the text channel', () => {
    const reasoningDraft = JSON.stringify({
      code: 'cube(5);',
      message: 'Draft',
    });
    const finalText = JSON.stringify({
      code: 'cube(10);',
      message: 'Final',
    });
    const resolved = resolveAgentResultChannels(finalText, reasoningDraft);

    assert.equal(resolved.resultText, finalText);
    assert.equal(resolved.reasoningText, '');
    assert.deepEqual(parseAgentResult(resolved.resultText), {
      code: 'cube(10);',
      message: 'Final',
    });
  });

  it('selects the last valid envelope when an agent corrects itself', () => {
    const response = [
      JSON.stringify({ code: 'cube(5);', message: 'Draft' }),
      'Correction:',
      JSON.stringify({ code: 'cube(10);', message: 'Final' }),
    ].join('\n');

    assert.deepEqual(parseStructuredAgentResult(response), {
      code: 'cube(10);',
      message: 'Final',
    });
  });

  it('does not reinterpret ordinary prose as a structured result', () => {
    const response = 'Use difference() with cube() to make a hollow box.';

    assert.equal(parseStructuredAgentResult(response), undefined);
    assert.deepEqual(parseAgentResult(response), {
      code: undefined,
      message: response,
    });
  });
});
