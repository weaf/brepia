import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationAgentDir,
  conversationExportFormatDir,
  conversationInputFilesDir,
  conversationInputImagesDir,
  conversationInputMeshesDir,
  conversationLogDir,
  conversationManifestPath,
  conversationModelDir,
  conversationModelRevisionsDir,
  conversationRenderDir,
  conversationRoot,
  conversationWorkspaceRoot,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

async function withWorkspaceRoot(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-conversations-'));
  process.env.PCAD_CONVERSATIONS_DIR = join(temp, 'workspaces');
  try {
    await fn(process.env.PCAD_CONVERSATIONS_DIR);
  } finally {
    if (previous === undefined) delete process.env.PCAD_CONVERSATIONS_DIR;
    else process.env.PCAD_CONVERSATIONS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

describe('conversation workspace', { concurrency: false }, () => {
  it('keeps all paths inside the configured UUID-owned root', async () => {
    await withWorkspaceRoot(async (configuredRoot) => {
      assert.equal(conversationWorkspaceRoot(), configuredRoot);
      assert.equal(conversationRoot(ID_A), join(configuredRoot, ID_A));
      assert.equal(
        conversationInputImagesDir(ID_A),
        join(configuredRoot, ID_A, 'input', 'images'),
      );
      assert.equal(
        conversationInputMeshesDir(ID_A),
        join(configuredRoot, ID_A, 'input', 'meshes'),
      );
      assert.equal(
        conversationInputFilesDir(ID_A),
        join(configuredRoot, ID_A, 'input', 'files'),
      );
      assert.equal(
        conversationModelDir(ID_A),
        join(configuredRoot, ID_A, 'models'),
      );
      assert.equal(
        conversationModelRevisionsDir(ID_A),
        join(configuredRoot, ID_A, 'models', 'revisions'),
      );
      assert.equal(
        conversationRenderDir(ID_A),
        join(configuredRoot, ID_A, 'renders'),
      );
      assert.equal(
        conversationExportFormatDir(ID_A, 'stl'),
        join(configuredRoot, ID_A, 'exports', 'stl'),
      );
      assert.equal(
        conversationAgentDir(ID_A, 'opencode'),
        join(configuredRoot, ID_A, 'agents', 'opencode'),
      );
      assert.equal(
        conversationLogDir(ID_A),
        join(configuredRoot, ID_A, 'logs'),
      );

      assert.throws(() => conversationRoot('../escape'), /Invalid conversation UUID/);
      assert.throws(
        () => conversationAgentDir(ID_A, '../escape'),
        /Invalid agent workspace name/,
      );
    });
  });

  it('initializes the complete workspace idempotently and preserves metadata', async () => {
    await withWorkspaceRoot(async () => {
      const first = await initializeConversationWorkspace({
        conversationId: ID_A,
        title: 'First title',
        type: 'parametric',
        createdAt: '2026-08-21T18:00:00.000Z',
        updatedAt: '2026-08-21T18:00:00.000Z',
      });
      assert.equal(first.id, ID_A);
      assert.equal(first.title, 'First title');

      const directories = [
        conversationInputImagesDir(ID_A),
        conversationInputMeshesDir(ID_A),
        conversationInputFilesDir(ID_A),
        conversationModelRevisionsDir(ID_A),
        conversationRenderDir(ID_A),
        conversationExportFormatDir(ID_A, 'stl'),
        conversationExportFormatDir(ID_A, '3mf'),
        conversationExportFormatDir(ID_A, 'dxf'),
        conversationAgentDir(ID_A, 'opencode'),
        conversationAgentDir(ID_A, 'codex'),
        conversationLogDir(ID_A),
      ];
      for (const dir of directories) {
        assert.equal((await stat(dir)).isDirectory(), true, dir);
      }

      const manifestPath = conversationManifestPath(ID_A);
      const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
        string,
        unknown
      >;
      raw.keepMe = 'preserved';
      await writeFile(manifestPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

      const second = await initializeConversationWorkspace({
        conversationId: ID_A,
        title: 'Renamed conversation',
        type: 'parametric',
      });
      assert.equal(second.id, ID_A);
      assert.equal(second.title, 'Renamed conversation');
      assert.equal(second.createdAt, '2026-08-21T18:00:00.000Z');
      assert.equal(second.keepMe, 'preserved');
    });
  });

  it('isolates separate conversations and rejects manifest ownership mismatches', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: ID_A,
        title: 'Conversation A',
      });
      await initializeConversationWorkspace({
        conversationId: ID_B,
        title: 'Conversation B',
      });

      assert.notEqual(conversationRoot(ID_A), conversationRoot(ID_B));
      assert.equal(
        (JSON.parse(await readFile(conversationManifestPath(ID_A), 'utf8')) as {
          id: string;
        }).id,
        ID_A,
      );
      assert.equal(
        (JSON.parse(await readFile(conversationManifestPath(ID_B), 'utf8')) as {
          id: string;
        }).id,
        ID_B,
      );

      const manifestA = JSON.parse(
        await readFile(conversationManifestPath(ID_A), 'utf8'),
      ) as Record<string, unknown>;
      manifestA.id = ID_B;
      await writeFile(
        conversationManifestPath(ID_A),
        `${JSON.stringify(manifestA, null, 2)}\n`,
        'utf8',
      );

      await assert.rejects(
        () => initializeConversationWorkspace({ conversationId: ID_A }),
        /manifest ID mismatch/,
      );
    });
  });
});
