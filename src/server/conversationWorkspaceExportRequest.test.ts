import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONVERSATION_WORKSPACE_ACTION_HEADER,
  PERSIST_EXPORT_ACTION,
  isConversationWorkspaceExportRequest,
} from './conversationWorkspaceExportRequest.ts';

describe('conversation workspace export request routing', () => {
  it('recognizes only explicitly marked POST export requests', () => {
    const marked = new Request('http://localhost/api/parametric-chat', {
      method: 'POST',
      headers: {
        [CONVERSATION_WORKSPACE_ACTION_HEADER]: PERSIST_EXPORT_ACTION,
      },
    });
    assert.equal(isConversationWorkspaceExportRequest(marked), true);

    const normalChat = new Request('http://localhost/api/parametric-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'test', model: 'local/test' }),
    });
    assert.equal(isConversationWorkspaceExportRequest(normalChat), false);

    const wrongAction = new Request('http://localhost/api/parametric-chat', {
      method: 'POST',
      headers: { [CONVERSATION_WORKSPACE_ACTION_HEADER]: 'other-action' },
    });
    assert.equal(isConversationWorkspaceExportRequest(wrongAction), false);

    const wrongMethod = new Request('http://localhost/api/parametric-chat', {
      method: 'GET',
      headers: {
        [CONVERSATION_WORKSPACE_ACTION_HEADER]: PERSIST_EXPORT_ACTION,
      },
    });
    assert.equal(isConversationWorkspaceExportRequest(wrongMethod), false);
  });
});