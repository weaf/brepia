import { beforeEach, describe, expect, it, vi } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBrepProjectArtifact } from '@shared/brepProjectArtifact';
import {
  BREP_TEMPLATE_SCHEMA_VERSION,
  computeBrepTemplateDefinitionDigest,
} from '@shared/brepTemplate';
import { createBuiltinBrepTemplateRegistry } from '@shared/brepTemplates';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  createBrepProjectConversation,
  createBrepProjectConversationFromTemplate,
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
  provenance: {
  kind: 'template',
  templateId: 'c1-test-fixture',
  templateVersion: 1,
  source: 'builtin',
  definitionDigest: 'fnv1a64:0123456789abcdef',
},
});

function revisionLookupResult(
  data: {
    id: string;
    parent_message_id: string | null;
    role: 'assistant';
    parts: unknown;
  } | null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const roleEq = vi.fn().mockReturnValue({ maybeSingle });
  const conversationEq = vi.fn().mockReturnValue({ eq: roleEq });
  const idEq = vi.fn().mockReturnValue({ eq: conversationEq });
  const select = vi.fn().mockReturnValue({ eq: idEq });
  return { select, maybeSingle, idEq, conversationEq, roleEq };
}

function validRevisionRow(id = sourceMessageId, parent = parentMessageId) {
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


function conversationCreationUpdateResult() {
  const userEq = vi.fn().mockResolvedValue({ error: null });
  const idEq = vi.fn().mockReturnValue({ eq: userEq });
  const update = vi.fn().mockReturnValue({ eq: idEq });
  return { update, idEq, userEq };
}

function c14TemplateDefinition() {
  const body = {
    templateSchemaVersion: BREP_TEMPLATE_SCHEMA_VERSION,
    id: 'c1-service-fixture',
    version: 2,
    name: 'C1 service fixture',
    category: 'test-fixture',
    description: 'C1.4 creation integration fixture.',
    source: phaseOneCabinetProject,
    compatibility: { brepSchemaVersion: 1 as const },
  };
  return {
    ...body,
    definitionDigest: computeBrepTemplateDefinitionDigest(body),
  };
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

describe('BRep project revision service boundaries', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    vi.restoreAllMocks();
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
    expect(insertedRows[0]).toMatchObject({
      parts: [
        {
          type: 'data-brep-project',
          data: { provenance: artifact.provenance },
        },
      ],
    });
    expect(sourceRow.parts).toEqual(originalSnapshot);
    expect(conversationUpdate.update).toHaveBeenCalledWith({
      current_message_leaf_id: restoredId,
    });
  });

  it('leaves a stale parameter revision inactive when compare-and-set loses the leaf race', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const leafUpdate = conversationLeafUpdateResult([]);
    const confirmation = currentLeafConfirmationResult(parentMessageId);
    mocks.from
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('messages');
        return { insert };
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return leafUpdate;
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return confirmation;
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
    expect(confirmation.eq).toHaveBeenCalledWith('id', conversationId);
  });

  it('accepts a confirmed active revision when RLS suppresses the update representation', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const leafUpdate = conversationLeafUpdateResult([]);
    const messageId = 'dddddddd-4444-4444-8444-444444444444';
    const confirmation = currentLeafConfirmationResult(messageId);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(messageId);
    mocks.from
      .mockImplementationOnce(() => ({ insert }))
      .mockImplementationOnce(() => leafUpdate)
      .mockImplementationOnce(() => confirmation);

    await expect(
      persistBrepProjectParameterRevision({
        conversationId,
        parentMessageId: sourceMessageId,
        artifact,
        parameterValues: { width: 1400 },
      }),
    ).resolves.toMatchObject({ messageId });
  });

  it('branches from the selected historical leaf while retaining stable BRep identities', async () => {
    const insertedRows: Array<Record<string, unknown>> = [];
    const insert = vi
      .fn()
      .mockImplementation(async (row: Record<string, unknown>) => {
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
    expect(result.artifact.provenance).toEqual(artifact.provenance);
    expect(result.artifact.source.source.id).toBe(artifact.source.source.id);
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


describe('C1.4 template project creation integration', () => {
  it('creates the normal immutable BRep baseline from one exact template version with provenance', async () => {
    const definition = c14TemplateDefinition();
    const registry = createBuiltinBrepTemplateRegistry([definition]);
    const conversationInsert = vi.fn().mockResolvedValue({ error: null });
    const insertedMessageRows: Array<Record<string, unknown>> = [];
    const messagesInsert = vi
      .fn()
      .mockImplementation(async (rows: Array<Record<string, unknown>>) => {
        insertedMessageRows.push(...rows);
        return { error: null };
      });
    const leafUpdate = conversationCreationUpdateResult();

    mocks.from
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return { insert: conversationInsert };
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('messages');
        return { insert: messagesInsert };
      })
      .mockImplementationOnce((table: string) => {
        expect(table).toBe('conversations');
        return leafUpdate;
      });

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333');

    const createdConversationId =
      await createBrepProjectConversationFromTemplate({
        userId: 'user-c14',
        templateRef: { id: definition.id, version: definition.version },
        registry,
        instantiationOptions: {
          projectIdFactory: () => 'project_from_template',
        },
      });

    expect(createdConversationId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(conversationInsert).toHaveBeenCalledWith({
      id: createdConversationId,
      user_id: 'user-c14',
      title: definition.name,
      type: 'parametric',
      settings: { parametricSourceKind: 'brep' },
    });
    expect(insertedMessageRows).toHaveLength(2);

    const assistant = insertedMessageRows.find(
      (row) => row.role === 'assistant',
    ) as { parts?: Array<{ type?: string; data?: Record<string, unknown> }> };
    const artifactPart = assistant.parts?.find(
      (part) => part.type === 'data-brep-project',
    );
    expect(artifactPart?.data).toMatchObject({
      provenance: {
        kind: 'template',
        templateId: definition.id,
        templateVersion: definition.version,
        source: 'builtin',
        definitionDigest: definition.definitionDigest,
      },
      source: {
        kind: 'brep',
        source: {
          id: 'project_from_template',
          resultNodeId: phaseOneCabinetProject.resultNodeId,
        },
      },
    });
    expect(
      (
        artifactPart?.data?.source as {
          source?: { nodes?: Array<{ id: string }> };
        }
      )?.source?.nodes?.map((node) => node.id),
    ).toEqual(phaseOneCabinetProject.nodes.map((node) => node.id));
    expect(leafUpdate.update).toHaveBeenCalledWith({
      current_message_leaf_id:
        '22222222-2222-4222-8222-222222222222',
    });
  });

  it('keeps ordinary scratch creation free of invented template provenance', async () => {
    const conversationInsert = vi.fn().mockResolvedValue({ error: null });
    const insertedMessageRows: Array<Record<string, unknown>> = [];
    const messagesInsert = vi
      .fn()
      .mockImplementation(async (rows: Array<Record<string, unknown>>) => {
        insertedMessageRows.push(...rows);
        return { error: null };
      });
    const leafUpdate = conversationCreationUpdateResult();

    mocks.from
      .mockImplementationOnce(() => ({ insert: conversationInsert }))
      .mockImplementationOnce(() => ({ insert: messagesInsert }))
      .mockImplementationOnce(() => leafUpdate);

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444')
      .mockReturnValueOnce('55555555-5555-4555-8555-555555555555')
      .mockReturnValueOnce('66666666-6666-4666-8666-666666666666');

    await createBrepProjectConversation({
      userId: 'user-scratch',
      title: 'Scratch cabinet',
      project: phaseOneCabinetProject,
    });

    const assistant = insertedMessageRows.find(
      (row) => row.role === 'assistant',
    ) as { parts?: Array<{ type?: string; data?: Record<string, unknown> }> };
    const artifactPart = assistant.parts?.find(
      (part) => part.type === 'data-brep-project',
    );
    expect(artifactPart?.data).not.toHaveProperty('provenance');
  });
});
