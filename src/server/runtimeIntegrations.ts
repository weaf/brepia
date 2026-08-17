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

// ---------------------------------------------------------------------------
// B6: SSRF defense-in-depth — validate all outbound URLs
// ---------------------------------------------------------------------------

/**
 * B6: Block dangerous protocols before any outbound fetch.
 * Runtime integrations use env-configured URLs (lower risk than user DB input)
 * but defense-in-depth requires the same protocol guard.
 */
function blockUnsafeProtocol(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// ---------------------------------------------------------------------------
// DTO types — safe, no secrets
// ---------------------------------------------------------------------------

export interface RuntimeIntegrationStatus {
  /** Stable identifier for the integration. */
  integrationId: 'opencode' | 'codex' | 'local-openai';
  /** Human-readable label. */
  label: string;
  /** Current connection status. */
  status: 'connected' | 'available' | 'unavailable' | 'not-configured';
  /** Base URL or endpoint, when applicable and safe to expose. */
  baseUrl: string | null;
  /** Number of discovered models, when applicable. */
  modelCount: number;
  /** Brief explanation of the status. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// OpenCode
// ---------------------------------------------------------------------------

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

  // Check if the URL is even reachable (no models but URL might be configured)
  try {
    // B6: SSRF guard — reject non-HTTP URLs before making network requests
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

// ---------------------------------------------------------------------------
// Codex CLI
// ---------------------------------------------------------------------------

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

/** Re-export configuredCodexModels for test access. */
export { configuredCodexModels } from './cliAgents';

// ---------------------------------------------------------------------------
// Local OpenAI compatible / llama-swap
// ---------------------------------------------------------------------------

async function discoverLocalOpenAI(): Promise<RuntimeIntegrationStatus> {
  const rawUrl = env('LOCAL_LLM_BASE_URL');
  const baseUrl = rawUrl || 'http://localhost:11434/v1';

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

  // Strip trailing slash, normalize
  const cleanUrl = baseUrl.replace(/\/+$/, '');

  // B6: SSRF guard — reject non-HTTP URLs before making network requests
  try {
    const parsed = new URL(cleanUrl);
    if (!blockUnsafeProtocol(parsed)) {
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'unavailable',
        baseUrl: cleanUrl,
        modelCount: 0,
        explanation: 'LOCAL_LLM_BASE_URL rejected by SSRF protection',
      };
    }
  } catch {
    // Invalid URL — fall through to unavailable
    return {
      integrationId: 'local-openai',
      label: 'Local OpenAI / llama-swap',
      status: 'unavailable',
      baseUrl: cleanUrl,
      modelCount: 0,
      explanation: 'LOCAL_LLM_BASE_URL is not a valid URL',
    };
  }

  // Probe the endpoint to determine availability
  try {
    // OpenAI-compatible /v1/models endpoint
    const res = await fetch(`${cleanUrl}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const modelCount = Array.isArray(data?.data) ? data.data.length : 0;
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'connected',
        baseUrl: cleanUrl,
        modelCount,
        explanation: `Local OpenAI-compatible server running with ${modelCount} model${modelCount === 1 ? '' : 's'}`,
      };
    }
  } catch {
    // Probe failed — server might be running but not on standard endpoint
  }

  // Try a bare root probe (llama-swap uses /)
  try {
    const res = await fetch(cleanUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return {
        integrationId: 'local-openai',
        label: 'Local OpenAI / llama-swap',
        status: 'available',
        baseUrl: cleanUrl,
        modelCount: 0,
        explanation: 'Local runtime responds but /v1/models not reachable',
      };
    }
  } catch {
    // Unreachable
  }

  return {
    integrationId: 'local-openai',
    label: 'Local OpenAI / llama-swap',
    status: 'unavailable',
    baseUrl: cleanUrl,
    modelCount: 0,
    explanation: 'Local runtime endpoint not responding',
  };
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Discover all runtime integrations and return their status DTOs.
 *
 * Each integration is discovered independently — a failure in one
 * does not affect the others.
 */
export async function discoverRuntimeIntegrations(): Promise<
  RuntimeIntegrationStatus[]
> {
  const results = await Promise.allSettled([
    discoverOpenCode(),
    discoverCodex(),
    discoverLocalOpenAI(),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<RuntimeIntegrationStatus> => {
      if (r.status === 'rejected') {
        // Log silently — a single integration failure must not block others
      }
      return true;
    })
    .map((r) => r.value);
}
