import { describe, expect, it } from 'vitest';
import {
  classifyAiToolError,
  measureAiStepContext,
  summarizeAiToolChoice,
} from '../src/server/aiStepDiagnostics';

describe('AI step diagnostics', () => {
  it('measures provider-facing BRep payload growth without returning payload data', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'make a room' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolName: 'build_brep_project',
            toolCallId: 'call-1',
            input: { project: { id: 'room', nodes: [{ id: 'wall' }] } },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'build_brep_project',
            toolCallId: 'call-1',
            output: { status: 'success', message: 'accepted' },
          },
        ],
      },
    ];

    const measured = measureAiStepContext(messages);

    expect(measured.messageCount).toBe(3);
    expect(measured.modelMessageBytes).toBeGreaterThan(0);
    expect(measured.brepToolCallCount).toBe(1);
    expect(measured.brepToolResultCount).toBe(1);
    expect(measured.brepToolInputBytes).toBeGreaterThan(0);
    expect(measured.brepToolOutputBytes).toBeGreaterThan(0);
    expect(measured.brepToolPayloadBytes).toBe(
      measured.brepToolInputBytes + measured.brepToolOutputBytes,
    );
    expect(measured).not.toHaveProperty('messages');
    expect(measured).not.toHaveProperty('project');
  });

  it('classifies wrapped validation errors from their bounded cause', () => {
    const cause = Object.assign(new Error('candidate payload omitted'), {
      name: 'BrepAiProjectError',
      code: 'graph_integrity',
    });
    const outer = new Error('tool execution failed', { cause });

    expect(classifyAiToolError(outer)).toEqual({
      errorClass: 'BrepAiProjectError',
      errorCode: 'graph_integrity',
    });
  });

  it('summarizes tool choice without exposing tool inputs', () => {
    expect(summarizeAiToolChoice('auto')).toBe('auto');
    expect(
      summarizeAiToolChoice({ type: 'tool', toolName: 'build_brep_project' }),
    ).toBe('tool:build_brep_project');
  });
});
