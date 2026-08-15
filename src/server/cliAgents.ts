/**
 * OpenCode and Codex are coding agents, not native AI SDK providers.  This
 * adapter runs either CLI in an empty temporary directory and turns its final
 * OpenSCAD answer into pCAD's existing build_parametric_model tool call.
 *
 * The HTTP response is still an AI SDK stream, but the agent invocation itself
 * is deliberately non-streaming.  pCAD needs the complete SCAD program before
 * it can compile and preview it, so token-by-token agent output has no product
 * value here.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';
import { env } from './env';
import { parseAgentResult, type AgentResult } from './opencodeAgentResult';

const TIMEOUT_MS = 8 * 60_000;

const USAGE = (): LanguageModelV2Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

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

function textFromOpenCode(stdout: string): string {
  let text = '';
  for (const line of stdout.split('\n')) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        part?: { type?: string; text?: string };
      };
      if (event.type === 'text' && event.part?.type === 'text')
        text = event.part.text ?? text;
    } catch {
      // OpenCode can write informational non-JSON lines; they are not output.
    }
  }
  return text;
}

function textFromCodex(stdout: string): string {
  let text = '';
  for (const line of stdout.split('\n')) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        item?: { type?: string; text?: string };
      };
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
  return text;
}

function promptText(prompt: LanguageModelV2Prompt): string {
  const messages: string[] = [];
  for (const message of prompt) {
    const parts = Array.isArray(message.content)
      ? message.content
      : [message.content];
    const text = parts
      .flatMap((part) => {
        if (typeof part === 'string') return [part];
        if (part.type === 'text') return [part.text];
        return [];
      })
      .join('\n');
    if (text) messages.push(`${message.role}: ${text}`);
  }
  return messages.join('\n\n');
}

async function invokeAgent(
  agent: AgentKind,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const dir = await mkdtemp(join(tmpdir(), 'pcad-cli-agent-'));
  try {
    const instruction = `${prompt}\n\nReturn only JSON with exactly these keys: {"code":"complete OpenSCAD source or empty string","message":"short user-facing status"}. For a CAD request, put the complete runnable OpenSCAD program in code. Do not use tools, network access, or files; work only from this conversation.`;
    const args =
      agent === 'opencode'
        ? ['run', '--auto', '--format', 'json', '--pure', '-m', model]
        : [
            'exec',
            '--skip-git-repo-check',
            '--ephemeral',
            '--sandbox',
            'read-only',
            '--json',
            ...(model === 'default' ? [] : ['-m', model]),
            '-',
          ];
    const result = await runCli(agent, args, instruction, dir, signal);
    const text =
      agent === 'opencode'
        ? textFromOpenCode(result.stdout)
        : textFromCodex(result.stdout);
    if (!text)
      throw new Error(
        `${agent} returned no final response: ${result.stderr.slice(0, 300)}`,
      );
    return parseAgentResult(text);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function cliAgentChatModel(appModelId: string): LanguageModelV2 {
  const { agent, model } = parseModelId(appModelId);
  return {
    specificationVersion: 'v2',
    provider: `${agent}-cli`,
    modelId: appModelId,
    supportedUrls: {},
    async doStream(options: LanguageModelV2CallOptions) {
      const result = await invokeAgent(
        agent,
        model,
        promptText(options.prompt),
        options.abortSignal,
      );
      const parts: LanguageModelV2StreamPart[] = [
        { type: 'stream-start', warnings: [] },
      ];
      if (result.code) {
        parts.push({
          type: 'tool-call',
          toolCallId: `cli-agent-${crypto.randomUUID()}`,
          toolName: 'build_parametric_model',
          input: JSON.stringify({
            title: 'Generated model',
            version: 'v1',
            code: result.code,
            message: result.message || 'Model generated.',
          }),
        });
      } else if (result.message) {
        parts.push({
          type: 'text-delta',
          id: 'cli-agent-text',
          delta: result.message,
        });
      }
      parts.push({
        type: 'finish',
        finishReason: result.code ? 'tool-calls' : 'stop',
        usage: USAGE(),
      });
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      });
      return {
        stream,
        request: {},
        response: {},
        usage: USAGE(),
        abort: () => {},
      };
    },
    async doGenerate(options) {
      const result = await this.doStream(options);
      const content: LanguageModelV2Content[] = [];
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.type === 'tool-call')
            content.push({
              type: 'tool-call',
              toolCallId: value.toolCallId,
              toolName: value.toolName,
              input: value.input,
            });
          if (value.type === 'text-delta')
            content.push({ type: 'text', text: value.delta });
        }
      } finally {
        reader.releaseLock();
      }
      return {
        content,
        finishReason: content.some((part) => part.type === 'tool-call')
          ? 'tool-calls'
          : 'stop',
        usage: USAGE(),
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: {},
        response: { modelId: appModelId },
        warnings: [],
      };
    },
  };
}
