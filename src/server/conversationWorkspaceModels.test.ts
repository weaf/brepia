import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import type { OpenScadProject } from '@shared/openScadProject';
import {
  conversationCurrentModelDir,
  conversationCurrentModelFilePath,
  conversationCurrentModelProjectPath,
  conversationModelDir,
  conversationModelRevisionDir,
  conversationModelRevisionFilePath,
  conversationModelRevisionProjectPath,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import {
  collectSuccessfulParametricBuilds,
  conversationModelProjectSha256,
  findConversationModelRevisionByProjectSha,
  syncConversationModelSources,
  type ConversationMessageRow,
} from './conversationWorkspaceModels.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const USER_1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const ASSISTANT_1 = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_2 = 'cccccccc-3333-4333-8333-333333333333';
const ASSISTANT_2 = 'dddddddd-4444-4444-8444-444444444444';
const SIBLING = 'eeeeeeee-5555-4555-8555-555555555555';

const CODE_1 = 'cube_size = 20;\ninclude <lib/shape.scad>;\nshape(cube_size);\n';
const CODE_1_EDITED =
  'cube_size = 35;\ninclude <lib/shape.scad>;\nshape(cube_size);\n';
const SUPPORT_1 = 'module shape(size) { cube([size, size, size]); }\n';
const SUPPORT_1_EDITED = 'module shape(size) { sphere(r=size / 2); }\n';
const CODE_2 =
  'width = 40; depth = 30; height = 15;\ncube([width, depth, height]);\n';
const SIBLING_CODE = 'sphere_radius = 12;\nsphere(r=sphere_radius);\n';

function project(
  entrypointContent: string,
  supportContent: string | null = SUPPORT_1,
  entrypointPath = 'main.scad',
): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath,
    files: [
      ...(supportContent === null
        ? []
        : [{ path: 'lib/shape.scad', content: supportContent }]),
      { path: entrypointPath, content: entrypointContent },
    ],
  };
}

function buildPart(
  toolCallId: string,
  title: string,
  openscadProject: OpenScadProject,
) {
  return {
    type: 'tool-build_parametric_model',
    toolCallId,
    state: 'output-available',
    input: { title, version: 'v1', project: openscadProject },
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
      parts: [buildPart('tool-call-1', 'Cube', project(CODE_1))],
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
          ...buildPart('failed-call', 'Broken', project('broken();\n', null)),
          state: 'output-error',
        },
        buildPart('tool-call-2', 'Rectangular block', project(CODE_2, null)),
      ],
    },
    {
      id: SIBLING,
      parent_message_id: USER_1,
      created_at: '2026-08-21T18:02:00.000Z',
      role: 'assistant',
      parts: [buildPart('sibling-call', 'Sphere', project(SIBLING_CODE, null))],
    },
  ];
}

async function withWorkspaceRoot(fn: () => Promise<void>): Promise<void> {
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

async function snapshotProject(path: string): Promise<OpenScadProject> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as {
    project: OpenScadProject;
  };
  return raw.project;
}

describe(
  'conversation workspace OpenSCAD project revisions',
  { concurrency: false },
  () => {
    it('collects complete successful projects only from the active branch', () => {
      const builds = collectSuccessfulParametricBuilds(rows(), ASSISTANT_2);
      assert.deepEqual(
        builds.map((build) => build.toolCallId),
        ['tool-call-1', 'tool-call-2'],
      );
      assert.deepEqual(builds[0]?.project.files, [
        { path: 'lib/shape.scad', content: SUPPORT_1 },
        { path: 'main.scad', content: CODE_1 },
      ]);
      assert.equal(builds[1]?.project.files.length, 1);
    });

    it('creates immutable full-project revisions and updates current idempotently', async () => {
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
          await readFile(
            conversationModelRevisionFilePath(
              CONVERSATION_ID,
              1,
              'lib/shape.scad',
            ),
            'utf8',
          ),
          SUPPORT_1,
        );
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(CONVERSATION_ID, 1, 'main.scad'),
            'utf8',
          ),
          CODE_1,
        );
        assert.equal(
          await readFile(
            conversationCurrentModelFilePath(CONVERSATION_ID, 'main.scad'),
            'utf8',
          ),
          CODE_2,
        );
        assert.deepEqual(
          await snapshotProject(
            conversationModelRevisionProjectPath(CONVERSATION_ID, 1),
          ),
          {
            schemaVersion: 1,
            entrypointPath: 'main.scad',
            files: [
              { path: 'lib/shape.scad', content: SUPPORT_1 },
              { path: 'main.scad', content: CODE_1 },
            ],
          },
        );

        const currentDocument = JSON.parse(
          await readFile(
            conversationCurrentModelProjectPath(CONVERSATION_ID),
            'utf8',
          ),
        ) as { metadata: { revision: number; toolCallId: string } };
        assert.equal(currentDocument.metadata.revision, 2);
        assert.equal(currentDocument.metadata.toolCallId, 'tool-call-2');

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

        const revisionEntries = (
          await readdir(
            join(
              process.env.PCAD_CONVERSATIONS_DIR!,
              CONVERSATION_ID,
              'models',
              'revisions',
            ),
          )
        ).sort();
        assert.deepEqual(revisionEntries, ['001', '002']);
      });
    });

    it('moves current with the selected branch without mutating revisions', async () => {
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
          await readFile(
            conversationCurrentModelFilePath(CONVERSATION_ID, 'main.scad'),
            'utf8',
          ),
          CODE_1,
        );
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(CONVERSATION_ID, 2, 'main.scad'),
            'utf8',
          ),
          CODE_2,
        );
      });
    });

    it('preserves support files when a persisted parameter edit changes only the entrypoint', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });

        const editedRows = rows().map((row) =>
          row.id === ASSISTANT_1
            ? {
                ...row,
                metadata: { originalCode: CODE_1 },
                parts: [
                  buildPart('tool-call-1', 'Cube', project(CODE_1_EDITED)),
                ],
              }
            : row,
        );

        const first = await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => editedRows },
        );
        assert.deepEqual(first, {
          discovered: 2,
          revisionsCreated: 2,
          currentRevision: 2,
        });
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(CONVERSATION_ID, 1, 'main.scad'),
            'utf8',
          ),
          CODE_1,
        );
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(CONVERSATION_ID, 2, 'main.scad'),
            'utf8',
          ),
          CODE_1_EDITED,
        );
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(
              CONVERSATION_ID,
              2,
              'lib/shape.scad',
            ),
            'utf8',
          ),
          SUPPORT_1,
        );

        const found = await findConversationModelRevisionByProjectSha(
          CONVERSATION_ID,
          conversationModelProjectSha256(project(CODE_1_EDITED)),
        );
        assert.equal(found?.revision, 2);
        assert.equal(found?.source, 'parameter-edit');
      });
    });

    it('creates a new revision for a support-file-only change', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });
        await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => rows() },
        );

        const changedRows = rows().map((row) =>
          row.id === ASSISTANT_1
            ? {
                ...row,
                parts: [
                  buildPart(
                    'tool-call-1',
                    'Cube',
                    project(CODE_1, SUPPORT_1_EDITED),
                  ),
                ],
              }
            : row,
        );
        const changed = await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => changedRows },
        );
        assert.deepEqual(changed, {
          discovered: 1,
          revisionsCreated: 1,
          currentRevision: 2,
        });
        assert.equal(
          await readFile(
            conversationModelRevisionFilePath(
              CONVERSATION_ID,
              2,
              'lib/shape.scad',
            ),
            'utf8',
          ),
          SUPPORT_1_EDITED,
        );
      });
    });

    it('uses stable whole-project identity regardless of input file order', () => {
      const ordered = project(CODE_1);
      const reversed = { ...ordered, files: [...ordered.files].reverse() };
      assert.equal(
        conversationModelProjectSha256(ordered),
        conversationModelProjectSha256(reversed),
      );
    });

    it('preserves a nested custom entrypoint path', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });
        const nestedProject: OpenScadProject = {
          schemaVersion: 1,
          entrypointPath: 'src/model.scad',
          files: [
            { path: 'src/model.scad', content: 'cube(5);\n' },
            { path: 'src/lib/support.scad', content: 'module support() {}\n' },
          ],
        };
        const messages = rows().map((row) =>
          row.id === ASSISTANT_1
            ? {
                ...row,
                parts: [buildPart('tool-call-1', 'Nested', nestedProject)],
              }
            : row,
        );
        await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => messages },
        );
        assert.equal(
          await readFile(
            conversationCurrentModelFilePath(
              CONVERSATION_ID,
              'src/model.scad',
            ),
            'utf8',
          ),
          'cube(5);\n',
        );
      });
    });

    it('removes stale current support files when the selected project no longer contains them', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });
        await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => rows() },
        );

        const withoutSupport = rows().map((row) =>
          row.id === ASSISTANT_1
            ? {
                ...row,
                parts: [
                  buildPart('tool-call-1', 'Cube', project('cube(10);\n', null)),
                ],
              }
            : row,
        );
        await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => withoutSupport },
        );
        const currentEntries = await readdir(
          conversationCurrentModelDir(CONVERSATION_ID),
        );
        assert.deepEqual(currentEntries.sort(), ['main.scad', 'project.json']);
      });
    });

    it('cleans generated legacy flat model mirror files during sync', async () => {
      await withWorkspaceRoot(async () => {
        await initializeConversationWorkspace({
          conversationId: CONVERSATION_ID,
          type: 'parametric',
        });
        const modelDir = conversationModelDir(CONVERSATION_ID);
        const revisionDir = join(modelDir, 'revisions');
        await writeFile(join(modelDir, 'current.scad'), 'legacy', 'utf8');
        await writeFile(join(modelDir, 'current.json'), '{}', 'utf8');
        await writeFile(join(revisionDir, '001.scad'), 'legacy', 'utf8');
        await writeFile(join(revisionDir, '001.json'), '{}', 'utf8');

        await syncConversationModelSources(
          request(),
          CONVERSATION_ID,
          ASSISTANT_1,
          { loadMessages: async () => rows() },
        );
        assert.deepEqual((await readdir(revisionDir)).sort(), ['001']);
        assert.deepEqual(
          (await readdir(modelDir)).sort(),
          ['current', 'generated', 'revisions'],
        );
      });
    });

    it('rejects invalid revision numbers at the workspace path boundary', () => {
      assert.throws(
        () => conversationModelRevisionDir(CONVERSATION_ID, 0),
        /Invalid model revision/,
      );
      assert.throws(
        () => conversationModelRevisionDir(CONVERSATION_ID, 1.5),
        /Invalid model revision/,
      );
    });
  },
);
