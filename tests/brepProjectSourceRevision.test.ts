import { beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBrepProjectArtifact } from '@shared/brepProjectArtifact';
import { replaceExistingBrepProjectNode } from '@shared/brepProjectEditing';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { persistBrepProjectSourceRevision } from '@/services/brepProjectService';

const conversationId = '11111111-2222-4333-8444-555555555555';
const parentMessageId = 'aaaaaaaa-1111-4111-8111-111111111111';

const artifact = createBrepProjectArtifact({
  title: 'Cabinet',
  version: 'v1',
  source: { kind: 'brep', source: phaseOneCabinetProject },
});

function conversationLeafUpdateResult(data: Array<{ id: string }> = []) {
  const select = vi.fn().mockResolvedValue({ data, error: null });
  const currentLeafEq = vi.fn().mockReturnValue({ select });
  const idEq = vi.fn().mockReturnValue({ eq: currentLeafEq });
  const update = vi.fn().mockReturnValue({ eq: idEq });
  return { update, idEq, currentLeafEq, select };
}

function currentLeafConfirmationResult(currentMessageLeafId: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { current_message_leaf_id: currentMessageLeafId },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, maybeSingle };
}

describe('BRep direct source revision persistence', () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it('persists one complete validated feature snapshot and activates it with CAS', async () => {
    const body = phaseOneCabinetProject.nodes.find(
      (node) => node.id === 'cabinetBody',
    );
    if (!body || body.type !== 'box') throw new Error('Missing cabinet body');
    const project = replaceExistingBrepProjectNode(
      phaseOneCabinetProject,
      body.id,
      { ...body, depth: 725 },
    );

    const insertedRows: Array<Record<string, unknown>> = [];
    const insert = vi
      .fn()
      .mockImplementation(async (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return { error: null };
      });
    const leafUpdate = conversationLeafUpdateResult([{ id: conversationId }]);
    mocks.from
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('messages');
        return { insert };
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return leafUpdate;
      });

    const result = await persistBrepProjectSourceRevision({
      conversationId,
      parentMessageId,
      artifact,
      project,
    });

    expect(insertedRows[0]).toMatchObject({
      conversation_id: conversationId,
      role: 'assistant',
      parent_message_id: parentMessageId,
      metadata: {},
    });
    expect(result.artifact.source.source.id).toBe(phaseOneCabinetProject.id);
    expect(result.artifact.source.source.resultNodeId).toBe(
      phaseOneCabinetProject.resultNodeId,
    );
    expect(
      result.artifact.source.source.nodes.find(
        (node) => node.id === 'cabinetBody',
      ),
    ).toMatchObject({ type: 'box', depth: 725 });
    expect(leafUpdate.currentLeafEq).toHaveBeenCalledWith(
      'current_message_leaf_id',
      parentMessageId,
    );
  });

  it('leaves a stale feature revision inactive when the active leaf changed', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const leafUpdate = conversationLeafUpdateResult([]);
    const confirmation = currentLeafConfirmationResult(parentMessageId);
    mocks.from
      .mockImplementationOnce(() => ({ insert }))
      .mockImplementationOnce(() => leafUpdate)
      .mockImplementationOnce(() => confirmation);

    await expect(
      persistBrepProjectSourceRevision({
        conversationId,
        parentMessageId,
        artifact,
        project: phaseOneCabinetProject,
      }),
    ).rejects.toThrow(/changed before this feature revision/i);
  });
});
