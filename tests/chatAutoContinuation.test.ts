import { describe, expect, it } from 'vitest';
import type { AppUIMessage } from '../shared/chatAi';
import { lastAssistantHasTerminalMeshError } from '../src/hooks/useCachedAiChat';

function messagesWithPart(part: Record<string, unknown>): AppUIMessage[] {
  return [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [part],
    },
  ] as unknown as AppUIMessage[];
}

describe('lastAssistantHasTerminalMeshError', () => {
  it('blocks automatic continuation after create_mesh output-error', () => {
    expect(
      lastAssistantHasTerminalMeshError(
        messagesWithPart({
          type: 'tool-create_mesh',
          toolCallId: 'mesh-1',
          state: 'output-error',
          errorText: 'backend failed',
        }),
      ),
    ).toBe(true);
  });

  it('does not block successful create_mesh output', () => {
    expect(
      lastAssistantHasTerminalMeshError(
        messagesWithPart({
          type: 'tool-create_mesh',
          toolCallId: 'mesh-1',
          state: 'output-available',
          output: { id: 'mesh-id', fileType: 'glb' },
        }),
      ),
    ).toBe(false);
  });

  it('does not block parametric compile errors', () => {
    expect(
      lastAssistantHasTerminalMeshError(
        messagesWithPart({
          type: 'tool-build_parametric_model',
          toolCallId: 'cad-1',
          state: 'output-error',
          errorText: 'compile failed',
        }),
      ),
    ).toBe(false);
  });
});