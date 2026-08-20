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
  resolveAgentResultChannels,
} from './opencodeAgentResult';
import { validateOpenScad } from './openScadValidation';
import { logError, logWarning } from './serverLog';
import { isRequestAbort } from './requestAbort';

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
const PCAD_OPENCODE_AGENT = 'pcad-builder';

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

function promptTextParts(
  message: LanguageModelV3Prompt[number],
  includeReasoning = true,
): string[] {
  const parts = Array.isArray(message.content)
    ? message.content
    : [message.content];
  const textParts: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      textParts.push(part);
    } else if (part.type === 'text') {
      textParts.push(part.text);
    } else if (includeReasoning && part.type === 'reasoning') {
      textParts.push(`(thinking: ${part.text})`);
    }
  }
  return textParts;
}

/**
 * Build a plain-text prompt from the AI SDK v3 prompt array. This remains the
 * fallback for legacy one-shot OpenCode model IDs. Persistent pCAD/OpenCode
 * sessions use `buildPersistentOpenCodePrompt` below so history is not sent
 * again on every turn.
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
    const textParts = promptTextParts(message);
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

export type OpenCodeSessionIdentity = {
  agent: typeof PCAD_OPENCODE_AGENT;
  model: { providerID: string; id: string };
  title: string;
};

export function buildOpenCodeSessionIdentity(
  modelId: string,
  prompt: string,
): OpenCodeSessionIdentity {
  const slash = modelId.indexOf('/');
  const providerID = slash > 0 ? modelId.slice(0, slash) : 'opencode';
  const bareId = slash > 0 ? modelId.slice(slash + 1) : modelId;
  return {
    title: buildOpenCodeSessionTitle(bareId, prompt),
    agent: PCAD_OPENCODE_AGENT,
    model: { providerID, id: bareId },
  };
}

/**
 * One OpenCode session belongs to one pCAD conversation, independent of which
 * underlying model is currently selected. OpenCode only requires session IDs
 * to start with `ses`, so the pCAD UUID can safely provide a stable identity
 * across browser/server restarts without another persistence table.
 */
export function buildOpenCodeSessionId(conversationId: string): string {
  const compact = conversationId.replace(/[^A-Za-z0-9]/g, '');
  if (!compact) throw new Error('Cannot build OpenCode session ID without conversation ID');
  return `ses_pcad_${compact}`;
}

export function buildOpenCodePromptBody(text: string) {
  return {
    prompt: { text },
    resume: true,
  };
}

type ParametricArtifactSnapshot = {
  title: string;
  version: string;
  code: string;
};

function parseArtifactInput(value: unknown): ParametricArtifactSnapshot | undefined {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return undefined;
    }
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined;
  }
  const record = candidate as Record<string, unknown>;
  if (typeof record['code'] !== 'string' || !record['code'].trim()) return undefined;
  return {
    title:
      typeof record['title'] === 'string' && record['title'].trim()
        ? record['title'].trim()
        : 'Current pCAD model',
    version:
      typeof record['version'] === 'string' && record['version'].trim()
        ? record['version'].trim()
        : 'v1',
    code: record['code'],
  };
}

/** Find the authoritative current OpenSCAD artifact in the AI SDK branch. */
export function currentParametricArtifactFromPrompt(
  prompt: LanguageModelV3Prompt,
): ParametricArtifactSnapshot | undefined {
  for (let messageIndex = prompt.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = prompt[messageIndex];
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!part || typeof part !== 'object') continue;
      const record = part as unknown as Record<string, unknown>;
      if (
        record['type'] !== 'tool-call' ||
        record['toolName'] !== 'build_parametric_model'
      ) {
        continue;
      }
      const artifact = parseArtifactInput(record['input']);
      if (artifact) return artifact;
    }
  }
  return undefined;
}

function toolOutputText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;

  if (record['type'] === 'text') {
    if (typeof record['value'] === 'string') return record['value'];
    if (typeof record['text'] === 'string') return record['text'];
  }

  if (record['type'] === 'content' && Array.isArray(record['value'])) {
    return record['value']
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
        const content = item as Record<string, unknown>;
        return content['type'] === 'text' && typeof content['text'] === 'string'
          ? content['text']
          : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof record['value'] === 'string') return record['value'];
  if (typeof record['text'] === 'string') return record['text'];
  return '';
}

function latestBuildResultFromPrompt(prompt: LanguageModelV3Prompt): string {
  for (let messageIndex = prompt.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = prompt[messageIndex];
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!part || typeof part !== 'object') continue;
      const record = part as unknown as Record<string, unknown>;
      if (
        record['type'] !== 'tool-result' ||
        record['toolName'] !== 'build_parametric_model'
      ) {
        continue;
      }
      const text = toolOutputText(record['output']).trim();
      if (text) return text;
    }
  }
  return '';
}

function latestUserPromptText(prompt: LanguageModelV3Prompt): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role !== 'user') continue;
    return promptTextParts(prompt[index], false).join('\n').trim();
  }
  return '';
}

function systemPromptText(prompt: LanguageModelV3Prompt): string {
  return prompt
    .filter((message) => message.role === 'system')
    .flatMap((message) => promptTextParts(message, false))
    .join('\n\n')
    .trim();
}

/**
 * Build only the NEW turn for a persistent OpenCode session. OpenCode owns its
 * conversation history; pCAD owns the authoritative CAD state. Therefore each
 * turn carries the current complete OpenSCAD artifact plus the new instruction
 * or compile feedback, instead of replaying the entire pCAD chat history.
 *
 * If the OpenCode session had to be recreated during a client-tool continuation
 * (for example after an OpenCode restart), the latest user request is included
 * once so the reconstructed session still knows the original intent.
 */
export function buildPersistentOpenCodePrompt(
  prompt: LanguageModelV3Prompt,
  sessionCreated: boolean,
): string {
  const lines: string[] = [
    '<environment instructions>',
    'You are the persistent OpenCode worker for one pCAD conversation.',
    'Treat <current_pcad_artifact> as the authoritative model currently shown by pCAD.',
    'Do NOT use OpenCode filesystem, shell, network, web, or external tools.',
    'The pCAD agent may use only pcad_validate to check an OpenSCAD candidate.',
    'pCAD, not you, converts a completed CAD artifact into its build_parametric_model tool call.',
    '</environment instructions>',
  ];

  const system = systemPromptText(prompt);
  if (system) {
    lines.push(`<pcad_system_context>\n${system}\n</pcad_system_context>`);
  }

  const artifact = currentParametricArtifactFromPrompt(prompt);
  if (artifact) {
    lines.push(
      [
        '<current_pcad_artifact>',
        `title: ${artifact.title}`,
        `version: ${artifact.version}`,
        '<openscad>',
        artifact.code,
        '</openscad>',
        '</current_pcad_artifact>',
      ].join('\n'),
    );
  }

  const latestUser = latestUserPromptText(prompt);
  const buildResult = latestBuildResultFromPrompt(prompt);
  const lastRole = prompt[prompt.length - 1]?.role;
  const isBuildContinuation = lastRole === 'tool' && Boolean(buildResult);

  if ((!isBuildContinuation || sessionCreated) && latestUser) {
    lines.push(`<user_request>\n${latestUser}\n</user_request>`);
  }

  if (isBuildContinuation) {
    lines.push(
      [
        '<pcad_build_result>',
        buildResult,
        '</pcad_build_result>',
        '<continuation_instruction>',
        'Continue the same CAD task using the authoritative current artifact above.',
        'If another geometry revision is needed, return a corrected complete artifact.',
        'If the current artifact already satisfies the task, return the concise final message.',
        '</continuation_instruction>',
      ].join('\n'),
    );
  } else if (!latestUser) {
    lines.push(
      '<continuation_instruction>Continue the current pCAD task from the authoritative artifact above.</continuation_instruction>',
    );
  }

  lines.push(buildAgentOutputContract());
  return lines.join('\n\n');
}

/**
 * OpenCode versions have differed in how reliably POST /session preserves a
 * supplied title. Apply it through the dedicated update endpoint before the
 * first prompt so the TUI never starts its automatic "New session" title flow.
 */
export async function updateOpenCodeSessionTitle(
  apiUrl: string,
  sessionId: string,
  title: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await opencodeFetch(
      `${apiUrl}/api/session/${sessionId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
        signal,
      },
    );
    if (response.ok) return true;

    const body = await response.text();
    logWarning(
      `Could not label OpenCode session ${sessionId} (HTTP ${response.status}): ${body.slice(0, 160)}`,
      { functionName: 'opencode-session-title' },
    );
    return false;
  } catch (error) {
    if (signal?.aborted) throw error;
    logWarning(
      `Could not label OpenCode session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      { functionName: 'opencode-session-title' },
    );
    return false;
  }
}

type OpenCodeSessionData = {
  id: string;
  agent?: string;
  model?: { providerID?: string; id?: string };
};

function sessionDataFromJson(value: unknown): OpenCodeSessionData | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const data = (value as Record<string, unknown>)['data'];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record['id'] !== 'string') return undefined;
  const model =
    record['model'] &&
    typeof record['model'] === 'object' &&
    !Array.isArray(record['model'])
      ? (record['model'] as Record<string, unknown>)
      : undefined;
  return {
    id: record['id'],
    agent: typeof record['agent'] === 'string' ? record['agent'] : undefined,
    model: model
      ? {
          providerID:
            typeof model['providerID'] === 'string'
              ? model['providerID']
              : undefined,
          id: typeof model['id'] === 'string' ? model['id'] : undefined,
        }
      : undefined,
  };
}

async function createOpenCodeSession(
  apiUrl: string,
  identity: OpenCodeSessionIdentity,
  signal: AbortSignal,
  requestedId?: string,
): Promise<OpenCodeSessionData> {
  const response = await opencodeFetch(`${apiUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(requestedId ? { id: requestedId } : {}),
      agent: identity.agent,
      model: identity.model,
    }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `session creation failed HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }
  const session = sessionDataFromJson(await response.json());
  if (!session) throw new Error('session creation returned no session id');
  return session;
}

async function switchOpenCodeSessionAgent(
  apiUrl: string,
  sessionId: string,
  agent: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await opencodeFetch(
    `${apiUrl}/api/session/${sessionId}/agent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent }),
      signal,
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `session agent switch failed HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }
}

async function switchOpenCodeSessionModel(
  apiUrl: string,
  sessionId: string,
  model: OpenCodeSessionIdentity['model'],
  signal: AbortSignal,
): Promise<void> {
  const response = await opencodeFetch(
    `${apiUrl}/api/session/${sessionId}/model`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      signal,
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `session model switch failed HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }
}

export async function ensureOpenCodeSession(
  apiUrl: string,
  identity: OpenCodeSessionIdentity,
  conversationId: string,
  signal: AbortSignal,
): Promise<{ sessionId: string; created: boolean; titleUpdated: boolean }> {
  const sessionId = buildOpenCodeSessionId(conversationId);
  const existingResponse = await opencodeFetch(
    `${apiUrl}/api/session/${sessionId}`,
    { signal },
  );

  if (existingResponse.status === 404) {
    const created = await createOpenCodeSession(
      apiUrl,
      identity,
      signal,
      sessionId,
    );
    const titleUpdated = await updateOpenCodeSessionTitle(
      apiUrl,
      created.id,
      identity.title,
      signal,
    );
    return { sessionId: created.id, created: true, titleUpdated };
  }

  if (!existingResponse.ok) {
    const body = await existingResponse.text();
    throw new Error(
      `session lookup failed HTTP ${existingResponse.status}: ${body.slice(0, 300)}`,
    );
  }

  const existing = sessionDataFromJson(await existingResponse.json());
  if (!existing) throw new Error('session lookup returned no session id');

  if (existing.agent !== identity.agent) {
    await switchOpenCodeSessionAgent(
      apiUrl,
      existing.id,
      identity.agent,
      signal,
    );
  }

  if (
    existing.model?.providerID !== identity.model.providerID ||
    existing.model?.id !== identity.model.id
  ) {
    await switchOpenCodeSessionModel(
      apiUrl,
      existing.id,
      identity.model,
      signal,
    );
  }

  return { sessionId: existing.id, created: false, titleUpdated: true };
}

async function submitOpenCodePrompt(
  apiUrl: string,
  sessionId: string,
  text: string,
  signal: AbortSignal,
): Promise<number | undefined> {
  const response = await opencodeFetch(
    `${apiUrl}/api/session/${sessionId}/prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOpenCodePromptBody(text)),
      signal,
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `prompt submission failed HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as Record<string, unknown>;
  const data =
    json['data'] && typeof json['data'] === 'object' && !Array.isArray(json['data'])
      ? (json['data'] as Record<string, unknown>)
      : undefined;
  return typeof data?.['admittedSeq'] === 'number'
    ? (data['admittedSeq'] as number)
    : undefined;
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
  durable?: { seq: number };
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
          durable?: { seq?: unknown };
        };
        if (payload.type && payload.data) {
          events.push({
            type: payload.type,
            data: payload.data,
            ...(typeof payload.durable?.seq === 'number'
              ? { durable: { seq: payload.durable.seq } }
              : {}),
          });
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
    const legacyDurable = evt.data['durable'] as Record<string, unknown> | undefined;
    const durableSeq =
      evt.durable?.seq ??
      (legacyDurable && typeof legacyDurable['seq'] === 'number'
        ? (legacyDurable['seq'] as number)
        : undefined);
    if (durableSeq !== undefined) {
      state.cursor = Math.max(state.cursor, durableSeq);
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
 * LanguageModelV3 stream. When `conversationId` is supplied, the same OpenCode
 * session is reused for every pCAD turn and the selected model is switched in
 * place rather than creating a new session.
 */
async function* streamParts(
  modelId: string,
  prompt: LanguageModelV3Prompt,
  options: LanguageModelV3CallOptions,
  conversationId?: string,
): AsyncGenerator<LanguageModelV3StreamPart> {
  yield { type: 'stream-start', warnings: [] };
  const ac = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const apiUrl = opencodeApiUrl();
    const formattedPrompt = formatPrompt(prompt);
    const identity = buildOpenCodeSessionIdentity(modelId, formattedPrompt);
    const { providerID, id: bareId } = identity.model;

    let sessionId = '';
    timeout = setTimeout(async () => {
      ac.abort();
      if (sessionId) await interruptSession(apiUrl, sessionId);
    }, 8 * 60_000);
    options.abortSignal?.addEventListener(
      'abort',
      async () => {
        ac.abort();
        if (sessionId) await interruptSession(apiUrl, sessionId);
      },
      { once: true },
    );

    let sessionCreated = true;
    let titleUpdated = false;
    try {
      if (conversationId) {
        const ensured = await ensureOpenCodeSession(
          apiUrl,
          identity,
          conversationId,
          ac.signal,
        );
        sessionId = ensured.sessionId;
        sessionCreated = ensured.created;
        titleUpdated = ensured.titleUpdated;
      } else {
        const session = await createOpenCodeSession(
          apiUrl,
          identity,
          ac.signal,
        );
        sessionId = session.id;
        titleUpdated = await updateOpenCodeSessionTitle(
          apiUrl,
          sessionId,
          identity.title,
          ac.signal,
        );
      }

      console.info('opencode session', {
        sessionId,
        reused: !sessionCreated,
        title: identity.title,
        titleUpdated,
        agent: identity.agent,
        model: `${providerID}/${bareId}`,
      });
    } catch (err) {
      throw new Error(
        `opencode session setup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const turnPrompt = conversationId
      ? buildPersistentOpenCodePrompt(prompt, sessionCreated)
      : formattedPrompt;
    const admittedSeq = await submitOpenCodePrompt(
      apiUrl,
      sessionId,
      turnPrompt,
      ac.signal,
    );
    if (conversationId && admittedSeq === undefined) {
      throw new Error(
        'persistent OpenCode prompt returned no admittedSeq; refusing to replay older session events',
      );
    }

    const makeState = (cursor = 0) => ({
      cursor,
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
    let state = makeState(admittedSeq ?? 0);
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

      const { resultText } = resolveAgentResultChannels(
        state.totalText,
        state.totalReasoning,
      );
      const candidate = parseAgentResult(resultText);
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

      const repairPrompt = [
        `Your OpenSCAD candidate did not compile (attempt ${validationAttempts} of 3).`,
        'Return a corrected complete JSON artifact. Do not explain the failed draft.',
        `Compiler diagnostics: ${validation.diagnostics ?? 'none supplied'}`,
      ].join('\n');
      const repairSeq = await submitOpenCodePrompt(
        apiUrl,
        sessionId,
        repairPrompt,
        ac.signal,
      );
      state = makeState(repairSeq ?? state.cursor);
    }

    const accepted = resolveAgentResultChannels(
      state.totalText,
      state.totalReasoning,
    );

    if (accepted.reasoningText) {
      const reasoningId = 'validated-reasoning-1';
      yield { type: 'reasoning-start', id: reasoningId };
      yield {
        type: 'reasoning-delta',
        id: reasoningId,
        delta: accepted.reasoningText,
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
      accepted.resultText,
      finishPart,
    )) {
      yield part;
    }
  } catch (err) {
    // Explicit stop (or a replacement run) aborts the generation controller.
    // End the provider stream normally instead of forwarding that expected
    // cancellation as an error chunk that aiChat would report as HTTP 500.
    if (options.abortSignal && isRequestAbort(err, options.abortSignal)) {
      return;
    }

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

function createOpencodeLanguageModel(
  appModelId: string,
  conversationId?: string,
): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: 'opencode',
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options: LanguageModelV3CallOptions) {
      const gen = streamParts(
        appModelId,
        options.prompt,
        options,
        conversationId,
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
  conversationId?: string,
): LanguageModelV3 {
  return createOpencodeLanguageModel(appModelId, conversationId);
}
