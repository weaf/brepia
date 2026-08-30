import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { chatTools, type AppUIMessage, type AppTools } from '@shared/chatAi';
import {
  isAiInstructionProfileId,
  loadBundledInstruction,
  renderInstructionTemplate,
} from '@shared/aiInstructionCatalog';
import { cleanAssistantText, getParametricText } from '@shared/parametricParts';
import { imageIdFromFilename, imageStoragePath } from '@shared/imageRefs';
import { normalizeConversationSuggestions } from '@shared/suggestions';
import { normalizeModelId } from '@shared/models';
import {
  opencodeChatModel,
  streamingOpencodeChatModel,
  type OpenCodeRuntimeOptions,
} from '@/server/opencode';
import { buildCustomChatModel } from '@/server/customProviders';
import { isCustomProviderModel } from '@shared/customModelIds';
import type { Conversation, Message, MeshFileType, Model } from '@shared/types';
import {
  convertToModelMessages,
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  hasToolCall,
  Output,
  smoothStream,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessageStreamWriter,
} from 'ai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import imageType from 'image-type';
import { z } from 'zod';
import { corsHeaders, isRecord } from './api';
import {
  loadBuiltinProviderRuntimeOverrides,
  type BuiltinProviderDriver,
  type BuiltinProviderRuntimeOverrides,
} from './builtinProviderOverrides';
import { env } from './env';
import { logError } from './serverLog';
import { isRequestAbort } from './requestAbort';
import {
  decidePersistAction,
  hasPendingClientToolCall,
  isDanglingToolPart,
  resolveDanglingToolParts,
} from './chatToolPersistence';
import { handleMeshRequest } from './mesh';
import {
  cliAgentChatModel,
  isCliAgentModel,
  selectChatTransport,
} from './cliAgents';
import { getAnonSupabaseClient } from './supabaseClient';
import { resolveConversationSystemPrompt } from './promptProfiles';
import { resolveCreativeAgentModel } from './creativeAgentModel';
import { createUserAiRuntimeContext } from './aiInstructionRuntime';
import {
  beginActiveGeneration,
  cancelActiveGeneration,
} from './activeGeneration';
import { modelSupportsDirectVision, withVisionFallback } from './vision';

export const PARAMETRIC_AGENT_PROMPT = loadBundledInstruction('parametric');
export const CREATIVE_AGENT_PROMPT = loadBundledInstruction('creative');

type ChatBody = {
  conversationId: string;
  model: Model;
  agentModel?: Model;
  thinking?: boolean;
  openCodeExecutionMode?: 'cli' | 'streaming';
};

type ChatRequestBody =
  | { kind: 'generate'; body: ChatBody }
  | { kind: 'cancel'; conversationId: string };

type ConversationAccess = Pick<
  Conversation,
  'id' | 'type' | 'user_id' | 'current_message_leaf_id' | 'settings'
>;

function isChatBody(value: unknown): value is ChatBody {
  return (
    isRecord(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.model === 'string' &&
    (value.agentModel == null || typeof value.agentModel === 'string') &&
    (value.thinking == null || typeof value.thinking === 'boolean') &&
    (value.openCodeExecutionMode == null ||
      value.openCodeExecutionMode === 'cli' ||
      value.openCodeExecutionMode === 'streaming')
  );
}

function parseChatRequestBody(value: unknown): ChatRequestBody | null {
  if (
    isRecord(value) &&
    value.action === 'cancel' &&
    typeof value.conversationId === 'string'
  ) {
    return { kind: 'cancel', conversationId: value.conversationId };
  }

  return isChatBody(value) ? { kind: 'generate', body: value } : null;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type ChatProvider =
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'local'
  | 'opencode'
  | 'cli-agent';

function providerFor(modelId: string): ChatProvider {
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('google/')) return 'google';
  if (modelId.startsWith('local/')) return 'local';
  if (modelId.startsWith('opencode/')) return 'opencode';
  if (isCliAgentModel(modelId)) return 'cli-agent';
  return 'openrouter';
}

function builtinDriverForModelId(
  modelId: string,
): BuiltinProviderDriver | undefined {
  if (
    isCustomProviderModel(modelId) ||
    modelId.startsWith('opencode/') ||
    isCliAgentModel(modelId)
  ) {
    return undefined;
  }
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('google/')) return 'google';
  if (modelId.startsWith('local/')) return 'openai-compatible';
  return 'openrouter';
}

type AnthropicProvider = ReturnType<typeof createAnthropic>;
type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;
type LocalProvider = ReturnType<typeof createOpenAICompatible>;

function normalizedAnthropicBaseURL(rawOverride?: string): string | undefined {
  const raw = (rawOverride ?? env('ANTHROPIC_BASE_URL')).trim();
  if (!raw) return undefined;
  const base = raw.replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

type ChatProviders = {
  anthropic: () => AnthropicProvider;
  google: () => GoogleProvider;
  openrouter: () => ReturnType<typeof createOpenRouter>;
  local: () => LocalProvider;
};

function enabledBuiltinOverride(
  overrides: BuiltinProviderRuntimeOverrides,
  driver: BuiltinProviderDriver,
) {
  const override = overrides[driver];
  if (override?.enabled === false) {
    throw new Error(`${driver} provider is disabled in AI Settings`);
  }
  return override;
}

function createChatProviders(
  overrides: BuiltinProviderRuntimeOverrides = {},
): ChatProviders {
  let anthropic: AnthropicProvider | undefined;
  let google: GoogleProvider | undefined;
  let openrouter: ReturnType<typeof createOpenRouter> | undefined;
  let local: LocalProvider | undefined;
  return {
    anthropic: () => {
      if (!anthropic) {
        const override = enabledBuiltinOverride(overrides, 'anthropic');
        const key = override?.credential ?? env('ANTHROPIC_API_KEY');
        const baseURL = normalizedAnthropicBaseURL(override?.baseUrl);
        anthropic = createAnthropic({
          apiKey: key,
          ...(baseURL ? { baseURL } : {}),
        });
      }
      return anthropic;
    },
    google: () => {
      if (!google) {
        const override = enabledBuiltinOverride(overrides, 'google');
        const baseURL = override?.baseUrl || env('GOOGLE_BASE_URL').trim();
        google = createGoogleGenerativeAI({
          apiKey: override?.credential ?? env('GOOGLE_API_KEY'),
          ...(baseURL ? { baseURL } : {}),
        });
      }
      return google;
    },
    openrouter: () => {
      if (!openrouter) {
        const override = enabledBuiltinOverride(overrides, 'openrouter');
        const baseURL = override?.baseUrl || env('OPENROUTER_BASE_URL').trim();
        openrouter = createOpenRouter({
          apiKey: override?.credential ?? env('OPENROUTER_API_KEY'),
          ...(baseURL ? { baseURL } : {}),
        });
      }
      return openrouter;
    },
    local: () => {
      if (!local) {
        const override = enabledBuiltinOverride(overrides, 'openai-compatible');
        local = createOpenAICompatible({
          name: 'local',
          baseURL:
            override?.baseUrl ||
            env('LOCAL_LLM_BASE_URL') ||
            'http://localhost:11434/v1',
          apiKey:
            (override?.credential ?? env('LOCAL_LLM_API_KEY')) || 'ollama',
        });
      }
      return local;
    },
  };
}

function buildChatModel(
  modelId: string,
  providers: ChatProviders,
  thinking: boolean,
  thinkingBudget: number,
  thinkingBudgetOverridden: boolean,
  openCodeRuntime: OpenCodeRuntimeOptions,
): { model: LanguageModel; providerOptions?: ProviderOptions } {
  const hasCappedThinkingBudget = thinking && thinkingBudgetOverridden;

  if (providerFor(modelId) === 'openrouter') {
    return {
      model: providers.openrouter().chat(modelId, {
        ...(thinking ? { reasoning: { max_tokens: thinkingBudget } } : {}),
        usage: { include: true },
      }),
    };
  }

  if (modelId.startsWith('anthropic/')) {
    const id = modelId.slice('anthropic/'.length).replace(/\./g, '-');
    const adaptiveThinking = usesAdaptiveAnthropicThinking(id);
    return {
      model: providers.anthropic()(id),
      providerOptions: thinking
        ? {
            anthropic: {
              ...(adaptiveThinking
                ? {
                    thinking: {
                      type: 'adaptive' as const,
                      display: 'summarized' as const,
                    },
                    effort: hasCappedThinkingBudget ? 'low' : 'high',
                  }
                : {
                    thinking: {
                      type: 'enabled' as const,
                      budgetTokens: thinkingBudget,
                    },
                  }),
            },
          }
        : undefined,
    };
  }

  if (modelId.startsWith('google/')) {
    const id = modelId.slice('google/'.length);
    return {
      model: providers.google()(id),
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      },
    };
  }

  if (modelId.startsWith('local/')) {
    const id = modelId.slice('local/'.length);
    return {
      model: providers.local()(id),
      providerOptions: thinking
        ? {
            openai: {
              ...(hasCappedThinkingBudget
                ? { reasoning: { max_tokens: thinkingBudget } }
                : {}),
            },
          }
        : undefined,
    };
  }

  if (modelId.startsWith('opencode/')) {
    return { model: opencodeChatModel(modelId, openCodeRuntime) };
  }

  if (isCliAgentModel(modelId)) {
    throw new Error('CLI agent model reached the normal model builder');
  }

  throw new Error(`Unsupported chat model ${modelId}`);
}

function bareModelId(modelId: string): string {
  const id = modelId.slice(modelId.lastIndexOf('/') + 1);
  return id.replace(/\./g, '-');
}

function isClaude5Model(modelId: string): boolean {
  return /^claude-[a-z]+-5\b/.test(bareModelId(modelId));
}

function usesAdaptiveAnthropicThinking(modelId: string) {
  if (isClaude5Model(modelId)) return true;
  const match = /^claude-(?:opus|sonnet)-4-(\d+)/.exec(bareModelId(modelId));
  return match ? Number(match[1]) >= 6 : false;
}

function rejectsForcedToolChoice(modelId: string): boolean {
  return /^claude-(?:fable|mythos)\b/.test(bareModelId(modelId));
}

function supportsForcedToolChoice(modelId: string): boolean {
  return !rejectsForcedToolChoice(modelId);
}

type SupabaseAnon = ReturnType<typeof getAnonSupabaseClient>;

type BranchMessageRow = Pick<
  Message,
  'id' | 'role' | 'parts' | 'metadata' | 'parent_message_id'
>;

function finalizeStreamingParts(
  parts: AppUIMessage['parts'],
): AppUIMessage['parts'] {
  return parts.map((part) => {
    if (
      (part.type === 'reasoning' || part.type === 'text') &&
      part.state === 'streaming'
    ) {
      return {
        ...part,
        state: 'done' as const,
        ...(part.type === 'text'
          ? { text: cleanAssistantText(part.text) }
          : {}),
      };
    }
    if (part.type === 'text') {
      return { ...part, text: cleanAssistantText(part.text) };
    }
    return part;
  });
}

function dropTextFromParametricBuildMessage(
  parts: AppUIMessage['parts'],
): AppUIMessage['parts'] {
  const hasBuild = parts.some(
    (part) => part.type === 'tool-build_parametric_model',
  );
  if (!hasBuild) return parts;

  return parts.filter((part) => part.type !== 'text') as AppUIMessage['parts'];
}

function messageRowToUIMessage(
  row: BranchMessageRow,
  conversationId: string,
): AppUIMessage {
  const rawParts = Array.isArray(row.parts)
    ? (row.parts as AppUIMessage['parts'])
    : [];

  const dangling = rawParts.filter(isDanglingToolPart);
  if (dangling.length > 0) {
    logError(
      new Error(
        `Resolved ${dangling.length} dangling tool call(s) in persisted branch. ` +
          'Expected to be rare (genuine interruptions only) now that the onFinish ' +
          'clobber guard holds — investigate the write path if this is frequent.',
      ),
      {
        functionName: 'ai-chat',
        statusCode: 200,
        conversationId,
        additionalContext: {
          operation: 'resolve_dangling_tool_parts',
          messageId: row.id,
          role: row.role,
          tools: dangling.map((part) => ({
            type: part.type,
            toolCallId: 'toolCallId' in part ? part.toolCallId : undefined,
            state: 'state' in part ? part.state : undefined,
          })),
        },
      },
    );
  }

  return {
    id: row.id,
    role: row.role,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as AppUIMessage['metadata'])
        : ({} as AppUIMessage['metadata']),
    parts: resolveDanglingToolParts(rawParts),
  };
}

async function loadBranchFromDb({
  supabaseClient,
  conversationId,
  leafId,
}: {
  supabaseClient: SupabaseAnon;
  conversationId: string;
  leafId: string;
}): Promise<{ branch: AppUIMessage[]; leafRole: 'user' | 'assistant' }> {
  const { data: rows, error } = await supabaseClient
    .from('messages')
    .select('id, role, parts, metadata, parent_message_id')
    .eq('conversation_id', conversationId)
    .overrideTypes<BranchMessageRow[]>();

  if (error || !rows) {
    throw new Error('Failed to load conversation messages');
  }

  const byId = new Map<string, BranchMessageRow>();
  for (const row of rows) byId.set(row.id, row);

  const path: BranchMessageRow[] = [];
  const visited = new Set<string>();
  let current = byId.get(leafId);
  while (current) {
    if (visited.has(current.id)) {
      logError(new Error('parent_message_id cycle in loadBranchFromDb'), {
        functionName: 'ai-chat',
        statusCode: 500,
        userId: '',
        conversationId,
        additionalContext: { messageId: current.id },
      });
      break;
    }
    visited.add(current.id);
    path.unshift(current);
    current = current.parent_message_id
      ? byId.get(current.parent_message_id)
      : undefined;
  }

  if (path.length === 0) {
    throw new Error(
      `Leaf ${leafId} not found in conversation ${conversationId}`,
    );
  }

  return {
    branch: path.map((row) => messageRowToUIMessage(row, conversationId)),
    leafRole: path[path.length - 1].role,
  };
}

async function generateConversationTitle({
  anthropic,
  firstMessage,
  systemInstruction,
}: {
  anthropic: AnthropicProvider;
  firstMessage: AppUIMessage;
  systemInstruction: string;
}) {
  const text = getParametricText(firstMessage.parts) || 'New conversation';
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: systemInstruction,
      prompt: text,
      output: Output.object({
        schema: z.object({ title: z.string().min(1) }),
      }),
    });
    return result.output.title.slice(0, 80);
  } catch {
    return text.trim().split(/\s+/).slice(0, 5).join(' ') || 'New Creation';
  }
}

async function generateConversationSuggestions({
  anthropic,
  branch,
  systemInstruction,
}: {
  anthropic: AnthropicProvider;
  branch: AppUIMessage[];
  systemInstruction: string;
}): Promise<string[]> {
  const firstUserText =
    getParametricText(branch.find((m) => m.role === 'user')?.parts ?? []) || '';
  const lastAssistantText = getParametricText(
    branch
      .slice()
      .reverse()
      .find((m) => m.role === 'assistant')?.parts ?? [],
  );
  const summary = `User request: ${firstUserText.slice(0, 400)}\n\nMost recent assistant reply: ${lastAssistantText.slice(0, 400)}`;
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: systemInstruction,
      prompt: summary,
      output: Output.object({
        schema: z.object({
          suggestions: z.array(z.string().min(1).max(80)).length(2),
        }),
      }),
    });
    return normalizeConversationSuggestions(result.output.suggestions);
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: '',
      conversationId: '',
      additionalContext: { operation: 'suggestion_generate_text' },
    });
    return [];
  }
}

function creativeTools({
  conversation,
  req,
  model,
  description,
}: {
  conversation: ConversationAccess;
  req: Request;
  model: Model;
  description: string;
}) {
  return {
    create_mesh: {
      ...chatTools.create_mesh,
      description,
      execute: async (input: AppTools['create_mesh']['input']) => {
        const response = await handleMeshRequest(
          new Request(new URL('/api/mesh', req.url), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: req.headers.get('Authorization') ?? '',
            },
            body: JSON.stringify({
              conversationId: conversation.id,
              text: input.text,
              images: input.imageIds,
              mesh: input.meshId,
              model,
              meshTopology: input.meshTopology,
              polygonCount: input.polygonCount,
            }),
            signal: req.signal,
          }),
        );
        const data: {
          id?: string;
          fileType?: MeshFileType;
          error?: unknown;
        } = await response.json();

        if (!response.ok || !data.id || !data.fileType) {
          throw new Error(
            isRecord(data.error) && typeof data.error.message === 'string'
              ? data.error.message
              : 'Mesh generation failed',
          );
        }

        return { id: data.id, fileType: data.fileType };
      },
    },
  };
}

const ACCEPTED_IMAGE_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

async function sniffImageMediaType(bytes: Uint8Array): Promise<string | null> {
  const sniffed = (await imageType(bytes))?.mime;
  return sniffed && ACCEPTED_IMAGE_MEDIA_TYPES.has(sniffed) ? sniffed : null;
}

async function downloadAsBase64(
  supabaseClient: SupabaseAnon,
  bucket: string,
  path: string,
): Promise<{ base64: string; mediaType: string } | null> {
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .download(path);
  if (error || !data) return null;

  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  const mediaType =
    (await sniffImageMediaType(bytes)) || data.type || 'image/png';
  return { base64: btoa(binary), mediaType };
}

function parametricTools({
  previewPathForToolCall,
  supabaseClient,
  buildDescription,
  answerDescription,
  inspectionOutputTemplate,
}: {
  previewPathForToolCall: (toolCallId: string) => string;
  supabaseClient: SupabaseAnon;
  buildDescription: string;
  answerDescription: string;
  inspectionOutputTemplate: string;
}) {
  return {
    build_parametric_model: {
      ...chatTools.build_parametric_model,
      description: buildDescription,
      async toModelOutput({
        toolCallId,
        output,
      }: {
        toolCallId: string;
        output: AppTools['build_parametric_model']['output'];
      }) {
        const downloaded = await downloadAsBase64(
          supabaseClient,
          'images',
          previewPathForToolCall(toolCallId),
        );
        const views =
          output.inspection?.views.join(', ') ??
          'ISO, FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM';
        const text = renderInstructionTemplate(inspectionOutputTemplate, {
          message: output.message,
          views,
          imageAttached: downloaded ? 'yes' : 'no',
        });

        if (downloaded) {
          return {
            type: 'content' as const,
            value: [
              { type: 'text' as const, text },
              {
                type: 'image-data' as const,
                data: downloaded.base64,
                mediaType: downloaded.mediaType,
              },
            ],
          };
        }

        return { type: 'text' as const, value: text };
      },
    },
    answer_user: {
      ...chatTools.answer_user,
      description: answerDescription,
    },
  };
}

async function pinCreativeAgentModel({
  supabaseClient,
  conversation,
  userId,
  modelId,
}: {
  supabaseClient: SupabaseAnon;
  conversation: ConversationAccess;
  userId: string;
  modelId: Model;
}) {
  const nextSettings = {
    ...(conversation.settings ?? {}),
    creativeAgentModel: modelId,
  };
  const { error } = await supabaseClient
    .from('conversations')
    .update({ settings: nextSettings })
    .eq('id', conversation.id)
    .eq('user_id', userId);

  if (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId,
      conversationId: conversation.id,
      additionalContext: { operation: 'pin_creative_agent_model', modelId },
    });
    return;
  }

  conversation.settings = nextSettings;
}

export async function handleAiChatRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseClient = getAnonSupabaseClient({
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user?.id) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const parsedBody = parseChatRequestBody(await req.json().catch(() => null));
  if (!parsedBody) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const conversationId =
    parsedBody.kind === 'cancel'
      ? parsedBody.conversationId
      : parsedBody.body.conversationId;

  const { data: conversation, error: conversationError } = await supabaseClient
    .from('conversations')
    .select('id, type, user_id, current_message_leaf_id, settings')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()
    .overrideTypes<ConversationAccess>();

  if (conversationError || !conversation) {
    return jsonResponse({ error: 'Conversation not found' }, 404);
  }

  if (parsedBody.kind === 'cancel') {
    return jsonResponse(
      {
        canceled: cancelActiveGeneration(user.id, conversation.id),
      },
      200,
    );
  }

  const rawBody = parsedBody.body;

  if (!conversation.current_message_leaf_id) {
    return jsonResponse(
      { error: 'Conversation has no leaf to generate from' },
      400,
    );
  }

  const executionMode: 'cli' | 'streaming' =
    rawBody.openCodeExecutionMode ??
    conversation.settings?.openCodeExecutionMode ??
    'cli';
  const pinnedInstructionProfileId = isAiInstructionProfileId(
    conversation.settings?.instructionProfileId,
  )
    ? conversation.settings?.instructionProfileId
    : undefined;

  let aiRuntime: Awaited<ReturnType<typeof createUserAiRuntimeContext>>;
  try {
    aiRuntime = await createUserAiRuntimeContext(
      user.id,
      pinnedInstructionProfileId,
    );
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: { operation: 'load_ai_runtime_settings' },
    });
    return jsonResponse(
      { error: 'AI runtime settings could not be loaded' },
      500,
    );
  }

  let resolvedSystemPrompt: string;
  try {
    if (conversation.type === 'creative') {
      const creativePromptProfileId = conversation.settings
        ?.creativePromptProfileId as string | null | undefined;
      resolvedSystemPrompt = await resolveConversationSystemPrompt({
        userId: user.id,
        profileId: creativePromptProfileId,
        scope: 'creative',
        instructionProfileId: aiRuntime.instructionProfileId,
      });
    } else {
      const promptProfileId = conversation.settings?.promptProfileId as
        | string
        | null
        | undefined;
      resolvedSystemPrompt = await resolveConversationSystemPrompt({
        userId: user.id,
        profileId: promptProfileId,
        scope: 'parametric',
        instructionProfileId: aiRuntime.instructionProfileId,
      });
    }
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: { operation: 'resolve_system_prompt' },
    });
    return jsonResponse(
      { error: 'Failed to resolve conversation system prompt' },
      500,
    );
  }

  let buildToolDescription: string;
  let answerToolDescription: string;
  let createMeshDescription: string;
  let parametricAttachmentTemplate: string;
  let creativeReferenceTemplate: string;
  let meshPreferencesTemplate: string;
  let inspectionOutputTemplate: string;
  let titleInstruction: string;
  let parametricSuggestionsInstruction: string;
  let creativeSuggestionsInstruction: string;
  let openCodeTransportInstruction: string;
  let codexTransportInstruction: string;
  try {
    [
      buildToolDescription,
      answerToolDescription,
      createMeshDescription,
      parametricAttachmentTemplate,
      creativeReferenceTemplate,
      meshPreferencesTemplate,
      inspectionOutputTemplate,
      titleInstruction,
      parametricSuggestionsInstruction,
      creativeSuggestionsInstruction,
      openCodeTransportInstruction,
      codexTransportInstruction,
    ] = await Promise.all([
      aiRuntime.instruction('tool.build_parametric_model'),
      aiRuntime.instruction('tool.answer_user'),
      aiRuntime.instruction('tool.create_mesh'),
      aiRuntime.template('context.parametric_attachment'),
      aiRuntime.template('context.creative_reference_mesh'),
      aiRuntime.template('context.mesh_preferences'),
      aiRuntime.template('context.parametric_inspection_output'),
      aiRuntime.instruction('conversation.title'),
      aiRuntime.instruction('suggestions.parametric'),
      aiRuntime.instruction('suggestions.creative'),
      aiRuntime.instruction('transport.opencode'),
      aiRuntime.instruction('transport.codex'),
    ]);
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: { operation: 'resolve_auxiliary_instructions' },
    });
    return jsonResponse(
      { error: 'AI instructions could not be resolved' },
      500,
    );
  }

  const tools =
    conversation.type === 'creative'
      ? creativeTools({
          conversation,
          req,
          model: rawBody.model,
          description: createMeshDescription,
        })
      : parametricTools({
          supabaseClient,
          buildDescription: buildToolDescription,
          answerDescription: answerToolDescription,
          inspectionOutputTemplate,
          previewPathForToolCall: (toolCallId) =>
            `${user.id}/${conversation.id}/inspection-preview-${toolCallId}`,
        });

  let branchMessages: AppUIMessage[];
  let leafRole: 'user' | 'assistant';
  try {
    const branchResult = await loadBranchFromDb({
      supabaseClient,
      conversationId: conversation.id,
      leafId: conversation.current_message_leaf_id,
    });
    branchMessages = branchResult.branch;
    leafRole = branchResult.leafRole;
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: { operation: 'load_branch' },
    });
    return jsonResponse({ error: 'Failed to load conversation branch' }, 500);
  }

  const leafMessageId = conversation.current_message_leaf_id;

  let providers: ChatProviders;
  let builtinProviderOverrides: BuiltinProviderRuntimeOverrides = {};
  try {
    builtinProviderOverrides = await loadBuiltinProviderRuntimeOverrides(
      user.id,
    );
    providers = createChatProviders(builtinProviderOverrides);
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: { operation: 'create_providers' },
    });
    return jsonResponse(
      { error: 'AI provider settings could not be loaded' },
      503,
    );
  }

  const anthropicAuxiliaryAvailable =
    builtinProviderOverrides.anthropic?.enabled !== false &&
    Boolean(
      builtinProviderOverrides.anthropic?.credential ||
        env('ANTHROPIC_API_KEY'),
    );

  const isFirstUserTurn = branchMessages.length === 1 && leafRole === 'user';

  const hydratedMessages = await Promise.all(
    branchMessages.map(async (message) => ({
      ...message,
      parts: (
        await Promise.all(
          message.parts.map(async (part) => {
            if (
              part.type !== 'file' ||
              typeof part.mediaType !== 'string' ||
              !part.mediaType.startsWith('image/') ||
              part.url.startsWith('data:')
            ) {
              return part;
            }
            const imageId = imageIdFromFilename(part.filename);
            if (!imageId) return null;
            const downloaded = await downloadAsBase64(
              supabaseClient,
              'images',
              imageStoragePath(conversation.user_id, conversation.id, imageId),
            );
            if (!downloaded) return null;
            return {
              ...part,
              mediaType: downloaded.mediaType,
              url: `data:${downloaded.mediaType};base64,${downloaded.base64}`,
            };
          }),
        )
      ).filter((part): part is NonNullable<typeof part> => part != null),
    })),
  );

  const modelMessages = await convertToModelMessages<AppUIMessage>(
    hydratedMessages,
    {
      tools,
      convertDataPart: (part) => {
        if (part.type === 'data-mesh-context') {
          const { meshId, fileType, filename, boundingBox } = part.data;
          if (conversation.type === 'parametric' && filename) {
            const dimensions = boundingBox
              ? `\nModel dimensions (mm): width=${boundingBox.x.toFixed(1)}, height=${boundingBox.y.toFixed(1)}, depth=${boundingBox.z.toFixed(1)}`
              : '';
            return {
              type: 'text',
              text: renderInstructionTemplate(parametricAttachmentTemplate, {
                fileType: fileType.toUpperCase(),
                filename,
                dimensions,
              }),
            };
          }
          return {
            type: 'text',
            text: renderInstructionTemplate(creativeReferenceTemplate, {
              meshId,
              fileType,
            }),
          };
        }
        if (part.type === 'data-mesh-preferences') {
          return {
            type: 'text',
            text: renderInstructionTemplate(meshPreferencesTemplate, {
              topology: part.data.topology,
              polygonCount: part.data.polygonCount,
            }),
          };
        }
        return undefined;
      },
    },
  );

  let actualModelId: string;
  let creativeAgentSource: 'request' | 'conversation' | 'catalog' | undefined;
  if (conversation.type === 'creative') {
    let resolution;
    try {
      resolution = await resolveCreativeAgentModel({
        conversation,
        requestedAgentModel: rawBody.agentModel,
        user,
      });
    } catch (error) {
      logError(error, {
        functionName: 'ai-chat',
        statusCode: 500,
        userId: user.id,
        conversationId: conversation.id,
        additionalContext: { operation: 'resolve_creative_agent_model' },
      });
      return jsonResponse(
        { error: 'Failed to resolve a Creative AI agent model' },
        500,
      );
    }

    if (!resolution) {
      return jsonResponse(
        {
          error:
            'No enabled direct AI model with tool support is available for Creative mode',
        },
        400,
      );
    }

    actualModelId = resolution.modelId;
    creativeAgentSource = resolution.source;
    if (resolution.source === 'catalog') {
      await pinCreativeAgentModel({
        supabaseClient,
        conversation,
        userId: user.id,
        modelId: actualModelId,
      });
    }
  } else {
    actualModelId = normalizeModelId(rawBody.model);
  }

  const resolvedProvider = providerFor(actualModelId);
  const baseLogContext = {
    userId: user.id,
    conversationId: conversation.id,
    modelId: actualModelId,
    requestedModelId:
      conversation.type === 'creative'
        ? (rawBody.agentModel ??
          conversation.settings?.creativeAgentModel ??
          actualModelId)
        : rawBody.model,
    ...(conversation.type === 'creative'
      ? { meshModelId: rawBody.model, creativeAgentSource }
      : {}),
    provider: resolvedProvider,
  };

  const thinkingEnabled =
    (rawBody.thinking ?? false) ||
    (resolvedProvider === 'anthropic' &&
      usesAdaptiveAnthropicThinking(actualModelId));
  const thinkingBudget = aiRuntime.number('chat.thinkingBudgetTokens');
  const thinkingBudgetOverridden = Object.prototype.hasOwnProperty.call(
    aiRuntime.preferences.runtimeOverrides,
    'chat.thinkingBudgetTokens',
  );
  const maxSteps = aiRuntime.number(
    conversation.type === 'parametric'
      ? 'chat.parametricMaxSteps'
      : 'chat.creativeMaxSteps',
  );
  const maxOutputTokens = aiRuntime.number(
    conversation.type === 'parametric'
      ? 'chat.parametricMaxOutputTokens'
      : thinkingEnabled
        ? 'chat.creativeThinkingMaxOutputTokens'
        : 'chat.creativeMaxOutputTokens',
  );
  const openCodeRuntime: OpenCodeRuntimeOptions = {
    transportInstruction: openCodeTransportInstruction,
    timeoutMs: aiRuntime.number('transport.openCodeTimeoutMs'),
    validationAttempts: aiRuntime.number(
      'transport.openCodeValidationAttempts',
    ),
  };
  const cliTimeoutMs = aiRuntime.number('transport.cliTimeoutMs');

  const transport = selectChatTransport(actualModelId, executionMode);
  if (conversation.type === 'creative' && transport.kind !== 'normal') {
    return jsonResponse(
      {
        error:
          'Creative mode currently requires a direct AI model; OpenCode/Codex agent adapters are parametric-only',
      },
      400,
    );
  }
  console.info('transport', {
    modelId: actualModelId,
    executionMode,
    transportKind: transport.kind,
    ...(transport.kind === 'streaming-opencode' && {
      underlyingModelId: transport.underlyingModelId,
    }),
  });

  let chatLanguageModel: LanguageModel;
  let chatProviderOptions: ProviderOptions | undefined;
  let customSupportsVision: boolean | undefined;
  const _builtinDriver = builtinDriverForModelId(actualModelId);
  try {
    if (transport.kind === 'streaming-opencode') {
      chatLanguageModel = streamingOpencodeChatModel(
        transport.underlyingModelId,
        conversation.id,
        openCodeRuntime,
      );
      chatProviderOptions = undefined;
    } else if (transport.kind === 'cli-agent') {
      chatLanguageModel = cliAgentChatModel(actualModelId, {
        transportInstruction: actualModelId.startsWith('agent/codex/')
          ? codexTransportInstruction
          : openCodeTransportInstruction,
        timeoutMs: cliTimeoutMs,
      });
      chatProviderOptions = undefined;
    } else if (isCustomProviderModel(actualModelId)) {
      try {
        const built = await buildCustomChatModel(
          actualModelId,
          user.id,
          thinkingEnabled,
          thinkingBudget,
        );

        const supportsTools = built.capabilities.supportsTools;
        if (!supportsTools) {
          return jsonResponse(
            { error: 'Provider does not support required CAD tools' },
            400,
          );
        }

        chatLanguageModel = built.model;
        chatProviderOptions = built.providerOptions;
        customSupportsVision = built.capabilities.supportsVision;
      } catch (error) {
        logError(error, {
          functionName: 'ai-chat',
          statusCode: 400,
          userId: user.id,
          conversationId: conversation.id,
          additionalContext: {
            ...baseLogContext,
            operation: 'build_custom_chat_model',
          },
        });
        const message =
          error instanceof Error ? error.message : 'Custom provider error';
        return jsonResponse({ error: message }, 400);
      }
    } else {
      const built = buildChatModel(
        actualModelId,
        providers,
        thinkingEnabled,
        thinkingBudget,
        thinkingBudgetOverridden,
        openCodeRuntime,
      );
      chatLanguageModel = built.model;
      chatProviderOptions = built.providerOptions;
    }
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: user.id,
      conversationId: conversation.id,
      additionalContext: {
        ...baseLogContext,
        operation: 'build_chat_model',
      },
    });
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(
      { error: `Failed to initialize model ${actualModelId}: ${message}` },
      500,
    );
  }

  const directVision = modelSupportsDirectVision(
    actualModelId,
    transport.kind,
    customSupportsVision,
  );
  if (conversation.type === 'parametric' && !directVision) {
    chatLanguageModel = withVisionFallback(chatLanguageModel, user.id);
  }
  console.info('vision routing', {
    modelId: actualModelId,
    transportKind: transport.kind,
    directVision,
    fallbackConfiguredByAiSettings: !directVision,
  });

  const logContext = {
    ...baseLogContext,
    thinking: thinkingEnabled,
  };

  const streamingOpenCode = transport.kind === 'streaming-opencode';
  const forceBuildToolChoice =
    !streamingOpenCode && supportsForcedToolChoice(actualModelId);
  const disableThinkingForBuildStep =
    forceBuildToolChoice && thinkingEnabled && resolvedProvider === 'anthropic';
  const usingAutoToolChoiceFallback =
    conversation.type === 'parametric' &&
    leafRole === 'user' &&
    !forceBuildToolChoice;

  const activeGeneration = beginActiveGeneration(user.id, conversation.id);

  const result = streamText({
    model: chatLanguageModel,
    providerOptions: chatProviderOptions,
    system: resolvedSystemPrompt,
    messages: modelMessages,
    tools,
    prepareStep: ({ stepNumber }) => {
      if (streamingOpenCode) return {};
      if (
        conversation.type === 'parametric' &&
        leafRole === 'user' &&
        stepNumber === 0
      ) {
        return {
          activeTools: ['build_parametric_model' as never],
          ...(forceBuildToolChoice
            ? {
                toolChoice: {
                  type: 'tool' as const,
                  toolName: 'build_parametric_model' as never,
                },
                ...(disableThinkingForBuildStep
                  ? {
                      providerOptions: {
                        anthropic: { thinking: { type: 'disabled' as const } },
                      },
                    }
                  : {}),
              }
            : {}),
        };
      }
      return {};
    },
    stopWhen: streamingOpenCode
      ? hasToolCall('build_parametric_model')
      : stepCountIs(maxSteps),
    maxOutputTokens,
    abortSignal: activeGeneration.signal,
    experimental_transform: smoothStream({ delayInMs: 30 }),
    onError: ({ error }) => {
      activeGeneration.finish();
      if (isRequestAbort(error, activeGeneration.signal)) return;

      logError(error, {
        functionName: 'ai-chat',
        statusCode: 500,
        userId: logContext.userId,
        conversationId: logContext.conversationId,
        additionalContext: {
          ...logContext,
          operation: 'stream_text',
        },
      });
    },
    onFinish: ({ steps }) => {
      activeGeneration.finish();
      if (!usingAutoToolChoiceFallback) return;
      const calledBuildTool = steps.some((step) =>
        step.toolCalls?.some(
          (call) => call.toolName === 'build_parametric_model',
        ),
      );
      if (!calledBuildTool) {
        logError(
          new Error(
            'Parametric turn finished without calling build_parametric_model under auto tool-choice fallback',
          ),
          {
            functionName: 'ai-chat',
            statusCode: 500,
            userId: logContext.userId,
            conversationId: logContext.conversationId,
            additionalContext: {
              ...logContext,
              operation: 'forced_tool_choice_fallback',
              modelId: actualModelId,
            },
          },
        );
      }
    },
  });

  const stream = createUIMessageStream<AppUIMessage>({
    onError: (error) => {
      activeGeneration.finish();
      if (isRequestAbort(error, activeGeneration.signal)) {
        return 'Generation stopped';
      }

      logError(error, {
        functionName: 'ai-chat',
        statusCode: 500,
        userId: baseLogContext.userId,
        conversationId: baseLogContext.conversationId,
        additionalContext: {
          ...baseLogContext,
          operation: 'ui_message_stream',
        },
      });
      const message = error instanceof Error ? error.message : String(error);
      return `Model call failed (${resolvedProvider}/${actualModelId}): ${message}`;
    },
    execute: async ({ writer }) => {
      if (isFirstUserTurn && anthropicAuxiliaryAvailable) {
        void emitConversationTitle({
          writer,
          anthropic: providers.anthropic(),
          supabaseClient,
          conversation,
          firstMessage: branchMessages[0],
          systemInstruction: titleInstruction,
        });
      }

      writer.merge(
        result.toUIMessageStream<AppUIMessage>({
          originalMessages: branchMessages,
          generateMessageId: () => crypto.randomUUID(),
          onFinish: async ({ responseMessage, isContinuation }) => {
            const metadata = {
              ...(responseMessage.metadata ?? {}),
              model: rawBody.model,
              ...(conversation.type === 'creative'
                ? { agentModel: actualModelId }
                : {}),
            };

            const finalizedParts =
              conversation.type === 'parametric'
                ? dropTextFromParametricBuildMessage(
                    finalizeStreamingParts(responseMessage.parts),
                  )
                : finalizeStreamingParts(responseMessage.parts);

            const serializedMessage = {
              metadata: JSON.parse(JSON.stringify(metadata)),
              parts: JSON.parse(JSON.stringify(finalizedParts)),
            };

            const hasPendingToolCall = hasPendingClientToolCall(finalizedParts);
            const persistAction = decidePersistAction({
              isContinuation,
              hasPendingToolCall,
            });
            let error: { message: string } | null = null;
            if (persistAction === 'update') {
              ({ error } = await supabaseClient
                .from('messages')
                .update(serializedMessage)
                .eq('id', responseMessage.id)
                .eq('conversation_id', conversation.id));
            } else if (persistAction === 'insert') {
              ({ error } = await supabaseClient.from('messages').insert({
                id: responseMessage.id,
                conversation_id: conversation.id,
                role: responseMessage.role,
                ...serializedMessage,
                parent_message_id: leafMessageId,
              }));
            } else {
              ({ error } = await supabaseClient
                .from('messages')
                .update({ metadata: serializedMessage.metadata })
                .eq('id', responseMessage.id)
                .eq('conversation_id', conversation.id));
            }

            if (error) {
              logError(error, {
                functionName: 'ai-chat',
                statusCode: 500,
                userId: user.id,
                conversationId: conversation.id,
                additionalContext: { operation: 'persist_response_message' },
              });
            }

            if (!hasPendingToolCall && anthropicAuxiliaryAvailable) {
              await emitConversationSuggestions({
                writer,
                anthropic: providers.anthropic(),
                supabaseClient,
                conversation,
                branch: [
                  ...branchMessages,
                  { ...responseMessage, parts: finalizedParts },
                ],
                systemInstruction:
                  conversation.type === 'creative'
                    ? creativeSuggestionsInstruction
                    : parametricSuggestionsInstruction,
              });
            }
          },
        }),
      );
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: corsHeaders,
    consumeSseStream: consumeStream,
  });
}

async function emitConversationTitle({
  writer,
  anthropic,
  supabaseClient,
  conversation,
  firstMessage,
  systemInstruction,
}: {
  writer: UIMessageStreamWriter<AppUIMessage>;
  anthropic: AnthropicProvider;
  supabaseClient: SupabaseAnon;
  conversation: ConversationAccess;
  firstMessage: AppUIMessage;
  systemInstruction: string;
}) {
  try {
    const title = await generateConversationTitle({
      anthropic,
      firstMessage,
      systemInstruction,
    });
    await supabaseClient
      .from('conversations')
      .update({ title })
      .eq('id', conversation.id);
    writer.write({
      transient: true,
      type: 'data-title-update',
      data: { conversationId: conversation.id, title },
    });
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: '',
      conversationId: conversation.id,
      additionalContext: { operation: 'title_update' },
    });
  }
}

async function emitConversationSuggestions({
  writer,
  anthropic,
  supabaseClient,
  conversation,
  branch,
  systemInstruction,
}: {
  writer: UIMessageStreamWriter<AppUIMessage>;
  anthropic: AnthropicProvider;
  supabaseClient: SupabaseAnon;
  conversation: ConversationAccess;
  branch: AppUIMessage[];
  systemInstruction: string;
}) {
  try {
    const suggestions = await generateConversationSuggestions({
      anthropic,
      branch,
      systemInstruction,
    });
    if (suggestions.length === 0) return;

    const { data: convRow } = await supabaseClient
      .from('conversations')
      .select('settings')
      .eq('id', conversation.id)
      .single();
    const currentSettings =
      convRow?.settings &&
      typeof convRow.settings === 'object' &&
      !Array.isArray(convRow.settings)
        ? (convRow.settings as Record<string, unknown>)
        : {};
    await supabaseClient
      .from('conversations')
      .update({ settings: { ...currentSettings, suggestions } })
      .eq('id', conversation.id);

    writer.write({
      transient: true,
      type: 'data-suggestions-update',
      data: { conversationId: conversation.id, suggestions },
    });
  } catch (error) {
    logError(error, {
      functionName: 'ai-chat',
      statusCode: 500,
      userId: '',
      conversationId: conversation.id,
      additionalContext: { operation: 'suggestions_update' },
    });
  }
}
