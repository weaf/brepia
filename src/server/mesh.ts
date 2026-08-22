import { isLocalCreativeMeshModel } from '@shared/creativeMeshModels';
import { handleMeshRequest as handleFalMeshRequest } from './falMesh';
import { syncConversationGeneratedMeshes } from './conversationWorkspaceGeneratedMeshes';
import { handleLocalMeshRequest } from './localMesh';
import { resolveLocalMeshEditSource } from './localMeshEditContext';
import { logError } from './serverLog';

function recordBody(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function requestModel(body: unknown): string | null {
  const record = recordBody(body);
  const model = record?.model;
  return typeof model === 'string' ? model : null;
}

function requestConversationId(body: unknown): string | null {
  const record = recordBody(body);
  const conversationId = record?.conversationId;
  return typeof conversationId === 'string' && conversationId
    ? conversationId
    : null;
}

/**
 * Stable entry point for Creative mesh generation.
 *
 * Historical `fast` / `quality` / `ultra` requests keep using the unchanged
 * fal.ai implementation in `falMesh.ts`. Local backend IDs are handled by the
 * pCAD local mesh gateway and never require FAL_KEY.
 */
export async function handleMeshRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return handleFalMeshRequest(request);
  }

  const body = await request.clone().json().catch(() => null);
  const model = requestModel(body);
  if (model && isLocalCreativeMeshModel(model)) {
    const resolvedBody = await resolveLocalMeshEditSource(request, body);
    const response = await handleLocalMeshRequest(request, resolvedBody);
    const conversationId = requestConversationId(resolvedBody);
    if (response.ok && conversationId) {
      try {
        await syncConversationGeneratedMeshes(request, conversationId);
      } catch (error) {
        logError(error, {
          functionName: 'conversation-workspace-generated-meshes',
          statusCode: 500,
          conversationId,
          additionalContext: { operation: 'post_local_mesh_generation_sync' },
        });
      }
    }
    return response;
  }

  return handleFalMeshRequest(request);
}
