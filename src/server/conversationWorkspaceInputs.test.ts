import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  conversationInputArtifactPath,
  initializeConversationWorkspace,
} from './conversationWorkspace.ts';
import {
  imageExtensionFromMediaType,
  isUserUploadedInputPrompt,
  syncConversationInputArtifacts,
  type ConversationInputArtifact,
} from './conversationWorkspaceInputs.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const IMAGE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const MESH_ID = 'ffffffff-1111-4222-8333-444444444444';

async function withWorkspaceRoot(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const previous = process.env.PCAD_CONVERSATIONS_DIR;
  const temp = await mkdtemp(join(tmpdir(), 'pcad-input-mirror-'));
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
  return new Request('http://localhost/api/parametric-chat', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe('conversation workspace input mirroring', { concurrency: false }, () => {
  it('recognizes only explicit user-upload input records', () => {
    assert.equal(
      isUserUploadedInputPrompt({ text: 'User uploaded image' }, 'image'),
      true,
    );
    assert.equal(
      isUserUploadedInputPrompt({ text: 'Generated image' }, 'image'),
      false,
    );
    assert.equal(
      isUserUploadedInputPrompt({ text: 'User uploaded mesh' }, 'mesh'),
      true,
    );
    assert.equal(isUserUploadedInputPrompt(null, 'mesh'), false);
  });

  it('maps image MIME types to stable filesystem extensions', () => {
    assert.equal(imageExtensionFromMediaType('image/png'), 'png');
    assert.equal(imageExtensionFromMediaType('image/jpeg'), 'jpg');
    assert.equal(imageExtensionFromMediaType('image/webp'), 'webp');
    assert.equal(imageExtensionFromMediaType('application/octet-stream'), 'bin');
    assert.equal(imageExtensionFromMediaType(null), 'bin');
  });

  it('mirrors image and mesh bytes into the UUID-owned input directories idempotently', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        title: 'Input mirror test',
        type: 'parametric',
      });

      const artifacts: ConversationInputArtifact[] = [
        {
          kind: 'image',
          id: IMAGE_ID,
          bucket: 'images',
          storagePath: `user/${CONVERSATION_ID}/${IMAGE_ID}`,
          extension: null,
        },
        {
          kind: 'mesh',
          id: MESH_ID,
          bucket: 'meshes',
          storagePath: `user/${CONVERSATION_ID}/${MESH_ID}.stl`,
          extension: 'stl',
        },
      ];

      let downloadCalls = 0;
      const dependencies = {
        listArtifacts: async () => artifacts,
        downloadArtifact: async (
          _request: Request,
          artifact: ConversationInputArtifact,
        ) => {
          downloadCalls += 1;
          return artifact.kind === 'image'
            ? {
                bytes: new TextEncoder().encode('image-bytes'),
                mediaType: 'image/jpeg',
              }
            : {
                bytes: new TextEncoder().encode('mesh-bytes'),
                mediaType: 'application/sla',
              };
        },
      };

      const first = await syncConversationInputArtifacts(
        request(),
        CONVERSATION_ID,
        dependencies,
      );
      assert.deepEqual(first, {
        discovered: 2,
        copied: 2,
        existing: 0,
        failed: 0,
      });
      assert.equal(downloadCalls, 2);
      assert.equal(
        await readFile(
          conversationInputArtifactPath(
            CONVERSATION_ID,
            'image',
            IMAGE_ID,
            'jpg',
          ),
          'utf8',
        ),
        'image-bytes',
      );
      assert.equal(
        await readFile(
          conversationInputArtifactPath(
            CONVERSATION_ID,
            'mesh',
            MESH_ID,
            'stl',
          ),
          'utf8',
        ),
        'mesh-bytes',
      );

      const second = await syncConversationInputArtifacts(
        request(),
        CONVERSATION_ID,
        dependencies,
      );
      assert.deepEqual(second, {
        discovered: 2,
        copied: 0,
        existing: 2,
        failed: 0,
      });
      assert.equal(downloadCalls, 2);
    });
  });

  it('logs and skips one broken artifact while continuing with the others', async () => {
    await withWorkspaceRoot(async () => {
      await initializeConversationWorkspace({
        conversationId: CONVERSATION_ID,
        title: 'Partial input mirror test',
      });

      const artifacts: ConversationInputArtifact[] = [
        {
          kind: 'image',
          id: IMAGE_ID,
          bucket: 'images',
          storagePath: `user/${CONVERSATION_ID}/${IMAGE_ID}`,
          extension: null,
        },
        {
          kind: 'mesh',
          id: MESH_ID,
          bucket: 'meshes',
          storagePath: `user/${CONVERSATION_ID}/${MESH_ID}.stl`,
          extension: 'stl',
        },
      ];

      const originalConsoleError = console.error;
      console.error = () => undefined;
      try {
        const result = await syncConversationInputArtifacts(
          request(),
          CONVERSATION_ID,
          {
            listArtifacts: async () => artifacts,
            downloadArtifact: async (
              _request: Request,
              artifact: ConversationInputArtifact,
            ) => {
              if (artifact.kind === 'image') {
                throw new Error('missing image object');
              }
              return {
                bytes: new TextEncoder().encode('mesh-still-copied'),
                mediaType: 'application/sla',
              };
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
            conversationInputArtifactPath(
              CONVERSATION_ID,
              'mesh',
              MESH_ID,
              'stl',
            ),
            'utf8',
          ),
          'mesh-still-copied',
        );
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});
