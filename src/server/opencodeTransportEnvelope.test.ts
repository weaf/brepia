import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import { finalizeAcceptedAgentResult } from './opencode.ts';

const FINISH_STOP: Extract<LanguageModelV2StreamPart, { type: 'finish' }> = {
  type: 'finish',
  finishReason: 'stop',
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
};

function types(parts: LanguageModelV2StreamPart[]): string[] {
  return parts.map((part) => part.type);
}

describe('OpenCode terminal envelope conversion', () => {
  it('keeps CAD transport JSON internal and emits one build tool call', () => {
    const envelope = JSON.stringify({
      code: 'cube([10,10,10]);',
      message: 'Box ready',
    });

    const parts = finalizeAcceptedAgentResult(envelope, FINISH_STOP);

    assert.deepEqual(types(parts), ['tool-call', 'finish']);
    assert.equal(
      parts.filter((part) => part.type === 'text-delta').length,
      0,
      'raw {code,message} transport JSON must never be visible as assistant text',
    );

    const toolCall = parts[0] as Extract<
      LanguageModelV2StreamPart,
      { type: 'tool-call' }
    >;
    assert.equal(toolCall.toolName, 'build_parametric_model');

    const input = JSON.parse(toolCall.input) as {
      code: string;
      message: string;
    };
    assert.equal(input.code, 'cube([10,10,10]);');
    assert.equal(input.message, 'Box ready');

    const finish = parts[1] as Extract<
      LanguageModelV2StreamPart,
      { type: 'finish' }
    >;
    assert.equal(finish.finishReason, 'tool-calls');
  });

  it('renders only message for a non-CAD JSON envelope', () => {
    const envelope = JSON.stringify({
      code: '',
      message: 'Hej från OpenCode',
    });

    const parts = finalizeAcceptedAgentResult(envelope, FINISH_STOP);

    assert.deepEqual(types(parts), [
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);

    const text = parts.find(
      (part): part is Extract<
        LanguageModelV2StreamPart,
        { type: 'text-delta' }
      > => part.type === 'text-delta',
    );
    assert.equal(text?.delta, 'Hej från OpenCode');
    assert.ok(!text?.delta.includes('"code"'));
    assert.ok(!text?.delta.includes('"message"'));
  });

  it('preserves plain prose as ordinary assistant text', () => {
    const parts = finalizeAcceptedAgentResult(
      'Ett vanligt svar utan CAD.',
      FINISH_STOP,
    );

    assert.deepEqual(types(parts), [
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);

    const text = parts.find(
      (part): part is Extract<
        LanguageModelV2StreamPart,
        { type: 'text-delta' }
      > => part.type === 'text-delta',
    );
    assert.equal(text?.delta, 'Ett vanligt svar utan CAD.');
  });

  it('emits no empty assistant text for an empty envelope', () => {
    const parts = finalizeAcceptedAgentResult(
      '{"code":"","message":""}',
      FINISH_STOP,
    );

    assert.deepEqual(parts, [FINISH_STOP]);
  });
});
