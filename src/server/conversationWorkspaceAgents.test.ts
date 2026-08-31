import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationAgentEventsLogPath,
  conversationAgentSessionPath,
  conversationAgentTurnPath,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import {
  recordConversationAgentSession,
  recordConversationAgentTurn,
} from './conversationWorkspaceAgents.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const TURN_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

async function withWorkspaceRoot(fn: () => Promise<void>): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-agent-diagnostics-'));
  process.env.PCAD_CONVERSATIONS_DIR = join(temp, 'conversations');
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.PCAD_CONVERSATIONS_DIR;
    else process.env.PCAD_CONVERSATIONS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

describe(
  'conversation workspace agent diagnostics',
  { concurrency: false },
  () => {
    it('stores current session metadata and only logs actual changes', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });

        const first = await recordConversationAgentSession({
          conversationId: CONVERSATION_ID,
          agent: 'opencode',
          transport: 'streaming',
          model: 'llama-swap/qwen-test',
          sessionId: 'ses_pcad_test',
          reused: false,
          server: 'http://127.0.0.1:4096',
          directory: '/repo/pcad',
          attachCommand:
            "opencode attach 'http://127.0.0.1:4096' --session 'ses_pcad_test' --dir '/repo/pcad'",
        });
        const input = {
          conversationId: CONVERSATION_ID,
          agent: 'opencode' as const,
          transport: 'streaming' as const,
          model: 'llama-swap/qwen-test',
          sessionId: 'ses_pcad_test',
          reused: true,
          server: 'http://127.0.0.1:4096',
          directory: '/repo/pcad',
        };
        const second = await recordConversationAgentSession(input);
        const third = await recordConversationAgentSession(input);

        assert.equal(second.firstSeenAt, first.firstSeenAt);
        assert.equal(second.reused, true);
        assert.equal(third.updatedAt, second.updatedAt);
        const stored = JSON.parse(
          await readFile(
            conversationAgentSessionPath(CONVERSATION_ID, 'opencode'),
            'utf8',
          ),
        ) as { sessionId: string; transport: string; model: string };
        assert.equal(stored.sessionId, 'ses_pcad_test');
        assert.equal(stored.transport, 'streaming');
        assert.equal(stored.model, 'llama-swap/qwen-test');

        const events = (
          await readFile(
            conversationAgentEventsLogPath(CONVERSATION_ID),
            'utf8',
          )
        )
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as { type: string });
        assert.deepEqual(
          events.map((event) => event.type),
          ['agent-session', 'agent-session'],
        );
      });
    });

    it('stores immutable first-write-wins per-turn summaries without raw prompts or stdout', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });

        const input = {
          id: TURN_ID,
          conversationId: CONVERSATION_ID,
          agent: 'codex' as const,
          transport: 'cli' as const,
          model: 'default',
          sessionId: '12345678-1234-1234-1234-123456789abc',
          reused: false,
          status: 'success' as const,
          startedAt: '2026-08-21T20:00:00.000Z',
          finishedAt: '2026-08-21T20:00:01.250Z',
          durationMs: 1250,
          resultKind: 'code' as const,
        };
        await recordConversationAgentTurn(input);
        await recordConversationAgentTurn(input);

        const path = conversationAgentTurnPath(
          CONVERSATION_ID,
          'codex',
          TURN_ID,
        );
        const raw = await readFile(path, 'utf8');
        const stored = JSON.parse(raw) as {
          status: string;
          durationMs: number;
          resultKind: string;
        };
        assert.equal(stored.status, 'success');
        assert.equal(stored.durationMs, 1250);
        assert.equal(stored.resultKind, 'code');
        assert.equal(raw.includes('prompt'), false);
        assert.equal(raw.includes('stdout'), false);
        assert.equal(raw.includes('stderr'), false);

        const eventsBeforeReplay = (
          await readFile(
            conversationAgentEventsLogPath(CONVERSATION_ID),
            'utf8',
          )
        )
          .trim()
          .split('\n');
        assert.equal(eventsBeforeReplay.length, 1);

        const replay = await recordConversationAgentTurn({
          ...input,
          status: 'error',
          error: new Error('should not overwrite'),
        });
        assert.equal(replay.status, 'success');

        const afterReplay = JSON.parse(await readFile(path, 'utf8')) as {
          status: string;
          error?: unknown;
        };
        assert.equal(afterReplay.status, 'success');
        assert.equal(afterReplay.error, undefined);

        const eventsAfterReplay = (
          await readFile(
            conversationAgentEventsLogPath(CONVERSATION_ID),
            'utf8',
          )
        )
          .trim()
          .split('\n');
        assert.equal(eventsAfterReplay.length, 1);
      });
    });

    it('sanitizes errors into bounded JSON-safe turn metadata', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });
        const id = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
        const longMessage = 'x'.repeat(5000);
        await recordConversationAgentTurn({
          id,
          conversationId: CONVERSATION_ID,
          agent: 'opencode',
          transport: 'cli',
          model: 'llama-swap/qwen-test',
          sessionId: 'ses_error',
          reused: true,
          status: 'error',
          startedAt: '2026-08-21T20:01:00.000Z',
          finishedAt: '2026-08-21T20:01:01.000Z',
          durationMs: 1000,
          error: new Error(longMessage),
        });

        const stored = JSON.parse(
          await readFile(
            conversationAgentTurnPath(CONVERSATION_ID, 'opencode', id),
            'utf8',
          ),
        ) as { error: { name: string; message: string } };
        assert.equal(stored.error.name, 'Error');
        assert.equal(stored.error.message.length, 2000);
      });
    });
  },
);
