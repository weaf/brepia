import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { finishWithParametricToolCall } from './opencodeAgentResult.ts';

/**
 * R06 — single-emission and revision-loop regression tests.
 *
 * These test the REAL shared finish-transformer (`finishWithParametricToolCall`)
 * that the streaming transport calls exactly once, at the terminal `finish`
 * part, with the fully accumulated response text.  The false-positive path
 * that caused Qwen's infinite revision loop (prose keywords -> accidental
 * `build_parametric_model` tool-call) must never produce a build call.
 */

const FINISH_STOP = {
  type: 'finish',
  finishReason: 'stop',
  usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
} as const;

function toolCalls(parts: Array<{ type: string }>): number {
  return parts.filter((p) => p.type === 'tool-call').length;
}

describe('R06 — streaming tool-call emission regression', () => {
  describe('prose keyword regression (the Qwen infinite-loop trigger)', () => {
    it('zero build calls for prose with cube', () => {
      const parts = finishWithParametricToolCall(
        'The cube looks correct; no rotation is necessary.',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });

    it('zero build calls for prose with cube, rotate, and cylinder', () => {
      const parts = finishWithParametricToolCall(
        'The cube is fine. Rotate it 45 degrees. The cylinder needs a smaller radius.',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });
  });

  describe('explicit artifact final results', () => {
    it('exactly one build call for a fenced SCAD final result', () => {
      const parts = finishWithParametricToolCall(
        'Here is the model:\n```scad\ncube([10,10,10]);\n```',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
      assert.equal(parts[0]?.type, 'tool-call');
      assert.equal(
        (parts[0] as { toolName?: string }).toolName,
        'build_parametric_model',
      );
    });

    it('exactly one build call for a CLI-supported JSON final result', () => {
      const parts = finishWithParametricToolCall(
        '```json\n{"code":"sphere(r=5);","message":"Model ready"}\n```',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });

    it('exactly one build call for a bare JSON final result', () => {
      const parts = finishWithParametricToolCall(
        '{"code":"cylinder(h=10, r=2);","message":"Done"}',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });
  });

  describe('terminal-event contract', () => {
    it('zero build calls for a partial fenced block during the stream', () => {
      // Simulates the accumulated text mid-stream, before the fence closes.
      const parts = finishWithParametricToolCall(
        '```scad\ncube([10,10,10]);\ntranslate([0,0,20]) s',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });

    it('exactly one build call when the fence completes by the terminal event', () => {
      const parts = finishWithParametricToolCall(
        '```scad\ncube([10,10,10]);\ntranslate([0,0,20]) sphere(r=5);\n```',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });

    it('exactly one build call when repeated/snapshot events carry the same final content', () => {
      // Streaming snapshots can repeat the final content; the transformer
      // must still emit exactly one tool-call.
      const parts = finishWithParametricToolCall(
        '```scad\ncube([10,10,10]);\n```\n\n```scad\ncube([10,10,10]);\n```',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });

    it('exactly one build call when artifact and terminal event are in the same batch', () => {
      // The streaming loop accumulates text deltas before reaching finish,
      // so the full artifact is present when the transformer runs.
      const parts = finishWithParametricToolCall(
        '```scad\ncube([10,10,10]);\n```',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 1);
    });
  });

  describe('follow-up prose and ordinary text', () => {
    it('zero accidental build calls for follow-up prose after a tool result with CAD keywords', () => {
      const parts = finishWithParametricToolCall(
        'The model was built successfully. The cube and cylinder are both visible.',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
    });

    it('ordinary final text yields no build call and keeps finishReason', () => {
      const parts = finishWithParametricToolCall(
        'This is just a plain answer with no code.',
        FINISH_STOP,
      );
      assert.equal(toolCalls(parts), 0);
      assert.equal(parts.length, 1);
      assert.equal(
        (parts[0] as { finishReason?: string }).finishReason,
        'stop',
      );
    });
  });

  describe('finishReason transformation', () => {
    it('marks the finish part as tool-calls when a build call is emitted', () => {
      const parts = finishWithParametricToolCall(
        '```scad\ncube([10,10,10]);\n```',
        FINISH_STOP,
      );
      const finish = parts[parts.length - 1] as {
        finishReason?: string;
      };
      assert.equal(finish.finishReason, 'tool-calls');
    });

    it('preserves the original finish part when no build call is emitted', () => {
      const parts = finishWithParametricToolCall('plain text', FINISH_STOP);
      assert.deepEqual(parts, [FINISH_STOP]);
    });
  });
});
