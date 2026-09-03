import { beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBrepProjectArtifact } from '@shared/brepProjectArtifact';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  persistBrepProjectParameterRevision,
  restoreBrepProjectRevision,
  selectBrepProjectRevision,
} from '@/services/brepProjectService';

const conversationId = '11111111-2222-4333-8444-555555555555';
const sourceMessageId = 'aaaaaaaa-1111-4111-8111-111111111111';
const parentMessageId = 'bbbbbbbb-2222-4222-8222-222222222222';

const artifact = createBrepProjectArtifact({
  title: 'Cabinet',
  version: 'v1',
  source: { kind: 'brep', source: phaseOneCabinetProject },
});

function revisionLookupResult(
  data:
    | {
        id: string;
        parent_message_id: string | null;
        role: 'assistant';
        parts: unknown;
      }
    | null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const roleEq = vi.fn().mockReturnValue({ maybeSingle });
  const conversationEq = vi.fn().mockReturnValue({ eq: roleEq });
  const idEq = vi.fn().mockReturnValue({ eq: conversationEq });
  const select = vi.fn().mockReturnValue({ eq: idEq });
  return { select, maybeSingle, idEq, conversationEq, roleEq };
}

function validRevisionRow(
  id = sourceMessageId,
  parent = parentMessageId,
) {
  return {
    id,
    parent_message_id: parent,
    role: 'assistant' as const,
    parts: [{ type: 'data-brep-project', data: artifact }],
  };
}

function conversationLeafUpdateResult(data: Array<{ id: string }> = []) {
  const select = vi.fn().mockResolvedValue({ data, error: null });
  const currentLeafEq = vi.fn().mockReturnValue({ select });
  const idEq = vi.fn().mockReturnValue({ eq: currentLeafEq });
  const update = vi.fn().mockReturnValue({ eq: idEq });
  return { update, idEq, currentLeafEq, select };
}

function simpleConversationUpdateResult() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq };
}

describe('BRep project revision service boundaries', () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it('rejects a revision that cannot be resolved inside the same conversation before moving the leaf', async () => {
    const lookup = revisionLookupResult(null);
    mocks.from.mockImplementationOnce((table: string) => {
      expect(table).toBe('messages');
      return lookup;
    });

    await expect(
      selectBrepProjectRevision({ conversationId, messageId: sourceMessageId }),
    ).rejects.toThrow(/not found in this conversation/i);

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(lookup.idEq).toHaveBeenCalledWith('id', sourceMessageId);
    expect(lookup.conversationEq).toHaveBeenCalledWith(
      'conversation_id',
      conversationId,
    );
    expect(lookup.roleEq).toHaveBeenCalledWith('role', 'assistant');
  });

  it('validates a same-conversation BRep assistant revision before selecting it', async () => {
    const lookup = revisionLookupResult(validRevisionRow());
    const conversationUpdate = simpleConversationUpdateResult();
    mocks.from
      .mockImplementationOnce(() => lookup)
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return conversationUpdate;
      });

    await selectBrepProjectRevision({
      conversationId,
      messageId: sourceMessageId,
    });

    expect(conversationUpdate.update).toHaveBeenCalledWith({
      current_message_leaf_id: sourceMessageId,
    });
    expect(conversationUpdate.eq).toHaveBeenCalledWith('id', conversationId);
  });

  it('restores by copying the validated historical snapshot without mutating it', async () => {
    const sourceRow = validRevisionRow();
    const originalSnapshot = JSON.parse(JSON.stringify(sourceRow.parts));
    const sourceLookup = revisionLookupResult(sourceRow);
    const insertedRows: unknown[] = [];
    const insert = vi.fn().mockImplementation(async (row: unknown) => {
      insertedRows.push(row);
      return { error: null };
    });
    const restoredLookup = revisionLookupResult(
      validRevisionRow('cccccccc-3333-4333-8333-333333333333'),
    );
    const conversationUpdate = simpleConversationUpdateResult();

    mocks.from
      .mockImplementationOnce(() => sourceLookup)
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('messages');
        return { insert };
      })
      .mockImplementationOnce(() => restoredLookup)
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return conversationUpdate;
      });

    const restoredId = await restoreBrepProjectRevision({
      conversationId,
      sourceMessageId,
    });

    expect(restoredId).toEqual(expect.any(String));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertedRows[0]).toMatchObject({
      conversation_id: conversationId,
      role: 'assistant',
      parent_message_id: parentMessageId,
    });
    expect(sourceRow.parts).toEqual(originalSnapshot);
    expect(conversationUpdate.update).toHaveBeenCalledWith({
      current_message_leaf_id: restoredId,
    });
  });

  it('leaves a stale parameter revision inactive when compare-and-set loses the leaf race', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const leafUpdate = conversationLeafUpdateResult([]);
    mocks.from
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('messages');
        return { insert };
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return leafUpdate;
      });

    await expect(
      persistBrepProjectParameterRevision({
        conversationId,
        parentMessageId: sourceMessageId,
        artifact,
        parameterValues: { width: 1400 },
      }),
    ).rejects.toThrow(/changed before this parameter revision/i);

    expect(leafUpdate.idEq).toHaveBeenCalledWith('id', conversationId);
    expect(leafUpdate.currentLeafEq).toHaveBeenCalledWith(
      'current_message_leaf_id',
      sourceMessageId,
    );
  });

  it('branches from the selected historical leaf while retaining stable BRep identities', async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const insert = vi.fn().mockImplementation(async (row: Record<string, unknown>) => {
      insertedRows.push(row);
      return { error: null };
    });
    const leafUpdate = conversationLeafUpdateResult([{ id: conversationId }]);
    mocks.from
      .mockImplementationOnce(() => ({ insert }))
      .mockImplementationOnce(() => leafUpdate);

    const result = await persistBrepProjectParameterRevision({
      conversationId,
      parentMessageId: sourceMessageId,
      artifact,
      parameterValues: { width: 1400 },
    });

    expect(insertedRows[0]).toMatchObject({
      conversation_id: conversationId,
      role: 'assistant',
      parent_message_id: sourceMessageId,
    });
    expect(result.artifact.source.source.id).toBe(
      artifact.source.source.id,
    );
    expect(result.artifact.source.source.resultNodeId).toBe(
      artifact.source.source.resultNodeId,
    );
    expect(result.artifact.source.source.placement).toEqual(
      artifact.source.source.placement,
    );
    expect(
      result.artifact.source.source.parameters.find(
        (parameter) => parameter.id === 'width',
      )?.default,
    ).toBe(1400);
  });
});
