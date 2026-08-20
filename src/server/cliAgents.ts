/**
 * OpenCode and Codex are coding agents, not native AI SDK providers. This
 * adapter runs either CLI in a stable empty working directory and turns its
 * final OpenSCAD answer into pCAD's existing build_parametric_model tool call.
 *
 * Both CLIs persist their own sessions. pCAD carries the discovered external
 * session ID forward inside the persisted tool-call ID, so the next turn can
 * resume the same agent session without adding database schema or server-local
 * state. This also survives a pCAD restart because tool-call IDs are stored in
 * the conversation branch.
 *
 * The HTTP response is still an AI SDK stream, but the agent invocation itself
 * is deliberately non-streaming. pCAD needs the complete SCAD program before
 * it can compile and preview it, so token-by-token agent output has no product
 * value here.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { env } from './env';
import {
  buildAgentOutputContract,
  parseAgentResult,
  type AgentResult,
} from './opencodeAgentResult';
import { logWarning } from './serverLog';

const TIMEOUT_MS = 8 * 60_000;
const CLI_AGENT_WORKDIR = join(tmpdir(), 'pcad-cli-agent');
const SESSION_MARKER_PREFIX = 'cli-agent-session';

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

function finishReason(
  unified: LanguageModelV3FinishReason['unified'],
): LanguageModelV3FinishReason {
  return { unified, raw: unified };
}

type AgentKind = 'opencode' | 'codex';

export type CliAgentModel = {
  id: string;
  name: string;
  description: string;
  provider: 'OpenCode Agent' | 'Codex Agent';
  supportsTools: true;
  supportsThinking: false;
  supportsVision: false;
};

export function isCliAgentModel(modelId: string): boolean {
  return (
    modelId.startsWith('agent/opencode/') || modelId.startsWith('agent/codex/')
  );
}

/**
 * Underlying OpenCode `provider/model` ID for the canonical UI ID
 * `agent/opencode/<provider>/<model>` (the form `/api/opencode/models`
 * emits). Legacy `opencode/...` IDs pass through unchanged. Returns
 * undefined for non-OpenCode models so callers can detect the canonical
 * agent path before choosing a transport.
 */
export function opencodeAgentUnderlyingModelId(
  modelId: string,
): string | undefined {
  if (modelId.startsWith('agent/opencode/')) {
    return modelId.slice('agent/opencode/'.length);
  }
  if (modelId.startsWith('opencode/')) {
    return modelId;
  }
  return undefined;
}

export type ChatTransport =
  | { kind: 'cli-agent' }
  | { kind: 'streaming-opencode'; underlyingModelId: string }
  | { kind: 'normal' };

/**
 * Pick the chat transport for a model ID and execution mode.
 *
 * The canonical OpenCode agent ID `agent/opencode/<provider>/<model>` is the
 * single routable form: `executionMode === 'cli'` selects the CLI adapter,
 * `executionMode === 'streaming'` selects the streaming HTTP adapter. The
 * transport is never encoded in a different model ID.
 *
 * Legacy `opencode/...` IDs (possibly persisted in old conversations) keep
 * today's behavior: streaming mode routes to the streaming adapter, any other
 * mode falls through to `buildChatModel` (which resolves them via
 * `providerFor` -> `opencodeChatModel`). Non-OpenCode models always fall
 * through unchanged.
 */
export function selectChatTransport(
  modelId: string,
  executionMode: 'cli' | 'streaming',
): ChatTransport {
  const underlying = opencodeAgentUnderlyingModelId(modelId);
  if (underlying === undefined) return { kind: 'normal' };
  if (executionMode === 'streaming') {
    return { kind: 'streaming-opencode', underlyingModelId: underlying };
  }
  return modelId.startsWith('agent/opencode/')
    ? { kind: 'cli-agent' }
    : { kind: 'normal' };
}

function parseModelId(modelId: string): { agent: AgentKind; model: string } {
  const match = /^agent\/(opencode|codex)\/(.+)$/.exec(modelId);
  if (!match) throw new Error(`Unsupported CLI agent model ${modelId}`);
  return { agent: match[1] as AgentKind, model: match[2] };
}

function displayName(id: string): string {
  return id
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/** Codex has no supported command for enumerating account-entitled models. */
export function configuredCodexModels(): CliAgentModel[] {
  const configured = env('CODEX_MODELS')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const ids = [...new Set(['default', ...configured])];
  return ids.map((model) => ({
    id: `agent/codex/${model}`,
    name:
      model === 'default' ? 'Codex (default)' : `Codex · ${displayName(model)}`,
    description:
      model === 'default'
        ? 'Uses the model selected in the local Codex profile'
        : 'Configured Codex CLI model',
    provider: 'Codex Agent',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
  }));
}

async function ensureCliAgentWorkdir(): Promise<string> {
  await mkdir(CLI_AGENT_WORKDIR, { recursive: true });
  return CLI_AGENT_WORKDIR;
}

function runCli(
  bin: string,
  args: string[],
  input: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const fail = (error: Error) => {
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(new Error(`${bin} timed out after ${TIMEOUT_MS / 60_000} minutes`));
    }, TIMEOUT_MS);
    const abort = () => {
      child.kill('SIGKILL');
      fail(new Error(`${bin} request was cancelled`));
    };
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error) => fail(error));
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(`${bin} exited ${code}: ${stderr.trim().slice(0, 500)}`),
        );
    });
    child.stdin.end(input);
  });
}

type ParsedCliOutput = {
  text: string;
  sessionId?: string;
};

export function parseOpenCodeCliOutput(
  stdout: string,
  stderr = '',
): ParsedCliOutput {
  let text = '';
  let sessionId: string | undefined;
  for (const line of stdout.split('\n')) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        sessionID?: string;
        sessionId?: string;
        part?: { type?: string; text?: string; sessionID?: string };
      };
      const eventSessionId =
        typeof event.sessionID === 'string'
          ? event.sessionID
          : typeof event.sessionId === 'string'
            ? event.sessionId
            : typeof event.part?.sessionID === 'string'
              ? event.part.sessionID
              : undefined;
      if (eventSessionId?.startsWith('ses')) sessionId = eventSessionId;
      if (event.type === 'text' && event.part?.type === 'text') {
        text = event.part.text ?? text;
      }
    } catch {
      // OpenCode can write informational non-JSON lines; they are not output.
    }
  }

  if (!sessionId) {
    const stderrMatch = /\bsession:\s*(ses_[A-Za-z0-9_-]+)/i.exec(stderr);
    if (stderrMatch) sessionId = stderrMatch[1];
  }

  return { text, sessionId };
}

export function parseCodexCliOutput(stdout: string): ParsedCliOutput {
  let text = '';
  let sessionId: string | undefined;
  for (const line of stdout.split('\n')) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        thread_id?: string;
        item?: { type?: string; text?: string };
      };
      if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
        sessionId = event.thread_id;
      }
      if (
        event.type === 'item.completed' &&
        event.item?.type === 'agent_message'
      ) {
        text = event.item.text ?? text;
      }
    } catch {
      // Codex --json is JSONL, but keep the parser defensive.
    }
  }
  return { text, sessionId };
}

function promptTextParts(message: LanguageModelV3Prompt[number]): string[] {
  const parts = Array.isArray(message.content)
    ? message.content
    : [message.content];
  return parts.flatMap((part) => {
    if (typeof part === 'string') return [part];
    if (part.type === 'text') return [part.text];
    return [];
  });
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

function currentArtifact(prompt: LanguageModelV3Prompt): ParametricArtifactSnapshot | undefined {
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

function latestBuildResult(prompt: LanguageModelV3Prompt): string {
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

function latestUserText(prompt: LanguageModelV3Prompt): string {
  for (let index = prompt.length - 1; index >= 0; index -= 1) {
    if (prompt[index].role !== 'user') continue;
    return promptTextParts(prompt[index]).join('\n').trim();
  }
  return '';
}

function systemText(prompt: LanguageModelV3Prompt): string {
  return prompt
    .filter((message) => message.role === 'system')
    .flatMap((message) => promptTextParts(message))
    .join('\n\n')
    .trim();
}

/**
 * Build only the state needed for this CLI turn. The external agent session
 * owns its conversation history while pCAD remains authoritative for the CAD
 * artifact. Every turn therefore carries the complete current OpenSCAD source
 * plus the new user request or latest browser compile/inspection result.
 */
export function buildPersistentCliAgentPrompt(
  prompt: LanguageModelV3Prompt,
  sessionExists: boolean,
): string {
  const lines: string[] = [
    '<environment_instructions>',
    'You are an AI CAD worker reached from pCAD.',
    'Treat <current_pcad_artifact> as the authoritative model currently shown by pCAD.',
    'Do not use filesystem, shell, network, or external files; work only from the supplied conversation state.',
    '</environment_instructions>',
  ];

  if (!sessionExists) {
    const system = systemText(prompt);
    if (system) lines.push(`<pcad_system_context>\n${system}\n</pcad_system_context>`);
  }

  const artifact = currentArtifact(prompt);
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

  const userText = latestUserText(prompt);
  const buildResult = latestBuildResult(prompt);
  const isBuildContinuation = prompt[prompt.length - 1]?.role === 'tool' && Boolean(buildResult);

  if (isBuildContinuation) {
    if (userText) {
      lines.push(`<task_context>\n${userText}\n</task_context>`);
    }
    lines.push(
      [
        '<pcad_build_result>',
        buildResult,
        '</pcad_build_result>',
        '<continuation_instruction>',
        'Continue the same CAD task from the authoritative artifact above.',
        'If another geometry revision is needed, return a corrected complete artifact.',
        'If the current artifact already satisfies the task, return the concise final message.',
        '</continuation_instruction>',
      ].join('\n'),
    );
  } else if (userText) {
    lines.push(`<user_request>\n${userText}\n</user_request>`);
  } else {
    lines.push(
      '<continuation_instruction>Continue the current pCAD task from the authoritative artifact above.</continuation_instruction>',
    );
  }

  return lines.join('\n\n');
}

export function encodeCliAgentSessionToolCallId(
  agent: AgentKind,
  sessionId: string | undefined,
): string {
  if (!sessionId) return `cli-agent-${crypto.randomUUID()}`;
  const encoded = Buffer.from(sessionId, 'utf8').toString('base64url');
  return `${SESSION_MARKER_PREFIX}.${agent}.${encoded}.${crypto.randomUUID()}`;
}

function sessionIdFromToolCallId(
  agent: AgentKind,
  toolCallId: string,
): string | undefined {
  const [prefix, encodedAgent, encodedSession] = toolCallId.split('.', 4);
  if (prefix !== SESSION_MARKER_PREFIX || encodedAgent !== agent || !encodedSession) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(encodedSession, 'base64url').toString('utf8');
    if (agent === 'opencode') return decoded.startsWith('ses') ? decoded : undefined;
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/** Recover the most recent session for the same CLI agent from pCAD history. */
export function cliAgentSessionIdFromPrompt(
  agent: AgentKind,
  prompt: LanguageModelV3Prompt,
): string | undefined {
  for (let messageIndex = prompt.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = prompt[messageIndex];
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!part || typeof part !== 'object') continue;
      const toolCallId = (part as unknown as Record<string, unknown>)['toolCallId'];
      if (typeof toolCallId !== 'string') continue;
      const sessionId = sessionIdFromToolCallId(agent, toolCallId);
      if (sessionId) return sessionId;
    }
  }
  return undefined;
}

/**
 * Build CLI arguments for a new or resumed agent session. OpenCode can resume
 * with --session. Codex uses `exec resume <thread-id>` and must not be
 * ephemeral because ephemeral Codex threads are intentionally not resumable.
 */
export function buildCliAgentArgs(
  agent: AgentKind,
  model: string,
  sessionId?: string,
): string[] {
  if (agent === 'opencode') {
    return [
      'run',
      '--format',
      'json',
      '--pure',
      '-m',
      model,
      ...(sessionId ? ['--session', sessionId] : []),
    ];
  }

  const common = [
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--json',
    ...(model === 'default' ? [] : ['-m', model]),
    '-',
  ];
  return sessionId
    ? ['exec', 'resume', sessionId, ...common]
    : ['exec', ...common];
}

/**
 * Build the final instruction sent to a CLI agent. OpenCode uses the same
 * result contract as the streaming transport; Codex keeps the equivalent
 * strict JSON envelope.
 */
export function buildCliAgentInstruction(
  agent: AgentKind,
  prompt: string,
): string {
  if (agent === 'opencode') {
    return `${prompt}\n\n${buildAgentOutputContract()}`;
  }
  return `${prompt}\n\nReturn only JSON with exactly these keys: {"code":"complete OpenSCAD source or empty string","message":"short user-facing status"}. For a CAD request, put the complete runnable OpenSCAD program in code. Do not use tools, network access, or files; work only from this conversation.`;
}

function isMissingSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /resource not found|session[^\n]*(?:not found|does not exist|unknown)|thread[^\n]*(?:not found|does not exist|unknown)|rollout[^\n]*not found/i.test(
    message,
  );
}

type AgentInvocation = {
  result: AgentResult;
  sessionId?: string;
  reused: boolean;
};

async function invokeAgent(
  agent: AgentKind,
  model: string,
  prompt: string,
  existingSessionId?: string,
  signal?: AbortSignal,
): Promise<AgentInvocation> {
  const dir = await ensureCliAgentWorkdir();
  const instruction = buildCliAgentInstruction(agent, prompt);

  const runOnce = async (sessionId?: string) => {
    const cliResult = await runCli(
      agent,
      buildCliAgentArgs(agent, model, sessionId),
      instruction,
      dir,
      signal,
    );
    const parsed =
      agent === 'opencode'
        ? parseOpenCodeCliOutput(cliResult.stdout, cliResult.stderr)
        : parseCodexCliOutput(cliResult.stdout);
    if (!parsed.text) {
      throw new Error(
        `${agent} returned no final response: ${cliResult.stderr.slice(0, 300)}`,
      );
    }
    return parsed;
  };

  let parsed: ParsedCliOutput;
  let reused = Boolean(existingSessionId);
  try {
    parsed = await runOnce(existingSessionId);
  } catch (error) {
    if (!existingSessionId || !isMissingSessionError(error)) throw error;
    logWarning(
      `${agent} session ${existingSessionId} no longer exists; starting a replacement session`,
      { functionName: 'cli-agent-session-resume' },
    );
    parsed = await runOnce();
    reused = false;
  }

  const sessionId = parsed.sessionId ?? existingSessionId;
  if (!sessionId) {
    logWarning(`${agent} CLI did not expose a resumable session ID`, {
      functionName: 'cli-agent-session-id',
    });
  }

  console.info('cli agent session', {
    agent,
    model,
    sessionId,
    reused,
  });

  return {
    result: parseAgentResult(parsed.text),
    sessionId,
    reused,
  };
}

export function cliAgentChatModel(appModelId: string): LanguageModelV3 {
  const { agent, model } = parseModelId(appModelId);
  return {
    specificationVersion: 'v3',
    provider: `${agent}-cli`,
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options: LanguageModelV3CallOptions) {
      const existingSessionId = cliAgentSessionIdFromPrompt(agent, options.prompt);
      const invocation = await invokeAgent(
        agent,
        model,
        buildPersistentCliAgentPrompt(options.prompt, Boolean(existingSessionId)),
        existingSessionId,
        options.abortSignal,
      );
      const result = invocation.result;
      const parts: LanguageModelV3StreamPart[] = [
        { type: 'stream-start', warnings: [] },
      ];
      if (result.code) {
        parts.push({
          type: 'tool-call',
          toolCallId: encodeCliAgentSessionToolCallId(
            agent,
            invocation.sessionId,
          ),
          toolName: 'build_parametric_model',
          input: JSON.stringify({
            title: 'Generated model',
            version: 'v1',
            code: result.code,
            message: result.message || 'Model generated.',
          }),
        });
      } else if (result.message) {
        const textId = 'cli-agent-text';
        parts.push(
          { type: 'text-start', id: textId },
          {
            type: 'text-delta',
            id: textId,
            delta: result.message,
          },
          { type: 'text-end', id: textId },
        );
      }
      parts.push({
        type: 'finish',
        finishReason: finishReason(result.code ? 'tool-calls' : 'stop'),
        usage: USAGE(),
      });
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
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
      const content: LanguageModelV3Content[] = [];
      let finalReason = finishReason('stop');
      let usage = USAGE();
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.type === 'tool-call') {
            content.push({
              type: 'tool-call',
              toolCallId: value.toolCallId,
              toolName: value.toolName,
              input: value.input,
            });
          }
          if (value.type === 'text-delta') {
            content.push({ type: 'text', text: value.delta });
          }
          if (value.type === 'finish') {
            finalReason = value.finishReason;
            usage = value.usage;
          }
        }
      } finally {
        reader.releaseLock();
      }
      return {
        content,
        finishReason: finalReason,
        usage,
        request: {},
        response: { modelId: appModelId },
        warnings: [],
      };
    },
  };
}
