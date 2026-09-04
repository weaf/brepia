import { describe, expect, it } from 'vitest';
import {
  BrepAiContextError,
  isBrepAiCreationRoute,
  resolveActiveBrepAiSource,
  resolveActiveBrepAiSourceForLeaf,
  serializeBrepAiProjectContext,
} from '../shared/brepAiContext';
import type { BrepProject } from '../shared/brepProject';
import { createBrepProjectArtifact } from '../shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '../shared/brepSamples';

function sourceMessage(
  id: string,
  project: BrepProject = phaseOneCabinetProject,
) {
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

    expect(source && !isBrepAiCreationRoute(source) ? source.messageId : null).toBe(
      'a1',
    );
    expect(source && !isBrepAiCreationRoute(source) ? source.project.id : null).toBe(
      phaseOneCabinetProject.id,
    );
  });

  it('uses the newest valid BRep source revision on the active branch', () => {
    const revised: BrepProject = {
      ...phaseOneCabinetProject,
      name: 'Revised cabinet',
    };
    const source = resolveActiveBrepAiSource([
      sourceMessage('a1'),
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Rename it.' }] },
      sourceMessage('a2', revised),
      { id: 'u3', role: 'user', parts: [{ type: 'text', text: 'Continue.' }] },
    ]);

    expect(source && !isBrepAiCreationRoute(source) ? source.messageId : null).toBe(
      'a2',
    );
    expect(source && !isBrepAiCreationRoute(source) ? source.project.name : null).toBe(
      'Revised cabinet',
    );
  });

  it('returns undefined for an ordinary OpenSCAD-style branch with no native BRep source', () => {
    expect(
      resolveActiveBrepAiSource([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Make a box.' }] },
      ]),
    ).toBeUndefined();
  });

  it('does not infer BRep creation from prompt text', () => {
    expect(
      resolveActiveBrepAiSource([
        {
          id: 'u1',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Create a native BRep cabinet, not an OpenSCAD model.',
            },
          ],
          metadata: { model: 'test/model' },
        },
      ]),
    ).toBeUndefined();
  });

  it('routes the first turn to BRep only from explicit persisted source intent', () => {
    const route = resolveActiveBrepAiSource([
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'Make a cabinet.' }],
        metadata: {
          model: 'test/model',
          parametricSourceKind: 'brep',
        },
      },
    ]);

    expect(route).toMatchObject({ kind: 'creation', messageId: 'u1' });
    expect(route && isBrepAiCreationRoute(route)).toBe(true);
    expect(route?.project).toBeUndefined();
  });

  it('makes persisted canonical BRep source authoritative over creation intent', () => {
    const route = resolveActiveBrepAiSource([
      {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: 'Make a cabinet.' }],
        metadata: { parametricSourceKind: 'brep' },
      },
      sourceMessage('a1'),
      {
        id: 'u2',
        role: 'user',
        parts: [{ type: 'text', text: 'Make it taller.' }],
      },
    ]);

    expect(route && isBrepAiCreationRoute(route)).toBe(false);
    expect(route?.messageId).toBe('a1');
  });

  it('keeps product source resolution empty until canonical creation is persisted', () => {
    expect(
      resolveActiveBrepAiSourceForLeaf(
        [
          {
            id: 'u1',
            role: 'user',
            parts: [{ type: 'text', text: 'Make a cabinet.' }],
            metadata: { parametricSourceKind: 'brep' },
            parent_message_id: null,
          },
        ],
        'u1',
      ),
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

  it('resolves the source ancestor when the current tree leaf is a non-source assistant turn', () => {
    const source = resolveActiveBrepAiSourceForLeaf(
      [
        {
          ...sourceMessage('a1'),
          parent_message_id: null,
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'Change the hole radius.' }],
          parent_message_id: 'a1',
        },
        {
          id: 'a2',
          role: 'assistant',
          parts: [
            {
              type: 'tool-build_brep_project',
              state: 'output-error',
              errorText: 'Candidate failed validation.',
            },
          ],
          parent_message_id: 'u2',
        },
      ],
      'a2',
    );

    expect(source?.messageId).toBe('a1');
    expect(source?.project.id).toBe(phaseOneCabinetProject.id);
  });

  it('resolves only the selected tree branch when sibling source revisions exist', () => {
    const revised: BrepProject = {
      ...phaseOneCabinetProject,
      name: 'Sibling revision',
    };
    const source = resolveActiveBrepAiSourceForLeaf(
      [
        {
          ...sourceMessage('a1'),
          parent_message_id: null,
        },
        {
          ...sourceMessage('a2', revised),
          parent_message_id: 'a1',
        },
        {
          id: 'u3',
          role: 'user',
          parts: [{ type: 'text', text: 'Continue original branch.' }],
          parent_message_id: 'a1',
        },
      ],
      'u3',
    );

    expect(source?.messageId).toBe('a1');
    expect(source?.project.name).toBe(phaseOneCabinetProject.name);
  });

  it('fails closed when persisted tree ancestry is incomplete', () => {
    expect(() =>
      resolveActiveBrepAiSourceForLeaf(
        [
          {
            id: 'u2',
            role: 'user',
            parts: [{ type: 'text', text: 'Continue.' }],
            parent_message_id: 'missing-parent',
          },
        ],
        'u2',
      ),
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
