import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { syncConversationWorkspaceForChatRequest } from './conversationWorkspaceLifecycle.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function request() {
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

describe('conversation workspace verified render owner', () => {
  it('passes the already verified conversation owner to render mirroring', async () => {
    let receivedOwnerUserId: string | undefined;

    const synced = await syncConversationWorkspaceForChatRequest(request(), {
      loadConversation: async () => ({
        id: CONVERSATION_ID,
        title: 'Multi-file model',
        type: 'parametric',
        created_at: '2026-09-02T18:00:00.000Z',
        updated_at: '2026-09-02T18:00:00.000Z',
        current_message_leaf_id: null,
        verified_owner_user_id: USER_ID,
      }),
      initializeWorkspace: async (metadata) => ({
        schemaVersion: 1,
        id: metadata.conversationId,
        title: metadata.title ?? null,
        type: metadata.type ?? null,
        createdAt: metadata.createdAt ?? '2026-09-02T18:00:00.000Z',
        updatedAt: metadata.updatedAt ?? '2026-09-02T18:00:00.000Z',
      }),
      syncInputs: async () => ({
        discovered: 0,
        copied: 0,
        existing: 0,
        failed: 0,
      }),
      syncModels: async () => ({
        discovered: 0,
        revisionsCreated: 0,
        currentRevision: null,
      }),
      syncRenders: async (_request, _conversationId, _dependencies, ownerUserId) => {
        receivedOwnerUserId = ownerUserId;
        return { discovered: 0, copied: 0, existing: 0, failed: 0 };
      },
      syncAgents: async () => ({
        discoveredTurns: 0,
        recordedTurns: 0,
        sessionsUpdated: 0,
      }),
    });

    assert.equal(synced, true);
    assert.equal(receivedOwnerUserId, USER_ID);
  });
});
