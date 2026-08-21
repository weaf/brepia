import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  conversationIdFromChatWorkspaceRequest,
  syncConversationWorkspaceForChatRequest,
  withConversationWorkspaceLifecycle,
} from './conversationWorkspaceLifecycle.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
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

function conversationRow() {
  return {
    id: CONVERSATION_ID,
    title: 'Cable wall bracket',
    type: 'parametric',
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
  };
}

const noInputSync = async () => ({ discovered: 0, copied: 0, existing: 0 });

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

  it('syncs metadata and inputs without consuming the request body', async () => {
    const request = generationRequest();
    let loadedId: string | null = null;
    let initializedMetadata: Record<string, unknown> | null = null;
    let syncedInputId: string | null = null;

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
        return { discovered: 2, copied: 2, existing: 0 };
      },
    });

    assert.equal(synced, true);
    assert.equal(loadedId, CONVERSATION_ID);
    assert.equal(syncedInputId, CONVERSATION_ID);
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

  it('skips non-generation requests without touching storage', async () => {
    let loadCalls = 0;
    const dependencies = {
      loadConversation: async () => {
        loadCalls += 1;
        return conversationRow();
      },
      syncInputs: noInputSync,
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
          return { discovered: 0, copied: 0, existing: 0 };
        },
      },
    );

    assert.equal(synced, false);
    assert.equal(initializeCalls, 0);
    assert.equal(inputSyncCalls, 0);
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
          assert.equal((await downstreamRequest.json()).conversationId, CONVERSATION_ID);
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
