import { describe, expect, it } from 'vitest';
import { createBrepProjectArtifact } from '../shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import type { AppUIMessage } from '../shared/chatAi';
import type {
  BrepAiPersistedSourceRevision,
  BrepAiSourceRevision,
} from '../shared/brepAiContext';
import type { BrepAiBuildInput } from '../shared/brepAiTool';
import {
  executeBrepAiBuild,
  finalizeBrepAiAssistantParts,
  parametricBuildToolName,
  withBrepProjectSystemContext,
} from '../src/server/brepAiTurn';

function activeSource(): BrepAiPersistedSourceRevision {
  const artifact = createBrepProjectArtifact({
    title: phaseOneCabinetProject.name,
    version: 'v1',
    source: { kind: 'brep', source: phaseOneCabinetProject },
  });
  return {
    kind: 'source',
    messageId: 'source-a1',
    artifact,
    project: phaseOneCabinetProject,
  };
}

function creationRoute(): BrepAiSourceRevision {
  return { kind: 'creation', messageId: 'user-u1' };
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
  it('selects the BRep build tool for persisted BRep source and explicit creation route', () => {
    expect(parametricBuildToolName(activeSource())).toBe('build_brep_project');
    expect(parametricBuildToolName(creationRoute())).toBe('build_brep_project');
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

  it('does not fabricate previous-project context for explicit creation', () => {
    const system = withBrepProjectSystemContext({
      systemPrompt: 'Base prompt',
      contextTemplate: '<brep>{{projectJson}}</brep>',
      creationContext: 'Create a canonical native BRep project.',
      activeBrepSource: creationRoute(),
    });

    expect(system).toContain('Base prompt');
    expect(system).toContain('Create a canonical native BRep project.');
    expect(system).not.toContain('<brep>');
    expect(system).not.toContain(phaseOneCabinetProject.id);
  });
});

describe('BRep AI build execution and finalization', () => {
  it('returns a machine-derived structural diff summary and captures the validated follow-up candidate', () => {
    const revised = {
      ...phaseOneCabinetProject,
      name: 'AI revised cabinet',
    };
    let accepted: BrepAiBuildInput | undefined;
    const output = executeBrepAiBuild({
      activeBrepSource: activeSource(),
      input: {
        title: revised.name,
        version: 'v1',
        project: revised,
      },
      onAcceptedInput: (input) => {
        accepted = input;
      },
    });

    expect(output.status).toBe('success');
    expect(output.message).toContain('project field');
    expect(accepted?.project.name).toBe('AI revised cabinet');
  });

  it('validates first BRep result as standalone canonical creation', () => {
    const created = {
      ...phaseOneCabinetProject,
      id: 'aiCreatedCabinet',
      name: 'AI created cabinet',
    };
    let accepted: BrepAiBuildInput | undefined;
    const output = executeBrepAiBuild({
      activeBrepSource: creationRoute(),
      input: {
        title: created.name,
        version: 'v1',
        project: created,
      },
      onAcceptedInput: (input) => {
        accepted = input;
      },
    });

    expect(output).toMatchObject({
      status: 'success',
      message: 'Created canonical native BRep project.',
    });
    expect(accepted?.project.id).toBe('aiCreatedCabinet');
  });

  it('rejects project identity replacement on follow-up without capturing a candidate', () => {
    let captured = false;
    expect(() =>
      executeBrepAiBuild({
        activeBrepSource: activeSource(),
        input: {
          title: 'Wrong identity',
          version: 'v1',
          project: { ...phaseOneCabinetProject, id: 'replacementProject' },
        },
        onAcceptedInput: () => {
          captured = true;
        },
      }),
    ).toThrow(/project id/i);
    expect(captured).toBe(false);
  });

  it('persists only the final successful follow-up candidate as canonical source', () => {
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

  it('persists first successful creation candidate without a previous-project diff', () => {
    const created = {
      ...phaseOneCabinetProject,
      id: 'freshProject',
      name: 'Fresh native project',
    };
    const result = finalizeBrepAiAssistantParts({
      parts: [successfulBuildPart(created)],
      activeBrepSource: creationRoute(),
    });

    expect(result.artifact?.source.source.id).toBe('freshProject');
    expect(result.diff).toBeUndefined();
    expect(
      result.parts.filter((part) => part.type === 'data-brep-project'),
    ).toHaveLength(1);
  });

  it('uses the request-local accepted candidate even when the UI message omits the build part', () => {
    const revised = {
      ...phaseOneCabinetProject,
      nodes: phaseOneCabinetProject.nodes.map((node) =>
        node.id === 'cableHole' && node.type === 'cylinder'
          ? { ...node, radius: 60 }
          : node,
      ),
    };
    const acceptedBuildInput: BrepAiBuildInput = {
      title: revised.name,
      version: 'v1',
      project: revised,
    };
    const parts = [
      {
        type: 'tool-answer_user',
        toolCallId: 'answer-1',
        state: 'output-available',
        input: { message: 'Updated.' },
        output: { message: 'Updated.' },
      },
    ] as AppUIMessage['parts'];

    const result = finalizeBrepAiAssistantParts({
      parts,
      activeBrepSource: activeSource(),
      acceptedBuildInput,
    });

    expect(result.artifact?.source.source.id).toBe(phaseOneCabinetProject.id);
    expect(
      result.artifact?.source.source.nodes.find(
        (node) => node.id === 'cableHole' && node.type === 'cylinder',
      ),
    ).toMatchObject({ radius: 60 });
    expect(
      result.parts.filter((part) => part.type === 'data-brep-project'),
    ).toHaveLength(1);
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
