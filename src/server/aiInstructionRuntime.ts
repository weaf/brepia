import type { AiPreferencesDto } from '@shared/aiSettings';
import {
  renderInstructionTemplate,
  type AiInstructionKey,
  type AiRuntimeLimitKey,
} from '@shared/aiInstructionCatalog';
import {
  resolveRuntimeValue,
  type RuntimeOverrides,
} from '@shared/aiInstructionSettings';
import { getPreferencesByUserId } from './aiSettings';
import { resolveInstructionProfile } from './promptProfiles';

function configuredProfileId(
  preferences: AiPreferencesDto,
  key: AiInstructionKey,
): string | null {
  if (key === 'parametric') return preferences.defaultPromptProfileId;
  if (key === 'creative') return preferences.defaultCreativePromptProfileId;
  return preferences.instructionProfileDefaults[key] ?? null;
}

export async function resolveUserInstruction(
  userId: string,
  key: AiInstructionKey,
  values: Record<string, string | number | boolean | null | undefined> = {},
): Promise<string> {
  const preferences = await getPreferencesByUserId(userId);
  const template = await resolveInstructionProfile({
    userId,
    scope: key,
    profileId: configuredProfileId(preferences, key),
  });
  return renderInstructionTemplate(template, values);
}

export function resolveRuntimeFromPreferences(
  preferences: Pick<AiPreferencesDto, 'runtimeOverrides'>,
  key: AiRuntimeLimitKey,
): number | string {
  return resolveRuntimeValue(
    preferences.runtimeOverrides as RuntimeOverrides,
    key,
  );
}

export async function resolveUserRuntimeValue(
  userId: string,
  key: AiRuntimeLimitKey,
): Promise<number | string> {
  const preferences = await getPreferencesByUserId(userId);
  return resolveRuntimeFromPreferences(preferences, key);
}

export async function resolveUserRuntimeNumber(
  userId: string,
  key: AiRuntimeLimitKey,
): Promise<number> {
  const value = await resolveUserRuntimeValue(userId, key);
  if (typeof value !== 'number') {
    throw new Error(`AI runtime setting ${key} is not numeric`);
  }
  return value;
}

export async function resolveUserRuntimeString(
  userId: string,
  key: AiRuntimeLimitKey,
): Promise<string> {
  const value = await resolveUserRuntimeValue(userId, key);
  if (typeof value !== 'string') {
    throw new Error(`AI runtime setting ${key} is not a string`);
  }
  return value;
}
