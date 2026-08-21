import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationAgentDir,
  conversationAgentEventsLogPath,
  conversationAgentSessionPath,
  conversationAgentTurnPath,
  conversationAgentTurnsDir,
  conversationExportFormatDir,
  conversationExportRevisionMetadataPath,
  conversationExportRevisionPath,
  conversationInputArtifactPath,
  conversationInputFilesDir,
  conversationInputImagesDir,
  conversationInputMeshesDir,
  conversationLogDir,
  conversationManifestPath,
  conversationModelDir,
  conversationModelRevisionsDir,
  conversationRenderArtifactPath,
  conversationRenderDir,
  conversationRenderRevisionDir,
  conversationRoot,
  conversationWorkspaceRoot,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const TURN_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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
        conversationInputArtifactPath(
          ID_A,
          'image',
          'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          '.png',
        ),
        join(
          configuredRoot,
          ID_A,
          'input',
          'images',
          'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png',
        ),
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
        conversationRenderRevisionDir(ID_A, 7),
        join(configuredRoot, ID_A, 'renders', '007'),
      );
      assert.equal(
        conversationRenderArtifactPath(ID_A, 7, 'inspection'),
        join(configuredRoot, ID_A, 'renders', '007', 'inspection.png'),
      );
      assert.equal(
        conversationExportFormatDir(ID_A, 'stl'),
        join(configuredRoot, ID_A, 'exports', 'stl'),
      );
      assert.equal(
        conversationExportRevisionPath(ID_A, 'stl', 7),
        join(configuredRoot, ID_A, 'exports', 'stl', '007.stl'),
      );
      assert.equal(
        conversationExportRevisionMetadataPath(ID_A, 'stl', 7),
        join(configuredRoot, ID_A, 'exports', 'stl', '007.json'),
      );
      assert.equal(
        conversationAgentDir(ID_A, 'opencode'),
        join(configuredRoot, ID_A, 'agents', 'opencode'),
      );
      assert.equal(
        conversationAgentSessionPath(ID_A, 'opencode'),
        join(configuredRoot, ID_A, 'agents', 'opencode', 'session.json'),
      );
      assert.equal(
        conversationAgentTurnsDir(ID_A, 'codex'),
        join(configuredRoot, ID_A, 'agents', 'codex', 'turns'),
      );
      assert.equal(
        conversationAgentTurnPath(ID_A, 'opencode', TURN_ID),
        join(
          configuredRoot,
          ID_A,
          'agents',
          'opencode',
          'turns',
          `${TURN_ID}.json`,
        ),
      );
      assert.equal(
        conversationLogDir(ID_A),
        join(configuredRoot, ID_A, 'logs'),
      );
      assert.equal(
        conversationAgentEventsLogPath(ID_A),
        join(configuredRoot, ID_A, 'logs', 'agent-events.jsonl'),
      );

      assert.throws(() => conversationRoot('../escape'), /Invalid conversation UUID/);
      assert.throws(
        () => conversationAgentDir(ID_A, '../escape'),
        /Invalid agent workspace name/,
      );
      assert.throws(
        () => conversationAgentTurnPath(ID_A, 'opencode', '../escape'),
        /Invalid agent turn id/,
      );
      assert.throws(
        () => conversationInputArtifactPath(ID_A, 'image', '../escape', 'png'),
        /Invalid input artifact id/,
      );
      assert.throws(
        () =>
          conversationInputArtifactPath(
            ID_A,
            'mesh',
            'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            '../stl',
          ),
        /Invalid input artifact extension/,
      );
      assert.throws(
        () => conversationRenderRevisionDir(ID_A, 0),
        /Invalid model revision/,
      );
      assert.throws(
        () => conversationExportRevisionPath(ID_A, 'dxf', -1),
        /Invalid model revision/,
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
        conversationAgentTurnsDir(ID_A, 'opencode'),
        conversationAgentDir(ID_A, 'codex'),
        conversationAgentTurnsDir(ID_A, 'codex'),
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
