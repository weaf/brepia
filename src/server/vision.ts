import { createHash } from 'node:crypto';
import type {
  LanguageModelV3,
  LanguageModelV3FilePart,
  LanguageModelV3Message,
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultPart,
} from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';
import { PARAMETRIC_MODELS } from '../lib/utils';
import { env } from './env';
import { logWarning } from './serverLog';

const DEFAULT_VISION_URL = 'http://127.0.0.1:9292/v1/chat/completions';
const DEFAULT_FAST_VISION_MODEL = 'qwen-vision-8b';
const DEFAULT_DEEP_VISION_MODEL = 'qwen-vision-30b';
const VISION_TIMEOUT_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 128;

type VisionTransportKind = 'normal' | 'streaming-opencode' | 'cli-agent';
export type VisionAnalysisKind = 'reference' | 'inspection';

export type VisionAnalysisRequest = {
  kind: VisionAnalysisKind;
  images: string[];
  userRequest?: string;
  signal?: AbortSignal;
};

export type VisionAnalyzer = (
  request: VisionAnalysisRequest,
) => Promise<string | undefined>;

const visionCache = new Map<string, Promise<string | undefined>>();

function visionUrl(): string {
  return env('PCAD_VISION_BASE_URL').trim() || DEFAULT_VISION_URL;
}

function visionModel(kind: VisionAnalysisKind): string {
  const configured =
    kind === 'inspection'
      ? env('PCAD_VISION_DEEP_MODEL').trim()
      : env('PCAD_VISION_FAST_MODEL').trim();
  if (configured) return configured;
  return kind === 'inspection'
    ? DEFAULT_DEEP_VISION_MODEL
    : DEFAULT_FAST_VISION_MODEL;
}

function visionPrompt(kind: VisionAnalysisKind, userRequest?: string): string {
  const task = userRequest?.trim()
    ? `\nCurrent CAD request:\n${userRequest.trim()}`
    : '';

  if (kind === 'inspection') {
    return [
      'Analyze the attached pCAD/OpenSCAD multi-view render as a visual QA reviewer.',
      'Return concise factual observations for another CAD model that cannot see the image.',
      'Focus on overall shape, proportions, missing or disconnected parts, openings/cutouts, wall thickness, corner radii, symmetry, printability, collisions, hidden geometry, and obvious visual defects.',
      'Compare the render with the current CAD request when it is supplied.',
      'Do not generate OpenSCAD code. Do not guess details that are not visible.',
      task,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Analyze the attached reference image(s) for a CAD/OpenSCAD modeler.',
    'Return concise factual visual observations for another model that cannot see the images.',
    'Focus on geometry, silhouette, proportions, spatial relationships, major features, holes/cutouts, symmetry, visible dimensions/text, and details that matter when recreating or modifying the object.',
    'Do not generate OpenSCAD code. Distinguish visible facts from uncertain interpretation and do not invent hidden details.',
    task,
  ]
    .filter(Boolean)
    .join('\n');
}

function combinedSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(VISION_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function assistantText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
      const record = item as Record<string, unknown>;
      return record['type'] === 'text' && typeof record['text'] === 'string'
        ? record['text']
        : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function cacheKey(
  kind: VisionAnalysisKind,
  model: string,
  images: string[],
  userRequest?: string,
): string {
  const hash = createHash('sha256');
  hash.update(kind);
  hash.update('\0');
  hash.update(model);
  hash.update('\0');
  hash.update(userRequest ?? '');
  for (const image of images) {
    hash.update('\0');
    hash.update(image);
  }
  return hash.digest('hex');
}

function rememberVisionResult(
  key: string,
  value: Promise<string | undefined>,
): Promise<string | undefined> {
  if (visionCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = visionCache.keys().next().value as string | undefined;
    if (oldest) visionCache.delete(oldest);
  }
  visionCache.set(key, value);
  return value;
}

export const analyzeImagesWithVision: VisionAnalyzer = async ({
  kind,
  images,
  userRequest,
  signal,
}) => {
  if (images.length === 0) return undefined;

  const model = visionModel(kind);
  const key = cacheKey(kind, model, images, userRequest);
  const cached = visionCache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const apiKey = env('PCAD_VISION_API_KEY').trim();
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await fetch(visionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt(kind, userRequest) },
                ...images.map((url) => ({
                  type: 'image_url',
                  image_url: { url },
                })),
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: kind === 'inspection' ? 2400 : 1800,
        }),
        signal: combinedSignal(signal),
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}: ${raw.slice(0, 300)}`,
        );
      }

      const data = JSON.parse(raw) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const text = assistantText(data.choices?.[0]?.message?.content);
      if (!text) throw new Error('vision model returned no usable text');
      return text;
    } catch (error) {
      visionCache.delete(key);
      if (signal?.aborted) throw error;
      logWarning(
        `pCAD vision fallback failed (${model}): ${error instanceof Error ? error.message : String(error)}`,
        { functionName: 'pcad-vision-fallback' },
      );
      return undefined;
    }
  })();

  return rememberVisionResult(key, pending);
};

function dataUrlFromImageFile(part: LanguageModelV3FilePart): string | undefined {
  if (!part.mediaType.startsWith('image/')) return undefined;

  const { data } = part;
  if (data instanceof Uint8Array) {
    return `data:${part.mediaType};base64,${Buffer.from(data).toString('base64')}`;
  }
  if (data instanceof URL) {
    return data.protocol === 'data:' ? data.toString() : undefined;
  }
  if (typeof data !== 'string') return undefined;
  if (data.startsWith('data:')) return data;
  if (/^https?:\/\//i.test(data)) return undefined;
  return `data:${part.mediaType};base64,${data}`;
}

function toolImageDataUrl(
  item: Extract<
    Extract<LanguageModelV3ToolResultPart['output'], { type: 'content' }>['value'][number],
    { type: 'image-data' | 'image-url' | 'file-data' }
  >,
): string | undefined {
  if (item.type === 'image-data') {
    return item.data.startsWith('data:')
      ? item.data
      : `data:${item.mediaType};base64,${item.data}`;
  }
  if (item.type === 'image-url') {
    return item.url.startsWith('data:') ? item.url : undefined;
  }
  if (item.type === 'file-data' && item.mediaType.startsWith('image/')) {
    return item.data.startsWith('data:')
      ? item.data
      : `data:${item.mediaType};base64,${item.data}`;
  }
  return undefined;
}

function latestUserRequest(prompt: LanguageModelV3Prompt): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    const message = prompt[index];
    if (message.role !== 'user') continue;
    return message.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

type UserMessage = Extract<LanguageModelV3Message, { role: 'user' }>;
type AssistantMessage = Extract<LanguageModelV3Message, { role: 'assistant' }>;
type ToolMessage = Extract<LanguageModelV3Message, { role: 'tool' }>;

async function rewriteMultimodalMessage<T extends UserMessage | AssistantMessage>(
  message: T,
  analyzer: VisionAnalyzer,
  userRequest: string,
  signal?: AbortSignal,
): Promise<T> {
  const images = message.content.flatMap((part) => {
    if (part.type !== 'file') return [];
    const image = dataUrlFromImageFile(part);
    return image ? [image] : [];
  });
  if (images.length === 0) return message;

  const analysis = await analyzer({
    kind: 'reference',
    images,
    userRequest,
    signal,
  });
  const replacement = analysis
    ? `[pCAD vision fallback — visual reference]\n${analysis}`
    : '[pCAD vision fallback unavailable — visual reference could not be analyzed]';

  let inserted = false;
  const content = message.content.flatMap((part) => {
    if (part.type !== 'file' || !dataUrlFromImageFile(part)) return [part];
    if (inserted) return [];
    inserted = true;
    return [{ type: 'text' as const, text: replacement }];
  });

  return { ...message, content } as T;
}

async function rewriteToolResult(
  part: LanguageModelV3ToolResultPart,
  analyzer: VisionAnalyzer,
  userRequest: string,
  signal?: AbortSignal,
): Promise<LanguageModelV3ToolResultPart> {
  if (part.output.type !== 'content') return part;

  const images = part.output.value.flatMap((item) => {
    if (
      item.type !== 'image-data' &&
      item.type !== 'image-url' &&
      item.type !== 'file-data'
    ) {
      return [];
    }
    const image = toolImageDataUrl(item);
    return image ? [image] : [];
  });
  if (images.length === 0) return part;

  const analysis = await analyzer({
    kind: 'inspection',
    images,
    userRequest,
    signal,
  });
  const replacement = analysis
    ? `[pCAD vision fallback — rendered inspection]\n${analysis}`
    : '[pCAD vision fallback unavailable — rendered inspection could not be analyzed]';

  const retained = part.output.value.filter((item) => {
    if (
      item.type !== 'image-data' &&
      item.type !== 'image-url' &&
      item.type !== 'file-data'
    ) {
      return true;
    }
    return !toolImageDataUrl(item);
  });

  return {
    ...part,
    output: {
      ...part.output,
      value: [...retained, { type: 'text', text: replacement }],
    },
  };
}

async function rewriteToolMessage(
  message: ToolMessage,
  analyzer: VisionAnalyzer,
  userRequest: string,
  signal?: AbortSignal,
): Promise<ToolMessage> {
  return {
    ...message,
    content: await Promise.all(
      message.content.map((part) =>
        part.type === 'tool-result'
          ? rewriteToolResult(part, analyzer, userRequest, signal)
          : part,
      ),
    ),
  };
}

export async function rewritePromptForVisionFallback(
  prompt: LanguageModelV3Prompt,
  options: { analyzer?: VisionAnalyzer; signal?: AbortSignal } = {},
): Promise<LanguageModelV3Prompt> {
  const analyzer = options.analyzer ?? analyzeImagesWithVision;
  const userRequest = latestUserRequest(prompt);

  return Promise.all(
    prompt.map((message) => {
      switch (message.role) {
        case 'user':
        case 'assistant':
          return rewriteMultimodalMessage(
            message,
            analyzer,
            userRequest,
            options.signal,
          );
        case 'tool':
          return rewriteToolMessage(
            message,
            analyzer,
            userRequest,
            options.signal,
          );
        default:
          return message;
      }
    }),
  );
}

/**
 * Decide whether pCAD should preserve image parts for the selected model.
 * Explicit catalog/custom-provider capabilities are authoritative. Unknown
 * normal provider models stay direct so a newly-added multimodal model is not
 * accidentally downgraded; known text-only agents are handled explicitly.
 */
export function modelSupportsDirectVision(
  modelId: string,
  transportKind: VisionTransportKind,
  customSupportsVision?: boolean,
): boolean {
  if (transportKind !== 'normal') return false;
  if (customSupportsVision !== undefined) return customSupportsVision;
  if (
    modelId.startsWith('agent/codex/') ||
    modelId.startsWith('agent/opencode/') ||
    modelId.startsWith('opencode/')
  ) {
    return false;
  }

  const configured = PARAMETRIC_MODELS.find((model) => model.id === modelId);
  return configured ? configured.supportsVision === true : true;
}

/**
 * Wrap a LanguageModelV3 so image inputs are converted to Qwen3-VL textual
 * observations immediately before a text-only provider/agent is invoked.
 * Native multimodal models are never wrapped and therefore keep the original
 * image parts end-to-end.
 */
export function withVisionFallback(model: LanguageModel): LanguageModel {
  const v3 = model as LanguageModelV3;
  if (v3.specificationVersion !== 'v3') return model;

  return {
    ...v3,
    async doGenerate(options) {
      const prompt = await rewritePromptForVisionFallback(options.prompt, {
        signal: options.abortSignal,
      });
      return v3.doGenerate({ ...options, prompt });
    },
    async doStream(options) {
      const prompt = await rewritePromptForVisionFallback(options.prompt, {
        signal: options.abortSignal,
      });
      return v3.doStream({ ...options, prompt });
    },
  } as LanguageModel;
}
