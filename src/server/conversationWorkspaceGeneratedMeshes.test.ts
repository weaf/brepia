import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { initializeConversationWorkspace } from './conversationWorkspace.ts';
import {
  conversationGeneratedMeshPath,
  syncConversationGeneratedMeshes,
  type ConversationGeneratedMeshArtifact,
} from './conversationWorkspaceGeneratedMeshes.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const MESH_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SECOND_MESH_ID = 'ffffffff-1111-4222-8333-444444444444';

async function withWorkspaceRoot(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-generated-mesh-mirror-'));
  process.env.PCAD_CONVERSATIONS_DIR = join(temp, 'conversations');
  try {
    await fn(process.env.PCAD_CONVERSATIONS_DIR);
  } finally {
    if (previous === undefined) delete process.env.PCAD_CONVERSATIONS_DIR;
    else process.env.PCAD_CONVERSATIONS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

function request() {
  return new Request('http://localhost/api/creative-chat', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe(
  'conversation workspace generated mesh mirroring',
  { concurrency: false },
  () => {
    it('builds generated mesh paths under models/generated and rejects unsafe IDs/extensions', () => {
      assert.equal(
        conversationGeneratedMeshPath(CONVERSATION_ID, MESH_ID, 'GLB'),
        join(
          process.env.PCAD_CONVERSATIONS_DIR ??
            join(process.cwd(), 'conversations'),
          CONVERSATION_ID,
          'models',
          'generated',
          `${MESH_ID}.glb`,
        ),
      );
      assert.throws(() =>
        conversationGeneratedMeshPath(CONVERSATION_ID, '../mesh', 'glb'),
      );
      assert.throws(() =>
        conversationGeneratedMeshPath(CONVERSATION_ID, MESH_ID, '../glb'),
      );
    });

    it('mirrors generated mesh bytes idempotently', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          title: 'Creative generated mesh',
          type: 'creative',
        });

        const artifact: ConversationGeneratedMeshArtifact = {
          id: MESH_ID,
          extension: 'glb',
          storagePath: `user/${CONVERSATION_ID}/${MESH_ID}.glb`,
        };
        let downloads = 0;
        const dependencies = {
          listArtifacts: async () => [artifact],
          downloadArtifact: async () => {
            downloads += 1;
            return new TextEncoder().encode('generated-glb');
          },
        };

        const first = await syncConversationGeneratedMeshes(
          request(),
          CONVERSATION_ID,
          dependencies,
        );
        assert.deepEqual(first, {
          discovered: 1,
          copied: 1,
          existing: 0,
          failed: 0,
        });
        assert.equal(downloads, 1);
        assert.equal(
          await readFile(
            conversationGeneratedMeshPath(CONVERSATION_ID, MESH_ID, 'glb'),
            'utf8',
          ),
          'generated-glb',
        );

        const second = await syncConversationGeneratedMeshes(
          request(),
          CONVERSATION_ID,
          dependencies,
        );
        assert.deepEqual(second, {
          discovered: 1,
          copied: 0,
          existing: 1,
          failed: 0,
        });
        assert.equal(downloads, 1);
      });
    });

    it('isolates one broken generated mesh and continues with the next', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          title: 'Partial Creative mirror',
          type: 'creative',
        });

        const artifacts: ConversationGeneratedMeshArtifact[] = [
          {
            id: MESH_ID,
            extension: 'glb',
            storagePath: `user/${CONVERSATION_ID}/${MESH_ID}.glb`,
          },
          {
            id: SECOND_MESH_ID,
            extension: 'glb',
            storagePath: `user/${CONVERSATION_ID}/${SECOND_MESH_ID}.glb`,
          },
        ];

        const originalConsoleError = console.error;
        console.error = () => undefined;
        try {
          const result = await syncConversationGeneratedMeshes(
            request(),
            CONVERSATION_ID,
            {
              listArtifacts: async () => artifacts,
              downloadArtifact: async (_request, artifact) => {
                if (artifact.id === MESH_ID) {
                  throw new Error('missing generated object');
                }
                return new TextEncoder().encode('second-glb');
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
              conversationGeneratedMeshPath(
                CONVERSATION_ID,
                SECOND_MESH_ID,
                'glb',
              ),
              'utf8',
            ),
            'second-glb',
          );
        } finally {
          console.error = originalConsoleError;
        }
      });
    });
  },
);
