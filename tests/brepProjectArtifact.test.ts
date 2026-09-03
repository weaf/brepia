import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  buildBrepProjectBaselineMessages,
  createBrepProjectArtifact,
  getBrepProjectArtifact,
} from '@shared/brepProjectArtifact';

const artifact = createBrepProjectArtifact({
  title: 'Cabinet',
  version: 'v1',
  source: { kind: 'brep', source: phaseOneCabinetProject },
});

describe('BRep project message baseline', () => {
  it('stores only the normalized canonical BRep source on the assistant leaf', () => {
    const [user, assistant] = buildBrepProjectBaselineMessages({
      conversationId: '11111111-2222-4333-8444-555555555555',
      userMessageId: 'aaaaaaaa-1111-4111-8111-111111111111',
      assistantMessageId: 'bbbbbbbb-2222-4222-8222-222222222222',
      artifact,
    });

    expect(user.parent_message_id).toBeNull();
    expect(assistant.parent_message_id).toBe(user.id);
    expect(getBrepProjectArtifact(assistant.parts)).toEqual(artifact);
    expect(JSON.stringify(assistant.parts)).not.toContain('viewerMesh');
    expect(JSON.stringify(assistant.parts)).not.toContain('STEP');
  });

  it('fails closed rather than accepting a non-BRep source', () => {
    expect(() =>
      createBrepProjectArtifact({
        title: 'Not BRep',
        version: 'v1',
        source: {
          kind: 'openscad',
          source: {
            schemaVersion: 1,
            entrypointPath: 'main.scad',
            files: [{ path: 'main.scad', content: 'cube(1);' }],
          },
        },
      }),
    ).toThrow(/kind brep/i);
  });
});
