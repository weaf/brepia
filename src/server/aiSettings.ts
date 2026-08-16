// P02B: Server-side user_ai_preferences helpers.
//
// The service layer treats a missing row as defaults rather than requiring
// a row-per-user, so `getPreferences` always returns a valid object.

import type { User } from '@supabase/supabase-js';
import { getServiceRoleSupabaseClient } from './supabaseClient';
import type { AiPreferencesDto } from '@shared/aiSettings';

const DEFAULT_PREFERENCES: Omit<AiPreferencesDto, 'userId'> = {
  hiddenModelIds: [],
  defaultPromptProfileId: null,
};

/**
 * Get (or lazily create) the preferences row for `user`.
 *
 * Returns a complete `AiPreferencesDto`. If the user had no row, one is
 * inserted on the first call with default values so that subsequent reads
 * are fast.
 */
export async function getPreferences(user: User): Promise<AiPreferencesDto> {
  const supabase = getServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load preferences: ${error.message}`);
  }

  if (data) {
    return {
      userId: data.user_id,
      hiddenModelIds: data.hidden_model_ids,
      defaultPromptProfileId: data.default_prompt_profile_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // Lazily create a default row
  const { data: inserted, error: insertErr } = await supabase
    .from('user_ai_preferences')
    .insert({ user_id: user.id })
    .select()
    .single();

  if (insertErr) {
    // Race-safe: another request may have inserted between our select and
    // insert.  Try a second select before giving up.
    const { data: retry } = await supabase
      .from('user_ai_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (retry && !insertErr.code?.includes('23505')) {
      // Unique violation is acceptable; return what exists now.
      return {
        userId: retry.user_id,
        hiddenModelIds: retry.hidden_model_ids,
        defaultPromptProfileId: retry.default_prompt_profile_id,
        createdAt: retry.created_at,
        updatedAt: retry.updated_at,
      };
    }

    // Fallback to defaults with no persisted row
    return { userId: user.id, ...DEFAULT_PREFERENCES };
  }

  return {
    userId: inserted.user_id,
    hiddenModelIds: inserted.hidden_model_ids,
    defaultPromptProfileId: inserted.default_prompt_profile_id,
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at,
  };
}

/**
 * Update hidden_model_ids for the given user.
 */
export async function updateHiddenModelIds(
  user: User,
  hiddenModelIds: string[],
): Promise<AiPreferencesDto> {
  const supabase = getServiceRoleSupabaseClient();

  // Ensure the row exists before upserting
  await ensureRowExists(supabase, user.id);

  const { data, error } = await supabase
    .from('user_ai_preferences')
    .update({
      hidden_model_ids: hiddenModelIds,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update hidden model IDs: ${error.message}`);
  }

  return {
    userId: data.user_id,
    hiddenModelIds: data.hidden_model_ids,
    defaultPromptProfileId: data.default_prompt_profile_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Set the default prompt profile reference.
 * Pass `null` to reset to built-in original.
 */
export async function setDefaultPromptProfileId(
  user: User,
  defaultPromptProfileId: string | null,
): Promise<AiPreferencesDto> {
  const supabase = getServiceRoleSupabaseClient();

  await ensureRowExists(supabase, user.id);

  const { data, error } = await supabase
    .from('user_ai_preferences')
    .update({
      default_prompt_profile_id: defaultPromptProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set default prompt profile: ${error.message}`);
  }

  return {
    userId: data.user_id,
    hiddenModelIds: data.hidden_model_ids,
    defaultPromptProfileId: data.default_prompt_profile_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Upsert a preferences row if it doesn't already exist.
 * This is cheaper than a full select-then-insert and avoids the double-read
 * pattern.
 */
async function ensureRowExists(
  supabase: ReturnType<typeof getServiceRoleSupabaseClient>,
  userId: string,
): Promise<void> {
  await supabase
    .from('user_ai_preferences')
    .upsert(
      { user_id: userId },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
}
