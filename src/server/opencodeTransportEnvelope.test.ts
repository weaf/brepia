import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { finalizeAcceptedAgentResult } from './opencode.ts';

const FINISH_STOP: Extract<LanguageModelV3StreamPart, { type: 'finish' }> = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: {
      total: 1,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 2, text: 2, reasoning: 0 },
  },
};

const PROJECT = {
  schemaVersion: 1 as const,
  entrypointPath: 'main.scad',
  files: [{ path: 'main.scad', content: 'cube([10,10,10]);' }],
};

function types(parts: LanguageModelV3StreamPart[]): string[] {
  return parts.map((part) => part.type);
}

describe('OpenCode terminal envelope conversion', () => {
  it('keeps project transport JSON internal and emits one build tool call', () => {
    const envelope = JSON.stringify({ project: PROJECT, message: 'Box ready' });
    const parts = finalizeAcceptedAgentResult(envelope, FINISH_STOP);

    assert.deepEqual(types(parts), ['tool-call', 'finish']);
    assert.equal(
      parts.filter((part) => part.type === 'text-delta').length,
      0,
      'raw project transport JSON must never be visible as assistant text',
    );

    const toolCall = parts[0] as Extract<
      LanguageModelV3StreamPart,
      { type: 'tool-call' }
    >;
    assert.equal(toolCall.toolName, 'build_parametric_model');

    const input = JSON.parse(toolCall.input) as {
      project: typeof PROJECT;
      message: string;
    };
    assert.deepEqual(input.project, PROJECT);
    assert.equal(input.message, 'Box ready');

    const finish = parts[1] as Extract<
      LanguageModelV3StreamPart,
      { type: 'finish' }
    >;
    assert.equal(finish.finishReason.unified, 'tool-calls');
  });

  it('renders only message for a non-CAD JSON envelope', () => {
    const parts = finalizeAcceptedAgentResult(
      JSON.stringify({ message: 'Hej från OpenCode' }),
      FINISH_STOP,
    );

    assert.deepEqual(types(parts), [
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);
    const text = parts.find(
      (
        part,
      ): part is Extract<LanguageModelV3StreamPart, { type: 'text-delta' }> =>
        part.type === 'text-delta',
    );
    assert.equal(text?.delta, 'Hej från OpenCode');
    assert.ok(!text?.delta.includes('"project"'));
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
      (
        part,
      ): part is Extract<LanguageModelV3StreamPart, { type: 'text-delta' }> =>
        part.type === 'text-delta',
    );
    assert.equal(text?.delta, 'Ett vanligt svar utan CAD.');
  });

  it('emits no empty assistant text for an empty message envelope', () => {
    const parts = finalizeAcceptedAgentResult('{"message":""}', FINISH_STOP);
    assert.deepEqual(parts, [FINISH_STOP]);
  });
});
