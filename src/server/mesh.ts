import { isLocalCreativeMeshModel } from '@shared/creativeMeshModels';
import { corsHeaders } from './api';
import { syncConversationGeneratedMeshes } from './conversationWorkspaceGeneratedMeshes';
import { handleMeshRequest as handleFalMeshRequest } from './falMesh';
import { handleLocalMeshRequest } from './localMesh';
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

function requestMeshId(body: unknown): string | null {
  const record = recordBody(body);
  const meshId = record?.mesh;
  return typeof meshId === 'string' && meshId ? meshId : null;
}

function localMeshEditingDeferredResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        message:
          'Follow-up editing of locally generated Creative meshes is not enabled yet. Create a new local mesh generation instead.',
      },
    }),
    {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

/**
 * Stable entry point for Creative mesh generation.
 *
 * Historical `fast` / `quality` / `ultra` requests keep using the unchanged
 * fal.ai implementation in `falMesh.ts`. Local backend IDs are handled by the
 * pCAD local mesh gateway and never require FAL_KEY.
 *
 * Local Creative v1 intentionally supports generation only. The experimental
 * follow-up mesh-edit path is deferred and rejected here rather than silently
 * regenerating or claiming an edit succeeded.
 */
export async function handleMeshRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return handleFalMeshRequest(request);
  }

  const body = await request.clone().json().catch(() => null);
  const model = requestModel(body);
  if (model && isLocalCreativeMeshModel(model)) {
    if (requestMeshId(body)) {
      return localMeshEditingDeferredResponse();
    }

    const response = await handleLocalMeshRequest(request, body);
    const conversationId = requestConversationId(body);
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
