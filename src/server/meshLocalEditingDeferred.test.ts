import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleMeshRequest } from './mesh.ts';

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555';
const MESH_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('local Creative mesh edit routing', () => {
  it('rejects follow-up edits before invoking the local generation backend', async () => {
    const response = await handleMeshRequest(
      new Request('http://localhost/cadam/api/mesh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: CONVERSATION_ID,
          model: 'local/hunyuan3d-2',
          mesh: MESH_ID,
          text: 'make it wider',
        }),
      }),
    );

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: {
        message:
          'Follow-up editing of locally generated Creative meshes is not enabled yet. Create a new local mesh generation instead.',
      },
    });
  });
});
