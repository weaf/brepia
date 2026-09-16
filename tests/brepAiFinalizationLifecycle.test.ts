import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import type { AppUIMessage } from '../shared/chatAi';
import type { BrepAiBuildInput } from '../shared/brepAiTool';
import type { BrepAiSourceRevision } from '../shared/brepAiContext';
import { finalizeBrepAiAssistantPartsForRun } from '../src/server/brepAiFinalizationLifecycle';

function creationRoute(): BrepAiSourceRevision {
  return { kind: 'creation', messageId: 'user-u1' };
}

function failureSink(codes: string[]) {
  return {
    failed: async (code: string) => {
      await Promise.resolve();
      codes.push(code);
    },
  };
}

describe('BRep AI finalization lifecycle', () => {
  it('terminalizes missing first-source artifacts before propagating the finalization error', async () => {
    const failureCodes: string[] = [];

    await expect(
      finalizeBrepAiAssistantPartsForRun({
        parts: [] as AppUIMessage['parts'],
        activeBrepSource: creationRoute(),
        generationRun: failureSink(failureCodes),
      }),
    ).rejects.toMatchObject({
      name: 'BrepAiFinalizationError',
      code: 'missing_creation_artifact',
    });

    expect(failureCodes).toEqual(['missing_creation_artifact']);
  });

  it('uses a bounded generic failure code for unexpected canonical finalization errors', async () => {
    const failureCodes: string[] = [];
    const invalidAcceptedBuild = {
      title: 'Invalid project',
      version: 'v1',
      project: { schemaVersion: 1 },
    } as unknown as BrepAiBuildInput;

    await expect(
      finalizeBrepAiAssistantPartsForRun({
        parts: [] as AppUIMessage['parts'],
        activeBrepSource: creationRoute(),
        acceptedBuildInput: invalidAcceptedBuild,
        generationRun: failureSink(failureCodes),
      }),
    ).rejects.toBeDefined();

    expect(failureCodes).toEqual(['brep_finalization_failed']);
  });

  it('does not mark the generation failed when canonical creation finalizes successfully', async () => {
    const failureCodes: string[] = [];
    const acceptedBuildInput: BrepAiBuildInput = {
      title: phaseOneCabinetProject.name,
      version: 'v1',
      project: phaseOneCabinetProject,
    };

    const finalized = await finalizeBrepAiAssistantPartsForRun({
      parts: [] as AppUIMessage['parts'],
      activeBrepSource: creationRoute(),
      acceptedBuildInput,
      generationRun: failureSink(failureCodes),
    });

    expect(finalized.artifact?.source.source.id).toBe(phaseOneCabinetProject.id);
    expect(failureCodes).toEqual([]);
  });
});
