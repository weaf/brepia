import { describe, expect, it } from 'vitest';
import type { AppUIMessage } from '../shared/chatAi';
import type { BrepAiSourceRevision } from '../shared/brepAiContext';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import {
  executeBrepAiBuild,
  finalizeBrepAiAssistantParts,
} from '../src/server/brepAiTurn';

function creationRoute(): BrepAiSourceRevision {
  return { kind: 'creation', messageId: 'user-m0' };
}

function ineffectiveProject() {
  return {
    ...phaseOneCabinetProject,
    id: 'm0RejectedProject',
    parameters: [
      ...phaseOneCabinetProject.parameters,
      {
        id: 'fakeSlider',
        label: 'Fake slider',
        type: 'number' as const,
        unit: 'mm' as const,
        default: 10,
      },
    ],
  };
}

describe('BRep AI M0 server boundary', () => {
  it('does not capture an AI build candidate with ineffective published geometry controls', () => {
    let captured = false;

    expect(() =>
      executeBrepAiBuild({
        activeBrepSource: creationRoute(),
        input: {
          title: 'Rejected M0 project',
          version: 'v1',
          project: ineffectiveProject(),
        },
        onAcceptedInput: () => {
          captured = true;
        },
      }),
    ).toThrow(/unused parameters: fakeSlider/i);

    expect(captured).toBe(false);
  });

  it('revalidates the fallback build part before creating a persisted source artifact', () => {
    const project = ineffectiveProject();
    const parts = [
      {
        type: 'tool-build_brep_project',
        toolCallId: 'build-m0',
        state: 'output-available',
        input: {
          title: project.name,
          version: 'v1',
          project,
        },
        output: {
          status: 'success',
          message: 'stale success payload',
        },
      },
    ] as AppUIMessage['parts'];

    expect(() =>
      finalizeBrepAiAssistantParts({
        parts,
        activeBrepSource: creationRoute(),
      }),
    ).toThrow(/unused parameters: fakeSlider/i);
  });
});
