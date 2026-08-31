import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  deleteConversationArtifacts,
  deleteOwnedConversations,
} from './conversationTeardown.ts';
import type { SupabaseClient } from './supabaseClient.ts';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION_A = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_B = '22222222-2222-4222-8222-222222222222';

async function withWorkspaceRoot(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-delete-'));
  process.env.PCAD_CONVERSATIONS_DIR = join(temp, 'conversations');
  try {
    await fn(process.env.PCAD_CONVERSATIONS_DIR);
  } finally {
    if (previous === undefined) delete process.env.PCAD_CONVERSATIONS_DIR;
    else process.env.PCAD_CONVERSATIONS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

function storageOnlyClient(removed: Array<{ bucket: string; paths: string[] }>) {
  return {
    storage: {
      from(bucket: string) {
        return {
          async list(folder: string) {
            return {
              data: [{ name: 'artifact.bin', id: `${bucket}-artifact` }],
              error: null,
              folder,
            };
          },
          async remove(paths: string[]) {
            removed.push({ bucket, paths });
            return { data: [], error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

describe('conversation teardown', { concurrency: false }, () => {
  it('removes all managed storage buckets and the local workspace', async () => {
    await withWorkspaceRoot(async (root) => {
      const workspace = join(root, CONVERSATION_A);
      await mkdir(join(workspace, 'models', 'generated'), { recursive: true });
      await writeFile(join(workspace, 'models', 'generated', 'mesh.glb'), 'mesh');

      const removed: Array<{ bucket: string; paths: string[] }> = [];
      await deleteConversationArtifacts(
        storageOnlyClient(removed),
        USER_ID,
        CONVERSATION_A,
      );

      assert.deepEqual(
        removed.map((entry) => entry.bucket),
        ['images', 'meshes', 'previews'],
      );
      for (const entry of removed) {
        assert.deepEqual(entry.paths, [
          `${USER_ID}/${CONVERSATION_A}/artifact.bin`,
        ]);
      }
      await assert.rejects(() => stat(workspace), { code: 'ENOENT' });
    });
  });

  it('refuses a batch when any requested conversation is not owned', async () => {
    let deleteCalled = false;
    const client = {
      from(table: string) {
        assert.equal(table, 'conversations');
        return {
          select() {
            return {
              eq() {
                return {
                  async in() {
                    return { data: [{ id: CONVERSATION_A }], error: null };
                  },
                };
              },
            };
          },
          delete() {
            deleteCalled = true;
            throw new Error('delete should not be reached');
          },
        };
      },
    } as unknown as SupabaseClient;

    await assert.rejects(
      () =>
        deleteOwnedConversations(client, USER_ID, [
          CONVERSATION_A,
          CONVERSATION_B,
        ]),
      /conversation_not_found_or_not_owned/,
    );
    assert.equal(deleteCalled, false);
  });
});
