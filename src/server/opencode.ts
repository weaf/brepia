import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
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

const USAGE = (): LanguageModelV2Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const MODELS_CACHE_TTL_MS = 5 * 60_000;

// Opencode serve HTTP API base URL.
// Priority: OPENCODE_BASE_URL (full URL) → OPENCODE_PORT (legacy) → default.
// start.sh uses port 4096, so that is the canonical default.
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
 * ALL registered providers (434 models vs ~47 from the API).
 * `listModels()` merges both: API models by ID (rich names), then CLI
 * models that aren't already present (filling in OpenRouter, Google, etc.).
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
 * Build a plain-text prompt from the AI SDK v2 prompt array. Tool calls and
 * tool results carry no meaning for OpenCode because pCAD owns artifact
 * conversion, so they are dropped.  System/modeling context and conversation
 * history are retained, followed by the shared final-result contract.
 */
export function formatPrompt(prompt: LanguageModelV2Prompt): string {
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

function _toFinishReason(
  reason: string | undefined,
): LanguageModelV2FinishReason {
  if (reason === 'length') return 'length';
  if (reason === 'tool-calls' || reason === 'tool_use') return 'tool-calls';
  if (reason === 'error') return 'error';
  return 'stop';
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
 * The endpoint is a persistent SSE stream (see `GET /doc` → "Subscribe to
 * session events … then continue with new durable events").  Reading the
 * entire response body with `Response.text()` blocks until EOF which never
 * arrives while the session is active — this caused a 2+ minute stall
 * (I09H-R1).  This function reads `eventRes.body` incrementally, decodes
 * chunks with `TextDecoder`, buffers incomplete SSE frames between chunks,
 * and yields a batch of complete `SSEEvent[]` as soon as they are available.
 *
 * The returned object also exposes a `close()` method that the caller should
 * invoke in the `finally` block to ensure the HTTP connection is cleaned up.
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

        // Split on double-newline (SSE event boundary).
        const parts = textBuffer.split('\n\n');
        textBuffer = parts.pop() ?? ''; // retain incomplete frame

        // Parse all complete events in this batch.
        const events: SSEEvent[] = [];
        for (const part of parts) {
          events.push(...parseSSE(part));
        }
        if (events.length) yield events;
      }
    } catch (err: unknown) {
      // If the signal was already aborted (intentional cancellation),
      // ignore the error. Otherwise re-throw.
      if (!ac.signal.aborted) throw err;
    } finally {
      // Flush any remaining buffered text (last incomplete frame).
      if (textBuffer) {
        const events = parseSSE(textBuffer);
        if (events.length) yield events;
      }
      reader.cancel();
      reader.releaseLock();
    }
  })() as AsyncIterableIterator<SSEEvent[]> & { close: () => void };

  gen.close = async () => {
    // Reader may already be cancelled (e.g., generator's finally ran).
    // This is safe to ignore — the stream is being torn down.
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  };

  return gen;
}

/**
 * Extract incremental text and reasoning from the accumulated event stream.
 *
 * Opencode event shapes:
 *   session.next.text.ended   → data.text = complete text segment
 *   session.next.reasoning.ended → data.text = reasoning content
 *   session.next.step.ended   → data.tokens = { input, output, reasoning, cache }
 *
 * NOT from `message.content` (that shape lives on the /message endpoint,
 * not on the SSE event stream).
 */
export function extractText(events: SSEEvent[]): {
  text: string;
  reasoning: string;
  tokens: LanguageModelV2Usage | undefined;
} {
  let text = '';
  let reasoning = '';
  let tokens:
    | { inputTokens: number; outputTokens: number; totalTokens: number }
    | undefined;
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
      const tok = evt.data['tokens'] as Record<string, unknown> | undefined;
      if (tok) {
        const input = Number(tok['input'] ?? 0);
        const output = Number(tok['output'] ?? 0);
        const reasoningTok = Number(tok['reasoning'] ?? 0);
        if (input || output || reasoningTok) {
          tokens = {
            inputTokens: input,
            outputTokens: output,
            totalTokens: input + output,
          };
        }
      }
    }
  }
  return { text, reasoning, tokens };
}

/**
 * Process one OpenCode event batch and yield the corresponding AI SDK
 * stream parts, updating the internal lifecycle state in place.
 *
 * This is the production event→stream-part state machine.  The S01/S02
 * tests exercise it directly via `processBatch()` so they share the same
 * logic as `streamParts()` (no duplicated parser/reducer).
 *
 * State is mutated in-place; `newParts` accumulates the AI SDK parts that
 * must be yielded to the controller.  `state.isTerminal` and
 * `state.isErrored` tell the caller whether polling should stop.
 *
 * LanguageModelV2 invariant:
 *   text-start → text-delta* → text-end    (one start, one end, no delta after end)
 *   reasoning-start → reasoning-delta* → reasoning-end
 *   Ends are emitted only AFTER all events in the batch have been
 *   processed and only when the stream is terminal (or errored).
 */
export function processBatch(
  state: {
    cursor: number;
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage | undefined;
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
): { newParts: LanguageModelV2StreamPart[] } {
  const newParts: LanguageModelV2StreamPart[] = [];

  for (const evt of events) {
    // Update cursor (durable sequence number).
    const dur = evt.data['durable'] as Record<string, unknown> | undefined;
    if (dur && typeof dur['seq'] === 'number') {
      state.cursor = Math.max(state.cursor, dur['seq'] as number);
    }

    // Permission request detected — log warning but do NOT auto-approve.
    // G02B policy: no tool use allowed; Streaming path has no permission
    // reply UI, so permission.v2.asked events may cause session hang.
    // This is a documented limitation (see G02D in status file).
    if (evt.type?.includes('permission.v2.asked')) {
      const action = evt.data['action'] as string | undefined;
      const resources = evt.data['resources'] as string[] | undefined;
      logWarning('permission.v2.asked event detected', {
        functionName: 'opencode-permission-asked',
        action,
        resources,
      });
      // Record permission request for downstream handling; we do NOT
      // auto-approve because G02B policy explicitly denies tool use.
      if (!state.permissionRequests) state.permissionRequests = [];
      state.permissionRequests.push({
        action,
        resources,
        id: (evt.data['id'] as string) ?? 'unknown',
      });
    }

    // Terminal: step.failed (immediate stop).
    if (evt.type?.includes('step.failed')) {
      state.isTerminal = true;
      state.isErrored = true;
      state.finishReason = 'error';
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
      // No further processing after error.
      break;
    }

    // A tool-calls step is an internal OpenCode agent transition, not a final
    // response.  Agents use it to receive a custom tool result and continue
    // their own validation/revision loop.  Only a non-tool terminal step ends
    // the pCAD transport.
    if (evt.type?.includes('step.ended')) {
      const finish = evt.data['finish'];
      if (finish !== 'tool-calls' && finish !== 'tool_use') {
        state.isTerminal = true;
      }
      const tok = evt.data['tokens'] as Record<string, unknown> | undefined;
      if (tok) {
        const input = Number(tok['input'] ?? 0);
        const output = Number(tok['output'] ?? 0);
        if (input || output) {
          state.usage = {
            inputTokens: input,
            outputTokens: output,
            totalTokens: input + output,
          };
        }
      }
    }

    // Text segment.
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

    // Reasoning segment.
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

  // Close open parts ONLY after processing all events and only when
  // terminal/errored.  D05: LanguageModelV2 requires text-end/reasoning-end
  // to close each part; they must come once at terminal, not per poll.
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
 * AI SDK stream. The agent's {code,message} JSON is an internal transport
 * contract and must never be emitted as ordinary assistant text.
 */
export function finalizeAcceptedAgentResult(
  text: string,
  finishPart: Extract<LanguageModelV2StreamPart, { type: 'finish' }>,
): LanguageModelV2StreamPart[] {
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

/**
 * Interrupt an active OpenCode session via the server API.
 *
 * OpenCode 1.18+ uses POST /api/session/{id}/interrupt (not /abort).
 * "Interrupt active execution owned by this OpenCode process.
 *  Idle interruption is a no-op."
 *
 * This is the canonical server-side cleanup for both user-initiated
 * Stop (aiChat.ts → options.abortSignal) and the 8-minute timeout.
 */
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
 * Execute one request through the opencode HTTP API:
 * 1. POST /api/session with model
 * 2. POST /api/session/{id}/prompt
 * 3. GET /api/session/{id}/event (SSE) — read until step.ended or step.failed
 */
async function* streamParts(
  modelId: string,
  prompt: string,
  options: LanguageModelV2CallOptions,
): AsyncGenerator<LanguageModelV2StreamPart> {
  yield { type: 'stream-start', warnings: [] };
  const ac = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const apiUrl = opencodeApiUrl();
    const slash = modelId.indexOf('/');
    const providerID = slash > 0 ? modelId.slice(0, slash) : 'opencode';
    const bareId = slash > 0 ? modelId.slice(slash + 1) : modelId;

    // Step 1: Create session with model
    let sessionId = '';
    // 8-minute timeout — aborts streaming and interrupts server-side execution
    timeout = setTimeout(async () => {
      ac.abort();
      if (sessionId) await interruptSession(apiUrl, sessionId);
    }, 8 * 60_000);

    try {
      const sessionRes = await opencodeFetch(`${apiUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Every pCAD OpenCode model uses the project-local agent. The model
          // remains user-selected in the request below; the agent supplies the
          // validation/revision workflow and restricted tool policy.
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

    // Step 2: Send prompt
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

    // Step 3: Read SSE events incrementally using the shared processBatch
    // helper.  The OpenCode /event endpoint is a long-lived SSE subscription
    // (not a finite batch).  `createIncrementalSseReader` consumes
    // eventRes.body directly so events yield as soon as they arrive — no
    // waiting for EOF.  See `createIncrementalSseReader` for details.
    const makeState = () => ({
      cursor: 0,
      finishReason: 'stop' as LanguageModelV2FinishReason,
      usage: undefined as LanguageModelV2Usage | undefined,
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
      permissionRequests: [],
    });
    let state = makeState();
    let validationAttempts = 0;

    // The app, not the model, is the validation authority.  A model may skip
    // its custom tool call or falsely claim success; after every completed CAD
    // artifact pCAD compiles the exact source and, on failure, asks the same
    // OpenCode agent to repair it (up to three total candidates).
    while (!state.isErrored) {
      // Check for prior cancellation before fetching.
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
        // Re-throw if this wasn't caused by intentional cancellation.
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

      // Keep the durable cursor so the next subscription receives only the
      // repair turn, not the already-rejected candidate's historical events.
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

      // Start reading the repair turn from its own fresh event cursor.
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
      LanguageModelV2StreamPart,
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
    // AbortError from intentional cancellation (user Stop, timeout) is NOT a
    // provider/model failure.  Log it at debug level so it doesn't pollute
    // error logs while still leaving a trace.
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
    if (!ac.signal.aborted) {
      ac.abort();
    }
  }
}

export function opencodeChatModel(appModelId: string): LanguageModelV2 {
  return {
    specificationVersion: 'v2',
    provider: 'opencode',
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options) {
      const prompt = formatPrompt(options.prompt);
      // Pass full modelId (e.g. "opencode/big-pickle" or
      // "llama-swap/qwen3.6-35b-mtp-128k") — streamParts parses it.
      const gen = streamParts(appModelId, prompt, options);
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
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
        usage: USAGE(),
        abort: () => {
          options.abortSignal?.dispatchEvent(new Event('abort'));
        },
      };
    },
    async doGenerate(options) {
      const result = await this.doStream(options);
      const parts: LanguageModelV2StreamPart[] = [];
      const reader = result.stream.getReader();
      try {
        let done = false;
        while (!done) {
          const { done: d, value } = await reader.read();
          done = d;
          if (value) parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const texts = parts
        .filter(
          (
            p,
          ): p is Extract<LanguageModelV2StreamPart, { type: 'text-delta' }> =>
            p.type === 'text-delta',
        )
        .map((p) => p.delta);
      const reasonings = parts
        .filter(
          (
            p,
          ): p is Extract<
            LanguageModelV2StreamPart,
            { type: 'reasoning-delta' }
          > => p.type === 'reasoning-delta',
        )
        .map((p) => p.delta);

      // Manual findLast (no ES2023 dependency)
      let finish:
        | Extract<LanguageModelV2StreamPart, { type: 'finish' } | undefined>
        | undefined;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].type === 'finish') {
          finish = parts[i] as Extract<
            LanguageModelV2StreamPart,
            { type: 'finish' }
          >;
          break;
        }
      }
      let errorPart:
        | Extract<LanguageModelV2StreamPart, { type: 'error' }>
        | undefined;
      for (const p of parts) {
        if (p.type === 'error') {
          errorPart = p as Extract<
            LanguageModelV2StreamPart,
            { type: 'error' }
          >;
          break;
        }
      }
      if (errorPart) throw errorPart.error;

      const content: LanguageModelV2Content[] = [];
      if (reasonings.length)
        content.push({ type: 'reasoning', text: reasonings.join('') });
      if (texts.length) content.push({ type: 'text', text: texts.join('') });

      return {
        content,
        finishReason: finish?.finishReason ?? 'stop',
        usage: finish?.usage ?? USAGE(),
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: {},
        response: {
          id: 'opencode',
          model: appModelId,
          timestamp: new Date(Date.now()),
          headers: {},
          body: undefined,
        },
        warnings: [],
      };
    },
  };
}

export function streamingOpencodeChatModel(
  appModelId: string,
): LanguageModelV2 {
  return {
    specificationVersion: 'v2',
    provider: 'opencode',
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options) {
      const gen = streamParts(
        appModelId,
        formatPrompt(options.prompt),
        options,
      );
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        async start(controller) {
          try {
            // streamParts now performs the one terminal envelope conversion
            // after server-side OpenSCAD validation. Forward semantic parts
            // verbatim so the internal {code,message} JSON never reaches UI.
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
        usage: USAGE(),
        abort: () => {
          options.abortSignal?.dispatchEvent(new Event('abort'));
        },
      };
    },
    async doGenerate(options) {
      const result = await this.doStream(options);
      const parts: LanguageModelV2StreamPart[] = [];
      const reader = result.stream.getReader();
      try {
        let done = false;
        while (!done) {
          const { done: d, value } = await reader.read();
          done = d;
          if (value) parts.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const texts = parts
        .filter(
          (
            p,
          ): p is Extract<LanguageModelV2StreamPart, { type: 'text-delta' }> =>
            p.type === 'text-delta',
        )
        .map((p) => p.delta);
      const reasonings = parts
        .filter(
          (
            p,
          ): p is Extract<
            LanguageModelV2StreamPart,
            { type: 'reasoning-delta' }
          > => p.type === 'reasoning-delta',
        )
        .map((p) => p.delta);

      let finish:
        | Extract<LanguageModelV2StreamPart, { type: 'finish' }>
        | undefined;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].type === 'finish') {
          finish = parts[i] as Extract<
            LanguageModelV2StreamPart,
            { type: 'finish' }
          >;
          break;
        }
      }
      let errorPart:
        | Extract<LanguageModelV2StreamPart, { type: 'error' }>
        | undefined;
      for (const p of parts) {
        if (p.type === 'error') {
          errorPart = p as Extract<
            LanguageModelV2StreamPart,
            { type: 'error' }
          >;
          break;
        }
      }
      if (errorPart) throw errorPart.error;

      const content: LanguageModelV2Content[] = [];
      if (reasonings.length)
        content.push({ type: 'reasoning', text: reasonings.join('') });
      if (texts.length) content.push({ type: 'text', text: texts.join('') });

      return {
        content,
        finishReason: finish?.finishReason ?? 'stop',
        usage: finish?.usage ?? USAGE(),
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: {},
        response: {
          id: 'opencode',
          model: appModelId,
          timestamp: new Date(Date.now()),
          headers: {},
          body: undefined,
        },
        warnings: [],
      };
    },
  };
}
