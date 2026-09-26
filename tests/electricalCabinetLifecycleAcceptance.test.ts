import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBrepProjectArtifact } from '@shared/brepProjectArtifact';
import { builtinProductTemplateCatalog } from '@shared/productTemplateCatalog';
import { listBuiltinProductTemplateDiscovery } from '@shared/productTemplateDiscovery';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  createBrepProjectConversationFromTemplate,
  persistBrepProjectParameterRevision,
} from '@/services/brepProjectService';

type InsertedMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  parent_message_id: string | null;
  parts: unknown;
  metadata: Record<string, unknown>;
};

function parameterDefault(
  artifact: NonNullable<ReturnType<typeof getBrepProjectArtifact>>,
  id: string,
) {
  return artifact.source.source.parameters.find((parameter) => parameter.id === id)
    ?.default;
}

describe('D1 Electrical Cabinet persisted lifecycle acceptance', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    vi.restoreAllMocks();
  });

  it('discovers and creates independent exact-version cabinet projects', async () => {
    const conversations: Array<Record<string, unknown>> = [];
    const messageBatches: InsertedMessage[][] = [];

    const conversationInsert = vi.fn().mockImplementation(async (row) => {
      conversations.push(row);
      return { error: null };
    });
    const messageInsert = vi.fn().mockImplementation(async (rows) => {
      messageBatches.push(rows);
      return { error: null };
    });
    const leafUserEq = vi.fn().mockResolvedValue({ error: null });
    const leafIdEq = vi.fn().mockReturnValue({ eq: leafUserEq });
    const conversationUpdate = vi.fn().mockReturnValue({ eq: leafIdEq });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return { insert: conversationInsert, update: conversationUpdate };
      }
      if (table === 'messages') return { insert: messageInsert };
      throw new Error('Unexpected table: ' + table);
    });

    const discovery = listBuiltinProductTemplateDiscovery(
      builtinProductTemplateCatalog,
    );
    const cabinet = discovery.find(
      (template) => template.templateId === 'builtin:electrical-cabinet',
    );
    expect(cabinet).toMatchObject({
      templateId: 'builtin:electrical-cabinet',
      templateVersion: 1,
      name: 'Electrical Cabinet',
    });

    const firstConversationId = await createBrepProjectConversationFromTemplate({
      userId: '11111111-2222-4333-8444-555555555555',
      templateId: cabinet!.templateId,
      templateVersion: cabinet!.templateVersion,
    });
    const secondConversationId = await createBrepProjectConversationFromTemplate({
      userId: '11111111-2222-4333-8444-555555555555',
      templateId: cabinet!.templateId,
      templateVersion: cabinet!.templateVersion,
    });

    expect(secondConversationId).not.toBe(firstConversationId);
    expect(conversations).toHaveLength(2);
    expect(messageBatches).toHaveLength(2);

    const firstAssistant = messageBatches[0]!.find(
      (message) => message.role === 'assistant',
    )!;
    const secondAssistant = messageBatches[1]!.find(
      (message) => message.role === 'assistant',
    )!;

    const firstArtifact = getBrepProjectArtifact(firstAssistant.parts)!;
    const secondArtifact = getBrepProjectArtifact(secondAssistant.parts)!;

    expect(firstArtifact.source.source).toEqual(secondArtifact.source.source);
    expect(firstArtifact.source.source).not.toBe(secondArtifact.source.source);
    expect(parameterDefault(firstArtifact, 'doorOpenAngleDeg')).toBe(0);
    expect(firstArtifact.source.source.resultNodeId).toBe('cabinet');
    expect(firstArtifact.source.source.nodes).toHaveLength(39);

    expect(conversations[0]).toMatchObject({
      title: 'Electrical Cabinet',
      type: 'parametric',
      settings: {
        parametricSourceKind: 'brep',
        projectOrigin: {
          kind: 'template',
          catalog: 'builtin',
          templateId: 'builtin:electrical-cabinet',
          templateVersion: 1,
          sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      },
    });
    expect(firstAssistant.metadata).toEqual({
      projectCreation: (conversations[0]!.settings as Record<string, unknown>)
        .projectOrigin,
    });
  });

  it('reloads the persisted snapshot and creates a template-agnostic immutable 90 degree revision', async () => {
    const conversationInsert = vi.fn().mockResolvedValue({ error: null });
    const baselineInsert = vi.fn();
    let baselineMessages: InsertedMessage[] = [];
    baselineInsert.mockImplementation(async (rows) => {
      baselineMessages = rows;
      return { error: null };
    });
    const creationLeafUserEq = vi.fn().mockResolvedValue({ error: null });
    const creationLeafIdEq = vi.fn().mockReturnValue({ eq: creationLeafUserEq });
    const creationUpdate = vi.fn().mockReturnValue({ eq: creationLeafIdEq });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return { insert: conversationInsert, update: creationUpdate };
      }
      if (table === 'messages') return { insert: baselineInsert };
      throw new Error('Unexpected table during creation: ' + table);
    });

    const conversationId = await createBrepProjectConversationFromTemplate({
      userId: '11111111-2222-4333-8444-555555555555',
      templateId: 'builtin:electrical-cabinet',
      templateVersion: 1,
    });

    const baselineAssistant = baselineMessages.find(
      (message) => message.role === 'assistant',
    )!;
    const persistedParts = JSON.parse(JSON.stringify(baselineAssistant.parts));
    const persistedMetadata = JSON.parse(
      JSON.stringify(baselineAssistant.metadata),
    );
    const reloadedArtifact = getBrepProjectArtifact(persistedParts)!;

    expect(parameterDefault(reloadedArtifact, 'doorOpenAngleDeg')).toBe(0);
    expect(persistedMetadata).toMatchObject({
      projectCreation: {
        kind: 'template',
        catalog: 'builtin',
        templateId: 'builtin:electrical-cabinet',
        templateVersion: 1,
        sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });

    const revisionRows: Array<Record<string, unknown>> = [];
    const revisionInsert = vi.fn().mockImplementation(async (row) => {
      revisionRows.push(row);
      return { error: null };
    });
    const leafSelect = vi
      .fn()
      .mockResolvedValue({ data: [{ id: conversationId }], error: null });
    const currentLeafEq = vi.fn().mockReturnValue({ select: leafSelect });
    const conversationEq = vi.fn().mockReturnValue({ eq: currentLeafEq });
    const revisionUpdate = vi.fn().mockReturnValue({ eq: conversationEq });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'messages') return { insert: revisionInsert };
      if (table === 'conversations') return { update: revisionUpdate };
      throw new Error('Unexpected table during revision: ' + table);
    });

    const revision = await persistBrepProjectParameterRevision({
      conversationId,
      parentMessageId: baselineAssistant.id,
      artifact: reloadedArtifact,
      parameterValues: { doorOpenAngleDeg: 90 },
    });

    expect(revision.messageId).not.toBe(baselineAssistant.id);
    expect(parameterDefault(revision.artifact, 'doorOpenAngleDeg')).toBe(90);
    expect(parameterDefault(reloadedArtifact, 'doorOpenAngleDeg')).toBe(0);
    expect(revision.artifact.source.source.id).toBe(
      reloadedArtifact.source.source.id,
    );
    expect(revision.artifact.source.source.resultNodeId).toBe('cabinet');

    expect(revisionRows).toHaveLength(1);
    expect(revisionRows[0]).toMatchObject({
      conversation_id: conversationId,
      role: 'assistant',
      parent_message_id: baselineAssistant.id,
      metadata: {},
    });
    expect(JSON.stringify(revisionRows[0])).not.toContain(
      'builtin:electrical-cabinet',
    );
    expect(JSON.stringify(revisionRows[0])).not.toContain('projectCreation');

    const persistedRevisionArtifact = getBrepProjectArtifact(
      (revisionRows[0] as { parts: unknown }).parts,
    )!;
    expect(parameterDefault(persistedRevisionArtifact, 'doorOpenAngleDeg')).toBe(
      90,
    );
  });
});
