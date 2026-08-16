// P02D: Server-side ai_providers and ai_provider_models management.
//
// Handles provider CRUD, credential encryption/decryption (AES-256-GCM),
// model management, and provider testing.
//
// SECURITY: Provider credentials (API keys) are stored encrypted at rest.
// API responses only expose `hasCredential: boolean` — never the key.
// The `credential` field in CreateProviderInput is the plaintext to encrypt.
//
// NOTE: The `ai_providers` table does NOT have `preset` or `headers` columns
// yet.  These are pending migrations in P05+.

import crypto from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { getServiceRoleSupabaseClient } from './supabaseClient';
import { env } from './env';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  ProviderDetailDto,
  ProviderSummaryDto,
  ProviderModelDto,
  CreateProviderModelInput,
  UpdateProviderModelInput,
  TestProviderResultDto,
} from '@shared/aiSettings';

// ---------------------------------------------------------------------------
// Credential encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY_ENV = 'PCAD_CREDENTIAL_ENCRYPTION_KEY';
const ALGORITHM = 'aes-256-gcm';

/**
 * Get the encryption key from the environment.
 *
 * If the key is not configured but encrypted credentials exist in the DB,
 * provider operations that require decryption will fail at runtime.  The
 * startup check in P01E should log a clear error.
 */
function getEncryptionKey(): Buffer {
  const key = env(ENCRYPTION_KEY_ENV);
  if (!key) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} is not set — custom providers with encrypted credentials are unavailable.`,
    );
  }
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} must be a 256-bit (32-byte) hex key, got ${keyBuffer.length * 8} bits.`,
    );
  }
  return keyBuffer;
}

/**
 * Encrypt a plaintext credential using AES-256-GCM.
 * Returns { ciphertext, iv, tag } for DB storage.
 */
function encryptCredential(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  const tag = cipher.getAuthTag().toString('base64');

  return { ciphertext, iv: iv.toString('base64'), tag };
}

/**
 * Decrypt a stored credential using AES-256-GCM.
 *
 * Returns `null` if decryption fails (corrupted data, wrong key).
 * This is a safety measure — never throw on decryption failure because
 * the API still needs to respond (with `hasCredential: false`).
 */
function decryptCredential(
  ciphertext: string,
  iv: string,
  tag: string,
): string | null {
  try {
    const key = getEncryptionKey();
    const ivBuffer = Buffer.from(iv, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch {
    // Decryption failure: corrupted data or wrong encryption key.
    // Do NOT log the full error to avoid leaking crypto internals.
    return null;
  }
}

/**
 * Check whether a provider row has encrypted credentials.
 */
function hasStoredCred(row: {
  credential_ciphertext: string | null;
  credential_iv: string | null;
  credential_tag: string | null;
}): boolean {
  return !!(
    row.credential_ciphertext &&
    row.credential_iv &&
    row.credential_tag
  );
}

// ---------------------------------------------------------------------------
// Provider CRUD
// ---------------------------------------------------------------------------

/**
 * Get all providers for a user (summaries only — no secrets).
 */
export async function getUserProviders(
  user: User,
): Promise<ProviderSummaryDto[]> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('ai_providers')
    .select('id, user_id, slug, name, driver, enabled, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load providers: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    driver: row.driver as ProviderSummaryDto['driver'],
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single provider by ID (with credential presence check).
 * The decrypted credential is NEVER returned — only `hasCredential`.
 */
export async function getProvider(
  userId: string,
  providerId: string,
): Promise<ProviderDetailDto | null> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('id', providerId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load provider: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    slug: data.slug,
    name: data.name,
    driver: data.driver as ProviderDetailDto['driver'],
    baseUrl: data.base_url,
    hasCredential: hasStoredCred(data),
    enabled: data.enabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new provider.
 */
export async function createProvider(
  user: User,
  input: CreateProviderInput,
): Promise<ProviderDetailDto> {
  const supabase = getServiceRoleSupabaseClient();

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    slug: input.slug,
    name: input.name,
    driver: input.driver,
    enabled: true,
    base_url: input.baseUrl ?? '',
  };

  // Encrypt credential if provided
  if (input.credential) {
    const { ciphertext, iv, tag } = encryptCredential(input.credential);
    insertRow.credential_ciphertext = ciphertext;
    insertRow.credential_iv = iv;
    insertRow.credential_tag = tag;
  }

  const { data, error } = await supabase
    .from('ai_providers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertRow as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create provider: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    slug: data.slug,
    name: data.name,
    driver: data.driver as ProviderDetailDto['driver'],
    baseUrl: data.base_url,
    hasCredential: hasStoredCred(data),
    enabled: data.enabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing provider.
 *
 * Credential handling:
 * - If `credential` is provided (non-empty string), encrypt and store it.
 * - If `credential` is `null` or missing, do NOT change the existing secret.
 * - To remove a credential, use a dedicated remove endpoint.
 */
export async function updateProvider(
  userId: string,
  providerId: string,
  input: UpdateProviderInput,
): Promise<ProviderDetailDto> {
  const supabase = getServiceRoleSupabaseClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from('ai_providers')
    .select('id')
    .eq('id', providerId)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    throw new Error('Provider not found');
  }

  // Build update row — only include fields that were provided
  const updateRow: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateRow.name = input.name;
  if (input.driver !== undefined) updateRow.driver = input.driver;
  if (input.baseUrl !== undefined) updateRow.base_url = input.baseUrl;
  if (input.enabled !== undefined) updateRow.enabled = input.enabled;

  // Handle credential update: only encrypt and store if a non-empty value is given
  if (input.credential) {
    const { ciphertext, iv, tag } = encryptCredential(input.credential);
    updateRow.credential_ciphertext = ciphertext;
    updateRow.credential_iv = iv;
    updateRow.credential_tag = tag;
  }

  // Remove credential if explicitly set to null (dedicated removal)
  if (input.credential === null) {
    updateRow.credential_ciphertext = null;
    updateRow.credential_iv = null;
    updateRow.credential_tag = null;
  }

  const { data, error } = await supabase
    .from('ai_providers')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updateRow as any)
    .eq('id', providerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update provider: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    slug: data.slug,
    name: data.name,
    driver: data.driver as ProviderDetailDto['driver'],
    baseUrl: data.base_url,
    hasCredential: hasStoredCred(data),
    enabled: data.enabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a provider and cascade-delete its models.
 */
export async function deleteProvider(
  userId: string,
  providerId: string,
): Promise<void> {
  const supabase = getServiceRoleSupabaseClient();

  const { error } = await supabase
    .from('ai_providers')
    .delete()
    .eq('id', providerId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete provider: ${error.message}`);
  }
}

/**
 * Test provider connectivity.
 *
 * Sends a minimal request (e.g., GET /v1/models for OpenAI-compatible)
 * to verify the provider is reachable with the given credentials.
 *
 * SECURITY: Do NOT log the credential or Authorization header.
 */
export async function testProvider(
  userId: string,
  providerId: string | undefined,
  draftConfig?: CreateProviderInput,
): Promise<TestProviderResultDto> {
  const supabase = getServiceRoleSupabaseClient();
  const providerRow: {
    base_url: string | null;
    credential_ciphertext: string | null;
    credential_iv: string | null;
    credential_tag: string | null;
  } | null = providerId
    ? ((
        await supabase
          .from('ai_providers')
          .select(
            'base_url, credential_ciphertext, credential_iv, credential_tag',
          )
          .eq('id', providerId)
          .eq('user_id', userId)
          .maybeSingle()
      ).data ?? null)
    : null;

  // For draft testing, we use the provided config directly.
  // For existing providers, we decrypt the stored credential.
  const baseUrl = draftConfig?.baseUrl || providerRow?.base_url || '';
  const credential =
    draftConfig?.credential ??
    (providerRow && hasStoredCred(providerRow)
      ? decryptCredential(
          providerRow.credential_ciphertext!,
          providerRow.credential_iv!,
          providerRow.credential_tag!,
        )
      : null);

  const startTime = Date.now();

  try {
    const testUrl = baseUrl.replace(/\/$/, '') + '/v1/models';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (credential) {
      headers['Authorization'] = `Bearer ${credential}`;
    }

    const response = await fetch(testUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        ok: true,
        message: 'Provider responded successfully',
        latencyMs: latency,
      };
    }

    return {
      ok: false,
      message: `Provider returned ${response.status} ${response.statusText}`,
      latencyMs: latency,
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    const message =
      err instanceof Error
        ? err.message
        : 'Unknown error connecting to provider';
    return {
      ok: false,
      message: `Connection failed: ${message}`,
      latencyMs: latency,
    };
  }
}

// ---------------------------------------------------------------------------
// Provider Models CRUD
// ---------------------------------------------------------------------------

/**
 * Get all models for a provider (scoped to user via FK).
 */
export async function getProviderModels(
  providerId: string,
): Promise<ProviderModelDto[]> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('ai_provider_models')
    .select('*')
    .eq('provider_id', providerId)
    .order('is_visible', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load provider models: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    userId: row.user_id,
    modelId: row.model_id,
    displayName: row.display_name,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Create a model for a provider.
 */
export async function createProviderModel(
  providerId: string,
  userId: string,
  input: CreateProviderModelInput,
): Promise<ProviderModelDto> {
  const supabase = getServiceRoleSupabaseClient();

  // Verify the provider belongs to this user
  const { data: prov } = await supabase
    .from('ai_providers')
    .select('id')
    .eq('id', providerId)
    .eq('user_id', userId)
    .single();

  if (!prov) {
    throw new Error('Provider not found');
  }

  const { data, error } = await supabase
    .from('ai_provider_models')
    .insert({
      provider_id: providerId,
      user_id: userId,
      model_id: input.modelId,
      display_name: input.displayName,
      is_visible: input.isVisible,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create provider model: ${error.message}`);
  }

  return {
    id: data.id,
    providerId: data.provider_id,
    userId: data.user_id,
    modelId: data.model_id,
    displayName: data.display_name,
    isVisible: data.is_visible,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update a provider model.
 */
export async function updateProviderModel(
  modelId: string,
  userId: string,
  input: UpdateProviderModelInput,
): Promise<ProviderModelDto> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('ai_provider_models')
    .update({
      display_name: input.displayName,
      is_visible: input.isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq('id', modelId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update provider model: ${error.message}`);
  }

  return {
    id: data.id,
    providerId: data.provider_id,
    userId: data.user_id,
    modelId: data.model_id,
    displayName: data.display_name,
    isVisible: data.is_visible,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a provider model.
 */
export async function deleteProviderModel(
  modelId: string,
  userId: string,
): Promise<void> {
  const supabase = getServiceRoleSupabaseClient();

  const { error } = await supabase
    .from('ai_provider_models')
    .delete()
    .eq('id', modelId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete provider model: ${error.message}`);
  }
}
