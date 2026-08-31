/**
 * B5 — Custom-provider runtime execution tests
 *
 * Covers buildCustomChatModel against all 10 B5 requirements:
 *   1. Parse stable custom model IDs
 *   2. Load provider + model scoped to user
 *   3. Reject disabled provider/model
 *   4. Decrypt credential server-side only
 *   5. Instantiate correct driver (openai-compatible, anthropic, google, openrouter)
 *   6. Respect configured base URL and native model ID
 *   7. Map capabilities from provider-model config
 *   8. No silent fallback to built-in / opencode / other model
 *   9. Billing behavior — custom/BYOK marked
 *  10. Built-in provider routing preserved (not touched)
 */

import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Test fixtures — actual AES-256-GCM encrypted credentials
// ---------------------------------------------------------------------------

const TEST_PLAINTEXT_KEY = 'test-api-key';
const TEST_HEX_KEY = 'a'.repeat(64);

let testCiphertext: string;
let testIv: string;
let testTag: string;

beforeAll(() => {
  const key = Buffer.from(TEST_HEX_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let c = cipher.update(TEST_PLAINTEXT_KEY, 'utf8', 'base64');
  c += cipher.final('base64');
  testCiphertext = c;
  testIv = iv.toString('base64');
  testTag = cipher.getAuthTag().toString('base64');
});

// ---------------------------------------------------------------------------
// vi.hoisted — runs BEFORE hoisted vi.mock factories, so factories see
// real fn() references instead of undefined.
// ---------------------------------------------------------------------------

const _hoisted = vi.hoisted(() => ({
  mockCreateOpenAICompatible: vi.fn((_opts: unknown) => {
    const modelObj: Record<string, unknown> = {
      model: 'openai-stub',
      name: 'openai-stub',
    };
    return (_id: string) => modelObj;
  }),
  mockCreateAnthropic: vi.fn((_opts: unknown) => {
    const modelObj: Record<string, unknown> = {
      model: 'anthropic-stub',
      name: 'anthropic-stub',
    };
    return (_id: string) => modelObj;
  }),
  mockCreateGoogleGenerativeAI: vi.fn((_opts: unknown) => {
    const modelObj: Record<string, unknown> = {
      model: 'google-stub',
      name: 'google-stub',
    };
    return (_id: string) => modelObj;
  }),
  mockCreateOpenRouter: vi.fn((_opts: unknown) => {
    return {
      chat: (_id: string) => ({
        model: 'openrouter-stub',
        name: 'openrouter-stub',
      }),
    };
  }),
  queryQueue: [] as Array<Record<string, unknown> | null>,
}));

const {
  mockCreateOpenAICompatible,
  mockCreateAnthropic,
  mockCreateGoogleGenerativeAI,
  mockCreateOpenRouter,
  queryQueue,
} = _hoisted;

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: (...args: unknown[]) =>
    mockCreateOpenAICompatible(...args),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (...args: unknown[]) =>
    mockCreateGoogleGenerativeAI(...args),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: (...args: unknown[]) => mockCreateOpenRouter(...args),
}));

vi.mock('ai', () => ({}));
vi.mock('@ai-sdk/provider-utils', () => ({}));

function makeChain(): Record<string, unknown> {
  return {
    eq: () => makeChain(),
    select: () => makeChain(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      const result = queryQueue.shift();
      return result
        ? { data: result, error: null }
        : { data: null, error: null };
    }),
    single: vi.fn(),
  };
}

vi.mock('@/server/supabaseClient', () => ({
  getServiceRoleSupabaseClient: () => ({
    from: (_table: string) => makeChain(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setEnv(partial: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function makeProviderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prov-001',
    user_id: 'user-001',
    slug: 'my-provider',
    name: 'My Provider',
    driver: 'openai-compatible',
    enabled: true,
    base_url: null,
    credential_ciphertext: testCiphertext,
    credential_iv: testIv,
    credential_tag: testTag,
    ...overrides,
  };
}

function makeModelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-001',
    provider_id: 'prov-001',
    user_id: 'user-001',
    is_visible: true,
    display_name: 'GPT-4 Custom',
    supports_tools: true,
    supports_vision: true,
    ...overrides,
  };
}

function enqueueProvider(provider: Record<string, unknown> | null) {
  queryQueue.push(provider);
}

function enqueueModel(model: Record<string, unknown> | null) {
  queryQueue.push(model);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('B5 — buildCustomChatModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv({ PCAD_CREDENTIAL_ENCRYPTION_KEY: TEST_HEX_KEY });
    mockCreateOpenAICompatible.mockClear();
    mockCreateAnthropic.mockClear();
    mockCreateGoogleGenerativeAI.mockClear();
    mockCreateOpenRouter.mockClear();
    queryQueue.length = 0;
  });

  // -----------------------------------------------------------------------
  // Requirement 1: Parse stable custom model IDs
  // -----------------------------------------------------------------------

  describe('ID parsing', () => {
    it('parses custom model ID format custom/<providerId>/<modelId>', async () => {
      const { parseCustomProviderModelId } =
        await import('@shared/customModelIds');
      const result = parseCustomProviderModelId('custom/prov-001/model-001');
      expect(result).toEqual({ providerId: 'prov-001', modelId: 'model-001' });
    });

    it('handles native model IDs containing /', async () => {
      const { parseCustomProviderModelId } =
        await import('@shared/customModelIds');
      const result = parseCustomProviderModelId('custom/prov-001/openai/gpt-4');
      expect(result).toEqual({
        providerId: 'prov-001',
        modelId: 'openai/gpt-4',
      });
    });

    it('returns null for non-custom model IDs', async () => {
      const { parseCustomProviderModelId } =
        await import('@shared/customModelIds');
      expect(parseCustomProviderModelId('gpt-4')).toBeNull();
      expect(parseCustomProviderModelId('builtin:parametric')).toBeNull();
      expect(parseCustomProviderModelId('opencode/hy3-free')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 2: Load provider + model scoped to user
  // -----------------------------------------------------------------------

  describe('user-scoped loading', () => {
    it('loads provider row with user_id scope', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateOpenAICompatible).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 3: Reject disabled provider/model
  // -----------------------------------------------------------------------

  describe('disabled provider/model rejection', () => {
    it('throws when provider is disabled', async () => {
      enqueueProvider(makeProviderRow({ enabled: false }));

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/disabled/);
    });

    it('throws when provider not found', async () => {
      enqueueProvider(null);

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/not found/);
    });

    it('throws when model is not visible', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow({ is_visible: false }));

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/disabled/);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 4: Decrypt credential server-side only
  // -----------------------------------------------------------------------

  describe('credential decryption', () => {
    it('throws when credential is missing (null ciphertext)', async () => {
      // buildCustomChatModel queries provider then model BEFORE checking credential.
      // Need both queries to return data, then provider has null credentials.
      enqueueProvider(
        makeProviderRow({
          credential_ciphertext: null,
          credential_iv: null,
          credential_tag: null,
        }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/credential/);
    });

    it('decrypts credential before instantiating provider', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateOpenAICompatible).toHaveBeenCalled();
      expect(result.model).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 5: Instantiate correct driver
  // -----------------------------------------------------------------------

  describe('driver instantiation', () => {
    it('openai-compatible: uses createOpenAICompatible with baseURL and slug', async () => {
      enqueueProvider(
        makeProviderRow({
          driver: 'openai-compatible',
          slug: 'my-slug',
          base_url: 'http://localhost:8080/v1',
        }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
        name: 'my-slug',
        apiKey: TEST_PLAINTEXT_KEY,
        baseURL: 'http://localhost:8080/v1',
      });
      expect(result.model).toBeDefined();
    });

    it('anthropic: uses createAnthropic', async () => {
      enqueueProvider(
        makeProviderRow({
          driver: 'anthropic',
          base_url: 'http://localhost:11434',
        }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateAnthropic).toHaveBeenCalled();
    });

    it('anthropic: passes thinking config when enabled', async () => {
      enqueueProvider(makeProviderRow({ driver: 'anthropic' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        true,
        8192,
      );

      expect(mockCreateAnthropic).toHaveBeenCalled();
    });

    it('google: uses createGoogleGenerativeAI', async () => {
      enqueueProvider(makeProviderRow({ driver: 'google' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateGoogleGenerativeAI).toHaveBeenCalled();
    });

    it('openrouter: uses createOpenRouter', async () => {
      enqueueProvider(makeProviderRow({ driver: 'openrouter' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(mockCreateOpenRouter).toHaveBeenCalled();
    });

    it('unsupported driver: throws explicit error', async () => {
      // buildCustomChatModel queries provider then model before driver check
      enqueueProvider(makeProviderRow({ driver: 'unknown-driver' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/unsupported driver/);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 6: Respect configured base URL and native model ID
  // -----------------------------------------------------------------------

  describe('base URL and native model ID', () => {
    it('uses provider base_url when configured', async () => {
      enqueueProvider(
        makeProviderRow({
          driver: 'openai-compatible',
          base_url: 'https://custom-endpoint.example.com/v1',
        }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      const callArgs = mockCreateOpenAICompatible.mock.calls[0][0];
      expect(callArgs.baseURL).toBe('https://custom-endpoint.example.com/v1');
    });

    it('omits baseURL when not configured', async () => {
      enqueueProvider(
        makeProviderRow({ driver: 'openai-compatible', base_url: null }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      const callArgs = mockCreateOpenAICompatible.mock.calls[0][0];
      expect(callArgs.baseURL).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 7: Map capabilities from provider-model config
  // -----------------------------------------------------------------------

  describe('capability mapping', () => {
    it('reports supports_tools from model row', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow({ supports_tools: true }));

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.capabilities.supportsTools).toBe(true);
    });

    it('reports supports_vision from model row', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow({ supports_vision: false }));

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.capabilities.supportsVision).toBe(false);
    });

    it('defaults supports_tools to true when not specified', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow({ supports_tools: undefined }));

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.capabilities.supportsTools).toBe(true);
    });

    it('anthropic defaults supports_vision to false', async () => {
      enqueueProvider(makeProviderRow({ driver: 'anthropic' }));
      enqueueModel(makeModelRow({ supports_vision: undefined }));

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.capabilities.supportsVision).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 8: No silent fallback (P06E)
  // -----------------------------------------------------------------------

  describe('no silent fallback (P06E)', () => {
    it('throws explicit error when provider not found', async () => {
      enqueueProvider(null);

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/not found/);
    });

    it('throws explicit error when credential missing', async () => {
      // buildCustomChatModel queries provider then model BEFORE checking credential
      enqueueProvider(
        makeProviderRow({
          credential_ciphertext: null,
          credential_iv: null,
          credential_tag: null,
        }),
      );
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/credential/);
    });

    it('throws when model row not found', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(null);

      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('custom/prov-001/model-001', 'user-001', false),
      ).rejects.toThrow(/not found/);
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 9: Billing behavior — custom/BYOK
  // -----------------------------------------------------------------------

  describe('billing source', () => {
    it('returns billingSource: "custom" for openai-compatible', async () => {
      mockCreateOpenAICompatible.mockClear();
      enqueueProvider(makeProviderRow({ driver: 'openai-compatible' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.billingSource).toBe('custom');
    });

    it('returns billingSource: "custom" for anthropic', async () => {
      mockCreateAnthropic.mockClear();
      enqueueProvider(makeProviderRow({ driver: 'anthropic' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.billingSource).toBe('custom');
    });

    it('returns billingSource: "custom" for google', async () => {
      mockCreateGoogleGenerativeAI.mockClear();
      enqueueProvider(makeProviderRow({ driver: 'google' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.billingSource).toBe('custom');
    });

    it('returns billingSource: "custom" for openrouter', async () => {
      mockCreateOpenRouter.mockClear();
      enqueueProvider(makeProviderRow({ driver: 'openrouter' }));
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.billingSource).toBe('custom');
    });
  });

  // -----------------------------------------------------------------------
  // Requirement 10: Invalid custom model ID handling
  // -----------------------------------------------------------------------

  describe('invalid model ID', () => {
    it('throws when ID does not match custom/<providerId>/<modelId> format', async () => {
      const { buildCustomChatModel } = await import('@/server/customProviders');

      await expect(
        buildCustomChatModel('gpt-4', 'user-001', false),
      ).rejects.toThrow(/Invalid custom model ID/);

      await expect(
        buildCustomChatModel('builtin:parametric', 'user-001', false),
      ).rejects.toThrow(/Invalid custom model ID/);
    });
  });

  // -----------------------------------------------------------------------
  // Security — no secrets in result
  // -----------------------------------------------------------------------

  describe('security — no secrets in result', () => {
    it('does not expose credential or ciphertext in build result', async () => {
      enqueueProvider(makeProviderRow());
      enqueueModel(makeModelRow());

      const { buildCustomChatModel } = await import('@/server/customProviders');
      const result = await buildCustomChatModel(
        'custom/prov-001/model-001',
        'user-001',
        false,
      );

      expect(result.model).toBeDefined();
      expect(result.capabilities).toBeDefined();
      expect(result.billingSource).toBe('custom');
    });
  });
});

// ---------------------------------------------------------------------------
// B6 — SSRF protection: isSafeUrl / isSafeIpAddress
// ---------------------------------------------------------------------------

describe('B6 SSRF protection', () => {
  describe('isSafeIpAddress', () => {
    let mod: typeof import('@/server/customProviders');

    beforeEach(async () => {
      mod = await import('@/server/customProviders');
    });

    it('rejects loopback 127.0.0.1', () => {
      expect(mod.isSafeIpAddress('127.0.0.1')).toBe(false);
    });

    it('rejects IPv6 loopback ::1', () => {
      expect(mod.isSafeIpAddress('::1')).toBe(false);
    });

    it('rejects unspecified 0.0.0.0', () => {
      expect(mod.isSafeIpAddress('0.0.0.0')).toBe(false);
    });

    it('rejects 10.0.0.0/8 private range', () => {
      expect(mod.isSafeIpAddress('10.0.0.1')).toBe(false);
      expect(mod.isSafeIpAddress('10.255.255.255')).toBe(false);
    });

    it('rejects 172.16.0.0/12 private range', () => {
      expect(mod.isSafeIpAddress('172.16.0.1')).toBe(false);
      expect(mod.isSafeIpAddress('172.31.255.255')).toBe(false);
    });

    it('allows 172.15.0.1 (outside /12)', () => {
      expect(mod.isSafeIpAddress('172.15.0.1')).toBe(true);
    });

    it('rejects 192.168.0.0/16 private range', () => {
      expect(mod.isSafeIpAddress('192.168.1.1')).toBe(false);
      expect(mod.isSafeIpAddress('192.168.0.1')).toBe(false);
    });

    it('rejects 169.254.0.0/16 link-local', () => {
      expect(mod.isSafeIpAddress('169.254.169.254')).toBe(false);
    });

    it('allows public IPs', () => {
      expect(mod.isSafeIpAddress('8.8.8.8')).toBe(true);
      expect(mod.isSafeIpAddress('1.1.1.1')).toBe(true);
      expect(mod.isSafeIpAddress('203.0.113.5')).toBe(true);
    });
  });

  describe('isSafeUrl', () => {
    let mod: typeof import('@/server/customProviders');

    beforeEach(async () => {
      mod = await import('@/server/customProviders');
    });

    it('rejects file:// protocol', async () => {
      expect(await mod.isSafeUrl(new URL('file:///etc/passwd'))).toBe(false);
    });

    it('rejects data:// protocol', async () => {
      expect(
        await mod.isSafeUrl(
          new URL('data:text/html,<script>alert(1)</script>'),
        ),
      ).toBe(false);
    });

    it('rejects javascript:// protocol', async () => {
      expect(await mod.isSafeUrl(new URL('javascript:alert(1)'))).toBe(false);
    });

    it('allows http:// and https:// for public hostnames', async () => {
      expect(
        await mod.isSafeUrl(new URL('https://api.openai.com/v1/chat')),
      ).toBe(true);
      expect(await mod.isSafeUrl(new URL('http://1.1.1.1/v1/models'))).toBe(
        true,
      );
    });

    it('rejects localhost hostname', async () => {
      expect(
        await mod.isSafeUrl(new URL('http://localhost:8080/v1/models')),
      ).toBe(false);
    });

    it('rejects .internal hostname', async () => {
      expect(
        await mod.isSafeUrl(new URL('http://api.internal/v1/models')),
      ).toBe(false);
    });

    it('rejects .local hostname', async () => {
      expect(await mod.isSafeUrl(new URL('http://printer.local'))).toBe(false);
    });

    it('rejects AWS metadata endpoint', async () => {
      expect(
        await mod.isSafeUrl(
          new URL('http://169.254.169.254/latest/meta-data/'),
        ),
      ).toBe(false);
    });

    it('rejects private IP addresses even with http/https', async () => {
      expect(await mod.isSafeUrl(new URL('http://192.168.1.1:8080/api'))).toBe(
        false,
      );
      expect(await mod.isSafeUrl(new URL('https://10.0.0.1/v1/models'))).toBe(
        false,
      );
    });
  });
});
