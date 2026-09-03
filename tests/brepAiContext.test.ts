import { describe, expect, it } from 'vitest';
import {
  BrepAiContextError,
  resolveActiveBrepAiSource,
  serializeBrepAiProjectContext,
} from '../shared/brepAiContext';
import { createBrepProjectArtifact } from '../shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '../shared/brepSamples';

function sourceMessage(id: string, project = phaseOneCabinetProject) {
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: 'data-brep-project',
        data: createBrepProjectArtifact({
          title: project.name,
          version: 'v1',
          source: { kind: 'brep', source: project },
        }),
      },
    ],
  };
}

describe('native BRep AI source context', () => {
  it('resolves the nearest preceding BRep source when the active leaf is a user follow-up', () => {
    const source = resolveActiveBrepAiSource([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Created.' }] },
      sourceMessage('a1'),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Make it taller.' }] },
    ]);

    expect(source?.messageId).toBe('a1');
    expect(source?.project.id).toBe(phaseOneCabinetProject.id);
  });

  it('uses the newest valid BRep source revision on the active branch', () => {
    const revised = {
      ...phaseOneCabinetProject,
      name: 'Revised cabinet',
    };
    const source = resolveActiveBrepAiSource([
      sourceMessage('a1'),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Rename it.' }] },
      sourceMessage('a2', revised),
      { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'Continue.' }] },
    ]);

    expect(source?.messageId).toBe('a2');
    expect(source?.project.name).toBe('Revised cabinet');
  });

  it('returns undefined for a branch with no native BRep source', () => {
    expect(
      resolveActiveBrepAiSource([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Make a box.' }] },
      ]),
    ).toBeUndefined();
  });

  it('fails closed on the nearest malformed BRep source marker instead of falling back', () => {
    expect(() =>
      resolveActiveBrepAiSource([
        sourceMessage('a1'),
        {
          id: 'a2',
          role: 'assistant',
          parts: [{ type: 'data-brep-project', data: { broken: true } }],
        },
        { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'Continue.' }] },
      ]),
    ).toThrowError(BrepAiContextError);
  });

  it('rejects a BRep source marker on a non-assistant message', () => {
    const artifact = createBrepProjectArtifact({
      title: phaseOneCabinetProject.name,
      version: 'v1',
      source: { kind: 'brep', source: phaseOneCabinetProject },
    });

    expect(() =>
      resolveActiveBrepAiSource([
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'data-brep-project', data: artifact }],
        },
      ]),
    ).toThrowError(BrepAiContextError);
  });

  it('serializes only normalized editable project semantics for model context', () => {
    const json = serializeBrepAiProjectContext(phaseOneCabinetProject);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.id).toBe(phaseOneCabinetProject.id);
    expect(parsed.schemaVersion).toBe(phaseOneCabinetProject.schemaVersion);
    expect(json).not.toContain('sourceMessageId');
    expect(json).not.toContain('build123d');
    expect(json).not.toContain('STEP');
  });
});
