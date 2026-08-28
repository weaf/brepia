import { Buffer } from 'node:buffer';
import {
  NATIVE_TRELLIS2_MODEL_ID,
  type CreativeMeshModelId,
} from '@shared/creativeMeshModels';
import { imageIdFromFilename } from '@shared/imageRefs';
import type { MeshFileType } from '@shared/types';
import { corsHeaders, isRecord } from './api';
import { env } from './env';
import { logError } from './serverLog';
import {
  getServiceRoleSupabaseClient,
  type SupabaseClient,
} from './supabaseClient';

const DEFAULT_LLAMA_SWAP_URL = 'http://127.0.0.1:9292';
const DEFAULT_Z_IMAGE_MODEL_ID = 'creative/z-image-turbo';
const DEFAULT_TRELLIS2_MODEL_ID = 'creative/trellis2';
const HEALTH_TIMEOUT_MS = 5_000;
const IMAGE_GENERATION_TIMEOUT_MS = 10 * 60_000;
const MESH_GENERATION_TIMEOUT_MS = 30 * 60_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_ALIAS_RE = /^image-(\d+)(?:\.[^.]+)?$/i;

type NativeCreativeStage =
  | 'llama-swap-health'
  | 'job-create'
  | 'image-download'
  | 'z-image-generate'
  | 'trellis-generate'
  | 'storage-persist';

type NativeCreativeMeshRequestBody = {
  images?: string[];
  mesh?: string;
  text?: string;
  conversationId?: string;
  model?: string;
};

type ImageInput = {
  bytes: ArrayBuffer;
  mediaType: string;
  filename: string;
};

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

function nativeCreativeLog(
  stage: NativeCreativeStage,
  message: string,
  context: Record<string, unknown> = {},
) {
  console.log('[native-creative-mesh]', { stage, message, ...context });
}

function llamaSwapUrl(): string {
  return (env('PCAD_LLAMA_SWAP_URL') || DEFAULT_LLAMA_SWAP_URL).replace(
    /\/+$/,
    '',
  );
}

function zImageModelId(): string {
  return env('PCAD_Z_IMAGE_MODEL_ID') || DEFAULT_Z_IMAGE_MODEL_ID;
}

function trellis2ModelId(): string {
  return env('PCAD_TRELLIS2_MODEL_ID') || DEFAULT_TRELLIS2_MODEL_ID;
}

function llamaSwapHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = env('PCAD_LLAMA_SWAP_API_KEY').trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function encodedModelPath(modelId: string): string {
  return modelId.split('/').map(encodeURIComponent).join('/');
}

function trellisResolution(): '512' | '1024' | '1536' {
  const configured = env('PCAD_TRELLIS2_RESOLUTION').trim();
  return configured === '512' || configured === '1536' ? configured : '1024';
}

function zImageSize(): string {
  const configured = env('PCAD_Z_IMAGE_SIZE').trim();
  return /^\d{3,4}x\d{3,4}$/.test(configured) ? configured : '1024x1024';
}

async function responseFailureDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed)) {
      if (typeof parsed.error === 'string') return parsed.error;
      if (typeof parsed.detail === 'string') return parsed.detail;
      if (isRecord(parsed.error) && typeof parsed.error.message === 'string') {
        return parsed.error.message;
      }
    }
  } catch {
    // Keep the upstream text below.
  }
  return text.slice(0, 1000);
}

async function ensureLlamaSwapModels(requiredModelIds: string[]): Promise<void> {
  const baseUrl = llamaSwapUrl();
  nativeCreativeLog('llama-swap-health', 'checking llama-swap model catalog', {
    llamaSwapUrl: baseUrl,
    requiredModelIds,
  });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/models`, {
      headers: llamaSwapHeaders(),
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `llama-swap is not reachable at ${baseUrl}. Start llama-swap with the Creative runtime models configured. (${errorMessage(error)})`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `llama-swap model discovery failed: ${await responseFailureDetail(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('llama-swap returned an invalid /v1/models response');
  }

  const available = new Set(
    payload.data
      .filter(isRecord)
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string'),
  );
  const missing = requiredModelIds.filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw new Error(
      `llama-swap is running but missing Creative runtime model${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
    );
  }
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
    throw new Error(
      `Failed to resolve Creative reference images: ${error.message}`,
    );
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

async function downloadReferenceImage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  imageId: string,
): Promise<ImageInput> {
  const { data, error } = await supabase.storage
    .from('images')
    .download(`${userId}/${conversationId}/${imageId}`);
  if (error || !data) {
    throw new Error(
      `Failed to load Creative reference image ${imageId}${error?.message ? `: ${error.message}` : ''}`,
    );
  }
  return {
    bytes: await data.arrayBuffer(),
    mediaType: data.type || 'image/png',
    filename: `reference-${imageId}.png`,
  };
}

async function generateConditioningImage(prompt: string): Promise<ImageInput> {
  const model = zImageModelId();
  nativeCreativeLog('z-image-generate', 'generating TRELLIS conditioning image', {
    model,
    size: zImageSize(),
  });

  const response = await fetch(`${llamaSwapUrl()}/v1/images/generations`, {
    method: 'POST',
    headers: llamaSwapHeaders(true),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: zImageSize(),
      output_format: 'png',
    }),
    signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Z-Image-Turbo generation failed: ${await responseFailureDetail(response)}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Z-Image-Turbo returned an invalid image response');
  }
  const first = payload.data[0];
  if (!isRecord(first) || typeof first.b64_json !== 'string') {
    throw new Error('Z-Image-Turbo response did not contain base64 image data');
  }

  const decoded = Buffer.from(first.b64_json, 'base64');
  if (decoded.length === 0) {
    throw new Error('Z-Image-Turbo returned an empty conditioning image');
  }
  const bytes = Uint8Array.from(decoded);
  return {
    bytes: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    mediaType: 'image/png',
    filename: 'z-image-conditioning.png',
  };
}

async function generateTrellisGlb(image: ImageInput): Promise<ArrayBuffer> {
  const model = trellis2ModelId();
  const form = new FormData();
  form.append(
    'image',
    new Blob([image.bytes], { type: image.mediaType }),
    image.filename,
  );
  form.append('resolution', trellisResolution());

  const url = `${llamaSwapUrl()}/upstream/${encodedModelPath(model)}/generate`;
  nativeCreativeLog('trellis-generate', 'starting TRELLIS.2 generation', {
    model,
    resolution: trellisResolution(),
    via: url,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: llamaSwapHeaders(),
    body: form,
    signal: AbortSignal.timeout(MESH_GENERATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `TRELLIS.2 generation failed: ${await responseFailureDetail(response)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (
    !contentType.includes('model/gltf-binary') &&
    !contentType.includes('application/octet-stream')
  ) {
    throw new Error(
      `TRELLIS.2 returned unexpected content type: ${contentType || 'missing'}`,
    );
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 12) {
    throw new Error('TRELLIS.2 returned an empty or invalid GLB');
  }
  return bytes;
}

async function persistMeshResult({
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
    throw new Error(`Failed to store TRELLIS.2 mesh: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('meshes')
    .update({ status: 'success', file_type: 'glb' })
    .eq('id', meshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);
  if (updateError) {
    throw new Error(`Failed to finalize TRELLIS.2 mesh: ${updateError.message}`);
  }
}

async function markFailure(
  supabase: SupabaseClient,
  meshId: string,
  userId: string,
  conversationId: string,
  stage: NativeCreativeStage,
  error: unknown,
) {
  console.error('[native-creative-mesh] generation failed', {
    stage,
    meshId,
    conversationId,
    error: errorMessage(error),
  });
  logError(error, {
    functionName: 'native-creative-mesh',
    statusCode: 500,
    userId,
    conversationId,
    additionalContext: {
      meshId,
      model: NATIVE_TRELLIS2_MODEL_ID,
      stage,
    },
  });
  await supabase
    .from('meshes')
    .update({ status: 'failure' })
    .eq('id', meshId)
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);
}

export async function handleNativeCreativeMeshRequest(
  request: Request,
  parsedBody?: unknown,
): Promise<Response> {
  const body = (
    isRecord(parsedBody) ? parsedBody : await request.json().catch(() => null)
  ) as NativeCreativeMeshRequestBody | null;
  if (!body) return localError('Invalid TRELLIS.2 request body');
  if (body.model !== NATIVE_TRELLIS2_MODEL_ID) {
    return localError('Unknown native Creative mesh backend');
  }
  if (body.mesh) {
    return localError(
      'Follow-up editing of locally generated Creative meshes is not enabled yet.',
      422,
    );
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;
  if (!token) return localError('Unauthorized', 401);

  const supabase = getServiceRoleSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
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
  let attachedImageIds: string[];
  try {
    attachedImageIds = await currentLeafImageIds(
      supabase,
      conversationId,
      conversation.current_message_leaf_id,
    );
  } catch (error) {
    return localError(errorMessage(error), 500);
  }

  const requestedImageIds = Array.isArray(body.images) ? body.images : [];
  const imageIds = resolveRequestedImageIds(requestedImageIds, attachedImageIds);
  if (!text && imageIds.length === 0) {
    return localError('Text or a reference image is required for TRELLIS.2');
  }
  if (imageIds.length > 1) {
    return localError(
      'TRELLIS.2 currently accepts one reference image per generation. Attach or select a single image.',
      422,
    );
  }

  const requiredRuntimeModels = [trellis2ModelId()];
  if (imageIds.length === 0) requiredRuntimeModels.unshift(zImageModelId());
  try {
    await ensureLlamaSwapModels(requiredRuntimeModels);
  } catch (error) {
    return localError(errorMessage(error), 503);
  }

  nativeCreativeLog('job-create', 'creating TRELLIS.2 mesh job', {
    conversationId,
    imageCount: imageIds.length,
    usesZImage: imageIds.length === 0,
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
        model: NATIVE_TRELLIS2_MODEL_ID as CreativeMeshModelId,
      },
    })
    .select()
    .single();

  if (meshError || !meshData) {
    return localError(meshError?.message ?? 'Failed to create TRELLIS.2 mesh job', 500);
  }

  let stage: NativeCreativeStage = 'image-download';
  try {
    let conditioningImage: ImageInput;
    if (imageIds.length > 0) {
      nativeCreativeLog(stage, 'loading TRELLIS.2 reference image', {
        meshId: meshData.id,
        imageId: imageIds[0],
      });
      conditioningImage = await downloadReferenceImage(
        supabase,
        userData.user.id,
        conversationId,
        imageIds[0],
      );
      if (text) {
        nativeCreativeLog(
          stage,
          'reference image takes precedence over text conditioning for this generation',
          { meshId: meshData.id },
        );
      }
    } else {
      stage = 'z-image-generate';
      conditioningImage = await generateConditioningImage(text as string);
    }

    stage = 'trellis-generate';
    const glb = await generateTrellisGlb(conditioningImage);

    stage = 'storage-persist';
    await persistMeshResult({
      supabase,
      userId: userData.user.id,
      conversationId,
      meshId: meshData.id,
      bytes: glb,
    });
    nativeCreativeLog(stage, 'TRELLIS.2 generation completed', {
      meshId: meshData.id,
      conversationId,
    });
  } catch (error) {
    await markFailure(
      supabase,
      meshData.id,
      userData.user.id,
      conversationId,
      stage,
      error,
    );
    return localError(errorMessage(error), 500);
  }

  return jsonResponse({ id: meshData.id, fileType: 'glb' }, 200);
}
