import { isLocalCreativeMeshModel } from '@shared/creativeMeshModels';
import { handleMeshRequest as handleFalMeshRequest } from './falMesh';
import { handleLocalMeshRequest } from './localMesh';

function requestModel(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const model = (body as Record<string, unknown>).model;
  return typeof model === 'string' ? model : null;
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
    return handleLocalMeshRequest(request, body);
  }

  return handleFalMeshRequest(request);
}
