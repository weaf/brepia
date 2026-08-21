import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  conversationIdFromChatWorkspaceRequest,
  syncConversationWorkspaceForChatRequest,
  withConversationWorkspaceLifecycle,
} from './conversationWorkspaceLifecycle.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const LEAF_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CREATED_AT = '2026-08-21T18:00:00.000Z';
const UPDATED_AT = '2026-08-21T19:00:00.000Z';

function generationRequest() {
  return new Request('http://localhost/api/parametric-chat', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId: CONVERSATION_ID,
      model: 'local/test-model',
    }),
  });
}

function conversationRow(type: 'parametric' | 'creative' = 'parametric') {
  return {
    id: CONVERSATION_ID,
    title: 'Cable wall bracket',
    type,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
    current_message_leaf_id: LEAF_ID,
  };
}

const noInputSync = async () => ({
  discovered: 0,
  copied: 0,
  existing: 0,
  failed: 0,
});

const noModelSync = async () => ({
  discovered: 0,
  revisionsCreated: 0,
  currentRevision: null,
});

const noRenderSync = async () => ({
  discovered: 0,
  copied: 0,
  existing: 0,
  failed: 0,
});

const noAgentSync = async () => ({
  discoveredTurns: 0,
  recordedTurns: 0,
  sessionsUpdated: 0,
});

describe('conversation workspace chat lifecycle', () => {
  it('extracts generation conversation IDs but ignores cancellation', () => {
    assert.equal(
      conversationIdFromChatWorkspaceRequest({
        conversationId: CONVERSATION_ID,
        model: 'local/test-model',
      }),
      CONVERSATION_ID,
    );
    assert.equal(
      conversationIdFromChatWorkspaceRequest({
        action: 'cancel',
        conversationId: CONVERSATION_ID,
      }),
      null,
    );
    assert.equal(conversationIdFromChatWorkspaceRequest(null), null);
    assert.equal(conversationIdFromChatWorkspaceRequest({}), null);
  });

  it('syncs metadata, inputs, active model source, build renders, and agent history without consuming the request body', async () => {
    const request = generationRequest();
    let loadedId: string | null = null;
    let initializedMetadata: Record<string, unknown> | null = null;
    let syncedInputId: string | null = null;
    let syncedModelId: string | null = null;
    let syncedLeafId: string | null = null;
    let syncedRenderId: string | null = null;
    let syncedAgentId: string | null = null;
    let syncedAgentLeafId: string | null = null;

    const synced = await syncConversationWorkspaceForChatRequest(request, {
      loadConversation: async (loadedRequest, conversationId) => {
        loadedId = conversationId;
        assert.equal(
          loadedRequest.headers.get('Authorization'),
          'Bearer test-token',
        );
        return conversationRow();
      },
      initializeWorkspace: async (metadata) => {
        initializedMetadata = metadata;
        return {
          schemaVersion: 1,
          id: metadata.conversationId,
          title: metadata.title ?? null,
          type: metadata.type ?? null,
          createdAt: metadata.createdAt ?? CREATED_AT,
          updatedAt: metadata.updatedAt ?? UPDATED_AT,
        };
      },
      syncInputs: async (inputRequest, conversationId) => {
        syncedInputId = conversationId;
        assert.equal(
          inputRequest.headers.get('Authorization'),
          'Bearer test-token',
        );
        return { discovered: 2, copied: 2, existing: 0, failed: 0 };
      },
      syncModels: async (modelRequest, conversationId, leafId) => {
        syncedModelId = conversationId;
        syncedLeafId = leafId;
        assert.equal(
          modelRequest.headers.get('Authorization'),
          'Bearer test-token',
        );
        return { discovered: 1, revisionsCreated: 1, currentRevision: 1 };
      },
      syncRenders: async (renderRequest, conversationId) => {
        syncedRenderId = conversationId;
        assert.equal(
          renderRequest.headers.get('Authorization'),
          'Bearer test-token',
        );
        return { discovered: 2, copied: 2, existing: 0, failed: 0 };
      },
      syncAgents: async (agentRequest, conversationId, leafId) => {
        syncedAgentId = conversationId;
        syncedAgentLeafId = leafId;
        assert.equal(
          agentRequest.headers.get('Authorization'),
          'Bearer test-token',
        );
        return { discoveredTurns: 1, recordedTurns: 1, sessionsUpdated: 1 };
      },
    });

    assert.equal(synced, true);
    assert.equal(loadedId, CONVERSATION_ID);
    assert.equal(syncedInputId, CONVERSATION_ID);
    assert.equal(syncedModelId, CONVERSATION_ID);
    assert.equal(syncedLeafId, LEAF_ID);
    assert.equal(syncedRenderId, CONVERSATION_ID);
    assert.equal(syncedAgentId, CONVERSATION_ID);
    assert.equal(syncedAgentLeafId, LEAF_ID);
    assert.deepEqual(initializedMetadata, {
      conversationId: CONVERSATION_ID,
      title: 'Cable wall bracket',
      type: 'parametric',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });

    assert.deepEqual(await request.json(), {
      conversationId: CONVERSATION_ID,
      model: 'local/test-model',
    });
  });

  it('skips OpenSCAD model/render sync for creative conversations but still allows agent history sync', async () => {
    let modelSyncCalls = 0;
    let renderSyncCalls = 0;
    let agentSyncCalls = 0;
    const synced = await syncConversationWorkspaceForChatRequest(
      generationRequest(),
      {
        loadConversation: async () => conversationRow('creative'),
        initializeWorkspace: async (metadata) => ({
          schemaVersion: 1,
          id: metadata.conversationId,
          title: metadata.title ?? null,
          type: metadata.type ?? null,
          createdAt: metadata.createdAt ?? CREATED_AT,
          updatedAt: metadata.updatedAt ?? UPDATED_AT,
        }),
        syncInputs: noInputSync,
        syncModels: async () => {
          modelSyncCalls += 1;
          return { discovered: 0, revisionsCreated: 0, currentRevision: null };
        },
        syncRenders: async () => {
          renderSyncCalls += 1;
          return { discovered: 0, copied: 0, existing: 0, failed: 0 };
        },
        syncAgents: async () => {
          agentSyncCalls += 1;
          return { discoveredTurns: 0, recordedTurns: 0, sessionsUpdated: 0 };
        },
      },
    );
    assert.equal(synced, true);
    assert.equal(modelSyncCalls, 0);
    assert.equal(renderSyncCalls, 0);
    assert.equal(agentSyncCalls, 1);
  });

  it('skips non-generation requests without touching storage', async () => {
    let loadCalls = 0;
    const dependencies = {
      loadConversation: async () => {
        loadCalls += 1;
        return conversationRow();
      },
      syncInputs: noInputSync,
      syncModels: noModelSync,
      syncRenders: noRenderSync,
      syncAgents: noAgentSync,
    };

    assert.equal(
      await syncConversationWorkspaceForChatRequest(
        new Request('http://localhost/api/parametric-chat', { method: 'GET' }),
        dependencies,
      ),
      false,
    );

    assert.equal(
      await syncConversationWorkspaceForChatRequest(
        new Request('http://localhost/api/parametric-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            conversationId: CONVERSATION_ID,
          }),
        }),
        dependencies,
      ),
      false,
    );

    assert.equal(loadCalls, 0);
  });

  it('does not create or sync a workspace for an inaccessible conversation', async () => {
    let initializeCalls = 0;
    let inputSyncCalls = 0;
    let modelSyncCalls = 0;
    let renderSyncCalls = 0;
    let agentSyncCalls = 0;
    const synced = await syncConversationWorkspaceForChatRequest(
      generationRequest(),
      {
        loadConversation: async () => null,
        initializeWorkspace: async (metadata) => {
          initializeCalls += 1;
          return {
            schemaVersion: 1,
            id: metadata.conversationId,
            title: null,
            type: null,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
          };
        },
        syncInputs: async () => {
          inputSyncCalls += 1;
          return { discovered: 0, copied: 0, existing: 0, failed: 0 };
        },
        syncModels: async () => {
          modelSyncCalls += 1;
          return { discovered: 0, revisionsCreated: 0, currentRevision: null };
        },
        syncRenders: async () => {
          renderSyncCalls += 1;
          return { discovered: 0, copied: 0, existing: 0, failed: 0 };
        },
        syncAgents: async () => {
          agentSyncCalls += 1;
          return { discoveredTurns: 0, recordedTurns: 0, sessionsUpdated: 0 };
        },
      },
    );

    assert.equal(synced, false);
    assert.equal(initializeCalls, 0);
    assert.equal(inputSyncCalls, 0);
    assert.equal(modelSyncCalls, 0);
    assert.equal(renderSyncCalls, 0);
    assert.equal(agentSyncCalls, 0);
  });

  it('continues to the chat handler when workspace persistence fails', async () => {
    const request = generationRequest();
    let nextCalls = 0;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const response = await withConversationWorkspaceLifecycle(
        request,
        async (downstreamRequest) => {
          nextCalls += 1;
          const body = await downstreamRequest.json();
          assert.equal(body.conversationId, CONVERSATION_ID);
          return new Response('chat-ok', { status: 200 });
        },
        {
          loadConversation: async () => conversationRow(),
          initializeWorkspace: async () => {
            throw new Error('simulated disk failure');
          },
          syncInputs: noInputSync,
          syncModels: noModelSync,
          syncRenders: noRenderSync,
          syncAgents: noAgentSync,
        },
      );

      assert.equal(nextCalls, 1);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'chat-ok');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('continues to the chat handler when input mirroring fails', async () => {
    const request = generationRequest();
    let nextCalls = 0;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const response = await withConversationWorkspaceLifecycle(
        request,
        async (downstreamRequest) => {
          nextCalls += 1;
          assert.equal(
            (await downstreamRequest.json()).conversationId,
            CONVERSATION_ID,
          );
          return new Response('chat-ok', { status: 200 });
        },
        {
          loadConversation: async () => conversationRow(),
          initializeWorkspace: async (metadata) => ({
            schemaVersion: 1,
            id: metadata.conversationId,
            title: metadata.title ?? null,
            type: metadata.type ?? null,
            createdAt: metadata.createdAt ?? CREATED_AT,
            updatedAt: metadata.updatedAt ?? UPDATED_AT,
          }),
          syncInputs: async () => {
            throw new Error('simulated storage download failure');
          },
          syncModels: noModelSync,
          syncRenders: noRenderSync,
          syncAgents: noAgentSync,
        },
      );

      assert.equal(nextCalls, 1);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'chat-ok');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('continues to the chat handler when model revision sync fails', async () => {
    const request = generationRequest();
    let nextCalls = 0;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const response = await withConversationWorkspaceLifecycle(
        request,
        async (downstreamRequest) => {
          nextCalls += 1;
          assert.equal(
            (await downstreamRequest.json()).conversationId,
            CONVERSATION_ID,
          );
          return new Response('chat-ok', { status: 200 });
        },
        {
          loadConversation: async () => conversationRow(),
          initializeWorkspace: async (metadata) => ({
            schemaVersion: 1,
            id: metadata.conversationId,
            title: metadata.title ?? null,
            type: metadata.type ?? null,
            createdAt: metadata.createdAt ?? CREATED_AT,
            updatedAt: metadata.updatedAt ?? UPDATED_AT,
          }),
          syncInputs: noInputSync,
          syncModels: async () => {
            throw new Error('simulated model persistence failure');
          },
          syncRenders: noRenderSync,
          syncAgents: noAgentSync,
        },
      );

      assert.equal(nextCalls, 1);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'chat-ok');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('continues to the chat handler when render mirroring fails', async () => {
    const request = generationRequest();
    let nextCalls = 0;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const response = await withConversationWorkspaceLifecycle(
        request,
        async (downstreamRequest) => {
          nextCalls += 1;
          assert.equal(
            (await downstreamRequest.json()).conversationId,
            CONVERSATION_ID,
          );
          return new Response('chat-ok', { status: 200 });
        },
        {
          loadConversation: async () => conversationRow(),
          initializeWorkspace: async (metadata) => ({
            schemaVersion: 1,
            id: metadata.conversationId,
            title: metadata.title ?? null,
            type: metadata.type ?? null,
            createdAt: metadata.createdAt ?? CREATED_AT,
            updatedAt: metadata.updatedAt ?? UPDATED_AT,
          }),
          syncInputs: noInputSync,
          syncModels: noModelSync,
          syncRenders: async () => {
            throw new Error('simulated render persistence failure');
          },
          syncAgents: noAgentSync,
        },
      );

      assert.equal(nextCalls, 1);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'chat-ok');
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('continues to the chat handler when agent history persistence fails', async () => {
    const request = generationRequest();
    let nextCalls = 0;
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const response = await withConversationWorkspaceLifecycle(
        request,
        async (downstreamRequest) => {
          nextCalls += 1;
          assert.equal(
            (await downstreamRequest.json()).conversationId,
            CONVERSATION_ID,
          );
          return new Response('chat-ok', { status: 200 });
        },
        {
          loadConversation: async () => conversationRow(),
          initializeWorkspace: async (metadata) => ({
            schemaVersion: 1,
            id: metadata.conversationId,
            title: metadata.title ?? null,
            type: metadata.type ?? null,
            createdAt: metadata.createdAt ?? CREATED_AT,
            updatedAt: metadata.updatedAt ?? UPDATED_AT,
          }),
          syncInputs: noInputSync,
          syncModels: noModelSync,
          syncRenders: noRenderSync,
          syncAgents: async () => {
            throw new Error('simulated agent diagnostic persistence failure');
          },
        },
      );

      assert.equal(nextCalls, 1);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'chat-ok');
    } finally {
      console.error = originalConsoleError;
    }
  });
});
