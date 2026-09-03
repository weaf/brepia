import { describe, expect, it } from 'vitest';
import { createBrepProjectArtifact } from '../shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import type { AppUIMessage } from '../shared/chatAi';
import type { BrepAiSourceRevision } from '../shared/brepAiContext';
import {
  executeBrepAiBuild,
  finalizeBrepAiAssistantParts,
  parametricBuildToolName,
  withBrepProjectSystemContext,
} from '../src/server/brepAiTurn';

function activeSource(): BrepAiSourceRevision {
  const artifact = createBrepProjectArtifact({
    title: phaseOneCabinetProject.name,
    version: 'v1',
    source: { kind: 'brep', source: phaseOneCabinetProject },
  });
  return {
    messageId: 'source-a1',
    artifact,
    project: phaseOneCabinetProject,
  };
}

function successfulBuildPart(
  project = phaseOneCabinetProject,
  toolCallId = 'build-1',
): AppUIMessage['parts'][number] {
  return {
    type: 'tool-build_brep_project',
    toolCallId,
    state: 'output-available',
    input: {
      title: project.name,
      version: 'v1',
      project,
    },
    output: {
      status: 'success',
      message: 'validated',
    },
  } as AppUIMessage['parts'][number];
}

describe('BRep AI turn routing and context', () => {
  it('selects the BRep build tool only when an active native BRep source exists', () => {
    expect(parametricBuildToolName(activeSource())).toBe('build_brep_project');
    expect(parametricBuildToolName(undefined)).toBe('build_parametric_model');
  });

  it('injects only canonical project JSON, not source message identity', () => {
    const system = withBrepProjectSystemContext({
      systemPrompt: 'Base prompt',
      contextTemplate: '<brep>{{projectJson}}</brep>',
      activeBrepSource: activeSource(),
    });

    expect(system).toContain('Base prompt');
    expect(system).toContain(phaseOneCabinetProject.id);
    expect(system).not.toContain('source-a1');
  });
});

describe('BRep AI build execution and finalization', () => {
  it('returns a machine-derived structural diff summary', () => {
    const revised = {
      ...phaseOneCabinetProject,
      name: 'AI revised cabinet',
    };
    const output = executeBrepAiBuild({
      activeBrepSource: activeSource(),
      input: {
        title: revised.name,
        version: 'v1',
        project: revised,
      },
    });

    expect(output.status).toBe('success');
    expect(output.message).toContain('project field');
  });

  it('rejects project identity replacement before execution succeeds', () => {
    expect(() =>
      executeBrepAiBuild({
        activeBrepSource: activeSource(),
        input: {
          title: 'Wrong identity',
          version: 'v1',
          project: { ...phaseOneCabinetProject, id: 'replacementProject' },
        },
      }),
    ).toThrow(/project id/i);
  });

  it('persists only the final successful build candidate as canonical source', () => {
    const first = {
      ...phaseOneCabinetProject,
      name: 'First candidate',
    };
    const final = {
      ...phaseOneCabinetProject,
      name: 'Final candidate',
    };
    const parts = [
      successfulBuildPart(first, 'build-1'),
      { type: 'step-start' as const },
      successfulBuildPart(final, 'build-2'),
    ] as AppUIMessage['parts'];

    const result = finalizeBrepAiAssistantParts({
      parts,
      activeBrepSource: activeSource(),
    });
    const sourceParts = result.parts.filter(
      (part) => part.type === 'data-brep-project',
    );

    expect(sourceParts).toHaveLength(1);
    expect(result.artifact?.source.source.name).toBe('Final candidate');
    expect(result.diff?.summary).toContain('project field');
  });

  it('does not invent a new source revision when no successful build exists', () => {
    const parts = [
      {
        type: 'tool-answer_user',
        toolCallId: 'answer-1',
        state: 'output-available',
        input: { message: 'Unsupported.' },
        output: { message: 'Unsupported.' },
      },
    ] as AppUIMessage['parts'];

    const result = finalizeBrepAiAssistantParts({
      parts,
      activeBrepSource: activeSource(),
    });

    expect(result.artifact).toBeUndefined();
    expect(
      result.parts.some((part) => part.type === 'data-brep-project'),
    ).toBe(false);
  });
});
