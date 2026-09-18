import { describe, expect, it } from 'vitest';
import type { AppUIMessage } from '../shared/chatAi';
import {
  BrepAiFinalizationError,
  finalizeBrepAiAssistantParts,
} from '../src/server/brepAiTurn';
import { shouldStopAfterAcceptedBrepBuild } from '../src/server/aiBrepStopCondition';

describe('BRep agentic repair lifecycle', () => {
  it('keeps a rejected BRep build eligible for another model step', () => {
    const attempts = new Map([
      [0, [{ accepted: false }]],
    ]);

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 1)).toBe(false);
  });

  it('stops only after the just-completed step contains an accepted BRep build', () => {
    const attempts = new Map([
      [0, [{ accepted: true }]],
      [1, [{ accepted: false }]],
      [2, [{ accepted: true }]],
    ]);

    expect(shouldStopAfterAcceptedBrepBuild(attempts, 2)).toBe(false);
    expect(shouldStopAfterAcceptedBrepBuild(attempts, 3)).toBe(true);
  });

  it('fails closed when first-turn BRep creation finishes without a canonical artifact', () => {
    const parts = [
      {
        type: 'tool-answer_user',
        toolCallId: 'answer-1',
        state: 'output-available',
        input: { message: 'I could not produce the requested model.' },
        output: { message: 'I could not produce the requested model.' },
      },
    ] as AppUIMessage['parts'];

    expect(() =>
      finalizeBrepAiAssistantParts({
        parts,
        activeBrepSource: { kind: 'creation', messageId: 'user-1' },
      }),
    ).toThrow(BrepAiFinalizationError);

    expect(() =>
      finalizeBrepAiAssistantParts({
        parts,
        activeBrepSource: { kind: 'creation', messageId: 'user-1' },
      }),
    ).toThrow(/without a canonical project artifact/i);
  });
});
