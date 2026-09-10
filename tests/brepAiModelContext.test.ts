import { describe, expect, it } from 'vitest';

import type { AppUIMessage } from '../shared/chatAi';
import {
  resolveActiveBrepAiSource,
  serializeBrepAiProjectContext,
} from '../shared/brepAiContext';
import { createBrepProjectArtifact } from '../shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import {
  projectBrepAiModelContext,
  projectBrepProviderModelMessages,
} from '../src/server/brepAiModelContext';

function userMessage(id: string, text: string): AppUIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as AppUIMessage;
}

function acceptedRevisionMessage(
  id: string,
  project = phaseOneCabinetProject,
  summary = 'Updated the canonical Native BRep project.',
): AppUIMessage {
  const artifact = createBrepProjectArtifact({
    title: project.name,
    version: 'v1',
    source: { kind: 'brep', source: project },
  });
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: 'tool-build_brep_project',
        toolCallId: `${id}-build`,
        state: 'output-available',
        input: {
          title: project.name,
          version: 'v1',
          project,
        },
        output: { status: 'success', message: summary },
      },
      { type: 'data-brep-project', data: artifact },
    ],
  } as AppUIMessage;
}

describe('Native BRep provider model-context projection', () => {
  it('does not project ordinary or first-turn creation history', () => {
    const ordinary = [userMessage('u1', 'Make a box.')];
    const ordinaryResult = projectBrepAiModelContext({
      messages: ordinary,
      activeBrepSource: undefined,
    });
    expect(ordinaryResult.diagnostics.applied).toBe(false);
    expect(ordinaryResult.messages).toEqual(ordinary);

    const creationResult = projectBrepAiModelContext({
      messages: ordinary,
      activeBrepSource: { kind: 'creation', messageId: 'u1' },
    });
    expect(creationResult.diagnostics.applied).toBe(false);
    expect(creationResult.messages).toEqual(ordinary);
  });

  it('removes superseded full BRep tool inputs and snapshots while keeping a bounded success summary', () => {
    const branch = [
      userMessage('u1', 'Create a cabinet.'),
      acceptedRevisionMessage('a1'),
      userMessage('u2', 'Make it taller.'),
    ];
    const source = resolveActiveBrepAiSource(branch);
    expect(source?.messageId).toBe('a1');

    const result = projectBrepAiModelContext({
      messages: branch,
      activeBrepSource: source,
    });

    expect(result.diagnostics).toMatchObject({
      applied: true,
      inputMessageCount: 3,
      outputMessageCount: 3,
      removedBuildToolParts: 1,
      removedBrepSnapshotParts: 1,
      summarizedAcceptedBuilds: 1,
    });
    expect(result.diagnostics.removedBuildInputBytes).toBeGreaterThan(0);
    expect(result.diagnostics.removedBuildOutputBytes).toBeGreaterThan(0);
    expect(result.diagnostics.removedSnapshotBytes).toBeGreaterThan(0);

    const projectedAssistant = result.messages[1];
    expect(projectedAssistant?.role).toBe('assistant');
    expect(projectedAssistant?.parts).toEqual([
      {
        type: 'text',
        text: 'Prior accepted Native BRep revision: Updated the canonical Native BRep project.',
      },
    ]);
    expect(JSON.stringify(result.messages)).not.toContain(
      'tool-build_brep_project',
    );
    expect(JSON.stringify(result.messages)).not.toContain('data-brep-project');
  });

  it('preserves user messages, including the current leaf, unchanged at the UI-message layer', () => {
    const rootUser = userMessage('u1', 'Create it with width 1200.');
    const currentUser = userMessage('u2', 'Now make only the height 2200.');
    const branch = [rootUser, acceptedRevisionMessage('a1'), currentUser];
    const source = resolveActiveBrepAiSource(branch);

    const result = projectBrepAiModelContext({
      messages: branch,
      activeBrepSource: source,
    });

    expect(result.messages[0]).toBe(rootUser);
    expect(result.messages.at(-1)).toBe(currentUser);
    expect(result.messages.at(-1)?.parts).toEqual(currentUser.parts);
  });

  it('keeps current canonical geometry out of projected history so the separate system context is the only copy', () => {
    const project = {
      ...phaseOneCabinetProject,
      name: 'C3_UNIQUE_CANONICAL_MARKER',
    };
    const branch = [
      userMessage('u1', 'Create it.'),
      acceptedRevisionMessage('a1', project, 'Created the requested project.'),
      userMessage('u2', 'Continue editing it.'),
    ];
    const source = resolveActiveBrepAiSource(branch);
    expect(source?.project).toBeDefined();

    const result = projectBrepAiModelContext({
      messages: branch,
      activeBrepSource: source,
    });
    const projectedJson = JSON.stringify(result.messages);
    expect(projectedJson).not.toContain('C3_UNIQUE_CANONICAL_MARKER');

    const canonical = serializeBrepAiProjectContext(source?.project);
    const combined = `${canonical}\n${projectedJson}`;
    expect(combined.match(/C3_UNIQUE_CANONICAL_MARKER/g)).toHaveLength(1);
  });

  it('drops source-only assistant shells but preserves unrelated assistant context', () => {
    const sourceOnly = acceptedRevisionMessage('a1');
    sourceOnly.parts = sourceOnly.parts.filter(
      (part) => part.type === 'data-brep-project',
    ) as AppUIMessage['parts'];
    const unrelatedAssistant = {
      id: 'a2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'User asked to keep the rear clearance.' }],
    } as AppUIMessage;
    const branch = [
      userMessage('u1', 'Create it.'),
      sourceOnly,
      unrelatedAssistant,
      userMessage('u2', 'Change the width.'),
    ];
    const source = resolveActiveBrepAiSource(branch);

    const result = projectBrepAiModelContext({
      messages: branch,
      activeBrepSource: source,
    });

    expect(result.messages.map((message) => message.id)).toEqual([
      'u1',
      'a2',
      'u2',
    ]);
    expect(result.messages[1]).toBe(unrelatedAssistant);
  });

  it('removes the actual provider tool call/result payloads and replaces a successful result with its bounded revision summary', () => {
    const branch = [
      userMessage('u1', 'Create it.'),
      acceptedRevisionMessage('a1', phaseOneCabinetProject, 'Changed width to 1500.'),
      userMessage('u2', 'Now change the height.'),
    ];
    const modelMessages = [
      { role: 'user', content: [{ type: 'text', text: 'Create it.' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'a1-build',
            toolName: 'build_brep_project',
            input: {
              title: phaseOneCabinetProject.name,
              project: phaseOneCabinetProject,
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'a1-build',
            toolName: 'build_brep_project',
            output: { status: 'success', message: 'Changed width to 1500.' },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Now change the height.' }],
      },
    ];

    const result = projectBrepProviderModelMessages({
      modelMessages,
      branchMessages: branch,
      enabled: true,
    });

    expect(result.branchDiagnostics).toMatchObject({
      removedBuildToolParts: 1,
      removedBrepSnapshotParts: 1,
      summarizedAcceptedBuilds: 1,
    });
    expect(result.providerDiagnostics).toMatchObject({
      applied: true,
      removedToolCalls: 1,
      removedToolResults: 1,
      insertedRevisionSummaries: 1,
    });
    expect(result.providerDiagnostics.removedToolInputBytes).toBeGreaterThan(0);
    expect(result.providerDiagnostics.removedToolOutputBytes).toBeGreaterThan(0);

    const serialized = JSON.stringify(result.messages);
    expect(serialized).not.toContain('tool-call');
    expect(serialized).not.toContain('tool-result');
    expect(serialized).not.toContain(phaseOneCabinetProject.id);
    expect(serialized).toContain(
      'Prior accepted Native BRep revision: Changed width to 1500.',
    );
    expect(result.messages.at(-1)).toEqual(modelMessages.at(-1));
  });

  it('leaves provider messages byte-for-byte equivalent when C3 is disabled', () => {
    const branch = [userMessage('u1', 'Make a normal model.')];
    const modelMessages = [
      { role: 'user', content: [{ type: 'text', text: 'Make a normal model.' }] },
    ];

    const result = projectBrepProviderModelMessages({
      modelMessages,
      branchMessages: branch,
      enabled: false,
    });

    expect(result.providerDiagnostics.applied).toBe(false);
    expect(result.messages).toEqual(modelMessages);
  });
});
