import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationCurrentModelMetadataPath,
  conversationCurrentModelPath,
  conversationModelRevisionMetadataPath,
  conversationModelRevisionPath,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import {
  collectSuccessfulParametricBuilds,
  syncConversationModelSources,
  type ConversationMessageRow,
} from './conversationWorkspaceModels.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const USER_1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const ASSISTANT_1 = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_2 = 'cccccccc-3333-4333-8333-333333333333';
const ASSISTANT_2 = 'dddddddd-4444-4444-8444-444444444444';
const SIBLING = 'eeeeeeee-5555-4555-8555-555555555555';

const CODE_1 = 'cube_size = 20;\ncube([cube_size, cube_size, cube_size]);\n';
const CODE_2 = 'width = 40; depth = 30; height = 15;\ncube([width, depth, height]);\n';
const SIBLING_CODE = 'sphere_radius = 12;\nsphere(r=sphere_radius);\n';

function buildPart(toolCallId: string, title: string, code: string) {
  return {
    type: 'tool-build_parametric_model',
    toolCallId,
    state: 'output-available',
    input: { title, version: 'v1', code },
    output: { status: 'success', message: 'Compilation successful.' },
  };
}

function rows(): ConversationMessageRow[] {
  return [
    {
      id: USER_1,
      parent_message_id: null,
      created_at: '2026-08-21T18:00:00.000Z',
      role: 'user',
      parts: [{ type: 'text', text: 'make a cube' }],
    },
    {
      id: ASSISTANT_1,
      parent_message_id: USER_1,
      created_at: '2026-08-21T18:00:01.000Z',
      role: 'assistant',
      parts: [buildPart('tool-call-1', 'Cube', CODE_1)],
    },
    {
      id: USER_2,
      parent_message_id: ASSISTANT_1,
      created_at: '2026-08-21T18:01:00.000Z',
      role: 'user',
      parts: [{ type: 'text', text: 'make it rectangular' }],
    },
    {
      id: ASSISTANT_2,
      parent_message_id: USER_2,
      created_at: '2026-08-21T18:01:01.000Z',
      role: 'assistant',
      parts: [
        {
          ...buildPart('failed-call', 'Broken', 'broken();'),
          state: 'output-error',
        },
        buildPart('tool-call-2', 'Rectangular block', CODE_2),
      ],
    },
    {
      id: SIBLING,
      parent_message_id: USER_1,
      created_at: '2026-08-21T18:02:00.000Z',
      role: 'assistant',
      parts: [buildPart('sibling-call', 'Sphere', SIBLING_CODE)],
    },
  ];
}

async function withWorkspaceRoot(
  fn: () => Promise<void>,
): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-model-revisions-'));
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

describe('conversation workspace OpenSCAD revisions', { concurrency: false }, () => {
  it('collects successful builds only from the active branch', () => {
    const builds = collectSuccessfulParametricBuilds(rows(), ASSISTANT_2);
    assert.deepEqual(
      builds.map((build) => build.toolCallId),
      ['tool-call-1', 'tool-call-2'],
    );
    assert.equal(builds[0]?.code, CODE_1);
    assert.equal(builds[1]?.code, CODE_2);
  });

  it('creates immutable numbered revisions and updates current.scad idempotently', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        title: 'Model revision test',
        type: 'parametric',
      });

      const messages = rows();
      const dependencies = { loadMessages: async () => messages };
      const first = await syncConversationModelSources(
        request(),
        CONVERSATION_ID,
        ASSISTANT_2,
        dependencies,
      );
      assert.deepEqual(first, {
        discovered: 2,
        revisionsCreated: 2,
        currentRevision: 2,
      });
      assert.equal(
        await readFile(conversationModelRevisionPath(CONVERSATION_ID, 1), 'utf8'),
        CODE_1,
      );
      assert.equal(
        await readFile(conversationModelRevisionPath(CONVERSATION_ID, 2), 'utf8'),
        CODE_2,
      );
      assert.equal(
        await readFile(conversationCurrentModelPath(CONVERSATION_ID), 'utf8'),
        CODE_2,
      );

      const metadata = JSON.parse(
        await readFile(
          conversationModelRevisionMetadataPath(CONVERSATION_ID, 2),
          'utf8',
        ),
      ) as { revision: number; toolCallId: string };
      assert.equal(metadata.revision, 2);
      assert.equal(metadata.toolCallId, 'tool-call-2');

      const currentMetadata = JSON.parse(
        await readFile(
          conversationCurrentModelMetadataPath(CONVERSATION_ID),
          'utf8',
        ),
      ) as { revision: number; toolCallId: string };
      assert.equal(currentMetadata.revision, 2);
      assert.equal(currentMetadata.toolCallId, 'tool-call-2');

      const second = await syncConversationModelSources(
        request(),
        CONVERSATION_ID,
        ASSISTANT_2,
        dependencies,
      );
      assert.deepEqual(second, {
        discovered: 2,
        revisionsCreated: 0,
        currentRevision: 2,
      });

      const revisionFiles = (
        await readdir(join(process.env.PCAD_CONVERSATIONS_DIR!, CONVERSATION_ID, 'models', 'revisions'))
      ).sort();
      assert.deepEqual(revisionFiles, [
        '001.json',
        '001.scad',
        '002.json',
        '002.scad',
      ]);
    });
  });

  it('moves current.scad with the selected branch without duplicating revisions', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        type: 'parametric',
      });
      const messages = rows();
      const dependencies = { loadMessages: async () => messages };

      await syncConversationModelSources(
        request(),
        CONVERSATION_ID,
        ASSISTANT_2,
        dependencies,
      );
      const switched = await syncConversationModelSources(
        request(),
        CONVERSATION_ID,
        ASSISTANT_1,
        dependencies,
      );

      assert.deepEqual(switched, {
        discovered: 1,
        revisionsCreated: 0,
        currentRevision: 1,
      });
      assert.equal(
        await readFile(conversationCurrentModelPath(CONVERSATION_ID), 'utf8'),
        CODE_1,
      );
      assert.equal(
        await readFile(conversationModelRevisionPath(CONVERSATION_ID, 2), 'utf8'),
        CODE_2,
      );
    });
  });

  it('rejects a replay that tries to mutate an immutable revision', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        type: 'parametric',
      });
      const originalRows = rows();
      await syncConversationModelSources(
        request(),
        CONVERSATION_ID,
        ASSISTANT_1,
        { loadMessages: async () => originalRows },
      );

      const changedRows = rows().map((row) =>
        row.id === ASSISTANT_1
          ? {
              ...row,
              parts: [
                buildPart(
                  'tool-call-1',
                  'Cube',
                  'cube_size = 99;\ncube([cube_size, cube_size, cube_size]);\n',
                ),
              ],
            }
          : row,
      );

      await assert.rejects(
        () =>
          syncConversationModelSources(
            request(),
            CONVERSATION_ID,
            ASSISTANT_1,
            { loadMessages: async () => changedRows },
          ),
        /replay changed source/,
      );
    });
  });

  it('rejects invalid revision numbers at the workspace path boundary', () => {
    assert.throws(
      () => conversationModelRevisionPath(CONVERSATION_ID, 0),
      /Invalid model revision/,
    );
    assert.throws(
      () => conversationModelRevisionPath(CONVERSATION_ID, 1.5),
      /Invalid model revision/,
    );
  });
});