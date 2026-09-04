import { describe, expect, it, vi } from 'vitest';
import {
  persistBrepAiRevisionAtomically,
  type BrepAiRpcClient,
} from '../src/server/brepAiPersistence';

function clientWith(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { client: { rpc } as BrepAiRpcClient, rpc };
}

describe('BRep AI atomic persistence client', () => {
  it('passes the request leaf as the expected stale guard', async () => {
    const { client, rpc } = clientWith({
      accepted: true,
      messageId: 'assistant-a2',
    });

    await expect(
      persistBrepAiRevisionAtomically({
        client,
        conversationId: 'conversation-1',
        expectedLeafId: 'request-u2',
        messageId: 'assistant-a2',
        parts: [{ type: 'data-brep-project', data: { ok: true } }],
        metadata: { model: 'test/model' },
      }),
    ).resolves.toEqual({ accepted: true, messageId: 'assistant-a2' });

    expect(rpc).toHaveBeenCalledWith('persist_brep_ai_revision', {
      p_conversation_id: 'conversation-1',
      p_expected_leaf_id: 'request-u2',
      p_message_id: 'assistant-a2',
      p_parts: [{ type: 'data-brep-project', data: { ok: true } }],
      p_metadata: { model: 'test/model' },
    });
  });

  it('fails closed when the database reports a stale request leaf', async () => {
    const { client } = clientWith({ accepted: false, reason: 'stale' });

    await expect(
      persistBrepAiRevisionAtomically({
        client,
        conversationId: 'conversation-1',
        expectedLeafId: 'request-u2',
        messageId: 'assistant-a2',
        parts: [{ type: 'text', text: 'stale' }],
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'stale' });
  });

  it('surfaces RPC failures without treating them as accepted persistence', async () => {
    const { client } = clientWith(null, { message: 'database unavailable' });

    await expect(
      persistBrepAiRevisionAtomically({
        client,
        conversationId: 'conversation-1',
        expectedLeafId: 'request-u2',
        messageId: 'assistant-a2',
        parts: [{ type: 'text', text: 'x' }],
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'rpc_failed' });
  });

  it('rejects malformed or mismatched RPC success results', async () => {
    const malformed = clientWith({ accepted: true });
    await expect(
      persistBrepAiRevisionAtomically({
        client: malformed.client,
        conversationId: 'conversation-1',
        expectedLeafId: 'request-u2',
        messageId: 'assistant-a2',
        parts: [{ type: 'text', text: 'x' }],
        metadata: {},
      }),
    ).rejects.toMatchObject({
      code: 'invalid_rpc_result',
    });
  });
});
