import { Buffer } from 'node:buffer';
import {
  getCreativeMeshModelDefinition,
  isLocalCreativeMeshModel,
  type CreativeMeshModelId,
} from '@shared/creativeMeshModels';
import { imageIdFromFilename } from '@shared/imageRefs';
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
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_ALIAS_RE = /^image-(\d+)(?:\.[^.]+)?$/i;
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

type LocalMeshStage =
  | 'gateway-health'
  | 'job-create'
  | 'image-download'
  | 'mesh-download'
  | 'mesh-transform'
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

type MeshTransform = {
  scale: [number, number, number];
  label: string;
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

function imageIdsFromMessageParts(parts: unknown): string[] {
  if (!Array.isArray(parts)) return [];
  const ids: string[] = [];
  for (const part of parts) {
    if (!isRecord(part) || part.type !== 'file') continue;
    if (
      typeof part.mediaType === 'string' &&
      !part.mediaType.startsWith('image/')
    ) {
      continue;
    }
    const filename = typeof part.filename === 'string' ? part.filename : null;
    const imageId = imageIdFromFilename(filename);
    if (imageId && UUID_RE.test(imageId)) ids.push(imageId);
  }
  return Array.from(new Set(ids));
}

async function currentLeafImageIds(
  supabase: SupabaseClient,
  conversationId: string,
  leafMessageId: string | null | undefined,
): Promise<string[]> {
  if (!leafMessageId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('parts, role')
    .eq('id', leafMessageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve Creative reference images: ${error.message}`);
  }
  if (!data || data.role !== 'user') return [];
  return imageIdsFromMessageParts(data.parts);
}

function resolveRequestedImageIds(
  requested: string[],
  attachedImageIds: string[],
): string[] {
  if (requested.length === 0) return attachedImageIds;

  const resolved: string[] = [];
  for (const raw of requested) {
    if (UUID_RE.test(raw)) {
      resolved.push(raw);
      continue;
    }

    const filenameId = imageIdFromFilename(raw);
    if (filenameId && UUID_RE.test(filenameId)) {
      resolved.push(filenameId);
      continue;
    }

    const alias = raw.match(IMAGE_ALIAS_RE);
    if (alias) {
      const index = Number(alias[1]) - 1;
      if (Number.isInteger(index) && attachedImageIds[index]) {
        resolved.push(attachedImageIds[index]);
      }
    }
  }

  if (resolved.length === 0 && attachedImageIds.length === 1) {
    resolved.push(attachedImageIds[0]);
  }

  return Array.from(new Set(resolved));
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

function parseDeterministicMeshEdit(text: string | undefined): MeshTransform | null {
  if (!text) return null;
  const value = text.toLowerCase();
  let scaleX = 1;
  let scaleY = 1;
  let scaleZ = 1;
  const labels: string[] = [];

  const apply = (
    patterns: RegExp[],
    axis: 'x' | 'y' | 'z' | 'all',
    factor: number,
    label: string,
  ) => {
    if (!patterns.some((pattern) => pattern.test(value))) return;
    if (axis === 'x' || axis === 'all') scaleX *= factor;
    if (axis === 'y' || axis === 'all') scaleY *= factor;
    if (axis === 'z' || axis === 'all') scaleZ *= factor;
    labels.push(label);
  };

  apply([/\bwider\b/, /\bbroader\b/, /\bbredare\b/], 'x', 1.25, 'wider');
  apply([/\bnarrower\b/, /\bsmalare\b/], 'x', 0.8, 'narrower');
  apply([/\btaller\b/, /\bhigher\b/, /\bhögre\b/], 'y', 1.25, 'taller');
  apply([/\bshorter\b/, /\blägre\b/], 'y', 0.8, 'shorter');
  apply([/\bthicker\b/, /\bdeeper\b/, /\btjockare\b/, /\bdjupare\b/], 'z', 1.25, 'thicker');
  apply([/\bthinner\b/, /\bshallower\b/, /\btunnare\b/], 'z', 0.8, 'thinner');
  apply([/\bbigger\b/, /\blarger\b/, /\bstörre\b/], 'all', 1.2, 'larger');
  apply([/\bsmaller\b/, /\bmindre\b/], 'all', 0.8, 'smaller');

  if (labels.length === 0) return null;
  return { scale: [scaleX, scaleY, scaleZ], label: labels.join(', ') };
}

function paddedJsonChunk(value: unknown): Buffer {
  const raw = Buffer.from(JSON.stringify(value), 'utf8');
  const padding = (4 - (raw.length % 4)) % 4;
  return padding === 0 ? raw : Buffer.concat([raw, Buffer.alloc(padding, 0x20)]);
}

export function transformGlbScale(
  source: ArrayBuffer,
  scale: [number, number, number],
): ArrayBuffer {
  const input = Buffer.from(source);
  if (input.length < 20 || input.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('Source mesh is not a valid GLB file');
  }
  if (input.readUInt32LE(4) !== 2) {
    throw new Error('Only GLB version 2 is supported for local mesh edits');
  }

  const chunks: Array<{ type: number; data: Buffer }> = [];
  let offset = 12;
  while (offset + 8 <= input.length) {
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > input.length) throw new Error('Source GLB contains an invalid chunk');
    chunks.push({ type, data: input.subarray(start, end) });
    offset = end;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === GLB_JSON_CHUNK);
  if (!jsonChunk) throw new Error('Source GLB has no JSON chunk');

  const parsed = JSON.parse(
    jsonChunk.data.toString('utf8').replace(/[\u0000\u0020]+$/g, ''),
  ) as Record<string, unknown>;
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const sceneIndex = typeof parsed.scene === 'number' ? parsed.scene : 0;
  const scene = scenes[sceneIndex];
  if (!isRecord(scene)) throw new Error('Source GLB has no editable scene');

  const existingNodes = Array.isArray(scene.nodes)
    ? scene.nodes.filter((node): node is number => typeof node === 'number')
    : [];
  const wrapperIndex = nodes.length;
  nodes.push({
    name: 'pCAD deterministic mesh edit',
    children: existingNodes,
    scale,
  });
  scene.nodes = [wrapperIndex];
  parsed.nodes = nodes;
  parsed.scenes = scenes;

  const replacedJson = paddedJsonChunk(parsed);
  const rebuiltChunks = chunks.map((chunk) =>
    chunk.type === GLB_JSON_CHUNK ? { ...chunk, data: replacedJson } : chunk,
  );
  const totalLength =
    12 + rebuiltChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);

  offset = 12;
  for (const chunk of rebuiltChunks) {
    output.writeUInt32LE(chunk.data.length, offset);
    output.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(output, offset + 8);
    offset += 8 + chunk.data.length;
  }

  return output.buffer.slice(
    output.byteOffset,
    output.byteOffset + output.byteLength,
  ) as ArrayBuffer;
}

async function loadOwnedMeshBytes({
  supabase,
  userId,
  conversationId,
  sourceMeshId,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  sourceMeshId: string;
}): Promise<ArrayBuffer> {
  const { data: mesh, error } = await supabase
    .from('meshes')
    .select('id, file_type, status')
    .eq('id', sourceMeshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load source mesh metadata: ${error.message}`);
  if (!mesh) throw new Error('Source mesh was not found in this conversation');
  if (mesh.status !== 'success') throw new Error('Source mesh is not ready to edit');
  if (mesh.file_type !== 'glb') {
    throw new Error('Local Creative Mesh Editing v1 currently supports GLB sources only');
  }

  const { data, error: downloadError } = await supabase.storage
    .from('meshes')
    .download(`${userId}/${conversationId}/${sourceMeshId}.glb`);
  if (downloadError || !data) {
    throw new Error(
      `Failed to download source GLB${downloadError?.message ? `: ${downloadError.message}` : ''}`,
    );
  }
  return data.arrayBuffer();
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

async function editLocalMesh({
  supabase,
  userId,
  conversationId,
  meshId,
  sourceMeshId,
  model,
  transform,
}: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  meshId: string;
  sourceMeshId: string;
  model: CreativeMeshModelId;
  transform: MeshTransform;
}) {
  let stage: LocalMeshStage = 'mesh-download';
  try {
    localMeshLog(stage, 'loading source GLB for deterministic edit', {
      meshId,
      sourceMeshId,
      transform: transform.label,
    });
    const source = await loadOwnedMeshBytes({
      supabase,
      userId,
      conversationId,
      sourceMeshId,
    });

    stage = 'mesh-transform';
    const edited = transformGlbScale(source, transform.scale);
    localMeshLog(stage, 'applied deterministic GLB transform', {
      meshId,
      sourceMeshId,
      scale: transform.scale,
    });

    stage = 'storage-persist';
    await persistLocalMeshResult({
      supabase,
      userId,
      conversationId,
      meshId,
      bytes: edited,
    });
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
    throw error;
  }
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
    throw error;
  }
}

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
    .select('id, current_message_leaf_id')
    .eq('id', conversationId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (conversationError || !conversation) {
    return localError('Conversation not found', 404);
  }

  const text = body.text?.trim() || undefined;
  const transform = body.mesh ? parseDeterministicMeshEdit(text) : null;

  if (body.mesh && !transform) {
    return localError(
      'Local Creative Mesh Editing v1 supports whole-mesh geometric edits such as wider, narrower, taller, shorter, thicker, thinner, larger, or smaller. Semantic/localized mesh edits are not supported yet.',
      422,
    );
  }

  let attachedImageIds: string[] = [];
  if (!body.mesh) {
    try {
      attachedImageIds = await currentLeafImageIds(
        supabase,
        conversationId,
        conversation.current_message_leaf_id,
      );
    } catch (error) {
      return localError(errorMessage(error), 500);
    }
  }

  const requestedImageIds = Array.isArray(body.images) ? body.images : [];
  const imageIds = body.mesh
    ? []
    : resolveRequestedImageIds(requestedImageIds, attachedImageIds);

  if (requestedImageIds.length > 0 && !body.mesh) {
    localMeshLog('job-create', 'resolved Creative image references', {
      model,
      conversationId,
      requestedImages: requestedImageIds,
      attachedImageCount: attachedImageIds.length,
      resolvedImageCount: imageIds.length,
    });
  }

  if (!body.mesh) {
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
  }

  localMeshLog('job-create', body.mesh ? 'creating local mesh edit job' : 'creating local mesh generation job', {
    model,
    conversationId,
    imageCount: imageIds.length,
    sourceMeshId: body.mesh,
    transform: transform?.label,
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
        ...(transform ? { transform: { scale: transform.scale, label: transform.label } } : {}),
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

  try {
    if (body.mesh && transform) {
      await editLocalMesh({
        supabase,
        userId: userData.user.id,
        conversationId,
        meshId: meshData.id,
        sourceMeshId: body.mesh,
        model,
        transform,
      });
    } else {
      await generateLocalMesh({
        supabase,
        userId: userData.user.id,
        conversationId,
        meshId: meshData.id,
        model,
        text,
        imageIds,
        meshTopology: body.meshTopology,
        polygonCount: body.polygonCount,
      });
    }
  } catch (error) {
    return localError(errorMessage(error), 500);
  }

  return jsonResponse({ id: meshData.id, fileType: 'glb' }, 200);
}
