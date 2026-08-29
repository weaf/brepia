// Server-side prompt_profiles management.
//
// Primary Generative and Creative templates are repository-backed Markdown
// files. Custom profiles can overlay or fully replace those shipped templates.
// The technical `builtin:*` IDs are retained for backward compatibility with
// existing conversations/tests, but there is no special Reset-to-Original
// product operation.

import crypto from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { getServiceRoleSupabaseClient } from './supabaseClient';
import { loadBundledInstruction } from '@shared/aiInstructionCatalog';
import type {
  CreatePromptProfileInput,
  UpdatePromptProfileInput,
  PromptProfileSummaryDto,
  PromptProfileDetailDto,
  PromptProfileScope,
} from '@shared/aiSettings';

export const BUILTIN_PROFILE_ID = 'builtin:parametric';
export const BUILTIN_CREATIVE_PROFILE_ID = 'builtin:creative';

type PromptProfileMode = PromptProfileDetailDto['mode'];

type PromptProfileRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  prompt_template: string;
  mode: string;
  scope?: string;
  base_revision: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

function parsePromptProfileMode(mode: string): PromptProfileMode {
  if (mode === 'overlay' || mode === 'fork') return mode;
  throw new Error(`Invalid prompt profile mode: ${mode}`);
}

function parsePromptProfileScope(scope: string | undefined): PromptProfileScope {
  if (scope === 'creative') return 'creative';
  return 'parametric';
}

function bundledPrompt(scope: PromptProfileScope): string {
  return loadBundledInstruction(scope);
}

function builtinProfileId(scope: PromptProfileScope): string {
  return scope === 'creative' ? BUILTIN_CREATIVE_PROFILE_ID : BUILTIN_PROFILE_ID;
}

const builtinFingerprintCache = new Map<PromptProfileScope, string>();

export function fingerprint(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export function loadBuiltinProfile(
  scope: PromptProfileScope = 'parametric',
): PromptProfileDetailDto {
  const prompt = bundledPrompt(scope);
  let currentFingerprint = builtinFingerprintCache.get(scope);
  if (!currentFingerprint) {
    currentFingerprint = fingerprint(prompt);
    builtinFingerprintCache.set(scope, currentFingerprint);
  }

  return {
    id: builtinProfileId(scope),
    userId: '',
    name: scope === 'creative' ? 'Creative Original' : 'CADAM Original',
    description:
      scope === 'creative'
        ? 'Bundled Creative template from the repository.'
        : 'Bundled CADAM template from the repository.',
    promptTemplate: prompt,
    mode: 'overlay',
    scope,
    fingerprint: currentFingerprint,
    editable: false,
    deletable: false,
    baseRevision: null,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function rowToDetail(row: PromptProfileRow): PromptProfileDetailDto {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    promptTemplate: row.prompt_template,
    mode: parsePromptProfileMode(row.mode),
    scope: parsePromptProfileScope(row.scope),
    fingerprint: null,
    editable: true,
    deletable: true,
    baseRevision: row.base_revision,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserPromptProfiles(
  user: User,
  includeArchived = false,
  scope: PromptProfileScope = 'parametric',
): Promise<PromptProfileSummaryDto[]> {
  const supabase = getServiceRoleSupabaseClient();

  // `scope` is introduced by the Creative prompt migration. Keep this cast
  // local until generated Supabase types are refreshed after migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('prompt_profiles') as any)
    .select(
      'id, user_id, name, description, mode, scope, base_revision, archived, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .eq('scope', scope)
    .order('created_at', { ascending: false });

  if (!includeArchived) query = query.eq('archived', false);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load prompt profiles: ${error.message}`);
  }

  const customProfiles: PromptProfileSummaryDto[] = (
    (data ?? []) as PromptProfileRow[]
  ).map((row) => {
    const detail = rowToDetail({ ...row, prompt_template: '' });
    return {
      id: detail.id,
      userId: detail.userId,
      name: detail.name,
      description: detail.description,
      mode: detail.mode,
      scope: detail.scope,
      fingerprint: null,
      editable: true,
      deletable: true,
      baseRevision: detail.baseRevision,
      archived: detail.archived,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  });

  const builtIn = loadBuiltinProfile(scope);
  return [
    {
      id: builtIn.id,
      userId: builtIn.userId,
      name: builtIn.name,
      description: builtIn.description,
      mode: builtIn.mode,
      scope: builtIn.scope,
      fingerprint: builtIn.fingerprint,
      editable: false,
      deletable: false,
      baseRevision: null,
      archived: false,
      createdAt: builtIn.createdAt,
      updatedAt: builtIn.updatedAt,
    },
    ...customProfiles,
  ];
}

export async function getPromptProfile(
  userId: string,
  profileId: string,
): Promise<PromptProfileDetailDto | null> {
  if (profileId === BUILTIN_PROFILE_ID) return loadBuiltinProfile('parametric');
  if (profileId === BUILTIN_CREATIVE_PROFILE_ID) {
    return loadBuiltinProfile('creative');
  }

  const supabase = getServiceRoleSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('prompt_profiles') as any)
    .select('*')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load prompt profile: ${error.message}`);
  }
  if (!data) return null;
  return rowToDetail(data as PromptProfileRow);
}

export async function createPromptProfile(
  user: User,
  input: CreatePromptProfileInput,
): Promise<PromptProfileDetailDto> {
  const supabase = getServiceRoleSupabaseClient();
  const mode = input.mode ?? 'overlay';
  const scope = input.scope ?? 'parametric';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('prompt_profiles') as any)
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      prompt_template: input.promptTemplate,
      mode,
      scope,
      base_revision: input.baseRevision ?? null,
      archived: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create prompt profile: ${error.message}`);
  }
  return rowToDetail(data as PromptProfileRow);
}

export async function updatePromptProfile(
  userId: string,
  profileId: string,
  input: UpdatePromptProfileInput,
): Promise<PromptProfileDetailDto> {
  if (profileId === BUILTIN_PROFILE_ID) {
    throw new Error('Cannot update the built-in prompt profile');
  }
  if (profileId === BUILTIN_CREATIVE_PROFILE_ID) {
    throw new Error('Cannot update a built-in prompt profile');
  }

  const supabase = getServiceRoleSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('prompt_profiles') as any)
    .select('id, mode')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single();

  if (!existing) throw new Error('Prompt profile not found');
  const existingMode = parsePromptProfileMode(existing.mode);
  if (existingMode === 'fork' && input.mode) {
    throw new Error('Cannot change mode of a forked profile');
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.promptTemplate !== undefined) {
    update.prompt_template = input.promptTemplate;
  }
  if (input.mode !== undefined) update.mode = input.mode;
  if (input.baseRevision !== undefined) update.base_revision = input.baseRevision;

  // Ownership was established by the lookup above. Keep the write chain in
  // the legacy shape so existing Supabase test doubles remain valid.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('prompt_profiles') as any)
    .update(update)
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update prompt profile: ${error.message}`);
  }
  return rowToDetail(data as PromptProfileRow);
}

export async function archivePromptProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  if (
    profileId === BUILTIN_PROFILE_ID ||
    profileId === BUILTIN_CREATIVE_PROFILE_ID
  ) {
    throw new Error('Cannot archive a built-in prompt profile');
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

export async function deletePromptProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  if (
    profileId === BUILTIN_PROFILE_ID ||
    profileId === BUILTIN_CREATIVE_PROFILE_ID
  ) {
    throw new Error('Cannot delete a built-in prompt profile');
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

export async function resolveConversationSystemPrompt({
  userId,
  profileId,
  scope = 'parametric',
}: {
  userId: string;
  profileId: string | null | undefined;
  scope?: PromptProfileScope;
}): Promise<string> {
  const basePrompt = bundledPrompt(scope);
  const expectedBuiltinId = builtinProfileId(scope);

  if (!profileId || profileId === expectedBuiltinId) return basePrompt;

  if (
    profileId === BUILTIN_PROFILE_ID ||
    profileId === BUILTIN_CREATIVE_PROFILE_ID
  ) {
    throw new Error(`Prompt profile ${profileId} belongs to a different mode.`);
  }

  const profile = await getPromptProfile(userId, profileId);
  if (!profile) {
    throw new Error(
      `Prompt profile ${profileId} not found for user ${userId}. This conversation may have been corrupted.`,
    );
  }
  if (profile.scope !== scope) {
    throw new Error(
      `Prompt profile ${profileId} is ${profile.scope}, not ${scope}.`,
    );
  }

  if (profile.mode === 'overlay') {
    return `${basePrompt}\n\n--- User Custom Instructions ---\n\n${profile.promptTemplate}`;
  }
  return profile.promptTemplate;
}
