import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  pendingClientToolCalls,
  pendingClientToolsNeedingRecovery,
} from '../src/hooks/chatPendingToolRecovery';

describe('persisted pending client tool recovery', () => {
  it('recovers input-available pCAD tools from the latest assistant turn', () => {
    const messages = [
      { role: 'user', parts: [{ type: 'text', text: 'Create a sphere' }] },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-available',
            toolCallId: 'build-current',
            input: { code: 'sphere(10);' },
          },
        ],
      },
    ];

    assert.deepEqual(pendingClientToolCalls(messages), [
      {
        toolName: 'build_parametric_model',
        toolCallId: 'build-current',
        input: { code: 'sphere(10);' },
      },
    ]);
  });

  it('never replays an older dangling assistant when a newer assistant exists', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-available',
            toolCallId: 'build-stale',
            input: { code: 'cube(1);' },
          },
        ],
      },
      { role: 'user', parts: [{ type: 'text', text: 'Make it taller' }] },
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-available',
            toolCallId: 'build-current',
            input: { code: 'cube([1,1,2]);' },
          },
        ],
      },
    ];

    assert.deepEqual(
      pendingClientToolCalls(messages).map((tool) => tool.toolCallId),
      ['build-current'],
    );
  });

  it('does not recover resolved or already handled tools', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
            toolCallId: 'build-resolved',
            input: { code: 'sphere(10);' },
          },
          {
            type: 'tool-answer_user',
            state: 'input-available',
            toolCallId: 'answer-handled',
            input: { message: 'Done' },
          },
        ],
      },
    ];

    assert.deepEqual(
      pendingClientToolsNeedingRecovery(messages, new Set(['answer-handled'])),
      [],
    );
  });
});
