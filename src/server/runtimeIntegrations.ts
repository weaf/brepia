/**
 * Runtime integrations discovery.
 *
 * Reads status from existing pCAD runtime configuration without exposing
 * secrets, API keys, or raw configuration objects.
 *
 * Integrations:
 * - OpenCode — uses existing opencodeApiUrl() and opencodeModels()
 * - Codex CLI — checks executable availability, counts configured models
 * - Local OpenAI / llama-swap — checks LOCAL_LLM_BASE_URL config, probes health
 *
 * B6: SSRF defense-in-depth — all outbound fetch calls use the same
 * protocol/IP validation as testProvider to prevent any runtime integration
 * from being abused to reach internal services, even when the URL comes
 * from environment configuration rather than user input.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from './env';
import { opencodeApiUrl, opencodeModels } from './opencode';
import { configuredCodexModels } from './cliAgents';

const execFileP = promisify(execFile);

function blockUnsafeProtocol(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export interface RuntimeIntegrationStatus {
  integrationId: 'opencode' | 'codex' | 'local-openai';
  label: string;
  status: 'connected' | 'available' | 'unavailable' | 'not-configured';
  baseUrl: string | null;
  modelCount: number;
  explanation: string;
}

async function discoverOpenCode(): Promise<RuntimeIntegrationStatus> {
  const baseUrl = opencodeApiUrl();
  let modelCount = 0;

  try {
    const models = await opencodeModels();
    modelCount = models.length;
  } catch {
    // OpenCode server/CLI unreachable
  }

  if (modelCount > 0) {
    return {
      integrationId: 'opencode',
      label: 'OpenCode',
      status: 'connected',
      baseUrl,
      modelCount,
      explanation: `OpenCode agent runtime active with ${modelCount} model${modelCount === 1 ? '' : 's'}`,
    };
  }

  try {
    const parsed = new URL(baseUrl);
    if (!blockUnsafeProtocol(parsed)) {
      return {
        integrationId: 'opencode',
        label: 'OpenCode',
        status: 'unavailable',
        baseUrl,
        modelCount: 0,
        explanation: 'OpenCode URL rejected by SSRF protection',
      };
    }
    const res = await fetch(baseUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return {
        integrationId: 'opencode',
        label: 'OpenCode',
        status: 'available',
        baseUrl,
        modelCount: 0,
        explanation: 'OpenCode server reachable but no models discovered',
      };
    }
  } catch {
    // Unreachable
  }

  return {
    integrationId: 'opencode',
    label: 'OpenCode',
    status: 'unavailable',
    baseUrl,
    modelCount: 0,
    explanation: 'OpenCode agent runtime not responding',
  };
}

async function checkCodexAvailable(): Promise<boolean> {
  try {
    await execFileP('codex', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function discoverCodex(): Promise<RuntimeIntegrationStatus> {
  const available = await checkCodexAvailable();
  const models = configuredCodexModels();
  const modelCount = models.length;

  if (available) {
    return {
      integrationId: 'codex',
      label: 'Codex CLI',
      status: 'connected',
      baseUrl: null,
      modelCount,
      explanation: `Codex CLI available with ${modelCount} model${modelCount === 1 ? '' : 's'}`,
    };
  }

  return {
    integrationId: 'codex',
    label: 'Codex CLI',
    status: 'unavailable',
    baseUrl: null,
    modelCount,
    explanation: 'Codex CLI not found — install to enable',
  };
}

export { configuredCodexModels } from './cliAgents';

export function normalizeLocalOpenAiUrls(rawUrl: string): {
  baseUrl: string;
  modelsUrl: string;
  rootUrl: string;
} {
  const baseUrl = rawUrl.trim().replace(/\/+$/, '');
  const hasV1Suffix = /\/v1$/i.test(baseUrl);
  return {
    baseUrl,
    modelsUrl: hasV1Suffix ? `${baseUrl}/models` : `${baseUrl}/v1/models`,
    rootUrl: hasV1Suffix ? baseUrl.replace(/\/v1$/i, '') : baseUrl,
  };
}

async function discoverLocalOpenAI(): Promise<RuntimeIntegrationStatus> {
  const rawUrl = env('LOCAL_LLM_BASE_URL').trim();

  if (!rawUrl) {
    return {
      integrationId: 'local-openai',
      label: 'Local OpenAI / llama-swap',
      status: 'not-configured',
      baseUrl: null,
      modelCount: 0,
      explanation: 'LOCAL_LLM_BASE_URL not set — no local runtime configured',
    };
  }

  const { baseUrl, modelsUrl, rootUrl } = normalizeLocalOpenAiUrls(rawUrl);

  try {
    const parsed = new URL(baseUrl);
    if (!blockUnsafeProtocol(parsed)) {
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'unavailable',
        baseUrl,
        modelCount: 0,
        explanation: 'LOCAL_LLM_BASE_URL rejected by SSRF protection',
      };
    }
  } catch {
    return {
      integrationId: 'local-openai',
      label: 'Local OpenAI / llama-swap',
      status: 'unavailable',
      baseUrl,
      modelCount: 0,
      explanation: 'LOCAL_LLM_BASE_URL is not a valid URL',
    };
  }

  try {
    const res = await fetch(modelsUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const modelCount = Array.isArray(data?.data) ? data.data.length : 0;
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'connected',
        baseUrl,
        modelCount,
        explanation: `Local OpenAI-compatible server running with ${modelCount} model${modelCount === 1 ? '' : 's'}`,
      };
    }
  } catch {
    // Models endpoint unavailable; fall back to a root reachability probe.
  }

  try {
    const res = await fetch(rootUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'available',
        baseUrl,
        modelCount: 0,
        explanation: 'Local runtime responds but the OpenAI /v1/models endpoint is not reachable',
      };
    }
  } catch {
    // Unreachable
  }

  return {
    integrationId: 'local-openai',
    label: 'Local OpenAI / llama-swap',
    status: 'unavailable',
    baseUrl,
    modelCount: 0,
    explanation: 'Local runtime endpoint not responding',
  };
}

export async function discoverRuntimeIntegrations(): Promise<
  RuntimeIntegrationStatus[]
> {
  const results = await Promise.allSettled([
    discoverOpenCode(),
    discoverCodex(),
    discoverLocalOpenAI(),
  ]);

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
}
