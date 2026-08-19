import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { spawn } from 'node:child_process';
import { env } from './env';
import {
  buildAgentOutputContract,
  finishWithParametricToolCall,
  parseAgentResult,
} from './opencodeAgentResult';
import { validateOpenScad } from './openScadValidation';
import { logError, logWarning } from './serverLog';

const USAGE = (): LanguageModelV3Usage => ({
  inputTokens: {
    total: 0,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 0,
    text: undefined,
    reasoning: undefined,
  },
});

const MODELS_CACHE_TTL_MS = 5 * 60_000;

// Opencode serve HTTP API base URL.
// Priority: OPENCODE_BASE_URL (full URL) → OPENCODE_PORT (legacy) → default.
// start.sh normally exports the dynamically selected pCAD-owned port.
export function opencodeApiUrl(): string {
  const baseUrl = env('OPENCODE_BASE_URL').trim();
  if (baseUrl) return baseUrl.replace(/\/+$/, '');
  const port = env('OPENCODE_PORT');
  if (port) return `http://127.0.0.1:${port}`;
  return 'http://127.0.0.1:4096';
}

/**
 * Build the HTTP headers required by an authenticated `opencode serve`.
 * OpenCode uses HTTP Basic Auth when OPENCODE_SERVER_PASSWORD is set; the
 * username defaults to `opencode` unless OPENCODE_SERVER_USERNAME overrides it.
 * Existing Authorization headers are preserved so callers can explicitly
 * override this behavior when needed.
 */
export function opencodeAuthHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  const password = env('OPENCODE_SERVER_PASSWORD');
  if (!password || result.has('Authorization')) return result;

  const username = env('OPENCODE_SERVER_USERNAME') || 'opencode';
  const credentials = Buffer.from(`${username}:${password}`, 'utf8').toString(
    'base64',
  );
  result.set('Authorization', `Basic ${credentials}`);
  return result;
}

/** Central HTTP transport for every pCAD → OpenCode server request. */
async function opencodeFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: opencodeAuthHeaders(init.headers),
  });
}

export type OpenCodeModelInfo = {
  /** Full `provider/model` id as `opencode models` prints it. */
  cliId: string;
  providerID: string;
  /** Id without the provider prefix. */
  bareID: string;
  name: string;
};

let modelsCache: { at: number; models: OpenCodeModelInfo[] } | undefined;

function humanName(bareID: string): string {
  return bareID
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Fetch models from `GET /api/model` (opencode serve HTTP API).
 * The API only returns models from providers active in the project
 * (e.g. llama-swap, morph, opencode). CLI `opencode models` returns
 * ALL registered providers. `listModels()` merges both: API models by ID
 * (rich names), then CLI models that aren't already present.
 *
 * NOTE: This function returns [] on error rather than falling back to CLI.
 * The caller `listModels()` always merges API + CLI — returning CLI here
 * would cause duplicates and lose API names for the API's own models.
 */
async function listModelsViaApi(): Promise<OpenCodeModelInfo[]> {
  try {
    const url = `${opencodeApiUrl()}/api/model`;
    const res = await opencodeFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const items = (json['data'] as OpenCodeModelItem[]) ?? [];
    return items
      .filter((m) => m.id && m.providerID)
      .map((m) => ({
        cliId: `${m.providerID}/${m.id}`,
        providerID: m.providerID,
        bareID: m.id,
        // Prefer the real name from opencode's /api/model response.
        // Falls back to humanName() for providers that don't include a name.
        name: m.name || humanName(m.id),
      }));
  } catch (err) {
    logError(err, {
      functionName: 'opencode-list-models-api',
      statusCode: 500,
    });
    return [];
  }
}

interface OpenCodeModelItem {
  id: string;
  providerID: string;
  name?: string;
}

async function listModels(): Promise<OpenCodeModelInfo[]> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_CACHE_TTL_MS) {
    return modelsCache.models;
  }
  // API gives us models with rich names; CLI gives us all providers.
  const apiModels = await listModelsViaApi();
  const cliModels = await listModelsViaCli();
  // Use API models as the primary source (they have proper names).
  // Supplement with CLI models that aren't already covered by the API.
  const apiCliIds = new Set(apiModels.map((m) => m.cliId));
  const merged = [
    ...apiModels,
    ...cliModels.filter((m) => !apiCliIds.has(m.cliId)),
  ];
  modelsCache = { at: Date.now(), models: merged };
  return merged;
}

async function listModelsViaCli(): Promise<OpenCodeModelInfo[]> {
  try {
    const { stdout } = await runOpenCode(['models'], { timeoutMs: 30_000 });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((cliId) => {
        const slash = cliId.indexOf('/');
        const providerID = slash > 0 ? cliId.slice(0, slash) : 'opencode';
        const bareID = slash > 0 ? cliId.slice(slash + 1) : cliId;
        return { cliId, providerID, bareID, name: humanName(bareID) };
      });
  } catch (err) {
    logError(err, {
      functionName: 'opencode-list-models-cli',
      statusCode: 500,
    });
    return [];
  }
}

export async function opencodeModels(): Promise<OpenCodeModelInfo[]> {
  return listModels();
}

/** Minimal CLI runner for `opencode models` fallback (reads stdout). */
function runOpenCode(
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('opencode', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`opencode ${args[0]} timed out`));
    }, opts?.timeoutMs ?? 60_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `opencode ${args[0]} exited ${code}: ${stderr.slice(0, 300)}`,
          ),
        );
    });
  });
}

/**
 * Build a plain-text prompt from the AI SDK v3 prompt array. Tool calls and
 * tool results carry no meaning for OpenCode because pCAD owns artifact
 * conversion, so they are dropped. System/modeling context and conversation
 * history are retained, followed by the shared final-result contract.
 */
export function formatPrompt(prompt: LanguageModelV3Prompt): string {
  const lines: string[] = [
    '<environment instructions>',
    'You are an AI assistant reached from a CAD generation web app.',
    'Use the supplied CADAM modeling context to answer the user request.',
    'Do NOT use OpenCode filesystem, shell, network, web, or external tools.',
    'The pCAD agent may use only pcad_validate to check an OpenSCAD candidate.',
    'pCAD, not you, converts a completed CAD artifact into its build_parametric_model tool call.',
    '</environment instructions>',
  ];
  for (const message of prompt) {
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    const textParts: string[] = [];
    for (const part of parts) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (part.type === 'text') {
        textParts.push(part.text);
      } else if (part.type === 'reasoning') {
        textParts.push(`(thinking: ${part.text})`);
      }
    }
    if (!textParts.length) continue;
    const label =
      message.role === 'user'
        ? 'User'
        : message.role === 'assistant'
          ? 'Assistant'
          : 'System';
    lines.push(`${label}: ${textParts.join('\n')}`);
  }
  lines.push(buildAgentOutputContract());
  return lines.join('\n\n');
}

/**
 * Give pCAD-created OpenCode sessions a deterministic, searchable identity.
 * The formatted prompt is already available here, so use only the first line
 * of the latest user turn and never expose system/context text in the title.
 */
export function buildOpenCodeSessionTitle(
  modelId: string,
  prompt: string,
): string {
  const marker = '\n\nUser: ';
  const markerIndex = prompt.lastIndexOf(marker);
  const rawUser = markerIndex >= 0 ? prompt.slice(markerIndex + marker.length) : '';
  const firstLine = (rawUser.split('\n')[0] ?? '').replace(/\s+/g, ' ').trim();
  const summary =
    firstLine.length > 60
      ? `${firstLine.slice(0, 57).trimEnd()}…`
      : firstLine;
  const bareModel = modelId.includes('/')
    ? modelId.slice(modelId.lastIndexOf('/') + 1)
    : modelId;
  const modelLabel =
    bareModel.length > 36
      ? `${bareModel.slice(0, 33).trimEnd()}…`
      : bareModel;
  return summary
    ? `[pCAD] ${modelLabel} · ${summary}`
    : `[pCAD] ${modelLabel}`;
}

function toFinishReason(reason: string | undefined): LanguageModelV3FinishReason {
  let unified: LanguageModelV3FinishReason['unified'];
  switch (reason) {
    case undefined:
    case 'stop':
      unified = 'stop';
      break;
    case 'length':
      unified = 'length';
      break;
    case 'content-filter':
    case 'content_filter':
      unified = 'content-filter';
      break;
    case 'tool-calls':
    case 'tool_use':
      unified = 'tool-calls';
      break;
    case 'error':
      unified = 'error';
      break;
    default:
      unified = 'other';
      break;
  }
  return { unified, raw: reason };
}

function numericField(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const raw = value[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function usageFromOpenCodeTokens(
  tokens: Record<string, unknown> | undefined,
): LanguageModelV3Usage | undefined {
  if (!tokens) return undefined;

  const input = numericField(tokens, 'input');
  const output = numericField(tokens, 'output');
  const reasoning = numericField(tokens, 'reasoning');
  const cache =
    tokens['cache'] &&
    typeof tokens['cache'] === 'object' &&
    !Array.isArray(tokens['cache'])
      ? (tokens['cache'] as Record<string, unknown>)
      : undefined;
  const cacheRead = cache ? numericField(cache, 'read') : undefined;
  const cacheWrite = cache ? numericField(cache, 'write') : undefined;

  if (
    input === undefined &&
    output === undefined &&
    reasoning === undefined &&
    cacheRead === undefined &&
    cacheWrite === undefined
  ) {
    return undefined;
  }

  return {
    inputTokens: {
      total: input,
      // OpenCode does not currently tell pCAD whether `input` includes cache
      // reads, so do not invent a no-cache count.
      noCache: undefined,
      cacheRead,
      cacheWrite,
    },
    outputTokens: {
      total: output,
      // `output` and `reasoning` are separate provider counters. Without an
      // explicit text-only counter, keep text undefined rather than guessing.
      text: undefined,
      reasoning,
    },
  };
}

/**
 * OpenCode HTTP API event parser.
 *
 * Opencode serve streams SSE events on GET /api/session/{id}/event.
 * We parse: step.started → step.failed (error) / step.ended → message.updated (text).
 */
export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('data: ')) {
      try {
        const payload = JSON.parse(trimmed.slice(6)) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (payload.type && payload.data) {
          events.push({ type: payload.type, data: payload.data });
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }
  return events;
}

/**
 * Incremental SSE reader for long-lived OpenCode `/api/session/{id}/event`
 * subscriptions.
 *
 * The endpoint is a persistent SSE stream. Reading the entire response body
 * with `Response.text()` blocks until EOF which never arrives while the
 * session is active. This function reads `eventRes.body` incrementally,
 * decodes chunks, buffers incomplete SSE frames between chunks, and yields a
 * batch of complete `SSEEvent[]` as soon as they are available.
 */
function createIncrementalSseReader(
  eventRes: Response,
  ac: AbortController,
): AsyncIterableIterator<SSEEvent[]> & { close: () => void } {
  const body = eventRes.body;
  if (!body) {
    const empty = (async function* () {})() as AsyncIterableIterator<
      SSEEvent[]
    > & { close: () => void };
    empty.close = () => {};
    return empty;
  }

  const reader = body.getReader();
  let textBuffer = '';

  const gen = (async function* () {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const buf = Buffer.isBuffer(value)
          ? value
          : value instanceof Uint8Array
            ? value
            : new TextEncoder().encode(String(value));
        textBuffer += new TextDecoder().decode(buf, { stream: true });

        const parts = textBuffer.split('\n\n');
        textBuffer = parts.pop() ?? '';

        const events: SSEEvent[] = [];
        for (const part of parts) {
          events.push(...parseSSE(part));
        }
        if (events.length) yield events;
      }
    } catch (err: unknown) {
      if (!ac.signal.aborted) throw err;
    } finally {
      if (textBuffer) {
        const events = parseSSE(textBuffer);
        if (events.length) yield events;
      }
      reader.cancel();
      reader.releaseLock();
    }
  })() as AsyncIterableIterator<SSEEvent[]> & { close: () => void };

  gen.close = async () => {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  };

  return gen;
}

/**
 * Extract incremental text, reasoning and native AI SDK v3 usage from an
 * accumulated OpenCode event batch.
 */
export function extractText(events: SSEEvent[]): {
  text: string;
  reasoning: string;
  tokens: LanguageModelV3Usage | undefined;
} {
  let text = '';
  let reasoning = '';
  let tokens: LanguageModelV3Usage | undefined;
  for (const evt of events) {
    const t = evt.type ?? '';
    if (t.includes('text.ended') && typeof evt.data['text'] === 'string') {
      text += evt.data['text'] as string;
    } else if (
      t.includes('reasoning.ended') &&
      typeof evt.data['text'] === 'string'
    ) {
      reasoning += evt.data['text'] as string;
    } else if (t.includes('step.ended')) {
      tokens =
        usageFromOpenCodeTokens(
          evt.data['tokens'] as Record<string, unknown> | undefined,
        ) ?? tokens;
    }
  }
  return { text, reasoning, tokens };
}

/**
 * Process one OpenCode event batch and yield the corresponding native AI SDK
 * v3 stream parts, updating the internal lifecycle state in place.
 *
 * LanguageModelV3 invariant:
 *   text-start → text-delta* → text-end
 *   reasoning-start → reasoning-delta* → reasoning-end
 * Ends are emitted only after all events in the terminal batch are processed.
 */
export function processBatch(
  state: {
    cursor: number;
    finishReason: LanguageModelV3FinishReason;
    usage: LanguageModelV3Usage | undefined;
    totalText: string;
    yieldedText: string;
    totalReasoning: string;
    yieldedReasoning: string;
    textPartId: number;
    lastTextPartId: string | undefined;
    hasStartedText: boolean;
    reasoningPartId: number;
    lastReasoningPartId: string | undefined;
    hasStartedReasoning: boolean;
    isTerminal: boolean;
    isErrored: boolean;
    permissionRequests: {
      action?: string;
      resources?: string[];
      id: string;
    }[];
  },
  events: SSEEvent[],
): { newParts: LanguageModelV3StreamPart[] } {
  const newParts: LanguageModelV3StreamPart[] = [];

  for (const evt of events) {
    const dur = evt.data['durable'] as Record<string, unknown> | undefined;
    if (dur && typeof dur['seq'] === 'number') {
      state.cursor = Math.max(state.cursor, dur['seq'] as number);
    }

    if (evt.type?.includes('permission.v2.asked')) {
      const action = evt.data['action'] as string | undefined;
      const resources = evt.data['resources'] as string[] | undefined;
      logWarning('permission.v2.asked event detected', {
        functionName: 'opencode-permission-asked',
        action,
        resources,
      });
      if (!state.permissionRequests) state.permissionRequests = [];
      state.permissionRequests.push({
        action,
        resources,
        id: (evt.data['id'] as string) ?? 'unknown',
      });
    }

    if (evt.type?.includes('step.failed')) {
      state.isTerminal = true;
      state.isErrored = true;
      state.finishReason = toFinishReason('error');
      const errorData = evt.data['error'] as
        | Record<string, unknown>
        | undefined;
      const errMsg = errorData?.['message'] as string | undefined;
      if (errMsg) {
        logError(errMsg, {
          functionName: 'opencode-step-failed',
          statusCode: 429,
        });
        newParts.push({ type: 'error', error: new Error(errMsg) });
      }
      break;
    }

    if (evt.type?.includes('step.ended')) {
      const finish =
        typeof evt.data['finish'] === 'string'
          ? (evt.data['finish'] as string)
          : undefined;
      state.finishReason = toFinishReason(finish);
      if (finish !== 'tool-calls' && finish !== 'tool_use') {
        state.isTerminal = true;
      }
      const usage = usageFromOpenCodeTokens(
        evt.data['tokens'] as Record<string, unknown> | undefined,
      );
      if (usage) state.usage = usage;
    }

    if (
      evt.type?.includes('text.ended') &&
      typeof evt.data['text'] === 'string'
    ) {
      state.totalText += evt.data['text'] as string;
      const delta = state.totalText.slice(state.yieldedText.length);
      if (delta) {
        if (!state.hasStartedText) {
          newParts.push({
            type: 'text-start',
            id: `text-${++state.textPartId}`,
          });
          state.lastTextPartId = `text-${state.textPartId}`;
          state.hasStartedText = true;
        }
        state.yieldedText = state.totalText;
        newParts.push({
          type: 'text-delta',
          id: state.lastTextPartId!,
          delta,
        });
      }
    }

    if (
      evt.type?.includes('reasoning.ended') &&
      typeof evt.data['text'] === 'string'
    ) {
      state.totalReasoning += evt.data['text'] as string;
      const delta = state.totalReasoning.slice(state.yieldedReasoning.length);
      if (delta) {
        if (!state.hasStartedReasoning) {
          newParts.push({
            type: 'reasoning-start',
            id: `reasoning-${++state.reasoningPartId}`,
          });
          state.lastReasoningPartId = `reasoning-${state.reasoningPartId}`;
          state.hasStartedReasoning = true;
        }
        state.yieldedReasoning = state.totalReasoning;
        newParts.push({
          type: 'reasoning-delta',
          id: state.lastReasoningPartId!,
          delta,
        });
      }
    }
  }

  if (state.isTerminal || state.isErrored) {
    if (state.hasStartedText) {
      newParts.push({ type: 'text-end', id: state.lastTextPartId! });
    }
    if (state.hasStartedReasoning) {
      newParts.push({ type: 'reasoning-end', id: state.lastReasoningPartId! });
    }
  }

  return { newParts };
}

/**
 * Convert a fully accepted OpenCode terminal envelope into pCAD's semantic
 * native AI SDK v3 stream. The agent's {code,message} JSON is an internal
 * transport contract and must never be emitted as ordinary assistant text.
 */
export function finalizeAcceptedAgentResult(
  text: string,
  finishPart: Extract<LanguageModelV3StreamPart, { type: 'finish' }>,
): LanguageModelV3StreamPart[] {
  const result = parseAgentResult(text);

  if (result.code) {
    return finishWithParametricToolCall(text, finishPart);
  }

  const message = result.message.trim();
  if (!message) return [finishPart];

  const id = 'validated-message-1';
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: message },
    { type: 'text-end', id },
    finishPart,
  ];
}

/** Interrupt an active OpenCode session via the server API. */
async function interruptSession(
  apiUrl: string,
  sessionId: string,
): Promise<void> {
  await opencodeFetch(`${apiUrl}/api/session/${sessionId}/interrupt`, {
    method: 'POST',
    signal: AbortSignal.timeout(3_000),
  }).catch(() => {});
}

/**
 * Execute one request through the OpenCode HTTP API and expose it as a native
 * LanguageModelV3 stream.
 */
async function* streamParts(
  modelId: string,
  prompt: string,
  options: LanguageModelV3CallOptions,
): AsyncGenerator<LanguageModelV3StreamPart> {
  yield { type: 'stream-start', warnings: [] };
  const ac = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const apiUrl = opencodeApiUrl();
    const slash = modelId.indexOf('/');
    const providerID = slash > 0 ? modelId.slice(0, slash) : 'opencode';
    const bareId = slash > 0 ? modelId.slice(slash + 1) : modelId;

    let sessionId = '';
    timeout = setTimeout(async () => {
      ac.abort();
      if (sessionId) await interruptSession(apiUrl, sessionId);
    }, 8 * 60_000);

    try {
      const sessionRes = await opencodeFetch(`${apiUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: buildOpenCodeSessionTitle(bareId, prompt),
          agent: 'pcad-builder',
          model: { providerID, id: bareId },
        }),
        signal: ac.signal,
      });
      if (!sessionRes.ok) {
        const body = await sessionRes.text();
        throw new Error(
          `session creation failed HTTP ${sessionRes.status}: ${body.slice(0, 300)}`,
        );
      }
      sessionId = (await sessionRes.json())['data']['id'];
      options.abortSignal?.addEventListener(
        'abort',
        async () => {
          ac.abort();
          if (sessionId) await interruptSession(apiUrl, sessionId);
        },
        { once: true },
      );
    } catch (err) {
      throw new Error(
        `opencode session creation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const promptRes = await opencodeFetch(
      `${apiUrl}/api/session/${sessionId}/prompt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: { role: 'user', text: prompt },
        }),
        signal: ac.signal,
      },
    );
    if (!promptRes.ok) {
      const body = await promptRes.text();
      throw new Error(
        `prompt submission failed HTTP ${promptRes.status}: ${body.slice(0, 300)}`,
      );
    }

    const makeState = () => ({
      cursor: 0,
      finishReason: toFinishReason(undefined),
      usage: undefined as LanguageModelV3Usage | undefined,
      totalText: '',
      yieldedText: '',
      totalReasoning: '',
      yieldedReasoning: '',
      textPartId: 0,
      lastTextPartId: undefined as string | undefined,
      hasStartedText: false,
      reasoningPartId: 0,
      lastReasoningPartId: undefined as string | undefined,
      hasStartedReasoning: false,
      isTerminal: false,
      isErrored: false,
      permissionRequests: [] as {
        action?: string;
        resources?: string[];
        id: string;
      }[],
    });
    let state = makeState();
    let validationAttempts = 0;

    while (!state.isErrored) {
      if (ac.signal.aborted) break;

      const eventsUrl = new URL(`${apiUrl}/api/session/${sessionId}/event`);
      if (state.cursor > 0) {
        eventsUrl.searchParams.set('after', String(state.cursor));
      }

      let eventReader:
        | ReturnType<typeof createIncrementalSseReader>
        | undefined;
      try {
        const eventRes = await opencodeFetch(eventsUrl, {
          signal: ac.signal,
        });

        if (!eventRes.ok) {
          const body = await eventRes.text();
          throw new Error(
            `event fetch failed HTTP ${eventRes.status}: ${body.slice(0, 300)}`,
          );
        }

        eventReader = createIncrementalSseReader(eventRes, ac);

        for await (const events of eventReader) {
          const { newParts } = processBatch(state, events);
          for (const part of newParts) {
            // Hold text/reasoning until a candidate is accepted. Otherwise
            // the browser could display or parse a known-invalid draft.
            if (
              part.type !== 'text-start' &&
              part.type !== 'text-delta' &&
              part.type !== 'text-end' &&
              part.type !== 'reasoning-start' &&
              part.type !== 'reasoning-delta' &&
              part.type !== 'reasoning-end'
            ) {
              yield part;
            }
          }
          if (state.isTerminal) break;
        }
      } catch (err) {
        if (!ac.signal.aborted) throw err;
      } finally {
        eventReader?.close();
      }

      if (!state.isTerminal) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const candidate = parseAgentResult(state.totalText);
      if (!candidate.code) break;

      const validation = await validateOpenScad(candidate.code, ac.signal);
      if (validation.valid) break;

      validationAttempts += 1;
      if (validationAttempts >= 3) {
        state.totalText = JSON.stringify({
          code: '',
          message: `OpenSCAD validation failed after 3 attempts: ${validation.diagnostics ?? 'unknown compiler error'}`,
        });
        break;
      }

      const previousCursor = state.cursor;
      state = makeState();
      state.cursor = previousCursor;
      const repairRes = await opencodeFetch(
        `${apiUrl}/api/session/${sessionId}/prompt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: {
              role: 'user',
              text: [
                `Your OpenSCAD candidate did not compile (attempt ${validationAttempts} of 3).`,
                'Return a corrected complete JSON artifact. Do not explain the failed draft.',
                `Compiler diagnostics: ${validation.diagnostics ?? 'none supplied'}`,
              ].join('\n'),
            },
          }),
          signal: ac.signal,
        },
      );
      if (!repairRes.ok) {
        const body = await repairRes.text();
        throw new Error(
          `repair prompt failed HTTP ${repairRes.status}: ${body.slice(0, 300)}`,
        );
      }
    }

    if (state.totalReasoning) {
      const reasoningId = 'validated-reasoning-1';
      yield { type: 'reasoning-start', id: reasoningId };
      yield {
        type: 'reasoning-delta',
        id: reasoningId,
        delta: state.totalReasoning,
      };
      yield { type: 'reasoning-end', id: reasoningId };
    }

    const finishPart: Extract<
      LanguageModelV3StreamPart,
      { type: 'finish' }
    > = {
      type: 'finish',
      finishReason: state.finishReason,
      usage: state.usage ?? USAGE(),
    };

    for (const part of finalizeAcceptedAgentResult(
      state.totalText,
      finishPart,
    )) {
      yield part;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isCancellation =
      ac.signal.aborted && /abort|canceled|cancelling/i.test(msg);
    if (!isCancellation) {
      logError(err, {
        functionName: 'opencode-api',
        statusCode: 500,
      });
    }
    yield {
      type: 'error',
      error: err instanceof Error ? err : new Error('opencode API call failed'),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!ac.signal.aborted) ac.abort();
  }
}

async function generateFromStream(
  appModelId: string,
  stream: ReadableStream<LanguageModelV3StreamPart>,
) {
  const content: LanguageModelV3Content[] = [];
  let finishReason = toFinishReason(undefined);
  let usage = USAGE();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === 'error') throw value.error;
      if (value.type === 'reasoning-delta') {
        content.push({ type: 'reasoning', text: value.delta });
      } else if (value.type === 'text-delta') {
        content.push({ type: 'text', text: value.delta });
      } else if (value.type === 'tool-call') {
        content.push({
          type: 'tool-call',
          toolCallId: value.toolCallId,
          toolName: value.toolName,
          input: value.input,
          providerExecuted: value.providerExecuted,
          dynamic: value.dynamic,
          providerMetadata: value.providerMetadata,
        });
      } else if (value.type === 'finish') {
        finishReason = value.finishReason;
        usage = value.usage;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    content,
    finishReason,
    usage,
    request: {},
    response: {
      id: 'opencode',
      modelId: appModelId,
      timestamp: new Date(),
    },
    warnings: [],
  };
}

function createOpencodeLanguageModel(appModelId: string): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'opencode',
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options: LanguageModelV3CallOptions) {
      const gen = streamParts(
        appModelId,
        formatPrompt(options.prompt),
        options,
      );
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          try {
            for await (const part of gen) {
              controller.enqueue(part);
            }
          } finally {
            controller.close();
          }
        },
      });
      return {
        stream,
        request: {},
        response: {},
      };
    },
    async doGenerate(options) {
      const result = await this.doStream(options);
      return generateFromStream(appModelId, result.stream);
    },
  };
}

/** Legacy OpenCode model factory retained for persisted model IDs. */
export function opencodeChatModel(appModelId: string): LanguageModelV3 {
  return createOpencodeLanguageModel(appModelId);
}

/** OpenCode HTTP/SSE transport used by the explicit Streaming execution mode. */
export function streamingOpencodeChatModel(
  appModelId: string,
): LanguageModelV3 {
  return createOpencodeLanguageModel(appModelId);
}
