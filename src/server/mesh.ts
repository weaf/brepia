import {
  isLocalCreativeMeshModel,
  isNativeTrellis2Model,
} from '@shared/creativeMeshModels';
import { corsHeaders } from './api';
import { scheduleActiveGenerationCancellation } from './activeGeneration';
import { syncConversationGeneratedMeshes } from './conversationWorkspaceGeneratedMeshes';
import { handleMeshRequest as handleFalMeshRequest } from './falMesh';
import { createInFlightRequestDeduper } from './inFlightRequestDeduper';
import { handleLocalMeshRequest } from './localMesh';
import { handleNativeCreativeMeshRequest } from './nativeCreativeMesh';
import { logError } from './serverLog';

type ResponseSnapshot = {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
};

type LocalMeshHandler = (
  request: Request,
  parsedBody?: unknown,
) => Promise<Response>;

const localMeshRequests = createInFlightRequestDeduper<ResponseSnapshot>();

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

function localMeshHandler(model: string): LocalMeshHandler {
  return isNativeTrellis2Model(model)
    ? handleNativeCreativeMeshRequest
    : handleLocalMeshRequest;
}

function localMeshRequestKey(
  request: Request,
  conversationId: string,
  model: string,
): string | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return null;

  // A conversation is intentionally single-flight for a selected local mesh
  // backend. Android/Chrome can drop the SSE connection while backgrounded;
  // the reconnect then starts the same Creative turn again before the first
  // local 3D call has finished. Include auth + conversation + backend so that
  // reconnect shares the existing job without allowing another user to
  // piggy-back on it. This applies to both the legacy gateway and TRELLIS.2.
  return `${authorization}\n${conversationId}\n${model}`;
}

async function snapshotResponse(response: Response): Promise<ResponseSnapshot> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    body: await response.text(),
    headers,
    status: response.status,
    statusText: response.statusText,
  };
}

function responseFromSnapshot(snapshot: ResponseSnapshot): Response {
  return new Response(snapshot.body, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  });
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

async function executeLocalMeshRequest(
  request: Request,
  body: unknown,
  conversationId: string,
  handler: LocalMeshHandler,
): Promise<ResponseSnapshot> {
  const response = await handler(request, body);
  if (response.ok) {
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
  } else {
    // Local backend/config/runtime failures are terminal for this Creative
    // turn. AI SDK otherwise feeds the tool error straight back to the LLM
    // and the model can immediately call create_mesh again, creating an
    // expensive failure loop. Let the current tool-error part finish first,
    // then abort the active multi-step generation before another backend job
    // can start. The user can explicitly retry after fixing the runtime.
    scheduleActiveGenerationCancellation(conversationId);
  }
  return snapshotResponse(response);
}

/**
 * Stable entry point for Creative mesh generation.
 *
 * Historical `fast` / `quality` / `ultra` requests keep using the unchanged
 * fal.ai implementation in `falMesh.ts`. Transitional local TRELLIS v1 and
 * Hunyuan IDs continue through the existing pCAD mesh gateway. `local/trellis2`
 * instead uses the llama-swap managed Z-Image-Turbo/TRELLIS.2 runtime path.
 *
 * Local Creative follow-up mesh editing remains deferred and is rejected here
 * rather than silently regenerating or claiming an edit succeeded.
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

    const handler = localMeshHandler(model);
    const conversationId = requestConversationId(body);
    if (!conversationId) {
      return handler(request, body);
    }

    const key = localMeshRequestKey(request, conversationId, model);
    if (!key) {
      return responseFromSnapshot(
        await executeLocalMeshRequest(request, body, conversationId, handler),
      );
    }

    const { promise, reused } = localMeshRequests.getOrRun(key, () =>
      executeLocalMeshRequest(request, body, conversationId, handler),
    );
    if (reused) {
      console.info('[local-mesh] reusing in-flight generation after reconnect', {
        conversationId,
        model,
      });
    }
    return responseFromSnapshot(await promise);
  }

  return handleFalMeshRequest(request);
}
