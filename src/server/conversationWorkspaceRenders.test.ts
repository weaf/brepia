import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationRenderArtifactPath,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import { syncConversationRenderArtifacts } from './conversationWorkspaceRenders.ts';
import type { ConversationModelRevisionMetadata } from './conversationWorkspaceModels.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';

function revision(
  number: number,
  toolCallId: string,
  source: 'build' | 'parameter-edit' = 'build',
): ConversationModelRevisionMetadata {
  return {
    revision: number,
    toolCallId,
    messageId: `message-${number}`,
    messageCreatedAt: '2026-08-21T18:00:00.000Z',
    title: `Model ${number}`,
    version: 'v1',
    source,
    codeSha256: `${number}`.padStart(64, '0'),
    savedAt: '2026-08-21T18:00:01.000Z',
  };
}

async function withWorkspaceRoot(fn: () => Promise<void>): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-render-mirror-'));
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

describe('conversation workspace render mirroring', { concurrency: false }, () => {
  it('mirrors each tool call render only onto its first build revision', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        type: 'parametric',
      });

      const revisions = [
        revision(1, 'tool-call-1'),
        revision(2, 'tool-call-1', 'parameter-edit'),
        revision(3, 'tool-call-3'),
        // Legacy histories can contain more than one build-labelled source for
        // the same tool call. The storage object still belongs only to rev 1.
        revision(4, 'tool-call-1'),
      ];
      let downloadCalls = 0;
      const dependencies = {
        listRevisions: async () => revisions,
        downloadRender: async (
          _request: Request,
          _conversationId: string,
          artifact: { revision: number; kind: 'preview' | 'inspection' },
        ) => {
          downloadCalls += 1;
          return new TextEncoder().encode(
            `${artifact.revision}-${artifact.kind}`,
          );
        },
      };

      const first = await syncConversationRenderArtifacts(
        request(),
        CONVERSATION_ID,
        dependencies,
      );
      assert.deepEqual(first, {
        discovered: 4,
        copied: 4,
        existing: 0,
        failed: 0,
      });
      assert.equal(downloadCalls, 4);
      assert.equal(
        await readFile(
          conversationRenderArtifactPath(CONVERSATION_ID, 1, 'preview'),
          'utf8',
        ),
        '1-preview',
      );
      assert.equal(
        await readFile(
          conversationRenderArtifactPath(CONVERSATION_ID, 1, 'inspection'),
          'utf8',
        ),
        '1-inspection',
      );
      assert.equal(
        await readFile(
          conversationRenderArtifactPath(CONVERSATION_ID, 3, 'preview'),
          'utf8',
        ),
        '3-preview',
      );

      const second = await syncConversationRenderArtifacts(
        request(),
        CONVERSATION_ID,
        dependencies,
      );
      assert.deepEqual(second, {
        discovered: 4,
        copied: 0,
        existing: 4,
        failed: 0,
      });
      assert.equal(downloadCalls, 4);
    });
  });

  it('continues mirroring later render artifacts when one storage object is missing', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        type: 'parametric',
      });

      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        const result = await syncConversationRenderArtifacts(
          request(),
          CONVERSATION_ID,
          {
            listRevisions: async () => [revision(1, 'tool-call-1')],
            downloadRender: async (
              _request,
              _conversationId,
              artifact,
            ) => {
              if (artifact.kind === 'preview') {
                throw new Error('missing preview');
              }
              return new TextEncoder().encode('inspection-ok');
            },
          },
        );

        assert.deepEqual(result, {
          discovered: 2,
          copied: 1,
          existing: 0,
          failed: 1,
        });
        assert.equal(
          await readFile(
            conversationRenderArtifactPath(
              CONVERSATION_ID,
              1,
              'inspection',
            ),
            'utf8',
          ),
          'inspection-ok',
        );
      } finally {
        console.warn = originalWarn;
      }
    });
  });
});