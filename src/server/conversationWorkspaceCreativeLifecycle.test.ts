import assert from 'node:assert/strict';
import { it } from 'node:test';
import { syncConversationWorkspaceForChatRequest } from './conversationWorkspaceLifecycle.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const LEAF_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function request() {
  return new Request('http://localhost/api/creative-chat', {
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

it('syncs generated meshes for Creative workspaces without running parametric model/render sync', async () => {
  let inputCalls = 0;
  let generatedMeshCalls = 0;
  let modelCalls = 0;
  let renderCalls = 0;
  let agentCalls = 0;

  const synced = await syncConversationWorkspaceForChatRequest(request(), {
    loadConversation: async () => ({
      id: CONVERSATION_ID,
      title: 'Creative hook',
      type: 'creative',
      created_at: '2026-08-22T18:00:00.000Z',
      updated_at: '2026-08-22T19:00:00.000Z',
      current_message_leaf_id: LEAF_ID,
    }),
    initializeWorkspace: async (metadata) => ({
      schemaVersion: 1,
      id: metadata.conversationId,
      title: metadata.title ?? null,
      type: metadata.type ?? null,
      createdAt: metadata.createdAt ?? '2026-08-22T18:00:00.000Z',
      updatedAt: metadata.updatedAt ?? '2026-08-22T19:00:00.000Z',
    }),
    syncInputs: async (_request, conversationId) => {
      inputCalls += 1;
      assert.equal(conversationId, CONVERSATION_ID);
      return { discovered: 1, copied: 1, existing: 0, failed: 0 };
    },
    syncGeneratedMeshes: async (_request, conversationId) => {
      generatedMeshCalls += 1;
      assert.equal(conversationId, CONVERSATION_ID);
      return { discovered: 1, copied: 1, existing: 0, failed: 0 };
    },
    syncModels: async () => {
      modelCalls += 1;
      return { discovered: 0, revisionsCreated: 0, currentRevision: null };
    },
    syncRenders: async () => {
      renderCalls += 1;
      return { discovered: 0, copied: 0, existing: 0, failed: 0 };
    },
    syncAgents: async (_request, conversationId, leafId) => {
      agentCalls += 1;
      assert.equal(conversationId, CONVERSATION_ID);
      assert.equal(leafId, LEAF_ID);
      return { discoveredTurns: 0, recordedTurns: 0, sessionsUpdated: 0 };
    },
  });

  assert.equal(synced, true);
  assert.equal(inputCalls, 1);
  assert.equal(generatedMeshCalls, 1);
  assert.equal(modelCalls, 0);
  assert.equal(renderCalls, 0);
  assert.equal(agentCalls, 1);
});
