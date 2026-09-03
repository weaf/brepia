import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  buildBrepProjectBaselineMessages,
  createBrepProjectArtifact,
  getBrepProjectArtifact,
  withBrepProjectParameterValues,
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

  it('creates a normalized revision source while retaining stable identities', () => {
    const revised = withBrepProjectParameterValues(phaseOneCabinetProject, {
      width: 1400,
    });
    expect(revised.id).toBe(phaseOneCabinetProject.id);
    expect(revised.resultNodeId).toBe(phaseOneCabinetProject.resultNodeId);
    expect(revised.placement).toEqual(phaseOneCabinetProject.placement);
    expect(
      revised.parameters.find((parameter) => parameter.id === 'width')?.default,
    ).toBe(1400);
    expect(
      revised.parameters.find((parameter) => parameter.id === 'height')
        ?.default,
    ).toBe(1800);
  });

  it('rejects invalid parameter revisions before a source snapshot is created', () => {
    expect(() =>
      withBrepProjectParameterValues(phaseOneCabinetProject, {
        width: Number.NaN,
      }),
    ).toThrow(/finite number/i);
    expect(() =>
      withBrepProjectParameterValues(phaseOneCabinetProject, { missing: 100 }),
    ).toThrow(/unknown BRep published parameter/i);
  });
});
