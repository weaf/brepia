import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationAgentEventsLogPath,
  conversationAgentSessionPath,
  conversationAgentTurnsDir,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import {
  collectConversationAgentTurns,
  syncConversationAgentHistory,
  type ConversationAgentHistoryRow,
} from './conversationWorkspaceAgentHistory.ts';
import { buildOpenCodeSessionId } from './opencode.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const USER_1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const ASSISTANT_1 = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_2 = 'cccccccc-3333-4333-8333-333333333333';
const ASSISTANT_2 = 'dddddddd-4444-4444-8444-444444444444';
const SIBLING = 'eeeeeeee-5555-4555-8555-555555555555';

function buildPart(
  toolCallId: string,
  state: 'output-available' | 'output-error' = 'output-available',
) {
  return {
    type: 'tool-build_parametric_model',
    toolCallId,
    state,
    input: {
      title: 'Generated model',
      version: 'v1',
      code: 'cube(20);',
    },
    ...(state === 'output-available'
      ? { output: { status: 'success' } }
      : { errorText: 'compile failed' }),
  };
}

function streamingRows(): ConversationAgentHistoryRow[] {
  return [
    {
      id: USER_1,
      parent_message_id: null,
      created_at: '2026-08-21T20:00:00.000Z',
      role: 'user',
      parts: [{ type: 'text', text: 'make a cube' }],
      metadata: {},
    },
    {
      id: ASSISTANT_1,
      parent_message_id: USER_1,
      created_at: '2026-08-21T20:00:01.000Z',
      role: 'assistant',
      parts: [buildPart('stream-first')],
      metadata: { model: 'agent/opencode/llama-swap/qwen-test' },
    },
    {
      id: USER_2,
      parent_message_id: ASSISTANT_1,
      created_at: '2026-08-21T20:01:00.000Z',
      role: 'user',
      parts: [{ type: 'text', text: 'make it taller' }],
      metadata: {},
    },
    {
      id: ASSISTANT_2,
      parent_message_id: USER_2,
      created_at: '2026-08-21T20:01:01.000Z',
      role: 'assistant',
      parts: [buildPart('stream-second')],
      metadata: { model: 'agent/opencode/llama-swap/qwen-test' },
    },
    {
      id: SIBLING,
      parent_message_id: USER_1,
      created_at: '2026-08-21T20:02:00.000Z',
      role: 'assistant',
      parts: [buildPart('stream-sibling')],
      metadata: { model: 'agent/opencode/llama-swap/qwen-test' },
    },
  ];
}

function cliMarker(agent: 'opencode' | 'codex', sessionId: string): string {
  const encoded = Buffer.from(sessionId, 'utf8').toString('base64url');
  return `cli-agent-session.${agent}.${encoded}.turn`;
}

async function withWorkspaceRoot(fn: () => Promise<void>): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-agent-history-'));
  process.env.PCAD_CONVERSATIONS_DIR = join(temp, 'conversations');
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.PCAD_CONVERSATIONS_DIR;
    else process.env.PCAD_CONVERSATIONS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

function request() {
  return new Request('http://localhost/api/parametric-chat', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe('conversation workspace agent history', { concurrency: false }, () => {
  it('collects only active-branch streaming OpenCode turns and tracks reuse', () => {
    const turns = collectConversationAgentTurns(
      CONVERSATION_ID,
      streamingRows(),
      ASSISTANT_2,
    );
    assert.equal(turns.length, 2);
    assert.deepEqual(
      turns.map((turn) => ({
        agent: turn.agent,
        transport: turn.transport,
        sessionId: turn.sessionId,
        reused: turn.reused,
      })),
      [
        {
          agent: 'opencode',
          transport: 'streaming',
          sessionId: buildOpenCodeSessionId(CONVERSATION_ID),
          reused: false,
        },
        {
          agent: 'opencode',
          transport: 'streaming',
          sessionId: buildOpenCodeSessionId(CONVERSATION_ID),
          reused: true,
        },
      ],
    );
  });

  it('decodes resumable Codex CLI thread ids from persisted tool-call markers', () => {
    const sessionId = '12345678-1234-1234-1234-123456789abc';
    const rows: ConversationAgentHistoryRow[] = [
      {
        id: USER_1,
        parent_message_id: null,
        created_at: '2026-08-21T20:00:00.000Z',
        role: 'user',
        parts: [],
        metadata: {},
      },
      {
        id: ASSISTANT_1,
        parent_message_id: USER_1,
        created_at: '2026-08-21T20:00:01.000Z',
        role: 'assistant',
        parts: [buildPart(cliMarker('codex', sessionId))],
        metadata: { model: 'agent/codex/default' },
      },
      {
        id: USER_2,
        parent_message_id: ASSISTANT_1,
        created_at: '2026-08-21T20:01:00.000Z',
        role: 'user',
        parts: [],
        metadata: {},
      },
      {
        id: ASSISTANT_2,
        parent_message_id: USER_2,
        created_at: '2026-08-21T20:01:01.000Z',
        role: 'assistant',
        parts: [buildPart(cliMarker('codex', sessionId))],
        metadata: { model: 'agent/codex/default' },
      },
    ];

    const turns = collectConversationAgentTurns(
      CONVERSATION_ID,
      rows,
      ASSISTANT_2,
    );
    assert.equal(turns.length, 2);
    assert.equal(turns[0]?.agent, 'codex');
    assert.equal(turns[0]?.transport, 'cli');
    assert.equal(turns[0]?.sessionId, sessionId);
    assert.equal(turns[0]?.reused, false);
    assert.equal(turns[1]?.reused, true);
  });

  it('backfills immutable turns, current session metadata, and an idempotent event log', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        type: 'parametric',
      });
      const rows = streamingRows();
      const dependencies = { loadMessages: async () => rows };

      const first = await syncConversationAgentHistory(
        request(),
        CONVERSATION_ID,
        ASSISTANT_2,
        dependencies,
      );
      assert.deepEqual(first, {
        discoveredTurns: 2,
        recordedTurns: 2,
        sessionsUpdated: 1,
      });

      const session = JSON.parse(
        await readFile(
          conversationAgentSessionPath(CONVERSATION_ID, 'opencode'),
          'utf8',
        ),
      ) as {
        transport: string;
        sessionId: string;
        reused: boolean;
        attachCommand: string;
      };
      assert.equal(session.transport, 'streaming');
      assert.equal(session.sessionId, buildOpenCodeSessionId(CONVERSATION_ID));
      assert.equal(session.reused, true);
      assert.match(session.attachCommand, /opencode attach/);

      const turnFiles = (
        await readdir(conversationAgentTurnsDir(CONVERSATION_ID, 'opencode'))
      ).sort();
      assert.equal(turnFiles.length, 2);
      assert.ok(turnFiles.every((filename) => filename.endsWith('.json')));

      const logPath = conversationAgentEventsLogPath(CONVERSATION_ID);
      const firstEvents = (await readFile(logPath, 'utf8')).trim().split('\n');
      assert.equal(firstEvents.length, 3);

      const second = await syncConversationAgentHistory(
        request(),
        CONVERSATION_ID,
        ASSISTANT_2,
        dependencies,
      );
      assert.deepEqual(second, first);
      const secondEvents = (await readFile(logPath, 'utf8')).trim().split('\n');
      assert.equal(secondEvents.length, 3);
    });
  });
});
