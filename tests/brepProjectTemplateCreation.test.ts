import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withBrepProjectParameterValues } from '@shared/brepProjectArtifact';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { createBuiltinProductTemplateCatalog } from '@shared/productTemplateCatalog';
import { digestCanonicalBrepProjectSource } from '@shared/productTemplateProjectCreation';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { createBrepProjectConversationFromTemplate } from '@/services/brepProjectService';

function fixtureCatalog() {
  return createBuiltinProductTemplateCatalog([
    {
      id: 'builtin:creation-fixture',
      version: 1,
      name: 'Creation fixture v1',
      category: 'Test fixtures',
      source: {
        kind: 'brep',
        source: phaseOneCabinetProject,
      },
    },
    {
      id: 'builtin:creation-fixture',
      version: 2,
      name: 'Creation fixture v2',
      category: 'Test fixtures',
      source: {
        kind: 'brep',
        source: withBrepProjectParameterValues(phaseOneCabinetProject, {
          width: 1700,
        }),
      },
    },
  ]);
}

describe('BRep template project persistence', () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it('copies the exact requested template snapshot and persists matching provenance/digest', async () => {
    const conversationInsert = vi.fn().mockResolvedValue({ error: null });
    const messageInsert = vi.fn().mockResolvedValue({ error: null });
    const leafUserEq = vi.fn().mockResolvedValue({ error: null });
    const leafIdEq = vi.fn().mockReturnValue({ eq: leafUserEq });
    const conversationUpdate = vi.fn().mockReturnValue({ eq: leafIdEq });

    mocks.from.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          insert: conversationInsert,
          update: conversationUpdate,
        };
      }
      if (table === 'messages') {
        return { insert: messageInsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const conversationId = await createBrepProjectConversationFromTemplate({
      userId: '11111111-2222-4333-8444-555555555555',
      templateId: 'builtin:creation-fixture',
      templateVersion: 1,
      catalog: fixtureCatalog(),
    });

    expect(conversationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const conversationRow = conversationInsert.mock.calls[0]?.[0];
    expect(conversationRow).toMatchObject({
      id: conversationId,
      title: 'Creation fixture v1',
      type: 'parametric',
      settings: {
        parametricSourceKind: 'brep',
        projectOrigin: {
          kind: 'template',
          catalog: 'builtin',
          templateId: 'builtin:creation-fixture',
          templateVersion: 1,
        },
      },
    });

    const rows = messageInsert.mock.calls[0]?.[0] as Array<{
      role: string;
      parts: Array<{ type: string; data?: any }>;
      metadata: Record<string, unknown>;
    }>;
    const assistant = rows.find((row) => row.role === 'assistant');
    expect(assistant?.metadata).toEqual({
      projectCreation: conversationRow.settings.projectOrigin,
    });

    const persistedProject = assistant?.parts[0]?.data?.source?.source;
    expect(persistedProject).toEqual(phaseOneCabinetProject);
    expect(
      persistedProject.parameters.find(
        (parameter: { id: string; default: number }) => parameter.id === 'width',
      )?.default,
    ).toBe(1200);

    expect(conversationRow.settings.projectOrigin.sourceDigest).toBe(
      await digestCanonicalBrepProjectSource(persistedProject),
    );
  });

  it('fails before persistence when the exact immutable template version is absent', async () => {
    await expect(
      createBrepProjectConversationFromTemplate({
        userId: '11111111-2222-4333-8444-555555555555',
        templateId: 'builtin:creation-fixture',
        templateVersion: 3,
        catalog: fixtureCatalog(),
      }),
    ).rejects.toThrow(/not found.*creation-fixture@3/i);

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
