import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { finishWithParametricToolCall } from './opencodeAgentResult.ts';

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

function projectEnvelope(message = 'Model ready'): string {
  return JSON.stringify({ project: PROJECT, message });
}

function toolCalls(parts: Array<{ type: string }>): number {
  return parts.filter((part) => part.type === 'tool-call').length;
}

describe('R06 — streaming tool-call emission regression', () => {
  describe('prose false-positive regression', () => {
    it('emits no build call for prose with CAD keywords', () => {
      const parts = finishWithParametricToolCall(
        'The cube is fine. Rotate it 45 degrees. The cylinder needs a smaller radius.',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });

    it('emits no build call for a legacy top-level code envelope', () => {
      const parts = finishWithParametricToolCall(
        '{"code":"cube([10,10,10]);","message":"legacy"}',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });
  });

  describe('complete project final results', () => {
    it('emits exactly one build call for a complete project envelope', () => {
      const parts = finishWithParametricToolCall(
        projectEnvelope(),
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
      assert.equal(parts[0]?.type, 'tool-call');
      assert.equal(
        (parts[0] as { toolName?: string }).toolName,
        'build_parametric_model',
      );
      const input = JSON.parse((parts[0] as { input: string }).input) as {
        project: typeof PROJECT;
      };
      assert.deepEqual(input.project, PROJECT);
    });

    it('accepts the complete project envelope inside a JSON fence', () => {
      const parts = finishWithParametricToolCall(
        `\`\`\`json\n${projectEnvelope()}\n\`\`\``,
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });

    it('uses one final build call when a corrected project follows a draft', () => {
      const draft = JSON.stringify({
        project: {
          ...PROJECT,
          files: [{ path: 'main.scad', content: 'cube([5,5,5]);' }],
        },
        message: 'Draft',
      });
      const parts = finishWithParametricToolCall(
        `${draft}\nCorrection:\n${projectEnvelope('Fixed')}`,
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
      const input = JSON.parse((parts[0] as { input: string }).input) as {
        project: typeof PROJECT;
      };
      assert.equal(input.project.files[0]?.content, 'cube([10,10,10]);');
    });
  });

  describe('terminal-event contract', () => {
    it('emits no build call for an incomplete project envelope', () => {
      const parts = finishWithParametricToolCall(
        '{"project":{"schemaVersion":1,"entrypointPath":"main.scad"}',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });

    it('marks the finish part as tool-calls when a build call is emitted', () => {
      const parts = finishWithParametricToolCall(
        projectEnvelope(),
        FINISH_STOP,
      );
      const finish = parts[parts.length - 1] as Extract<
        LanguageModelV3StreamPart,
        { type: 'finish' }
      >;
      assert.deepEqual(finish.finishReason, {
        unified: 'tool-calls',
        raw: 'tool-calls',
      });
    });

    it('preserves the original finish part when no build call is emitted', () => {
      const parts = finishWithParametricToolCall('plain text', FINISH_STOP);
      assert.deepEqual(parts, [FINISH_STOP]);
    });
  });
});
