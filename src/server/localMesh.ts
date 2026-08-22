import { Buffer } from 'node:buffer';
import {
  getCreativeMeshModelDefinition,
  isLocalCreativeMeshModel,
  type CreativeMeshModelId,
} from '@shared/creativeMeshModels';
import type { MeshFileType } from '@shared/types';
import { corsHeaders, isRecord } from './api';
import { env } from './env';
import {
  getServiceRoleSupabaseClient,
  type SupabaseClient,
} from './supabaseClient';
import { logError } from './serverLog';

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8180';
const GENERATION_TIMEOUT_MS = 30 * 60_000;
const HEALTH_TIMEOUT_MS = 3_000;

type LocalMeshStage =
  | 'gateway-health'
  | 'job-create'
  | 'image-download'
  | 'gateway-generate'
  | 'storage-persist';

type LocalMeshRequestBody = {
  images?: string[];
  mesh?: string;
  text?: string;
  conversationId?: string;
  model?: string;
  meshTopology?: 'quads' | 'polys';
  polygonCount?: number;
};

type LocalGatewayHealth = {
  status?: string;
  models?: Record<
    string,
    { installed?: boolean; available?: boolean; reason?: string }
  >;
};

function gatewayUrl(): string {
  return (env('PCAD_MESH_GATEWAY_URL') || DEFAULT_GATEWAY_URL).replace(
    /\/+$/,
    '',
  );
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function localError(message: string, status = 400): Response {
  return jsonResponse({ error: { message } }, status);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function localMeshLog(
  stage: LocalMeshStage,
  message: string,
  context: Record<string, unknown> = {},
) {
  console.log('[local-mesh]', { stage, message, ...context });
}

function runBackgroundTask(task: Promise<unknown>) {
  const loggedTask = task.catch((error) => {
    console.error('[local-mesh] background task failed:', error);
  });
  const requestContext = Reflect.get(
    globalThis,
    Symbol.for('@vercel/request-context'),
  );
  if (isRecord(requestContext) && typeof requestContext.get === 'function') {
    const context = requestContext.get();
    if (isRecord(context) && typeof context.waitUntil === 'function') {
      context.waitUntil(loggedTask);
      return;
    }
  }
  void loggedTask;
}

async function gatewayHealth(model: CreativeMeshModelId): Promise<void> {
  const baseUrl = gatewayUrl();
  localMeshLog('gateway-health', 'checking local mesh gateway', {
    model,
    gatewayUrl: baseUrl,
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Local mesh gateway is not running at ${baseUrl}. Run ./scripts/install-local-mesh-backends.sh and start pcad-mesh-gateway.service. (${errorMessage(error)})`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Local mesh gateway health check failed: HTTP ${response.status}`,
    );
  }

  const health = (await response
    .json()
    .catch(() => ({}))) as LocalGatewayHealth;
  const modelHealth = health.models?.[model];
  if (modelHealth?.installed === false || modelHealth?.available === false) {
    throw new Error(
      modelHealth.reason ||
        `${getCreativeMeshModelDefinition(model)?.name ?? model} is not ready. Re-run ./scripts/install-local-mesh-backends.sh.`,
    );
  }
  localMeshLog('gateway-health', 'gateway ready', { model });
}

async function ownedMeshImageIds(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  meshId: string | undefined,
): Promise<string[]> {
  if (!meshId) return [];
  const { data, error } = await supabase
    .from('meshes')
    .select('images')
    .eq('id', meshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load source mesh: ${error.message}`);
  if (!data || !Array.isArray(data.images)) return [];
  return data.images.filter(
    (value): value is string => typeof value === 'string',
  );
}

async function imageDataUrl(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  imageId: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('images')
    .download(`${userId}/${conversationId}/${imageId}`);
  if (error || !data) {
    throw new Error(
      `Failed to load Creative reference image ${imageId}${error?.message ? `: ${error.message}` : ''}`,
    );
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  const mediaType = data.type || 'image/png';
  return `data:${mediaType};base64,${bytes.toString('base64')}`;
}

async function persistLocalMeshResult({
  supabase,
  userId,
  conversationId,
  meshId,
  bytes,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  meshId: string;
  bytes: ArrayBuffer;
}) {
  const { error: uploadError } = await supabase.storage
    .from('meshes')
    .upload(`${userId}/${conversationId}/${meshId}.glb`, bytes, {
      contentType: 'model/gltf-binary',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Failed to store local mesh: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('meshes')
    .update({ status: 'success', file_type: 'glb' })
    .eq('id', meshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);
  if (updateError) {
    throw new Error(`Failed to finalize local mesh: ${updateError.message}`);
  }
}

async function markLocalMeshFailure(
  supabase: SupabaseClient,
  meshId: string,
  userId: string,
  conversationId: string,
  model: CreativeMeshModelId,
  stage: LocalMeshStage,
  error: unknown,
) {
  console.error('[local-mesh] generation failed', {
    stage,
    model,
    meshId,
    conversationId,
    error: errorMessage(error),
  });
  logError(error, {
    functionName: 'local-mesh',
    statusCode: 500,
    userId,
    conversationId,
    additionalContext: { meshId, model, stage },
  });
  await supabase
    .from('meshes')
    .update({ status: 'failure' })
    .eq('id', meshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);
}

async function generateLocalMesh({
  supabase,
  userId,
  conversationId,
  meshId,
  model,
  text,
  imageIds,
  meshTopology,
  polygonCount,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  meshId: string;
  model: CreativeMeshModelId;
  text?: string;
  imageIds: string[];
  meshTopology?: 'quads' | 'polys';
  polygonCount?: number;
}) {
  let stage: LocalMeshStage = 'image-download';
  try {
    localMeshLog(stage, 'loading Creative reference images', {
      model,
      meshId,
      imageCount: imageIds.length,
    });
    const images = await Promise.all(
      imageIds.map((imageId) =>
        imageDataUrl(supabase, userId, conversationId, imageId),
      ),
    );
    localMeshLog(stage, 'reference images loaded', {
      model,
      meshId,
      imageCount: images.length,
    });

    stage = 'gateway-generate';
    localMeshLog(stage, 'starting local mesh generation', {
      model,
      meshId,
      gatewayUrl: gatewayUrl(),
    });
    const response = await fetch(`${gatewayUrl()}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text?.trim() || undefined,
        images,
        topology: meshTopology,
        polygonCount,
        outputFormat: 'glb',
      }),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail =
        isRecord(body) && typeof body.error === 'string'
          ? body.error
          : isRecord(body) && typeof body.detail === 'string'
            ? body.detail
            : `HTTP ${response.status}`;
      throw new Error(`Local mesh generation failed: ${detail}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !contentType.includes('model/gltf-binary') &&
      !contentType.includes('application/octet-stream')
    ) {
      throw new Error(
        `Local mesh gateway returned unexpected content type: ${contentType || 'missing'}`,
      );
    }

    stage = 'storage-persist';
    localMeshLog(stage, 'persisting generated GLB', { model, meshId });
    await persistLocalMeshResult({
      supabase,
      userId,
      conversationId,
      meshId,
      bytes: await response.arrayBuffer(),
    });
    localMeshLog(stage, 'local mesh generation completed', { model, meshId });
  } catch (error) {
    await markLocalMeshFailure(
      supabase,
      meshId,
      userId,
      conversationId,
      model,
      stage,
      error,
    );
  }
}

/**
 * Local Creative equivalent of the legacy fal.ai mesh handler.
 * Authentication and ownership remain in pCAD; only sanitized prompt/image
 * payloads are sent over loopback to the local mesh gateway.
 */
export async function handleLocalMeshRequest(
  request: Request,
  parsedBody?: unknown,
): Promise<Response> {
  const body = (isRecord(parsedBody)
    ? parsedBody
    : await request.json().catch(() => null)) as LocalMeshRequestBody | null;
  if (!body) return localError('Invalid local mesh request body');

  const model = body.model;
  if (!model || !isLocalCreativeMeshModel(model)) {
    return localError('Unknown local Creative mesh backend');
  }
  const definition = getCreativeMeshModelDefinition(model);
  if (!definition) return localError('Unknown local Creative mesh backend');

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return localError('Unauthorized', 401);

  const supabase = getServiceRoleSupabaseClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) return localError('Unauthorized', 401);

  const conversationId = body.conversationId;
  if (!conversationId) return localError('Conversation ID is required');

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (conversationError || !conversation) {
    return localError('Conversation not found', 404);
  }

  const sourceMeshImages = await ownedMeshImageIds(
    supabase,
    userData.user.id,
    conversationId,
    body.mesh,
  );
  const imageIds = Array.from(
    new Set([
      ...(Array.isArray(body.images) ? body.images : []),
      ...sourceMeshImages,
    ]),
  );
  const text = body.text?.trim() || undefined;

  if (definition.requiresReferenceImage && imageIds.length === 0) {
    return localError(
      `${definition.name} requires a reference image. Add an image or choose TRELLIS v1 for text-to-3D.`,
    );
  }
  if (!text && imageIds.length === 0) {
    return localError(
      'Text or a reference image is required for local mesh generation',
    );
  }
  if (text && imageIds.length === 0 && !definition.supportsText) {
    return localError(
      `${definition.name} does not support text-only generation. Add a reference image or choose TRELLIS v1.`,
    );
  }

  try {
    await gatewayHealth(model);
  } catch (error) {
    console.error('[local-mesh] request rejected', {
      stage: 'gateway-health',
      model,
      conversationId,
      error: errorMessage(error),
    });
    return localError(errorMessage(error), 503);
  }

  localMeshLog('job-create', 'creating local mesh job', {
    model,
    conversationId,
    imageCount: imageIds.length,
  });
  const { data: meshData, error: meshError } = await supabase
    .from('meshes')
    .insert({
      user_id: userData.user.id,
      images: imageIds.length > 0 ? imageIds : null,
      conversation_id: conversationId,
      file_type: 'glb' as MeshFileType,
      prompt: {
        ...(text ? { text } : {}),
        ...(imageIds.length > 0 ? { images: imageIds } : {}),
        ...(body.mesh ? { mesh: body.mesh } : {}),
        model,
      },
    })
    .select()
    .single();

  if (meshError || !meshData) {
    console.error('[local-mesh] request rejected', {
      stage: 'job-create',
      model,
      conversationId,
      error: meshError?.message ?? 'Failed to create local mesh job',
    });
    return localError(
      meshError?.message ?? 'Failed to create local mesh job',
      500,
    );
  }
  localMeshLog('job-create', 'local mesh job created', {
    model,
    conversationId,
    meshId: meshData.id,
  });

  runBackgroundTask(
    generateLocalMesh({
      supabase,
      userId: userData.user.id,
      conversationId,
      meshId: meshData.id,
      model,
      text,
      imageIds,
      meshTopology: body.meshTopology,
      polygonCount: body.polygonCount,
    }),
  );

  return jsonResponse({ id: meshData.id, fileType: 'glb' }, 200);
}
