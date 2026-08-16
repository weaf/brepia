// P02C: Server-side prompt_profiles management.
//
// Supports CRUD for user-created profiles.  The built-in (original) prompt
// profile is NOT stored in the database — it is surfaced as a synthetic
// immutable record so that settings code can treat it uniformly.
//
// NOTE: The `prompt_profiles` table does NOT have a `mode` column.
// The mode is always "fork" for user-created profiles.

import crypto from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { getServiceRoleSupabaseClient } from './supabaseClient';
import { PARAMETRIC_AGENT_PROMPT } from './aiChat';
import type {
  CreatePromptProfileInput,
  UpdatePromptProfileInput,
  PromptProfileSummaryDto,
  PromptProfileDetailDto,
} from '@shared/aiSettings';

// ---------------------------------------------------------------------------
// Built-in synthetic profile
// ---------------------------------------------------------------------------

export const BUILTIN_PROFILE_ID = 'builtin:parametric';

let _cachedBuiltinFingerprint: string | null = null;

/**
 * SHA-256 hex digest of the built-in prompt template.
 *
 * Used by settings UI to detect when the upstream prompt changes — the
 * fingerprint is deterministic for any given template text, so a mismatch
 * between the stored fingerprint and the current one indicates a new
 * upstream revision.
 */
function fingerprint(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Load the built-in prompt profile from the upstream constant.
 *
 * The template is imported from `aiChat.ts` (PARAMETRIC_AGENT_PROMPT) so
 * there is zero duplication between the chat transport and the settings API.
 * A cached fingerprint is kept to avoid recomputing on every API call.
 */
function loadBuiltinProfile(): PromptProfileDetailDto {
  if (_cachedBuiltinFingerprint === null) {
    _cachedBuiltinFingerprint = fingerprint(PARAMETRIC_AGENT_PROMPT);
  }

  return {
    id: BUILTIN_PROFILE_ID,
    userId: '',
    name: 'CADAM Original',
    description: null,
    promptTemplate: PARAMETRIC_AGENT_PROMPT,
    fingerprint: _cachedBuiltinFingerprint,
    editable: false,
    deletable: false,
    baseRevision: null,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

/**
 * Get all prompt profiles for a user (non-archived by default).
 * Prepends the synthetic built-in profile.
 */
export async function getUserPromptProfiles(
  user: User,
  includeArchived = false,
): Promise<PromptProfileSummaryDto[]> {
  const supabase = getServiceRoleSupabaseClient();

  let query = supabase
    .from('prompt_profiles')
    .select('id, user_id, name, description, archived, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load prompt profiles: ${error.message}`);
  }

  const customProfiles: PromptProfileSummaryDto[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    fingerprint: null,
    editable: true,
    deletable: true,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return [loadBuiltinProfile() as PromptProfileSummaryDto, ...customProfiles];
}

/**
 * Get a single prompt profile by ID (including the built-in profile).
 */
export async function getPromptProfile(
  userId: string,
  profileId: string,
): Promise<PromptProfileDetailDto | null> {
  if (profileId === BUILTIN_PROFILE_ID) {
    return loadBuiltinProfile();
  }

  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('prompt_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load prompt profile: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    promptTemplate: data.prompt_template,
    fingerprint: null,
    editable: true,
    deletable: true,
    baseRevision: data.base_revision,
    archived: data.archived,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new prompt profile.
 */
export async function createPromptProfile(
  user: User,
  input: CreatePromptProfileInput,
): Promise<PromptProfileDetailDto> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('prompt_profiles')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      prompt_template: input.promptTemplate,
      base_revision: input.baseRevision ?? null,
      archived: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create prompt profile: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    promptTemplate: data.prompt_template,
    fingerprint: null,
    editable: true,
    deletable: true,
    baseRevision: data.base_revision,
    archived: data.archived,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing prompt profile.
 */
export async function updatePromptProfile(
  userId: string,
  profileId: string,
  input: UpdatePromptProfileInput,
): Promise<PromptProfileDetailDto> {
  if (profileId === BUILTIN_PROFILE_ID) {
    throw new Error('Cannot update the built-in prompt profile');
  }

  const supabase = getServiceRoleSupabaseClient();

  const { data: existing } = await supabase
    .from('prompt_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (!existing) {
    throw new Error('Prompt profile not found');
  }

  const { data, error } = await supabase
    .from('prompt_profiles')
    .update({
      name: input.name,
      description: input.description ?? null,
      prompt_template: input.promptTemplate,
      base_revision: input.baseRevision ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update prompt profile: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    promptTemplate: data.prompt_template,
    fingerprint: null,
    editable: true,
    deletable: true,
    baseRevision: data.base_revision,
    archived: data.archived,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Archive (soft-delete) a prompt profile.
 */
export async function archivePromptProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  if (profileId === BUILTIN_PROFILE_ID) {
    throw new Error('Cannot archive the built-in prompt profile');
  }

  const supabase = getServiceRoleSupabaseClient();

  const { error } = await supabase
    .from('prompt_profiles')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to archive prompt profile: ${error.message}`);
  }
}

/**
 * Delete a prompt profile permanently.
 */
export async function deletePromptProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  if (profileId === BUILTIN_PROFILE_ID) {
    throw new Error('Cannot delete the built-in prompt profile');
  }

  const supabase = getServiceRoleSupabaseClient();

  const { error } = await supabase
    .from('prompt_profiles')
    .delete()
    .eq('id', profileId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete prompt profile: ${error.message}`);
  }
}
